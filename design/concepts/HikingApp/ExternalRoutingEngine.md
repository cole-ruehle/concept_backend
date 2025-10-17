
### Concept 4: ExternalRoutingEngine

**purpose** Provide accurate routing and mapping calculations using external mapping services

**principle** Delegates complex routing calculations to specialized external services (like Valhalla, OpenRouteService, or Google Maps API) that can handle detailed network analysis, turn-by-turn directions, and real-time traffic data

**state**
- A set of RoutingRequests with ObjectId, origin coordinates, destination coordinates, mode, constraints, and creation timestamp
- A set of RoutingResults with ObjectId, requestId link, mode, distance, duration, instructions, polyline/GeoJSON, raw provider response, and creation timestamp
- A set of NetworkData with ObjectId, source identifier, data payload, last update timestamp, and data hash for change detection

**actions**
- calculateRoute(originLat: Number, originLon: Number, destLat: Number, destLon: Number, mode: String, constraintsJson?: String): (routingResultId: String)
  **requires** coordinates are valid (-90 to 90, -180 to 180), mode is supported ("driving", "walking", "transit", "cycling")
  **effects** delegates to getAlternativeRoutes with maxAlternatives=1, stores request and result in database, returns routing result document ID
- getAlternativeRoutes(originLat: Number, originLon: Number, destLat: Number, destLon: Number, mode: String, maxAlternatives: Number, constraintsJson?: String): (routingResultIds: Array<String>)
  **requires** coordinates are valid, maxAlternatives > 0, constraintsJson is valid JSON if provided
  **effects** creates routing request document, calls external provider, stores multiple results with request linking, returns array of result document IDs
- updateNetworkData(source?: String): (updated: Boolean)
  **requires** none
  **effects** fetches network data from external source, calculates hash for change detection, performs upsert operation if data changed, returns true if updates were found

**implementation notes**
- Uses MongoDB collections with proper indexing for request-result linking
- Implements provider abstraction pattern with Valhalla as default implementation
- Factory pattern for instance creation with environment variable configuration
- Hash-based change detection for network data caching
- Comprehensive error handling for validation, not found, and external service errors
- Fallback mechanisms for polyline/GeoJSON data retrieval
- Request-result linking via ObjectId references for audit trails
- Support for multiple routing providers through injectable provider interface
