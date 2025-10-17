
### Concept 2: DynamicExitPlanner

**purpose** Provide real-time exit strategies and alternative return routes during active hikes

**principle** As users progress along a hike, the system continuously monitors their location and available exit options, suggesting optimal return routes based on current conditions and user state

**state**
- A set of ActiveHikes with UUID ID, userId, plannedRouteId, GeoJSON location, start time, last update time, and status ("active" | "ended")
- A set of ExitPoints with UUID ID, name, GeoJSON location, accessibility features, and transit stop IDs
- A set of ExitStrategies with UUID ID, activeHikeId, exitPointId, criteria, timing estimates, optional LLM scoring, and computation timestamp
- A set of CompletedHikes with UUID ID, original activeHikeId, userId, plannedRouteId, end time, exit point, and duration

**actions**
- startHike(plannedRouteId: String, userId: String, startLat: Number, startLon: Number, startIso?: String): (activeHikeId: String)
  **requires** plannedRouteId and userId are valid, coordinates are valid, user has no active hike
  **effects** creates new ActiveHike with UUID, validates no concurrent hikes for user, records start time and location
- updateLocation(activeHikeId: String, lat: Number, lon: Number, atIso?: String): (void)
  **requires** activeHikeId exists and hike is active, coordinates are valid
  **effects** updates hike's GeoJSON location, automatically recomputes exit strategies for new position, updates lastUpdateIso timestamp
- getExitStrategies(activeHikeId: String): (strategyIds: Array<String>)
  **requires** activeHikeId exists and hike is active
  **effects** returns array of exit strategy IDs ordered by LLM scoring (if available) then by ETA, strategies are automatically recomputed on location updates
- endHike(activeHikeId: String, exitPointId: String, endIso?: String): (completedHikeId: String)
  **requires** activeHikeId exists and hike is active, exitPointId exists
  **effects** creates CompletedHike record, marks ActiveHike as "ended", calculates total duration, returns completed hike ID

**implementation notes**
- Uses MongoDB collections with spatial indexing for location-based queries
- Implements complete hike lifecycle management with state validation
- Automatic strategy recomputation on location updates using spatial queries
- Optional LLM integration for exit strategy scoring with ETA-based fallback
- Conflict prevention ensures users cannot start multiple concurrent hikes
- UUID-based ID generation for better distributed system support
- Comprehensive error handling for validation, not found, conflict, and state errors
