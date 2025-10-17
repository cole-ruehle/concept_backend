### Concept 3: ConstraintMonitor

**purpose** Monitor and integrate real-time constraints that affect route feasibility and safety

**principle** Continuously gather and process data about transit schedules, weather, daylight, and trail conditions to ensure planned routes remain viable and safe

**state**
- A set of TransitSchedules with route, stop, and time information
- A set of WeatherConditions with location, forecast, and current conditions
- A set of TrailConditions with trail status, closures, and difficulty ratings
- A set of ConstraintAlerts with affected routes and recommended actions

**actions**
- updateTransitSchedules(): (updatedSchedules: Set(TransitSchedule))
  **requires** none
  **effects** fetches latest transit schedule data from external sources, updates internal schedule state, returns set of updated schedules
- checkWeatherConditions(location: Location): (conditions: WeatherConditions)
  **requires** location is valid
  **effects** queries weather service for current and forecast conditions at location, returns weather data with timestamps
- getTrailConditions(trail: Trail): (conditions: TrailConditions)
  **requires** trail exists
  **effects** checks trail status (open/closed), difficulty ratings, and any reported issues, returns current trail conditions
- generateAlerts(route: PlannedRoute): (alerts: Set(ConstraintAlert))
  **requires** route exists
  **effects** analyzes route against current constraints (weather, transit, trail conditions), returns set of alerts for any issues found
