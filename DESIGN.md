# TrailLink: LLM-Orchestrated Route Planning System

## Introduction and Motivation

This document outlines the redesigned TrailLink system for intelligent hiking route planning, using Google Maps APIs and LLM-based orchestration to enable natural language, multi-modal route planning (transit plus hiking). This design has been significantly changed from the previous implementation based on direct feedback: the old approach was unnecessarily complicated, with too many abstract concepts, unclear responsibilities, and excessive state management. The previous architecture introduced a large Plan DSL, multiple files, and an over-conceptualized flow, which in practice hindered both usability and AI-assisted implementation.

In revising the design, I deliberately focused on simplification. Key points that drove this change:

- **Legacy Complexity**: The original concept included many distinct states, operations, and variable mechanisms, which complicated both the backend logic and the LLM prompts. LLMs struggled to handle this context reliably, even before frontend development began.
- **Context Limitations**: Managing, summarizing, and fitting the entire plan or state into context windows became impractical as the design expanded. At a certain point, the complexity made implementation or even code review impossible, effectively hitting a dead end.
- **Lesson Learned**: Too much abstraction and structure can backfire when collaborating with LLMs or when context management is involved. This experience underscored the importance of designing for both technical clarity and context fit.

To that end, the system now centers on a much simpler "single flow"—that is, state changes are expressed as a series of frontend updates that can be directly powered by LLM output, without unnecessary layers of abstraction.

The project still includes some of the original files and concept notes for reference; these show how the design was improved and why the old approach was abandoned.

## Overview

TrailLink is a hiking route planning service that provides users with natural language-driven multi-modal routes, combining public transit and hiking directions with information from Google Maps APIs. A single backend endpoint receives the user query, current location, preferences, and current route state (if present), and returns an updated route object to drive frontend display.

---

## Core Design Philosophy

- **Single Endpoint**: All route-planning operations (creation, modification, exit, timing) are handled by a single endpoint. The user always describes intent naturally; the LLM handles intent parsing and orchestration.
- **LLM-Orchestrated**: The Gemini LLM interprets user intent and orchestrates the appropriate sequence of Google Maps API calls to create or update hiking routes.
- **Statelessness**: The backend does not track user sessions between requests. Each request is self-contained, and only request logs are stored for debugging and analytics.
- **Simplicity and Maintainability**: The system avoids multilayered abstractions and unnecessary files, focusing on a straightforward flow between frontend and backend.

---

## System Architecture

**Technology Stack:**
- Runtime: Deno (TypeScript)
- Web Framework: Hono
- LLM: Google Gemini API
- Maps: Google Maps API (Places, Directions, Geocoding)
- Database: MongoDB (request logging only)

**High-Level Flow:**
1. The frontend sends a natural language query and location data to the API.
2. The orchestrate server builds a prompt (with context) and sends it to the Gemini LLM.
3. The LLM decides on the action (create, modify, exit, adjust) and provides necessary details.
4. The orchestrator executes the plan using Google Maps APIs.
5. The backend returns a single route object for rendering.

---

## User Flows

### 1. Create New Route

- Example query: "Find hiking trails near me accessible by public transit"
- Steps:
  1. User submits query and location
  2. LLM action: `"create_new"`
  3. Google Places Text Search to find trailheads
  4. Google Directions API for combined transit and walk/hiking path
  5. Entire route returned

Sample response:
```json
{
  "route": {
    "route_id": "route-123",
    "name": "Blue Hills Adventure",
    "metrics": { "totalMin": 180, "etaArrival": "..." },
    "origin": { "lat": 42.3601, "lng": -71.0589 },
    "destination": { "lat": 42.2114, "lng": -71.1089 },
    "waypoints": [...],
    "segments": [
      { "mode": "transit", "instructions": "...", "distance": 12.5, "duration": 45 },
      { "mode": "hiking", "instructions": "...", "distance": 8.5, "duration": 135 }
    ]
  },
  "suggestions": ["Check transit schedules...", "..."]
}
```

### 2. Add a Scenic Stop (Modify Existing Route)

- Example query: "Add a scenic viewpoint to my route"
- Frontend includes `currentRoute` object.
- LLM action: `"modify_existing"`, type: `"add_scenic_stop"`
- Computes route midpoint, finds nearby viewpoints, recalculates route with additional waypoint.
- Returns modified route; route_id is preserved.

### 3. Exit Now (Emergency)

- Example query: "I need to exit now and get home"
- LLM action: `"modify_existing"`, type: `"exit_now"`
- Uses current GPS and route context.
- Finds nearest transit stop, provides immediate transit directions home.
- Returns new route, prefixed route_id.

### 4. Adjust Timing

- Example query: "I need to be home by 5pm"
- Includes time constraint with query and `currentRoute`.
- LLM action: `"modify_existing"`, type: `"adjust_time"`
- Recalculates transit and hiking segments to honor time constraints.
- Returns updated route (same id).

---

## LLM Orchestration Design

**Prompt Structure:**
- The system prompt guides the LLM to understand user queries, pick destinations, plan the routes, and propose helpful suggestions. The prompt also includes user context, preferences, and current route when necessary.

**User Message:**
- Consists of the query, location, preferences, and current route (for modifications).

**LLM Response:**
```json
{
  "action": "create_new" | "modify_existing",
  "destination": "Blue Hills Reservation",
  "searchQuery": "Blue Hills hiking trails Boston",
  "requiresTransit": true,
  "estimatedHikingDuration": 120,
  "modifyType": "add_waypoint" | "exit_now" | "adjust_time" | "add_scenic_stop",
  "keepOriginalDestination": true/false,
  "suggestions": ["...", "..."]
}
```

**Action Matrix:**
- If the query contains "find," "show," or "plan": create_new
- If the query contains "add," "include," or "waypoint": modify_existing, add_scenic_stop
- If the query contains "exit," "go home," or "leave": modify_existing, exit_now
- If the query mentions "adjust," a specific time, or "shorten": modify_existing, adjust_time

---

## API Specification

**Endpoint:** POST `/api/plan-route`

**Request:**
```typescript
{
  query: string, // required, natural language
  userLocation: { lat: number, lng: number }, // required
  preferences?: {
    duration?: number,
    difficulty?: "easy" | "moderate" | "hard",
    transportModes?: string[],
    avoid?: string[],
    accessibility?: boolean
  },
  currentRoute?: {
    route_id: string,
    name?: string,
    origin: Location,
    destination: Location,
    waypoints?: Location[],
    segments?: Segment[],
    metrics?: {
      totalMin: number,
      etaArrival?: string
    }
  }
}
```

**Response:**
```typescript
{
  route: {
    route_id: string,
    name: string,
    metrics: {
      totalMin: number,
      etaArrival: string
    },
    origin: Location,
    destination: Location,
    waypoints: Array<Location & { name?: string }>,
    segments: Array<{
      mode: string,
      instructions: string,
      distance: number,
      duration: number,
      waypoints?: Location[]
    }>
  },
  suggestions: string[]
}
```

---

## Security and Configuration

Environment variables (`.env`) hold API keys and settings. All sensitive keys are server-side only, and the frontend has no direct access to them. Rate limiting and quotas are handled by Google API policies.

Example `.env` entries:
- GEMINI_API_KEY
- GOOGLE_MAPS_API_KEY
- MONGODB_URI
- MONGODB_DB
- PORT

---

## Usage

To install and run:

```bash
git clone <repo>
cp env.template .env
# Add your API keys to .env
deno task start
```

**Example API requests:**

Create route:
```bash
curl -X POST http://localhost:8000/api/plan-route \
  -H "Content-Type: application/json" \
  -d '{
    "query": "hiking trails near Boston with public transit",
    "userLocation": {"lat": 42.3601, "lng": -71.0589},
    "preferences": {
      "duration": 3,
      "transportModes": ["transit", "walking"]
    }
  }'
```

Add a scenic stop:
```bash
curl -X POST http://localhost:8000/api/plan-route \
  -H "Content-Type: application/json" \
  -d '{
    "query": "add a scenic viewpoint",
    "userLocation": {"lat": 42.3601, "lng": -71.0589},
    "currentRoute": {
      "route_id": "route-abc123",
      "origin": {"lat": 42.3601, "lng": -71.0589},
      "destination": {"lat": 42.2114, "lng": -71.1089}
    }
  }'
```

---

## Project Structure

```
concept_backend/
├── src/
│   ├── orchestrate_server.ts
│   ├── services/
│   │   ├── RoutePlannerOrchestrator.ts
│   │   ├── GeminiClient.ts
│   │   └── GoogleMapsClient.ts
│   ├── scripts/
│   │   ├── testOrchestrate.ts
│   │   └── testQuickActions.ts
│   └── utils/
│       └── database.ts
├── design/                    # Original concept designs (for reference and historical context)
├── .env                       # API keys (gitignored)
├── env.template               # Environment template
├── deno.json                  # Deno configuration
├── DESIGN.md                  # This documentation file
└── README.md                  # Assignment instructions
```

---

## Key Design Decisions

- **One Endpoint, Natural Language Input**: Simplifies integration and reduces API complexity. Allows the backend to focus on a clear, maintainable processing pipeline.
- **LLM Orchestration**: User requests are interpreted at a natural intent level, offering flexibility and making it easier to add or change behaviors.
- **Stateless Server**: Supports scaling and avoids issues with session or state corruption.
- **Google Maps Integration**: Chosen for its comprehensive, real-time, and multi-modal data.

---

## Original Plan DSL and Lessons Learned

Earlier versions of this project included a full custom plan DSL (documented in the old design files) with operation registries, variable resolution, conditional and stepwise execution, and advanced features like detour testing and operation caching. In practice, these features led to complicated state and context management that proved counterproductive, particularly given LLM limitations in handling large, convoluted prompts or plans. 

An example of the old DSL plan structure:
```json
{
  "version": "v1",
  "goal": "Add a scenic stop with ≤20 min detour",
  "steps": [
    { "op": "ensure_trailhead", "assign": "trailhead" },
    { "op": "pick_midpoint", "assign": "midpoint" },
    { "op": "places_nearby", "assign": "candidates" },
    { "op": "rank_places", "assign": "ranked" },
    { "op": "test_detours", "assign": "feasible" },
    { "op": "choose_first", "assign": "chosen" },
    { "op": "build_multimodal_plan", "assign": "route" },
    { "op": "finalize_payload" }
  ]
}
```

These files and concepts are included for historical reference, to illustrate how the design was streamlined and why that process mattered.

---

## Debugging and Troubleshooting

- **Server logs** show all LLM decisions and system activity.
- **MongoDB** stores request logs for diagnostics.
- Common issues and troubleshooting steps are in the codebase and documentation, including what to do if no hiking locations are found, the currentRoute is ignored, or the LLM times out.

---

## References and Resources

- Gemini API Documentation: https://ai.google.dev/docs
- Google Maps Platform: https://developers.google.com/maps
- Deno Documentation: https://docs.deno.com
- Hono Web Framework: https://hono.dev

---

## License

This project is part of MIT 6.104 coursework.

---

## Summary

TrailLink now delivers LLM-powered hiking route planning through a single, simple endpoint. The system was redesigned from an initially over-complicated architecture to a streamlined, context-friendly implementation that works better with LLM orchestration and frontend integration. The result is a stateless, secure, and straightforward codebase that demonstrates the value of iterative design and the importance of balancing conceptual ambition with technical feasibility.
