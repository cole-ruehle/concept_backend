---
timestamp: 'Thu Oct 16 2025 20:21:43 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_202143.5c6c32ad.md]]'
content_id: 31b422de96267d7d710759d9d183d8d9d65c6a2f9e655739a89c77e0ebe6727a
---

# prompt: Implement ConstraintMonitor (minimal Deno + MongoDB + Gemini-aware)

### Concept 3: ConstraintMonitor

**purpose** Monitor and integrate real-time constraints that affect route feasibility and safety

**principle** Continuously gather and process data about transit schedules, weather, daylight, and trail conditions to ensure planned routes remain viable and safe

**state**

* A set of TransitSchedules with route, stop, and time information
* A set of WeatherConditions with location, forecast, and current conditions
* A set of TrailConditions with trail status, closures, and difficulty ratings
* A set of ConstraintAlerts with affected routes and recommended actions

**actions**

* updateTransitSchedules(): (updatedSchedules: Set(TransitSchedule))
  **requires** none
  **effects** fetches latest transit schedule data from external sources, updates internal schedule state, returns set of updated schedules
* checkWeatherConditions(location: Location): (conditions: WeatherConditions)
  **requires** location is valid
  **effects** queries weather service for current and forecast conditions at location, returns weather data with timestamps
* getTrailConditions(trail: Trail): (conditions: TrailConditions)
  **requires** trail exists
  **effects** checks trail status (open/closed), difficulty ratings, and any reported issues, returns current trail conditions
* generateAlerts(route: PlannedRoute): (alerts: Set(ConstraintAlert))
  **requires** route exists
  **effects** analyzes route against current constraints (weather, transit, trail conditions), returns set of alerts for any issues found

## Goal

Implement **ConstraintMonitor** as a single TypeScript class whose public methods follow a normalized API (ids + primitives only). Keep dependencies minimal. External data (transit, weather, trails) should be fetched via tiny provider interfaces (injectable); default implementations may use `fetch`, but tests can inject stubs.

## Platform + constraints

* **Runtime:** Deno (latest), TypeScript
* **DB:** MongoDB Atlas via `.env` (`MONGODB_URL`), DB via `DB_NAME`
* **Deps:** only `npm:mongo` and Deno std if needed. **No other packages**.
* **LLM (optional):** tiny adapter via `fetch` (no SDK), key from `.env` `GEMINI_API_KEY`.
* **API surface:** ids + primitives (strings, numbers, booleans, ISO timestamps, lat/lon). **No composite objects** in public API.
* **Modularity:** no cross-concept calls.
* **Errors:** `ValidationError`, `NotFoundError`, `ConflictError`.

## Public API normalization (ids + primitives only)

Original actions return composites; normalize to return **ids** with read helpers:

* `updateTransitSchedules(source?: string): Promise<string[] /* transitScheduleIds */>`
* `checkWeatherConditions(lat: number, lon: number): Promise<string /* weatherConditionsId */>`
* `getTrailConditions(trailId: string): Promise<string /* trailConditionsId */>`
* `generateAlerts(plannedRouteId: string): Promise<string[] /* constraintAlertIds */>`

**Query helpers (read-only)**

* `getWeatherSummary(id: string): Promise<{ id: string; atIso: string; tempC: number; precipProb: number; windKph: number }>`
* `getTrailConditionSummary(id: string): Promise<{ id: string; trailId: string; status: "open"|"closed"; difficulty: number }>`
* `getTransitScheduleHeadway(routeId: string, stopId: string, atIso?: string): Promise<number /* minutes */>`
* `getAlertSummary(id: string): Promise<{ id: string; routeId: string; severity: number; message: string }>` (optional)

## Provider interfaces (injectable, minimal)

Define tiny interfaces and default `fetch`-based implementations (kept inline). Constructor may accept partials; if not provided, use defaults.

* `TransitProvider { fetchSchedules(source?: string): Promise<Array<{ routeId: string; stopId: string; departuresIso: string[] }>> }`
* `WeatherProvider { fetch(lat: number, lon: number): Promise<{ atIso: string; tempC: number; precipProb: number; windKph: number }> }`
* `TrailProvider { fetch(trailId: string): Promise<{ trailId: string; status: "open"|"closed"; difficulty: number; issues?: string[] }> }`

## LLM adapter (optional)

* `ConstraintMonitorLLM { summarize?(text: string): Promise<string>; scoreSeverity?(text: string): Promise<number> }`
* Provide `makeGeminiLLM(apiKey: string, model="gemini-2.5-flash")` using `fetch`. Only used if injected (e.g., to summarize alerts or score severity).

## Persistence (collections & indexes)

Export constants and idempotent `ensureCollections(db)`.

* `transit_schedules`
  * `_id: string`
  * `routeId: string`, `stopId: string`
  * `departuresIso: string[]`           // ISO datetimes
  * `source?: string`, `fetchedAtIso: string`
  * **Indexes:** `routeId+stopId`, `fetchedAtIso`
* `weather_conditions`
  * `_id: string`
  * `loc: { type: "Point", coordinates: [lon, lat] }`
  * `atIso: string`, `tempC: number`, `precipProb: number`, `windKph: number`
  * **Indexes:** `2dsphere(loc)`, `atIso`
* `trail_conditions`
  * `_id: string`
  * `trailId: string` (string id)
  * `status: "open"|"closed"`, `difficulty: number`, `issues?: string[]`, `checkedAtIso: string`
  * **Indexes:** `trailId`, `checkedAtIso`
* `constraint_alerts`
  * `_id: string`
  * `plannedRouteId: string`
  * `createdAtIso: string`
  * `kinds: string[]`                   // e.g., \["weather","transit","trail","daylight"]
  * `severity: number`                  // 0..100
  * `message: string`
  * **Indexes:** `plannedRouteId`, `createdAtIso`, `severity`

## Core logic (deterministic, testable)

* **updateTransitSchedules(source?)**
  1. Call `transitProvider.fetchSchedules(source)`.
  2. Upsert per `(routeId, stopId)`; refresh `departuresIso`, set `fetchedAtIso`.
  3. Return inserted/updated `_id`s (string array).
* **checkWeatherConditions(lat, lon)**
  1. Validate lat/lon; call `weatherProvider.fetch(lat, lon)`.
  2. Insert `weather_conditions` with `2dsphere` point and metrics; return `_id`.
* **getTrailConditions(trailId)**
  1. Validate `trailId`; call `trailProvider.fetch(trailId)`.
  2. Insert `trail_conditions` entry; return `_id`.
* **generateAlerts(plannedRouteId)**
  1. Load relevant data: latest weather near route, nearest transit schedules and headways for its stops, and current trail conditions for its trails (assume downstream concept stores route doc; if not available locally, validate existence via your own collections or clearly document expectation).
  2. Compute rules:
     * Weather dangerous? (`precipProb`, `windKph`, temp extremes) → add `"weather"` kind.
     * Transit gaps (headway > threshold or last departure before ETA) → add `"transit"` kind.
     * Trail closed / difficulty exceeds policy → add `"trail"` kind.
     * Daylight window (sunset before expected return) → add `"daylight"` kind (compute via simple solar approx or stub constant in tests).
  3. Compose `message`; compute `severity` (rule-based + optional `llm.scoreSeverity`).
  4. Insert one or more `constraint_alerts`; return their ids.

> Keep heuristics deterministic (constant walking speed, simple headway calc) so tests are stable. LLM use is optional and must not be required for correctness.

## Deliverables (write code to this path)

* **Implementation:** \[/src/concepts/ConstraintMonitor.ts]
  * `export class ConstraintMonitorConcept { ... }`
  * `constructor(db: Db, providers?: { transit?: TransitProvider; weather?: WeatherProvider; trail?: TrailProvider }, llm?: ConstraintMonitorLLM)`
  * Public methods = normalized signatures
  * Private helpers: validation, upsert schedule, nearest weather by point/time, headway minutes, daylight check
  * Export `connectMongo()`, `ensureCollections()`, and collection constants

## Errors

* `ValidationError` — bad args (lat/lon, ids)
* `NotFoundError` — route or referenced ids not found (when required)
* `ConflictError` — schedule uniqueness violations (should be prevented by upsert)
* Use plain `Error` for transient fetch failures but make message clear (tests can stub providers to avoid network)

## Comments

Top-of-file comment: env vars; collections; indexes; provider pattern; optional Gemini use; normalized API (ids + primitives only).

## Output

Return only final TypeScript for `/src/concepts/ConstraintMonitor.ts`, Deno-ready.

***
