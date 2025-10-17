---
timestamp: 'Thu Oct 16 2025 20:17:13 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_201713.4722cac4.md]]'
content_id: 1114399e9a94f6affe80d23a50ab23807385f8f0c812c9505ff3c86f5a5fc5e4
---

# prompt: Implement DynamicExitPlanner (minimal Deno + MongoDB + Gemini-aware)

### Concept 2: DynamicExitPlanner

**purpose** Provide real-time exit strategies and alternative return routes during active hikes

**principle** As users progress along a hike, the system continuously monitors their location and available exit options, suggesting optimal return routes based on current conditions and user state

**state**

* A set of ActiveHikes with current location, start time, and planned route
* A set of ExitPoints with location, accessibility, and transit connections
* A set of ExitStrategies with recommended exit point, transit route, and estimated arrival time

**actions**

* startHike(route: PlannedRoute, user: User): (hike: ActiveHike)
  **requires** route is valid and user is not already on an active hike
  **effects** creates new ActiveHike with current location set to trailhead, start time recorded
* updateLocation(hike: ActiveHike, newLocation: Location): (updatedHike: ActiveHike)
  **requires** hike is active and newLocation is valid
  **effects** updates hike's current location, recalculates available exit strategies based on new position
* getExitStrategies(hike: ActiveHike): (strategies: Set(ExitStrategy))
  **requires** hike is active
  **effects** returns set of possible exit strategies from current location, including transit connections and estimated arrival times
* endHike(hike: ActiveHike, exitPoint: ExitPoint): (completedHike: CompletedHike)
  **requires** hike is active and exitPoint is valid
  **effects** marks hike as completed, records end time and exit point, returns completed hike record

## Goal

Implement **DynamicExitPlanner** as a single TypeScript class whose public methods EXACTLY match normalized spec actions (ids + primitives only). Keep it minimal and dependency-light. Recompute exit strategies on location updates; LLM usage is optional and injected.

## Platform + constraints

* **Runtime:** Deno (latest), TypeScript
* **DB:** MongoDB Atlas via `.env` (`MONGODB_URL`), DB via `DB_NAME`
* **Deps:** only `npm:mongo` and Deno std if needed. **No other packages**.
* **LLM:** optional adapter via `fetch` (no SDK). Read `GEMINI_API_KEY` from `.env`. Only used if injected.
* **API surface:** ids + primitives (strings, numbers, booleans, ISO dates, lat/lon). **No composite objects** in public API.
* **Modularity:** no cross-concept calls; no references to other concepts’ state.
* **Errors:** `ValidationError`, `NotFoundError`, `ConflictError`, `StateError` (invalid lifecycle ops).

## Public API normalization (ids + primitives only)

Original actions use composite types; normalize as:

* `startHike(plannedRouteId: string, userId: string, startLat: number, startLon: number, startIso?: string): Promise<string /* activeHikeId */>`
* `updateLocation(activeHikeId: string, lat: number, lon: number, atIso?: string): Promise<void>`
* `getExitStrategies(activeHikeId: string): Promise<string[] /* exitStrategyIds */>`
* `endHike(activeHikeId: string, exitPointId: string, endIso?: string): Promise<string /* completedHikeId */>`

**Query helpers (read-only, primitive-only)**

* `getActiveHikeSummary(activeHikeId: string): Promise<{ id: string; userId: string; lat: number; lon: number; startedAtIso: string; strategiesCount: number }>`
* `getExitStrategyDetail(exitStrategyId: string): Promise<{ id: string; exitPointId: string; etaMinutes: number; transitMinutes: number; onFootMinutes: number }>` (optional)

## Persistence (collections & indexes)

Export collection name constants and idempotent `ensureCollections(db)`.

* `active_hikes`
  * `_id: string`
  * `userId: string`
  * `plannedRouteId: string`
  * `loc: { type: "Point", coordinates: [lon, lat] }`
  * `startedAtIso: string`
  * `lastUpdateIso?: string`
  * `status: "active" | "ended"`
  * **Indexes:** `2dsphere(loc)`, `userId+status` (unique on userId where status="active")
* `exit_points`
  * `_id: string`, `name: string`
  * `loc: { type: "Point", coordinates: [lon, lat] }`
  * `accessibility: string[]`  // e.g., wheelchair, paved, etc.
  * `transitStopIds: string[]`
  * **Indexes:** `2dsphere(loc)`, `name` unique
* `exit_strategies`
  * `_id: string`
  * `activeHikeId: string`
  * `exitPointId: string`
  * `criteria: "fastest" | "fewest_transfers" | "safest"`  // normalized criteria
  * `onFootMinutes: number`
  * `transitMinutes: number`
  * `etaMinutes: number`
  * `scoring?: number`    // higher is better
  * `computedAtIso: string`
  * **Indexes:** `activeHikeId`, `exitPointId`
* `completed_hikes`
  * `_id: string`
  * `activeHikeId: string`
  * `userId: string`
  * `plannedRouteId: string`
  * `endedAtIso: string`
  * `exitPointId: string`
  * `durationMinutes: number`
  * **Indexes:** `userId`, `endedAtIso`

> Seed data (exit\_points) can be created in tests; no global setup required.

## Core logic (deterministic, testable)

* **startHike**: validate `plannedRouteId` & ensure the `userId` has no active hike; set `loc` to `(startLon,startLat)`; insert in `active_hikes` with `status="active"`, return id. Precompute strategies (optional) or compute lazily on first `updateLocation`.
* **updateLocation**: validate active; update `loc` + `lastUpdateIso`; recompute exit strategies:
  1. Find nearby `exit_points` using `$near` (2dsphere).
  2. For each candidate, estimate:
     * `onFootMinutes` via great-circle distance / walking speed (e.g., 4.5 km/h).
     * `transitMinutes` via simple heuristic (nearest stop proximity or fixed penalty if connected).
  3. `etaMinutes = onFootMinutes + transitMinutes`.
  4. Insert new `exit_strategies` docs (optionally delete previous strategies for this hike first).
  5. **Optional LLM**: if `llm?.scoreExit` exists, compute `scoring` to refine ranking (e.g., weigh fatigue/time/weather strings passed in).
* **getExitStrategies**: return strategy ids for the hike, ordered by `etaMinutes` ascending (or by `scoring` desc, then `etaMinutes`).
* **endHike**: validate active; ensure `exitPointId` exists; create `completed_hikes` with `endedAtIso` and `durationMinutes`; set active hike `status="ended"`.

## Deliverables (write code to this path)

* **Implementation:** \[/src/concepts/DynamicExitPlanner.ts]
  * `export class DynamicExitPlannerConcept { ... }`
  * `constructor(db: Db, llm?: DynamicExitPlannerLLM)`
  * Public methods = normalized signatures above
  * Private helpers: validation, haversineMinutes, nearestExitPoints, recomputeStrategies
  * Export `connectMongo()`, `ensureCollections()`, and collection name constants

## LLM adapter (optional, inline)

* `export interface DynamicExitPlannerLLM { scoreExit?(input: string): Promise<number>; }`
* `export function makeGeminiLLM(apiKey: string, model="gemini-2.5-flash"): DynamicExitPlannerLLM`
  * `fetch` Gemini REST; return small numeric score
  * Not used unless provided; keep adapter tiny

## Errors

* `ValidationError` — bad lat/lon, times, or ids
* `NotFoundError` — hike/exitPoint not found
* `ConflictError` — user already has an active hike
* `StateError` — updating non-active hike or ending an already ended hike

## Comments

Top-of-file comment: env vars; collections; indexes; how to wire LLM; note normalized API (no composites across boundary).

## Output

Return only final TypeScript for `/src/concepts/DynamicExitPlanner.ts`, Deno-ready.

***
