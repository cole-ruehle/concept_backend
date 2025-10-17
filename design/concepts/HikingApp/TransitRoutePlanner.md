### Concept 1: TransitRoutePlanner

**purpose** Plan and optimize multi-modal routes combining public transportation with hiking segments

**principle** Users specify a starting location, desired hiking area, and constraints; the system calculates the total available time, subtracts transit time, and finds the longest possible hiking route that fits within the remaining time, then plans the complete journey (transit → hiking → transit home)

**state**
- A set of TransitStops with ObjectId, name, GeoJSON location, and available routes
- A set of Trailheads with ObjectId, name, GeoJSON location, and connecting trail IDs
- A set of Trails with ObjectId, name, duration in minutes, and optional description
- A set of PlannedRoutes with ObjectId, origin coordinates, destination trailhead ID, transit segments, hiking segments, total/transit/hiking minutes, criteria, and embedded constraints

**actions**
- planRoute(originLat: Number, originLon: Number, destinationTrailheadId: String, maxTravelMinutes: Number, preferredDepartureIso?: String, accessibility?: Array<String>): (plannedRouteId: String)
  **requires** coordinates are valid, destinationTrailheadId is valid ObjectId, maxTravelMinutes > 0
  **effects** finds nearest transit stops, calculates transit time, determines available hiking time, selects optimal trail based on criteria, creates complete journey plan, returns planned route document ID
- getAlternativeRoutes(plannedRouteId: String, criteria: String): (alternativeRouteIds: Array<String>)
  **requires** plannedRouteId exists, criteria is valid ("faster", "shorter", "scenic")
  **effects** generates alternative route based on criteria, uses LLM for scenic classification if available, returns array of alternative route IDs or empty array if no different alternative found
- updateRouteConstraints(plannedRouteId: String, maxTravelMinutes: Number, preferredDepartureIso?: String, accessibility?: Array<String>): (newRouteId: String | null)
  **requires** plannedRouteId exists, maxTravelMinutes > 0
  **effects** recalculates route with new constraints, returns new route document ID if valid route exists, returns null if no valid route possible

**implementation notes**
- Uses MongoDB collections with spatial indexing for nearest stop/trailhead queries
- Merges RouteConstraints into PlannedRoute documents for simplified data model
- Implements criteria-based route optimization with different speed profiles for transit
- Optional LLM integration for scenic trail classification with length-based fallback
- Comprehensive constraint validation and error handling
- Automatic transit time calculation using haversine distance and configurable speed profiles
- Trail selection algorithms based on available time and optimization criteria
- Support for accessibility requirements and preferred departure times
