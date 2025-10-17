---
timestamp: 'Thu Oct 16 2025 20:17:13 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_201713.4722cac4.md]]'
content_id: fba3f58fd1ed777672f25784777bdc2568c43b79129555da3df009169f4d3913
---

# tests: Generate Deno tests AFTER impl for DynamicExitPlanner

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

Create Deno tests:

* **Operational Principle (happy path):**
  1. Seed 2–3 `exit_points` around a start location.
  2. `startHike(plannedRouteId, userId, lat, lon, iso)` → id.
  3. `updateLocation(id, lat2, lon2)` recalculates strategies.
  4. `getExitStrategies(id)` returns ≥1 id, ordered by ETA (or score then ETA).
  5. `endHike(id, chosenExitPointId)` returns completed id; active hike now `status="ended"`.
* **Interesting scenarios (3–5):**
  * Starting a second hike for same user → `ConflictError`.
  * Updating location on ended hike → `StateError`.
  * No exit points within radius → strategies empty (still succeeds) or `ValidationError` per your design (be explicit).
  * LLM scoring stub shifts preferred strategy (inject `llm` with `scoreExit`).
  * Out-of-range lat/lon → `ValidationError`.
* No hidden manual state—seed via inserts/helpers only.
* Print inputs/outputs for legibility.
* Target: \[/src/concepts/DynamicExitPlanner.test.ts]
* Assume `deno test -A`; add a comment showing scoped perms.

***
