### Concept 3: ConstraintMonitor

**purpose** Monitor and integrate real-time constraints that affect route feasibility and safety

**principle** Continuously gather and process data about transit schedules, weather, daylight, and trail conditions to ensure planned routes remain viable and safe

**state**
- A set of TransitSchedules with route, stop, time information, source, and fetchedAtIso timestamp
- A set of WeatherConditions with GeoJSON location, forecast data, and atIso timestamp
- A set of TrailConditions with trail status, closures, difficulty ratings, issues, and checkedAtIso timestamp
- A set of ConstraintAlerts with affected route IDs, constraint types, severity scores, messages, and createdAtIso timestamp

**actions**
- updateTransitSchedules(source?: String): (updatedScheduleIds: Array<String>)
  **requires** none
  **effects** fetches latest transit schedule data from external sources, updates internal schedule state, returns array of newly created schedule document IDs
- checkWeatherConditions(lat: Number, lon: Number): (weatherConditionsId: String)
  **requires** lat and lon are valid coordinates (-90 to 90, -180 to 180)
  **effects** queries weather service for current and forecast conditions at location, stores data with GeoJSON location format, returns weather conditions document ID
- getTrailConditions(trailId: String): (trailConditionsId: String)
  **requires** trailId is valid string
  **effects** checks trail status (open/closed), difficulty ratings, and any reported issues, stores with timestamp, returns trail conditions document ID
- generateAlerts(plannedRouteId: String): (alertIds: Array<String>)
  **requires** plannedRouteId exists in planned_routes collection
  **effects** analyzes route against current constraints (weather, transit, trail conditions, daylight), consolidates multiple violations into single alerts, optionally uses LLM for severity scoring, returns array of alert document IDs

**implementation notes**
- Uses MongoDB collections with proper indexing for spatial queries and performance
- Integrates with external providers (TransitProvider, WeatherProvider, TrailProvider) for data fetching
- Optional LLM integration for dynamic severity scoring override
- GeoJSON format for location data enables spatial queries
- Consolidates multiple constraint violations into single alert documents
- Includes comprehensive query helpers for data retrieval
