# Concept: LLM Route Planner

## Purpose
Enable natural language-based multi-modal route planning (transit + hiking) through LLM orchestration, allowing users to create and modify routes without rigid UI constraints.

## Principle
```
concept LLMRoutePlanner
  purpose: intelligent route planning via natural language
  
  state:
    routes: Request -> RouteResponse  // logged requests
  
  actions:
    planRoute(query: String, userLocation: Location, 
              preferences?: Preferences, currentRoute?: Route) -> RouteResponse
      // Orchestrate LLM to interpret query and execute via Google Maps APIs
```

## Operational Principle
When a user provides a natural language query with their location, the LLM analyzes the intent and generates a routing plan. For new routes, the system searches for destinations matching the query and calculates multi-modal directions. For route modifications (when `currentRoute` is provided), the LLM detects the modification type (add waypoint, exit now, adjust timing) and the backend modifies the existing route accordingly. The system returns a complete route with segments, metrics, and contextual suggestions.

## State

**Routes (logged in MongoDB)**
- `timestamp`: When request was made
- `request`: User's query, location, preferences, and optional currentRoute
- `response`: Generated route or error
- `duration_ms`: Processing time
- `success`: Boolean indicating outcome

## Actions

### planRoute
**Parameters:**
- `query`: Natural language string describing intent
- `userLocation`: Current GPS coordinates {lat, lng}
- `preferences?`: Optional routing preferences
  - `duration`: Desired trip duration (hours)
  - `difficulty`: Trail difficulty ("easy" | "moderate" | "hard")
  - `transportModes`: Array of transport types (["transit", "walking", "bicycling"])
  - `avoid`: Array of avoidance preferences (["tolls", "highways", "ferries"])
  - `accessibility`: Boolean for accessibility requirements
- `currentRoute?`: Optional existing route for modifications
  - `route_id`: Unique route identifier
  - `origin`, `destination`: Start and end locations
  - `waypoints`: Array of intermediate points
  - `metrics`: Current timing information

**Returns:** RouteResponse
- `route`: Complete route object
  - `route_id`: Unique identifier (preserved for modifications)
  - `name`: Human-readable route name
  - `metrics`: {totalMin, etaArrival}
  - `origin`, `destination`: Geographic coordinates
  - `waypoints`: Array of points with optional names
  - `segments`: Array of route segments, each containing:
    - `mode`: Transport type ("transit" | "walking" | "hiking" | "bicycling")
    - `instructions`: Natural language directions
    - `distance`: Distance in kilometers
    - `duration`: Time in minutes
- `suggestions`: Array of contextual tips

**Behavior:**
1. **Intent Detection**: LLM analyzes query to determine action type
   - `create_new`: New route from scratch
   - `modify_existing`: Modify provided currentRoute
2. **Plan Generation**: LLM creates routing plan
   - Destination identification
   - Search query generation
   - Modification type classification ("add_waypoint" | "exit_now" | "adjust_time")
3. **Execution**: Backend calls Google Maps APIs
   - Places API: Find destinations/waypoints
   - Directions API: Calculate multi-modal routes
   - Combines transit + walking/hiking segments
4. **Response Formation**: Structure data for frontend
   - Preserve route_id for modifications
   - Generate contextual suggestions
   - Calculate total time and ETA

## Implementation

**Components:**
- `RoutePlannerOrchestrator`: Core orchestration logic
  - `generateRoutePlan()`: Sends query to Gemini LLM
  - `executeRoutePlan()`: Dispatches to creation or modification
  - `createNewRoute()`: Handles new route requests
  - `modifyExistingRoute()`: Routes to specific modification handlers
  - `addWaypointToRoute()`: Inserts scenic stops mid-route
  - `createExitRoute()`: Emergency exit routing
  - `adjustRouteTiming()`: Recalculates with time constraints

- `GeminiClient`: LLM API wrapper
  - `generateJSON()`: Structured LLM responses

- `GoogleMapsClient`: Maps API wrapper
  - `textSearch()`: Find places by query
  - `nearbySearch()`: Find places by location
  - `directions()`: Multi-modal route calculation

**LLM Prompt Structure:**
```
System: You are a hiking route planner. Handle modifications to existing 
routes, identify destinations, determine transit needs, provide suggestions.

User: Query: "find hiking trails near Boston"
      Location: 42.3601, -71.0589
      Preferences: duration=3hrs, modes=[transit, walking]
      
Response: {
  action: "create_new",
  destination: "Blue Hills Reservation",
  searchQuery: "Blue Hills hiking trails Boston",
  requiresTransit: true,
  estimatedHikingDuration: 120,
  suggestions: [...]
}
```

**Key Decisions:**
1. **Stateless Design**: No route storage; frontend maintains state
2. **Natural Language**: Single string query vs. structured parameters
3. **Route ID Preservation**: Same ID when modifying (except exit routes)
4. **LLM Flexibility**: Can handle arbitrary phrasings of same intent

## Data Structures

```typescript
interface PlanRouteRequest {
  query: string;
  userLocation: Location;
  preferences?: UserPreferences;
  currentRoute?: CurrentRoute;
}

interface RouteResponse {
  route: {
    route_id: string;
    name: string;
    metrics: {
      totalMin: number;
      etaArrival: string;  // ISO 8601
    };
    origin: Location;
    destination: Location;
    waypoints: Array<Location & {name?: string}>;
    segments: RouteSegment[];
  };
  suggestions: string[];
}

interface RouteSegment {
  mode: "transit" | "walking" | "hiking" | "bicycling";
  instructions: string;
  distance: number;  // km
  duration: number;  // minutes
  waypoints?: Location[];
}
```

## Dependencies

**External Services:**
- Google Gemini API: LLM orchestration
- Google Maps Places API: Destination/waypoint search
- Google Maps Directions API: Multi-modal routing
- Google Maps Geocoding API: Address resolution

**Internal:**
- MongoDB: Request logging (stateless otherwise)

## Example Usage

### Creating New Route
```typescript
const response = await planRoute({
  query: "Find hiking trails near Boston accessible by MBTA",
  userLocation: {lat: 42.3601, lng: -71.0589},
  preferences: {
    duration: 3,
    transportModes: ["transit", "walking"]
  }
});
// Returns: Complete route with transit + hiking segments
```

### Adding Scenic Stop
```typescript
const modified = await planRoute({
  query: "add a scenic viewpoint to my route",
  userLocation: {lat: 42.3601, lng: -71.0589},
  currentRoute: {
    route_id: "route-abc123",
    origin: {lat: 42.3601, lng: -71.0589},
    destination: {lat: 42.2114, lng: -71.1089}
  }
});
// Returns: Same route_id with added waypoint
```

### Emergency Exit
```typescript
const exit = await planRoute({
  query: "I need to exit now and get home",
  userLocation: {lat: 42.2500, lng: -71.1000},  // Current GPS
  currentRoute: {
    route_id: "route-abc123",
    origin: {lat: 42.3601, lng: -71.0589},
    destination: {lat: 42.2114, lng: -71.1089}
  }
});
// Returns: New exit route from current location to home
```

## Design Rationale

**Why LLM Orchestration?**
- Flexible natural language interface
- No rigid UI constraints
- Easy feature additions through prompt updates
- Intelligent fallback handling

**Why Single Endpoint?**
- Frontend simplicity (one API call)
- Natural language covers all use cases
- Reduces API surface area

**Why Stateless?**
- Horizontal scalability
- No session management complexity
- Simple error recovery
- Logging only for analytics

**Current vs. Future:**

*Current Implementation (Simplified):*
- LLM suggests destination and modification type
- Backend directly executes Google Maps API calls
- Single-step execution

*Future Enhancement (Full Plan DSL):*
- LLM generates multi-step execution plan with operations registry
- Variable resolution ($state.*, $var)
- Conditional execution (if/unless)
- Granular operation caching
- Parallel detour testing

The simplified version covers 80% of use cases with 20% of complexity.

