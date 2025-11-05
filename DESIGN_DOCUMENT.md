
# Final Design Evolution and Comparison

This document concisely summarizes the progression of my design from the initial concept (Assignment 2) and visual design (Assignment 4B) through to the final system architecture implemented in TrailLink. It highlights the significant shifts in concept modeling, user flow, and technical direction, with clearly organized sections and bullet points for clarity.

---

## Repository Configuration

<!-- UPDATE THIS URL when moving this file to a different repository -->
**Backend Repository Base URL:** `https://github.com/cole-ruehle/concept_backend`

> **Note:** When this document is moved to a new repository (e.g., a portfolio or documentation repo), simply update the above URL to point back to the TrailLink backend repository. All links below will reference this base.

---

## Table of Contents

- [Final Design Evolution and Comparison](#final-design-evolution-and-comparison)
  - [Repository Configuration](#repository-configuration)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Concept Trace](#concept-trace)
    - [Evolution Timeline](#evolution-timeline)
    - [Deprecated Concepts (October 2025)](#deprecated-concepts-october-2025)
    - [Current Concept Architecture](#current-concept-architecture)
    - [Why This Change?](#why-this-change)
  - [Key Changes Since Assignment 2](#key-changes-since-assignment-2)
  - [Refinements After Assignment 4B](#refinements-after-assignment-4b)
  - [Central User Flow and Concept Model](#central-user-flow-and-concept-model)
  - [Major Architectural Decisions](#major-architectural-decisions)
  - [Summary Table: Before and After](#summary-table-before-and-after)
  - [Design Rationale](#design-rationale)
  - [Current Concept Specifications](#current-concept-specifications)
    - [1. LLMRoutePlanner](#1-llmrouteplanner)
    - [2. User (Authentication)](#2-user-authentication)
    - [3. Profile](#3-profile)
    - [4. UserHistory](#4-userhistory)
  - [Additional Documentation](#additional-documentation)
  - [How to Update Links](#how-to-update-links)

---

## Overview

My design process for TrailLink underwent substantial revision after experiencing challenges with my initial concepts and ambiguous flows. This document outlines:

- How my approach shifted from a loosely defined, overly complex model to a focused, concept-driven design
- How user interactions were clarified into a "central dogma" of route state updates
- Incremental changes made during and after Assignment 4B to improve modularity, security, and extensibility

---

## Concept Trace

The TrailLink backend underwent a major architectural simplification in November 2025, removing over 2,480 lines of code and 4 specialized routing concepts in favor of a single, LLM-powered natural language interface.

### Evolution Timeline

```
October 2025 (Initial Design - Assignment 2)
    ↓
├── ConstraintMonitor          → ❌ Deprecated
├── DynamicExitPlanner         → ❌ Deprecated  
├── ExternalRoutingEngine      → ❌ Deprecated
└── TransitRoutePlanner        → ❌ Deprecated
    ↓
November 2025 (LLM-Based Architecture)
    ↓
├── LLMRoutePlanner           → ✅ Current (replaces all 4 above)
├── User                      → ✅ Current (authentication)
├── Profile                   → ✅ Current (public profiles)
└── UserHistory               → ✅ Current (activity tracking)
```

### Deprecated Concepts (October 2025)

**Full Deprecation Log:** [DEPRECATED_CONCEPTS.md](https://github.com/cole-ruehle/concept_backend/blob/main/DEPRECATED_CONCEPTS.md)

Four specialized routing concepts were removed:

| Concept | Purpose | Replacement | Lines Removed |
|---------|---------|-------------|---------------|
| **ConstraintMonitor** | Monitor transit schedules, weather, trail conditions | Google Maps APIs (built-in) | ~280 |
| **DynamicExitPlanner** | Real-time exit strategies during hikes | LLMRoutePlanner (natural language) | ~750 |
| **ExternalRoutingEngine** | Integration with mapping services | Service layer (GoogleMapsClient) | ~950 |
| **TransitRoutePlanner** | Multi-modal route planning | LLMRoutePlanner (natural language) | ~500 |

**Early Specification Snapshots:**
- [ConstraintMonitor Spec](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/ConstraintMonitor.md)
- [DynamicExitPlanner Spec](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/DynamicExitPlanner.md)
- [ExternalRoutingEngine Spec](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/ExternalRoutingEngine.md)
- [TransitRoutePlanner Spec](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/TransitRoutePlanner.md)

**Context Snapshots (Development History):**
- [Early Implementation Discussions](https://github.com/cole-ruehle/concept_backend/tree/main/context/design/concepts/HikingApp/implementation.md) - 21 snapshots showing iterative development
- [LikertSurvey Concept Development](https://github.com/cole-ruehle/concept_backend/tree/main/context/design/concepts/LikertSurvey) - Early concept experimentation

### Current Concept Architecture

**Core Concepts** (See [Current Concept Specifications](#current-concept-specifications) below):

1. **LLMRoutePlanner** - Natural language route planning
   - Handles all routing scenarios via single natural language interface
   - Replaces 4 specialized concepts
   - [Specification](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/LLMRoutePlanner.md)
   - [Implementation](https://github.com/cole-ruehle/concept_backend/blob/main/src/concepts/LLMRoutePlanner/LLMRoutePlannerConcept.ts)

2. **User** - Authentication and session management
   - Register, login, logout, session validation
   - [Specification](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/User.md)
   - [Implementation](https://github.com/cole-ruehle/concept_backend/blob/main/src/concepts/HikingApp/User.ts)

3. **Profile** - Public user profiles
   - Display name, bio, preferences
   - Separate from authentication concerns
   - [Specification](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/Profile.md)
   - [Implementation](https://github.com/cole-ruehle/concept_backend/blob/main/src/concepts/HikingApp/Profile.ts)

4. **UserHistory** - Activity and location tracking
   - Route history, location sharing, popular destinations
   - [Specification](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/UserHistory.md)
   - [Implementation](https://github.com/cole-ruehle/concept_backend/blob/main/src/concepts/HikingApp/UserHistory.ts)

### Why This Change?

**Problems with Original Design:**
- ❌ **Complex**: 4 concepts with rigid action signatures and many synchronizations
- ❌ **Inflexible**: Adding new routing features required new actions, tests, and syncs
- ❌ **Over-engineered**: Multiple concepts doing what an LLM could orchestrate naturally
- ❌ **Poor UX**: Users had to learn specific commands instead of natural language

**Benefits of New Design:**
- ✅ **Simple**: Single natural language interface for all routing
- ✅ **Flexible**: New features added via prompt updates, not code changes
- ✅ **User-friendly**: "Find trails near Boston" vs. rigid API parameters
- ✅ **Maintainable**: 2,480 fewer lines to maintain and test

**Example Transformation:**

```typescript
// ❌ OLD: Multiple concepts, rigid parameters
POST /api/transitRoutePlanner/planRoute
{ startLocation, endLocation, transitModes, maxWalkingDistance }

POST /api/dynamicExitPlanner/planExit
{ currentLocation, plannedRoute, urgency }

// ✅ NEW: Single endpoint, natural language
POST /api/llmRoutePlanner/planRoute
{ 
  query: "Find hiking trails near Boston accessible by MBTA",
  userLocation: {lat, lng}
}
```

---

## Key Changes Since Assignment 2

- **From Ad-hoc Concepts to Clear Models:**  
  Initial designs were muddled with features that were not true "concepts", leading to messy dependencies and code structure. The new model enforces strict boundaries between concepts (routes, users, profiles, history).

- **Simplified User Flow:**  
  Early user flows tried to do too much in one step. The final design separates state transitions and makes each action update the current route incrementally.

- **Context Injection Instead of Global Imports:**  
  Instead of importing or sharing state between modules, user actions are bundled as context for the LLM, which then returns the updated route or response.

- **Explicit Security via Session Tokens:**  
  Authentication and all user actions now require a session token, removing prior insecure patterns.

---

## Refinements After Assignment 4B

- **User-Profile Separation:**  
  Users (for authentication) are kept distinct from user profiles (for public display), clarifying access control and data flow.

- **Live Hiking Mode Added:**  
  Inspired by course examples, a "Live Hiking" mode and user location sharing were integrated. Location updates power both real-time user displays and historical trail popularity.

- **Use of User History:**  
  All hikes and locations are now stored, enabling users to see their hiking history and for the app to show popular destinations.

- **Shift to Request Module:**  
  The backend now uses the request module for safer and cleaner handling of external API calls, enforcing better separation of concerns.

---

## Central User Flow and Concept Model

**The Central Dogma:**  
At all times, the user maintains a "current route" (may be empty initially). All important user actions (start route, modify, add stop, exit, etc.):

- Update the current route, which is the single source of truth in the UI
- Are issued as discrete, atomic requests to the backend/LLM
- Trigger the LLM to ingest the existing route and user intent and respond with a new route object and explanatory note

**Diagram: Simplified User Flow**

```
   [User Action] 
        ↓ 
   [Update Context]  
        ↓ 
  [LLM Query + Google Maps API] 
        ↓ 
[New Route/Steps & Comment] 
        ↓ 
        [Display in UI]
```

---

## Major Architectural Decisions

- **Concept Granularity:**  
  Each major entity (User, Profile, Route, History, LiveSession) is independently modeled, avoiding blurred boundaries seen in Assignment 2.

- **No Implicit Imports:**  
  The new model avoids "spaghetti imports" that plagued earlier attempts. All information needed for each concept is explicitly injected.

- **Security as a First-Class Concern:**  
  All backend interactions require session tokens, closing the security holes of the initial prototype.

- **Front-end & Back-end Decoupling:**  
  Communication is always via clear, versioned API calls (see [API service module](src/api/api.js)).

---

## Summary Table: Before and After

| Area                | Assignment 2           | Final Design                |
|---------------------|-----------------------|-----------------------------|
| Concept Clarity     | Unclear ownership, concepts mixed together | Strong separation of User, Profile, History, Route |
| User Flow           | Monolithic, nonlinear, hard to extend | "Central dogma": All actions update route state |
| Visual/Interaction  | Unpredictable, little state management | Deterministic UI, route is source of truth |
| Security            | Ad-hoc, weak authentication | Strict session token usage throughout |
| Extensibility       | Difficult to modularize | Easy: Add concepts without cross-imports |
| LLM Usage           | Scattered, ill-defined context | Context injection for every interaction |

---

## Design Rationale

Making these changes helped resolve many of the scalability, security, and usability issues encountered in my earlier versions. By simplifying the user flow and strictly modeling each concept, I was able to iterate independently, make the backend more secure, and keep the frontend maintainable. This also positions TrailLink well for future extensions (e.g., richer profiles, more live modes), since every concept and interaction is clearly defined and modular.

---

## Current Concept Specifications

Below are the complete specifications for all active concepts in the TrailLink backend. Each concept follows the standard format: purpose, principle, state, actions, and implementation notes.

### 1. LLMRoutePlanner

**Purpose:** Enable natural language-based multi-modal route planning (transit + hiking) through LLM orchestration.

**Key Features:**
- Natural language query processing ("Find trails near Boston accessible by MBTA")
- Route creation and modification via single interface
- Emergency exit routing
- Context-aware suggestions

**Links:**
- [Full Specification](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/LLMRoutePlanner.md)
- [Implementation](https://github.com/cole-ruehle/concept_backend/blob/main/src/concepts/LLMRoutePlanner/LLMRoutePlannerConcept.ts)
- [API Documentation](https://github.com/cole-ruehle/concept_backend/blob/main/API_SPECIFICATION.md#llm-route-planner)

**Core Actions:**
- `planRoute(query, userLocation, preferences?, currentRoute?)` → RouteResponse

### 2. User (Authentication)

**Purpose:** Enable users to maintain authenticated state across multiple requests without repeatedly providing credentials.

**Key Features:**
- User registration with password hashing
- Session-based authentication with secure tokens
- Password management
- Automatic session expiration

**Links:**
- [Full Specification](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/User.md)
- [Implementation](https://github.com/cole-ruehle/concept_backend/blob/main/src/concepts/HikingApp/User.ts)
- [API Documentation](https://github.com/cole-ruehle/concept_backend/blob/main/API_SPECIFICATION.md#user-authentication)

**Core Actions:**
- `register(username, password, email)` → userId
- `login(username, password)` → sessionToken
- `authenticate(sessionToken)` → userId
- `logout(sessionToken)` → success

### 3. Profile

**Purpose:** Provide public-facing user profiles separate from authentication concerns.

**Key Features:**
- Display names, bios, and preferences
- Profile picture support
- Hiking statistics and achievements
- Privacy-focused (separate from User concept)

**Links:**
- [Full Specification](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/Profile.md)
- [Implementation](https://github.com/cole-ruehle/concept_backend/blob/main/src/concepts/HikingApp/Profile.ts)
- [API Documentation](https://github.com/cole-ruehle/concept_backend/blob/main/API_SPECIFICATION.md#profile-management)

**Core Actions:**
- `createProfile(userId, displayName, bio?)` → profileId
- `getProfile(userId)` → ProfileData
- `updateProfile(userId, updates)` → success
- `searchProfiles(query)` → ProfileData[]

### 4. UserHistory

**Purpose:** Track user hiking activities, location history, and enable discovery of popular destinations.

**Key Features:**
- Hike completion tracking
- Real-time location sharing
- Historical trail popularity data
- Personal hiking statistics

**Links:**
- [Full Specification](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/UserHistory.md)
- [Implementation](https://github.com/cole-ruehle/concept_backend/blob/main/src/concepts/HikingApp/UserHistory.ts)
- [API Documentation](https://github.com/cole-ruehle/concept_backend/blob/main/API_SPECIFICATION.md#user-history)

**Core Actions:**
- `recordHike(userId, route, completedAt)` → hikeId
- `updateLocation(userId, location, timestamp)` → success
- `getHikingHistory(userId, limit?)` → HikeData[]
- `getPopularDestinations(region?)` → DestinationData[]

---

## Additional Documentation

For complete implementation details, API specifications, and testing documentation, see:

- [API Specification](https://github.com/cole-ruehle/concept_backend/blob/main/API_SPECIFICATION.md) - Complete REST API documentation
- [Implementation Summary](https://github.com/cole-ruehle/concept_backend/blob/main/IMPLEMENTATION_SUMMARY.md) - Technical implementation details
- [Synchronizations](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/synchronizations.md) - Concept synchronization logic
- [Testing Documentation](https://github.com/cole-ruehle/concept_backend/blob/main/design/concepts/HikingApp/testing.md) - Test coverage and strategies
- [README](https://github.com/cole-ruehle/concept_backend/blob/main/README.md) - Setup and deployment instructions

---

## How to Update Links

All links in this document are currently configured to point to the TrailLink backend repository at:
**`https://github.com/cole-ruehle/concept_backend`**

If you move this document to a different repository (e.g., a portfolio or documentation repo):

1. Update the **Repository Configuration** section at the top of this document with the new base URL
2. Use find-and-replace throughout the document:
   - Find: `https://github.com/cole-ruehle/concept_backend`
   - Replace with: your new repository URL
3. All links will automatically point back to the correct files in the backend repository

**Example:** If moving to a portfolio repo, replace all instances of:
```
https://github.com/cole-ruehle/concept_backend
```
with:
```
https://github.com/YOUR_USERNAME/traillink-backend
```

This maintains all the references to the original backend code, specifications, and context files.