
### Concept 2: DynamicExitPlanner

**purpose** Provide real-time exit strategies and alternative return routes during active hikes

**principle** As users progress along a hike, the system continuously monitors their location and available exit options, suggesting optimal return routes based on current conditions and user state

**state**
- A set of ActiveHikes with current location, start time, and planned route
- A set of ExitPoints with location, accessibility, and transit connections
- A set of ExitStrategies with recommended exit point, transit route, and estimated arrival time

**actions**
- startHike(route: PlannedRoute, user: User): (hike: ActiveHike)
  **requires** route is valid and user is not already on an active hike
  **effects** creates new ActiveHike with current location set to trailhead, start time recorded
- updateLocation(hike: ActiveHike, newLocation: Location): (updatedHike: ActiveHike)
  **requires** hike is active and newLocation is valid
  **effects** updates hike's current location, recalculates available exit strategies based on new position
- getExitStrategies(hike: ActiveHike): (strategies: Set(ExitStrategy))
  **requires** hike is active
  **effects** returns set of possible exit strategies from current location, including transit connections and estimated arrival times
- endHike(hike: ActiveHike, exitPoint: ExitPoint): (completedHike: CompletedHike)
  **requires** hike is active and exitPoint is valid
  **effects** marks hike as completed, records end time and exit point, returns completed hike record
