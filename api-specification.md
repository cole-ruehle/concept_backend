# API Specification: HikingApp Backend

**Base URL:** `http://localhost:8000/api`

This API provides endpoints for the TrailLink hiking application, enabling urban hikers to plan transit-accessible hiking routes and manage active hikes with real-time exit strategies.

---

## API Endpoints

### POST /api/TransitRoutePlanner/planRoute

**Description:** Plan and optimize multi-modal routes combining public transportation with hiking segments.

**Requirements:**
- origin and destination are valid locations
- constraints specify valid time limits

**Effects:**
- calculates total available time, subtracts transit time, finds longest hiking route that fits, creates complete journey plan

**Request Body:**
```json
{
  "origin": "Location",
  "destination": "Trailhead", 
  "constraints": "RouteConstraints"
}
```

**Success Response Body:**
```json
{
  "route": "PlannedRoute"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/TransitRoutePlanner/getAlternativeRoutes

**Description:** Get alternative routes meeting specified criteria.

**Requirements:**
- route exists and criteria is valid ("faster", "shorter", "scenic")

**Effects:**
- returns set of alternative routes meeting the specified criteria

**Request Body:**
```json
{
  "route": "PlannedRoute",
  "criteria": "string"
}
```

**Success Response Body:**
```json
{
  "alternatives": "Set(PlannedRoute)"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/TransitRoutePlanner/updateRouteConstraints

**Description:** Update route constraints and recalculate the route.

**Requirements:**
- route exists and newConstraints are valid

**Effects:**
- recalculates route with new constraints, returns updated route or null if no valid route exists

**Request Body:**
```json
{
  "route": "PlannedRoute",
  "newConstraints": "RouteConstraints"
}
```

**Success Response Body:**
```json
{
  "updatedRoute": "PlannedRoute"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/DynamicExitPlanner/startHike

**Description:** Start a new active hike with the specified route.

**Requirements:**
- route is valid and user is not already on an active hike

**Effects:**
- creates new ActiveHike with current location set to trailhead, start time recorded

**Request Body:**
```json
{
  "route": "PlannedRoute",
  "user": "User"
}
```

**Success Response Body:**
```json
{
  "hike": "ActiveHike"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/DynamicExitPlanner/updateLocation

**Description:** Update the current location of an active hike.

**Requirements:**
- hike is active and newLocation is valid

**Effects:**
- updates hike's current location, recalculates available exit strategies based on new position

**Request Body:**
```json
{
  "hike": "ActiveHike",
  "newLocation": "Location"
}
```

**Success Response Body:**
```json
{
  "updatedHike": "ActiveHike"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/DynamicExitPlanner/getExitStrategies

**Description:** Get available exit strategies from current location.

**Requirements:**
- hike is active

**Effects:**
- returns set of possible exit strategies from current location, including transit connections and estimated arrival times

**Request Body:**
```json
{
  "hike": "ActiveHike"
}
```

**Success Response Body:**
```json
{
  "strategies": "Set(ExitStrategy)"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/DynamicExitPlanner/endHike

**Description:** End an active hike at the specified exit point.

**Requirements:**
- hike is active and exitPoint is valid

**Effects:**
- marks hike as completed, records end time and exit point, returns completed hike record

**Request Body:**
```json
{
  "hike": "ActiveHike",
  "exitPoint": "ExitPoint"
}
```

**Success Response Body:**
```json
{
  "completedHike": "CompletedHike"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/ConstraintMonitor/updateTransitSchedules

**Description:** Update transit schedule data from external sources.

**Requirements:**
- none

**Effects:**
- fetches latest transit schedule data from external sources, updates internal schedule state, returns set of updated schedules

**Request Body:**
```json
{}
```

**Success Response Body:**
```json
{
  "updatedSchedules": "Set(TransitSchedule)"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/ConstraintMonitor/checkWeatherConditions

**Description:** Check current and forecast weather conditions at a location.

**Requirements:**
- location is valid

**Effects:**
- queries weather service for current and forecast conditions at location, returns weather data with timestamps

**Request Body:**
```json
{
  "location": "Location"
}
```

**Success Response Body:**
```json
{
  "conditions": "WeatherConditions"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/ConstraintMonitor/getTrailConditions

**Description:** Get current trail conditions including status and difficulty.

**Requirements:**
- trail exists

**Effects:**
- checks trail status (open/closed), difficulty ratings, and any reported issues, returns current trail conditions

**Request Body:**
```json
{
  "trail": "Trail"
}
```

**Success Response Body:**
```json
{
  "conditions": "TrailConditions"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/ConstraintMonitor/generateAlerts

**Description:** Generate alerts for route based on current constraints.

**Requirements:**
- route exists

**Effects:**
- analyzes route against current constraints (weather, transit, trail conditions), returns set of alerts for any issues found

**Request Body:**
```json
{
  "route": "PlannedRoute"
}
```

**Success Response Body:**
```json
{
  "alerts": "Set(ConstraintAlert)"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/ExternalRoutingEngine/calculateRoute

**Description:** Calculate detailed route using external routing service.

**Requirements:**
- origin and destination are valid coordinates, mode is supported ("driving", "walking", "transit", "cycling")

**Effects:**
- queries external routing service with parameters, returns detailed route with instructions and metadata

**Request Body:**
```json
{
  "origin": "Location",
  "destination": "Location",
  "mode": "string",
  "constraints": "Map"
}
```

**Success Response Body:**
```json
{
  "result": "RoutingResult"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/ExternalRoutingEngine/getAlternativeRoutes

**Description:** Get multiple route alternatives from external routing service.

**Requirements:**
- origin and destination are valid, maxAlternatives > 0

**Effects:**
- requests multiple route options from external service, returns ranked set of alternatives

**Request Body:**
```json
{
  "origin": "Location",
  "destination": "Location", 
  "mode": "string",
  "maxAlternatives": "integer"
}
```

**Success Response Body:**
```json
{
  "results": "Set(RoutingResult)"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/ExternalRoutingEngine/updateNetworkData

**Description:** Refresh cached network data from external sources.

**Requirements:**
- none

**Effects:**
- refreshes cached network data from external sources, returns true if updates were found

**Request Body:**
```json
{}
```

**Success Response Body:**
```json
{
  "updated": "boolean"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/UserProfile/createOrUpdateProfile

**Description:** Create or update a user profile for personalization.

**Requirements:**
- userId is valid string

**Effects:**
- creates or updates user profile with preferences and capabilities

**Request Body:**
```json
{
  "userId": "string",
  "profileData": {
    "averagePace": "number",
    "maxDistance": "number", 
    "riskTolerance": "string",
    "weatherSensitivity": "string",
    "preferredDifficulty": "string",
    "hikingExperience": "string"
  }
}
```

**Success Response Body:**
```json
{
  "profileId": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/UserProfile/getProfile

**Description:** Get user profile by userId.

**Requirements:**
- userId is valid string

**Effects:**
- returns user profile data for personalization

**Request Body:**
```json
{
  "userId": "string"
}
```

**Success Response Body:**
```json
{
  "profile": "UserProfile"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/UserProfile/getPersonalizedRecommendations

**Description:** Get personalized hiking recommendations based on user profile.

**Requirements:**
- userId is valid string

**Effects:**
- returns personalized recommendations based on user profile and context

**Request Body:**
```json
{
  "userId": "string",
  "context": {
    "currentLocation": "Location",
    "timeOfDay": "string",
    "weatherConditions": "string",
    "availableTime": "number"
  }
}
```

**Success Response Body:**
```json
{
  "recommendations": {
    "recommendedDifficulty": "string",
    "recommendedDistance": "number",
    "recommendedStartTime": "string",
    "riskAssessment": "string",
    "personalizedTips": "Array<string>"
  }
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/UserProfile/submitFeedback

**Description:** Submit user feedback for learning and improvement.

**Requirements:**
- hikeId and satisfaction are provided

**Effects:**
- stores user feedback for learning algorithms

**Request Body:**
```json
{
  "hikeId": "string",
  "exitStrategyId": "string",
  "satisfaction": "number",
  "accuracy": "number",
  "helpfulness": "number",
  "comments": "string"
}
```

**Success Response Body:**
```json
{
  "feedbackId": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/DynamicExitPlanner/getPersonalizedExitStrategies

**Description:** Get personalized exit strategies based on user profile.

**Requirements:**
- activeHikeId and userId are valid

**Effects:**
- returns exit strategies personalized for the user's profile and preferences

**Request Body:**
```json
{
  "activeHikeId": "string",
  "userId": "string"
}
```

**Success Response Body:**
```json
{
  "strategies": "Array<ExitStrategy>",
  "personalizedRecommendations": "Array<string>",
  "riskAssessment": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/DynamicExitPlanner/submitExitStrategyFeedback

**Description:** Submit feedback about exit strategy effectiveness.

**Requirements:**
- activeHikeId and feedback data are provided

**Effects:**
- stores feedback for improving future recommendations

**Request Body:**
```json
{
  "activeHikeId": "string",
  "exitStrategyId": "string",
  "feedback": {
    "satisfaction": "number",
    "accuracy": "number",
    "helpfulness": "number",
    "comments": "string"
  }
}
```

**Success Response Body:**
```json
{
  "feedbackId": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/DynamicExitPlanner/getContextualGuidance

**Description:** Get contextual guidance based on current hike state and user query.

**Requirements:**
- activeHikeId and userQuery are provided

**Effects:**
- returns personalized guidance based on hike context and user profile

**Request Body:**
```json
{
  "activeHikeId": "string",
  "userQuery": "string"
}
```

**Success Response Body:**
```json
{
  "guidance": "string",
  "recommendations": "Array<string>",
  "safetyTips": "Array<string>"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/DynamicExitPlanner/analyzeUserState

**Description:** Analyze user's physical and mental state during hike.

**Requirements:**
- activeHikeId and sensorData are provided

**Effects:**
- analyzes user state and provides recommendations

**Request Body:**
```json
{
  "activeHikeId": "string",
  "sensorData": {
    "heartRate": "number",
    "pace": "number",
    "energyLevel": "number",
    "perceivedExertion": "number"
  }
}
```

**Success Response Body:**
```json
{
  "physicalState": {
    "fatigue": "number",
    "energy": "number",
    "pace": "number"
  },
  "mentalState": {
    "confidence": "number",
    "stress": "number",
    "motivation": "number"
  },
  "recommendations": "Array<string>"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

## Data Types

### Location
```json
{
  "latitude": "number",
  "longitude": "number",
  "address": "string"
}
```

### Trailhead
```json
{
  "location": "Location",
  "name": "string",
  "trails": "Array<Trail>"
}
```

### RouteConstraints
```json
{
  "maxTravelTime": "number",
  "preferredDepartureTime": "string",
  "accessibilityRequirements": "Array<string>"
}
```

### PlannedRoute
```json
{
  "origin": "Location",
  "destination": "Trailhead",
  "transitSegments": "Array<TransitSegment>",
  "hikingSegments": "Array<HikingSegment>",
  "totalDuration": "number"
}
```

### ActiveHike
```json
{
  "id": "string",
  "route": "PlannedRoute",
  "currentLocation": "Location",
  "startTime": "string",
  "user": "User"
}
```

### ExitStrategy
```json
{
  "exitPoint": "ExitPoint",
  "transitRoute": "TransitSegment",
  "estimatedArrivalTime": "string"
}
```

### User
```json
{
  "id": "string",
  "name": "string",
  "preferences": "Map<string, any>"
}
```

### UserProfile
```json
{
  "id": "string",
  "userId": "string",
  "averagePace": "number",
  "maxDistance": "number",
  "riskTolerance": "string",
  "weatherSensitivity": "string",
  "preferredDifficulty": "string",
  "hikingExperience": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

### UserFeedback
```json
{
  "id": "string",
  "hikeId": "string",
  "exitStrategyId": "string",
  "satisfaction": "number",
  "accuracy": "number",
  "helpfulness": "number",
  "comments": "string",
  "createdAt": "string"
}
```

### SensorData
```json
{
  "heartRate": "number",
  "pace": "number",
  "energyLevel": "number",
  "perceivedExertion": "number"
}
```

### PhysicalState
```json
{
  "fatigue": "number",
  "energy": "number",
  "pace": "number"
}
```

### MentalState
```json
{
  "confidence": "number",
  "stress": "number",
  "motivation": "number"
}
```
