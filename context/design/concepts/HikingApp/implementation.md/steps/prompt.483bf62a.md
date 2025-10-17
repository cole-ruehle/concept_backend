---
timestamp: 'Thu Oct 16 2025 19:20:08 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_192008.dffa3bf2.md]]'
content_id: 483bf62a583171cc92ee32a83124b1f27ab4cf79923c41f27a0b88a75ed4c839
---

# prompt: Implement TransitRoutePlanner (minimal Deno + MongoDB + Gemini-aware)

### Concept 1: TransitRoutePlanner

**purpose** Plan and optimize multi-modal routes combining public transportation with hiking segments

**principle** Users specify a starting location, desired hiking area, and constraints; the system calculates the total available time, subtracts transit time, and finds the longest possible hiking route that fits within the remaining time, then plans the complete journey (transit → hiking → transit home)

**state**

* A set of TransitStops with location, name, and available routes
* A set of Trailheads with location, name, and connecting trails
* A set of PlannedRoutes with origin, destination, transit segments, hiking segments, and total duration
* A set of RouteConstraints with maxTravelTime, preferredDepartureTime, and accessibility requirements

**actions**

* planRoute(origin: Location, destination: Trailhead, constraints: RouteConstraints): (route: PlannedRoute)
  **requires** origin and destination are valid locations, constraints specify valid time limits
  **effects** calculates total available time, subtracts transit time, finds longest hiking route that fits, creates complete journey plan
* getAlternativeRoutes(route: PlannedRoute, criteria: String): (alternatives: Set(PlannedRoute))
  **requires** route exists and criteria is valid ("faster", "shorter", "scenic")
  **effects** returns set of alternative routes meeting the specified criteria
* updateRouteConstraints(route: PlannedRoute, newConstraints: RouteConstraints): (updatedRoute: PlannedRoute)
  **requires** route exists and newConstraints are valid
  **effects** recalculates route with new constraints, returns updated route or null if no valid route exists

## Goal

Implement **TransitRoutePlanner** as a single TypeScript class whose public methods EXACTLY match the (normalized) spec actions below. Keep it minimal and dependency-light.

## Platform + constraints

* **Runtime:** Deno (latest), TypeScript
* **DB:** MongoDB Atlas via `.env` (`MONGODB_URL`), DB name via `DB_NAME`
* **Deps:** only:
  * `npm:mongo` (official MongoDB driver)
  * Deno std (fs/assert/testing) if needed
  * **No other packages**
* **LLM (Gemini) awareness:** Provide a tiny, optional adapter interface for future heuristics (e.g., “scenic” scoring) via `fetch` (no SDK). Key in `.env` (`GEMINI_API_KEY`). **Do not** make LLM calls unless explicitly wired; keep it optional.

## Public API normalization (ids + primitives only)

The concept spec mentions composite types (Location, Trailhead, PlannedRoute, RouteConstraints). To satisfy the class rules (no composite args/returns), **flatten inputs to primitives or ids** and **return ids**. Provide query helpers to read details when needed.

Use these public signatures:

* `planRoute(originLat: number, originLon: number, destinationTrailheadId: string, maxTravelMinutes: number, preferredDepartureIso?: string, accessibility?: string[]): Promise<string /* plannedRouteId */>`
* `getAlternativeRoutes(plannedRouteId: string, criteria: "faster" | "shorter" | "scenic"): Promise<string[] /* plannedRouteIds */>`
* `updateRouteConstraints(plannedRouteId: string, maxTravelMinutes: number, preferredDepartureIso?: string, accessibility?: string[]): Promise<string | null /* updatedRouteId or null */>`

**Query helpers (read-only)**
(Allowed because they return primitives or serialized strings; no composite objects crossing the boundary.)

* `getPlannedRouteSummary(plannedRouteId: string): Promise<{ id: string; totalMinutes: number; transitMinutes: number; hikingMinutes: number; segmentsCount: number }>`
* `getTrailheadCoords(trailheadId: string): Promise<{ lat: number; lon: number }>` (optional, used in tests)

## Persistence (collections & indexes)

Define minimal collections (constants exported):

* `transit_stops`:
  * `_id: string`, `name: string`, `loc: { type: "Point", coordinates: [lon, lat] }`, `routes: string[]`
  * **Indexes:** `2dsphere(loc)`, `unique(name)`
* `trailheads`:
  * `_id: string`, `name: string`, `loc: { type: "Point", coordinates: [lon, lat] }`, `connectingTrailIds: string[]`
  * **Indexes:** `2dsphere(loc)`, `unique(name)`
* `planned_routes`:
  * `_id: string`
  * `origin: { lat: number, lon: number }` (stored internally)
  * `destinationTrailheadId: string`
  * `transitSegments: { fromStopId: string, toStopId: string, minutes: number }[]`
  * `hikingSegments: { trailId: string, minutes: number }[]`
  * `totalMinutes: number`
  * `transitMinutes: number`
  * `hikingMinutes: number`
  * `criteria: "default" | "faster" | "shorter" | "scenic"`
  * `constraints: { maxTravelMinutes: number, preferredDepartureIso?: string, accessibility?: string[] }`
  * **Indexes:** `destinationTrailheadId`, `criteria`
* `route_constraints` (optional; if you want to store reusable presets):
  * `_id: string`, `maxTravelMinutes: number`, `preferredDepartureIso?: string`, `accessibility?: string[]`

> Use a small `ensureCollections(db)` to create indexes idempotently.

## Routing logic (minimal viable approach)

* For `planRoute`:
  1. **Find nearest** feasible `TransitStops` to origin and to destination trailhead (`$near` with `2dsphere`).
  2. Compute rough **transit time** (e.g., great-circle distance / avg speed; or hop-based minutes via simple heuristic). Keep deterministic and testable.
  3. Remaining = `maxTravelMinutes - transitMinutes`. If ≤ 0 → `ValidationError` (“no time for hiking”).
  4. **Pick hiking path**: choose longest available `connectingTrailIds` chain from destination trailhead whose minutes ≤ Remaining (greedy by length).
  5. Persist a `planned_routes` doc with computed fields; return `_id` (string).
* For `getAlternativeRoutes`:
  * Re-plan from the **same** origin/destination in the stored route, adjusting heuristic by `criteria`:
    * `faster`: minimize totalMinutes (favor faster transit heuristic)
    * `shorter`: minimize hikingMinutes (favor shorter hike)
    * `scenic`: if `llm?.classify` exists, prefer trails with higher scenic labels; otherwise use a simple proxy (elevationGain if available, else longer trails)
  * Insert alternatives; return their ids.
* For `updateRouteConstraints`:
  * Re-run `planRoute` with new constraints; if no valid combination, return `null`.

## Deliverables (write code to this path)

* **Implementation:** \[/src/concepts/TransitRoutePlanner.ts]
  * `export class TransitRoutePlannerConcept { ... }`
  * `constructor(db: Db, llm?: TransitRoutePlannerLLM)`
  * Public methods = normalized signatures above
  * Private helpers: validation, nearest-stop, transit-time heuristic, hiking-selection
  * `connectMongo()` and `ensureCollections()` exported
  * Collection name constants exported

## LLM adapter (inline, optional)

* `export interface TransitRoutePlannerLLM { classify?(s: string): Promise<string>; }`
* `export function makeGeminiLLM(apiKey: string, model = "gemini-2.5-flash"): TransitRoutePlannerLLM`
  * Use `fetch` to `https://generativelanguage.googleapis.com/...` (no SDK)
  * Keep the adapter tiny; not invoked unless `criteria === "scenic"` and `llm` exists.

## Errors

* `ValidationError` — bad coordinates, negative minutes, no time window left, bad criteria
* `NotFoundError` — trailhead or planned route id not found; no nearby transit stops
* `ConflictError` — (rare) if unique constraints hit (e.g., duplicate names in seed ops)

## Comments

Top-of-file comment: env vars expected; collections; indexes; how to construct `TransitRoutePlannerConcept` with/without LLM; note that public API is normalized to ids + primitives; composites are internal only.

## Output

Return only final TypeScript for `/src/concepts/TransitRoutePlanner.ts`, Deno-ready.

***
