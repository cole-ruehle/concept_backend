
### Concept 4: ExternalRoutingEngine

**purpose** Provide accurate routing and mapping calculations using external mapping services

**principle** Delegates complex routing calculations to specialized external services (like Valhalla, OpenRouteService, or Google Maps API) that can handle detailed network analysis, turn-by-turn directions, and real-time traffic data

**state**
- A set of RoutingRequests with origin, destination, mode, and constraints
- A set of RoutingResults with detailed paths, distances, durations, and turn-by-turn instructions
- A set of NetworkData with road networks, transit networks, and trail networks

**actions**
- calculateRoute(origin: Location, destination: Location, mode: String, constraints: Map): (result: RoutingResult)
  **requires** origin and destination are valid coordinates, mode is supported ("driving", "walking", "transit", "cycling")
  **effects** queries external routing service with parameters, returns detailed route with instructions and metadata
- getAlternativeRoutes(origin: Location, destination: Location, mode: String, maxAlternatives: Integer): (results: Set(RoutingResult))
  **requires** origin and destination are valid, maxAlternatives > 0
  **effects** requests multiple route options from external service, returns ranked set of alternatives
- updateNetworkData(): (updated: Boolean)
  **requires** none
  **effects** refreshes cached network data from external sources, returns true if updates were found

**notes**
This concept represents integration with external mapping services rather than building routing capabilities from scratch. Services like Valhalla, OpenRouteService, or commercial APIs provide the underlying routing engine that powers the transit and hiking route calculations.
