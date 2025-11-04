
# TrailLink HikingApp Design

**Last Updated**: November 2025

## 🚨 Deprecated Concepts

The following concepts have been **deprecated** and removed from the project in favor of a simpler, more flexible architecture using LLM-based route planning:

- ❌ **TransitRoutePlanner** - Replaced by LLMRoutePlanner
- ❌ **DynamicExitPlanner** - Replaced by LLMRoutePlanner (handles exit routes via natural language)
- ❌ **ConstraintMonitor** - Removed (constraints handled by Google Maps APIs directly)
- ❌ **ExternalRoutingEngine** - Simplified to service layer (not a concept)

### Why the Change?

**Old Approach**: Multiple specialized concepts for different routing scenarios
- Complex synchronizations between concepts
- Rigid action signatures
- Hard to extend with new features

**New Approach**: Single LLMRoutePlanner concept
- Natural language interface ("find trails near Boston", "I need to exit now")
- Flexible - handles all routing scenarios through LLM interpretation
- Easy to extend - just update LLM prompts
- Simpler architecture - fewer concepts, fewer syncs

---

## Problem Statement

### Problem Domain: Urban Hiking and Outdoor Recreation

Urban hiking represents the intersection of outdoor recreation and city living, where individuals seek to experience nature while navigating the constraints of urban transportation. This domain encompasses planning hiking routes that are accessible via public transit, managing logistics for day trips, and finding ways to experience wilderness without requiring personal vehicles. My connection to this domain stems from my personal experience as an avid hiker who has spent countless hours planning routes accessible by public transportation in the Boston area, where I've discovered the significant gap between the desire for outdoor recreation and the practical challenges of accessing natural areas without a car.

### The Problem: Transit-Accessible Route Planning for Urban Hikers

Urban hikers face a significant challenge in planning hiking routes that are accessible via public transportation. Current mapping and hiking applications assume users have personal vehicles, making it extremely difficult to plan multi-modal trips that combine public transit with hiking. Users must manually piece together transit schedules, trail information, and return route planning, often spending hours researching a single hike. This creates a barrier that prevents many urban residents from accessing outdoor recreation opportunities, particularly for longer or more remote trails that would otherwise be easily accessible with a car.

### Stakeholders

- **Urban Hikers**: Individuals who want to access outdoor recreation but rely on public transportation for mobility
- **Transit Authorities**: Organizations that want to increase ridership and demonstrate the value of public transportation for recreation
- **Park Managers**: Officials who want to increase park visitation and demonstrate the accessibility of their facilities
- **Conservation Organizations**: Groups interested in promoting sustainable, low-impact access to natural areas

### Evidence and Comparables

1. **Research on Green Space Access and Health** (https://pmc.ncbi.nlm.nih.gov/articles/PMC5754026)
   - Study demonstrates that access to natural environments is associated with increased physical activity and improved mental health, supporting the value of making outdoor recreation more accessible.

2. **Public Transportation and Park Access Barriers** (https://pmc.ncbi.nlm.nih.gov/articles/PMC7659949)
   - Research highlights how limited transit routes and schedules create barriers to accessing parks and natural areas, confirming the problem exists.

3. **Trail Accessibility Research** (https://www.fs.usda.gov/rm/pubs_journals/2022/rmrs_2022_campbell_m001.pdf)
   - Federal research examines how trail accessibility and connectivity influence outdoor recreation opportunities, supporting the need for better planning tools.

4. **Reddit Community Discussions** (https://www.reddit.com/r/boston/comments/1dt3ve9/hiking_accessible_via_public_transportation/)
   - Online communities demonstrate active demand for transit-accessible hiking information, with users sharing tips and requesting better resources.

5. **AllTrails App Limitations** (https://www.alltrails.com)
   - Popular hiking app provides comprehensive trail information but lacks integration with public transportation planning, representing a significant gap in current solutions.

6. **Google Maps Transit Integration**
   - While Google Maps excels at transit planning, it doesn't integrate hiking-specific information like trail difficulty, natural area coverage, or hiking-specific logistics.

7. **Gaia GPS Offline Capabilities** (https://www.gaiagps.com)
   - Specialized GPS app provides excellent offline mapping for hiking but requires significant manual setup and doesn't address transit accessibility.

8. **Mapy.cz Offline Features** (https://mapy.com)
   - European mapping service offers offline capabilities but requires extensive manual preparation and doesn't integrate with transit planning.

## Application Pitch

### Name: TrailLink

### Motivation
TrailLink solves the challenge of planning hiking routes accessible via public transportation, enabling urban residents to discover and access outdoor recreation opportunities without requiring a personal vehicle.

### Key Features

**1. Transit-Integrated Route Planning**
TrailLink automatically calculates the most efficient combination of public transportation and hiking routes, showing users exactly how to reach trailheads and return home. This feature eliminates the hours of manual research currently required, making outdoor recreation accessible to urban residents who rely on public transit. For urban hikers, this transforms a complex multi-step planning process into a simple search, while transit authorities benefit from increased ridership to recreational destinations.

**2. Dynamic Exit Strategy Planning**
The app provides real-time suggestions for the best return routes at various points along a hike, accounting for user fatigue, weather changes, or emergencies. This feature addresses the critical safety concern of being able to exit a hike if conditions change, which is especially important for transit-dependent hikers who can't simply call for a ride. Park managers benefit from improved visitor safety, while hikers gain confidence to attempt longer or more challenging routes.

**3. Real-Time Constraint Integration**
TrailLink incorporates live data about transit schedules, daylight hours, weather conditions, and trail status to ensure planned routes are actually feasible and safe. This feature prevents users from getting stranded due to missed connections or poor planning, significantly reducing the risk associated with transit-dependent hiking. Conservation organizations benefit from better-informed visitors who are less likely to require emergency assistance.

## Current Concept Design (Active)

### Core Concepts

#### Concept 1: User
**See**: `User.md`
- Authentication and session management
- User registration, login, password management

#### Concept 2: Profile
**See**: `Profile.md`
- Public-facing user identity
- Privacy controls and discoverability
- Experience levels, preferences

#### Concept 3: UserHistory
**See**: `UserHistory.md`
- Activity tracking and social feed
- Statistics and achievements
- Popular route recommendations

#### Concept 4: LLMRoutePlanner
**See**: `LLMRoutePlanner.md`

**purpose** Enable natural language-based multi-modal route planning (transit + hiking) through LLM orchestration

**principle** Users provide natural language queries like "find hiking trails near Boston accessible by MBTA" or "I need to exit my hike now and get home". The LLM interprets intent and orchestrates Google Maps APIs to generate complete routes with transit + hiking segments.

**state**
- RouteRequests: Logged requests with query, response, timing, success/failure
- Request history per user for analytics and rate limiting

**actions**
- planRoute(userId, query, userLocation, preferences?, currentRoute?): (route, suggestions)
  - Handles new route creation from natural language
  - Handles route modifications ("add a scenic viewpoint", "exit now")
  - Uses Gemini LLM for intent detection
  - Calls Google Maps APIs for actual routing
  - Returns complete route with segments, metrics, suggestions

- getRequestHistory(userId, limit?): (requests)
- getUsageStats(userId): (stats)
- getGlobalStats(): (stats)

**Why This Approach?**
- ✅ Flexible: Natural language handles all routing scenarios
- ✅ Simple: One concept instead of 4+ specialized concepts
- ✅ Extensible: Add features by updating LLM prompts
- ✅ User-friendly: No learning rigid command structures
- ✅ Handles everything: New routes, modifications, exit strategies, all via natural language

**Example Queries**:
- "Find hiking trails near Boston accessible by MBTA"
- "I need to exit my hike now and get home" (emergency exit)
- "Add a scenic viewpoint to my current route"
- "Find a 3-hour hike with easy difficulty"

### Support Concepts (No Syncs - Internal Use)

These concepts support the core functionality but aren't directly user-facing:

- **UnifiedRouting**: Search interface for trails and locations
- **LocationSearch**: Geocoding and location lookup
- **MapVisualization**: Map tile generation
- **POISearch**: Points of interest search
- **SearchHistory**: Query tracking

### Services (Not Concepts)

These remain as service-layer components:
- **RoutePlannerOrchestrator**: Used internally by LLMRoutePlanner
- **GeminiClient**: LLM API wrapper
- **GoogleMapsClient**: Maps API wrapper
- **GeocodingService**: Address resolution
- **OSMService**: OpenStreetMap data access

---

## ~~Deprecated Concepts~~ (Removed)

The following concepts were removed in favor of the LLMRoutePlanner approach:

### ~~TransitRoutePlanner~~ ❌ REMOVED
- **Why deprecated**: LLMRoutePlanner handles all route planning scenarios
- **Replacement**: Natural language queries to LLMRoutePlanner

### ~~DynamicExitPlanner~~ ❌ REMOVED
- **Why deprecated**: LLMRoutePlanner handles exit strategies via queries like "I need to exit now"
- **Replacement**: LLMRoutePlanner with `currentRoute` parameter

### ~~ConstraintMonitor~~ ❌ REMOVED  
- **Why deprecated**: Constraints (weather, schedules) handled by Google Maps APIs directly
- **Replacement**: Google Maps API real-time data

### ~~ExternalRoutingEngine~~ ❌ REMOVED
- **Why deprecated**: Simplified to service layer instead of concept
- **Replacement**: GoogleMapsClient service + OSMService

## UI Sketches

### Sketch 1: Main Search Screen
![Main Search Screen](images/screen1.png)
*Initial route planning interface with search functionality and time constraint options. This screen demonstrates the entry point for the TransitRoutePlanner concept.*

### Sketch 2: Route Results Screen
![Route Results Screen](images/screen2.png)

*Available hiking routes with transit options, showing route summaries and selection interface. This screen demonstrates the TransitRoutePlanner concept by presenting optimized route options.*

### Sketch 3: Route Detail Screen
![Route Detail Screen](images/screen3.png)

*Detailed view of a specific route showing the "Cambridge - Middlesex 5hr Route" with pictures, map view, step-by-step directions, and similar route options. This screen demonstrates the TransitRoutePlanner concept by showing the complete journey breakdown and alternative routes.*

### Sketch 4: Active Hike Monitoring Screen  
![Active Hike Screen](images/screen4.png)

*Real-time monitoring interface during an active hike, showing current location on map, next directions, and emergency options. This screen demonstrates the DynamicExitPlanner concept with its emergency route modification capabilities and the ConstraintMonitor integration for real-time safety updates.*

## User Journey

Sarah, a graduate student living in Cambridge without a car, has been wanting to explore the Middlesex Fells Reservation but has been intimidated by the complex planning required to get there and back via public transportation. On a Saturday morning, she opens TrailLink and searches for hiking opportunities within 2 hours of her location.

The app presents her with several options, including a route to the Middlesex Fells that involves taking the Red Line to Alewife, then a bus to the trailhead, with a 4-mile loop hike and clear return instructions. Sarah selects this route and sees that the total journey will take about 3.5 hours, with 2.5 hours of actual hiking time.

As Sarah begins her hike, TrailLink's real-time monitoring shows her current location on the trail map. About halfway through, she notices dark clouds approaching and feels her energy waning. She checks the app, which immediately suggests three exit strategies: continuing to the planned endpoint (30 minutes), taking a shorter loop back to the trailhead (20 minutes), or using an emergency exit to a nearby road (10 minutes). The app shows that if she takes the emergency exit, she can catch a bus in 15 minutes that will get her home before the weather worsens.

Sarah chooses the emergency exit option and follows the app's turn-by-turn directions to the road, where she successfully catches the bus and returns home safely. The next day, she receives a notification from TrailLink asking about her experience and whether the suggested exit strategy worked well, helping improve the app's recommendations for future users.

This journey demonstrates how TrailLink transforms what would have been an impossible or dangerous situation into a manageable outdoor experience, enabling Sarah to safely enjoy nature despite not having a car and despite changing conditions during her hike.
