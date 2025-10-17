### Concept 1: TransitRoutePlanner

**purpose** Plan and optimize multi-modal routes combining public transportation with hiking segments

**principle** Users specify a starting location, desired hiking area, and constraints; the system calculates the total available time, subtracts transit time, and finds the longest possible hiking route that fits within the remaining time, then plans the complete journey (transit → hiking → transit home)

**state**
- A set of TransitStops with location, name, and available routes
- A set of Trailheads with location, name, and connecting trails  
- A set of PlannedRoutes with origin, destination, transit segments, hiking segments, and total duration
- A set of RouteConstraints with maxTravelTime, preferredDepartureTime, and accessibility requirements

**actions**
- planRoute(origin: Location, destination: Trailhead, constraints: RouteConstraints): (route: PlannedRoute)
  **requires** origin and destination are valid locations, constraints specify valid time limits
  **effects** calculates total available time, subtracts transit time, finds longest hiking route that fits, creates complete journey plan
- getAlternativeRoutes(route: PlannedRoute, criteria: String): (alternatives: Set(PlannedRoute))
  **requires** route exists and criteria is valid ("faster", "shorter", "scenic")
  **effects** returns set of alternative routes meeting the specified criteria
- updateRouteConstraints(route: PlannedRoute, newConstraints: RouteConstraints): (updatedRoute: PlannedRoute)
  **requires** route exists and newConstraints are valid
  **effects** recalculates route with new constraints, returns updated route or null if no valid route exists
