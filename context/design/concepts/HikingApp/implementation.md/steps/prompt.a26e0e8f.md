---
timestamp: 'Thu Oct 16 2025 20:52:44 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_205244.0874322d.md]]'
content_id: a26e0e8f80f326f5329f13e9744cb40ca1c50eaeb1269484c9f41fed653745a3
---

# prompt: Implement ExternalRoutingEngine (minimal Deno + MongoDB + provider-injected)

### Concept 4: ExternalRoutingEngine

**purpose** Provide accurate routing and mapping calculations using external mapping services

**principle** Delegates complex routing calculations to specialized external services (like Valhalla, OpenRouteService, or Google Maps API) that can handle detailed network analysis, turn-by-turn directions, and real-time traffic data

**state**

* A set of RoutingRequests with origin, destination, mode, and constraints
* A set of RoutingResults with detailed paths, distances, durations, and turn-by-turn instructions
* A set of NetworkData with road networks, transit networks, and trail networks

**actions**

* calculateRoute(origin: Location, destination: Location, mode: String, constraints: Map): (result: RoutingResult)
  **requires** origin and destination are valid coordinates, mode is supported ("driving", "walking", "transit", "cycling")
  **effects** queries external routing service with parameters, returns detailed route with instructions and metadata
* getAlternativeRoutes(origin: Location, destination: Location, mode: String, maxAlternatives: Integer): (results: Set(RoutingResult))
  **requires** origin and destination are valid, maxAlternatives > 0
  **effects** requests multiple route options from external service, returns ranked set of alternatives
* updateNetworkData(): (updated: Boolean)
  **requires** none
  **effects** refreshes cached network data from external sources, returns true if updates were found

**notes**
This concept represents integration with external mapping services rather than building routing capabilities from scratch. Services like Valhalla, OpenRouteService, or commercial APIs provide the underlying routing engine that powers the transit and hiking route calculations.

## Goal

Implement **ExternalRoutingEngine** as a single TypeScript class that delegates routing to an **injectable provider** (Valhalla / OpenRouteService / Google, etc.). Keep deps minimal (Mongo driver only). Public API is normalized to **ids + primitives**; all composites remain internal.

## Platform + constraints

* **Runtime:** Deno (latest), TypeScript
* **DB:** MongoDB Atlas via `.env` (`MONGODB_URL`), `DB_NAME`
* **Deps:** only `npm:mongo` and Deno std if needed. **No other packages**.
* **Providers:** a tiny `RoutingProvider` interface; default impl uses `fetch` and can target Valhalla/ORS/Google by config.
* **API surface:** only ids + primitives (strings, numbers, booleans, ISO timestamps, lat/lon).
* **Modularity:** no calls to other concepts; no cross-state reads/writes.
* **Errors:** `ValidationError`, `NotFoundError`, `ExternalServiceError`, `ConflictError`.

## Public API normalization (ids + primitives only)

Original actions use composite `Location`, `RoutingResult`, etc. Normalize as:

* `calculateRoute(originLat: number, originLon: number, destLat: number, destLon: number, mode: "driving"|"walking"|"transit"|"cycling", constraintsJson?: string): Promise<string /* routingResultId */>`
* `getAlternativeRoutes(originLat: number, originLon: number, destLat: number, destLon: number, mode: "driving"|"walking"|"transit"|"cycling", maxAlternatives: number, constraintsJson?: string): Promise<string[] /* routingResultIds */>`
* `updateNetworkData(source?: string): Promise<boolean /* updated */>`

**Read helpers (primitive-only)**

* `getRoutingSummary(id: string): Promise<{ id: string; distanceMeters: number; durationMinutes: number; mode: string; createdAtIso: string }>`
* `getTurnByTurn(id: string): Promise<string[] /* instructions */>`
* (optional) `getPolyline(id: string): Promise<string /* encoded polyline or GeoJSON as string */>`

This Is the implementation for a single concept so it should be in a single file it's critical for de bugging and understanding purposes that the concept of self contained the testing, of course could be in a separate file but ensure that this is one file for the single concept
