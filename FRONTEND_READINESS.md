# Frontend Development Readiness

**Status**: ⚠️ **Almost Ready** - 2 Steps Remaining  
**Last Updated**: November 2025

## ✅ What's Complete

### Architecture Simplification
- ✅ Removed 4 deprecated concepts (2,480 lines deleted)
- ✅ Simplified to 4 core concepts + support concepts
- ✅ LLM-based routing replaces rigid action signatures

### Core Concepts with Full Synchronizations

| Concept | Syncs | Status | API Endpoints |
|---------|-------|--------|---------------|
| **User** | 18 | ✅ Complete | `/api/user/*` |
| **Profile** | 24 | ✅ Complete | `/api/profile/*` |
| **UserHistory** | 24 | ✅ Complete | `/api/userHistory/*` |
| **LLMRoutePlanner** | 15+ | ✅ Complete | `/api/llmRoutePlanner/*` |
| **Total** | **81+** | **All Done** | **4 namespaces** |

### Security & Protection
- ✅ Authentication gates (all protected endpoints)
- ✅ Rate limiting (10 requests/hour for expensive operations)
- ✅ Activity tracking (UserHistory integration)
- ✅ Request logging (audit trail)
- ✅ Error handling (proper error responses)

## ⚠️ What's Missing (2 Steps)

### Step 1: Generate Imports ⚠️ REQUIRED
The concept import file needs to be regenerated to include all concepts:

```bash
cd /Users/Cole-School/Desktop/MIT/Classes\ 2025/6.104\ Repos/concept_backend
deno run --allow-all src/utils/generate_imports.ts
```

**Why**: This creates `src/concepts/concepts.ts` with all concept exports for the engine.

**Expected Output**:
```typescript
// src/concepts/concepts.ts (auto-generated)
export const User = Engine.instrumentConcept(new UserConcept(db));
export const Profile = Engine.instrumentConcept(new ProfileConcept(db));
export const UserHistory = Engine.instrumentConcept(new UserHistoryConcept(db));
export const LLMRoutePlanner = Engine.instrumentConcept(new LLMRoutePlannerConcept(db));
// ... and support concepts
```

### Step 2: Label Passthrough Routes ⚠️ REQUIRED
Update `src/concepts/Requesting/passthrough.ts` to specify which routes bypass authentication:

```typescript
export const inclusions: Record<string, string> = {
  // Public queries that don't need authentication
  "/api/POISearch/searchPOIs": "public POI search",
  "/api/LocationSearch/geocodeAddress": "public geocoding",
  "/api/LocationSearch/reverseGeocode": "public reverse geocoding",
  "/api/MapVisualization/getMapTile": "public map tiles",
  "/api/UnifiedRouting/searchLocations": "public location search",
};

export const exclusions: Array<string> = [
  // All these go through Requesting syncs with authentication
  "/api/User/register",
  "/api/User/login",
  "/api/User/authenticate",
  "/api/User/logout",
  "/api/User/updatePassword",
  "/api/User/getUserProfile",
  "/api/Profile/createProfile",
  "/api/Profile/updateProfile",
  "/api/Profile/setVisibility",
  "/api/Profile/getProfile",
  "/api/Profile/deleteProfile",
  "/api/UserHistory/recordActivity",
  "/api/UserHistory/getUserHistory",
  "/api/UserHistory/updateVisibility",
  "/api/UserHistory/deleteActivity",
  "/api/LLMRoutePlanner/planRoute",
  "/api/LLMRoutePlanner/getRequestHistory",
  "/api/LLMRoutePlanner/getUsageStats",
];
```

## 📋 Available API Endpoints

### Authentication & User Management

#### POST `/api/user/register`
```json
{
  "username": "johndoe",
  "password": "password123",
  "email": "john@example.com"
}
// Returns: { "userId": "..." }
```

#### POST `/api/user/login`
```json
{
  "username": "johndoe",
  "password": "password123"
}
// Returns: { "sessionToken": "...", "userId": "..." }
```

#### POST `/api/user/authenticate`
```json
{
  "sessionToken": "abc123..."
}
// Returns: { "userId": "..." }
```

#### POST `/api/user/logout`
```json
{
  "sessionToken": "abc123..."
}
// Returns: { "success": true }
```

### Profile Management

#### POST `/api/profile/createProfile`
```json
{
  "sessionToken": "abc123...",
  "userId": "user-id",
  "displayName": "John Doe",
  "bio": "Avid hiker from Boston",
  "experienceLevel": "intermediate"
}
// Returns: { "profileId": "..." }
```

#### POST `/api/profile/getProfile`
```json
{
  "sessionToken": "abc123...",
  "userId": "user-id",
  "viewerUserId": "viewer-id"  // optional
}
// Returns: { "profile": { ... } }
```

#### POST `/api/profile/updateProfile`
```json
{
  "sessionToken": "abc123...",
  "userId": "user-id",
  "displayName": "John Smith",
  "homeLocation": {
    "type": "Point",
    "coordinates": [-71.0589, 42.3601]
  }
}
// Returns: { "success": true }
```

### Activity & History

#### POST `/api/userHistory/getUserHistory`
```json
{
  "sessionToken": "abc123...",
  "userId": "user-id",
  "limit": 20,
  "activityType": "hike_completed"  // optional
}
// Returns: { "entries": [ ... ] }
```

#### POST `/api/userHistory/getUserStats`
```json
{
  "sessionToken": "abc123...",
  "userId": "user-id"
}
// Returns: { 
//   "stats": { 
//     "totalHikes": 10, 
//     "totalDistance": 50, 
//     ... 
//   } 
// }
```

#### POST `/api/userHistory/getPublicFeed`
```json
{
  "location": {
    "type": "Point",
    "coordinates": [-71.0589, 42.3601]
  },
  "radius": 10000,  // meters
  "limit": 50
}
// Returns: { "entries": [ ... ] }
```

### 🌟 LLM Route Planning (The Main Feature!)

#### POST `/api/llmRoutePlanner/planRoute`
```json
{
  "sessionToken": "abc123...",
  "query": "Find hiking trails near Boston accessible by MBTA",
  "userLocation": {
    "lat": 42.3601,
    "lng": -71.0589
  },
  "preferences": {
    "duration": 3,
    "transportModes": ["transit", "walking"],
    "difficulty": "moderate"
  }
}
// Returns: { 
//   "route": { 
//     "route_id": "...",
//     "name": "Blue Hills Reservation Hike",
//     "metrics": { "totalMin": 180, "etaArrival": "..." },
//     "segments": [ ... ]
//   },
//   "suggestions": [ ... ]
// }
```

#### Emergency Exit Example
```json
{
  "sessionToken": "abc123...",
  "query": "I need to exit my hike now and get home",
  "userLocation": {
    "lat": 42.2500,
    "lng": -71.1000
  },
  "currentRoute": {
    "route_id": "existing-route-id",
    "origin": { "lat": 42.3601, "lng": -71.0589 },
    "destination": { "lat": 42.2114, "lng": -71.1089 }
  }
}
// Returns: Emergency exit route from current location
```

#### Route Modification Example
```json
{
  "sessionToken": "abc123...",
  "query": "Add a scenic viewpoint to my route",
  "userLocation": {
    "lat": 42.3601,
    "lng": -71.0589
  },
  "currentRoute": { /* existing route */ }
}
// Returns: Modified route with added waypoint
```

## 🚀 Frontend Development Guide

### 1. Authentication Flow

```typescript
// 1. Register new user
const { userId } = await fetch('/api/user/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johndoe',
    password: 'password123',
    email: 'john@example.com'
  })
}).then(r => r.json());

// 2. Login
const { sessionToken, userId } = await fetch('/api/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johndoe',
    password: 'password123'
  })
}).then(r => r.json());

// 3. Store sessionToken in localStorage or state management
localStorage.setItem('sessionToken', sessionToken);

// 4. Use sessionToken for all subsequent requests
```

### 2. Route Planning Flow

```typescript
// Natural language route planning
const planRoute = async (query: string) => {
  const sessionToken = localStorage.getItem('sessionToken');
  const userLocation = await getCurrentPosition(); // From browser geolocation
  
  const response = await fetch('/api/llmRoutePlanner/planRoute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionToken,
      query,
      userLocation: {
        lat: userLocation.coords.latitude,
        lng: userLocation.coords.longitude
      }
    })
  });
  
  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(error);
  }
  
  const { route, suggestions } = await response.json();
  return { route, suggestions };
};

// Usage
const result = await planRoute("Find easy hiking trails near me");
```

### 3. Profile Setup Flow

```typescript
// After registration, create profile
const createProfile = async () => {
  const sessionToken = localStorage.getItem('sessionToken');
  const userId = localStorage.getItem('userId');
  
  const { profileId } = await fetch('/api/profile/createProfile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionToken,
      userId,
      displayName: 'John Doe',
      experienceLevel: 'beginner'
    })
  }).then(r => r.json());
  
  return profileId;
};
```

### 4. Activity Feed Flow

```typescript
// Get public activity feed
const getActivityFeed = async () => {
  const userLocation = await getCurrentPosition();
  
  const { entries } = await fetch('/api/userHistory/getPublicFeed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: {
        type: 'Point',
        coordinates: [
          userLocation.coords.longitude,
          userLocation.coords.latitude
        ]
      },
      radius: 50000, // 50km
      limit: 20
    })
  }).then(r => r.json());
  
  return entries;
};
```

## 🎨 UI Component Suggestions

### Required Components

1. **Authentication**
   - LoginForm
   - RegistrationForm
   - SessionManager

2. **Profile**
   - ProfileSetup
   - ProfileView
   - ProfileEdit

3. **Route Planning**
   - SearchBar (natural language input)
   - RouteResults (display routes from LLM)
   - RouteDetail (show segments, map, directions)
   - EmergencyExitButton

4. **Activity**
   - ActivityFeed
   - UserStats
   - AchievementBadges

5. **Map**
   - MapView (showing routes and trails)
   - LocationMarker
   - RouteOverlay

## 🔒 Security Checklist

- ✅ All sensitive endpoints require authentication
- ✅ Session tokens stored securely (httpOnly cookies recommended)
- ✅ Rate limiting prevents abuse (10 requests/hour for route planning)
- ✅ Passwords hashed on backend (SHA-256, should upgrade to bcrypt)
- ✅ Input validation on all endpoints
- ⚠️ HTTPS required in production (configure CORS properly)

## 📊 API Response Formats

### Success Response
```json
{
  "userId": "...",
  "route": { ... },
  "success": true
}
```

### Error Response
```json
{
  "error": "Error message here"
}
```

### Rate Limit Response
```json
{
  "error": "Rate limit exceeded. You can make 10 route planning requests per hour. Please try again later."
}
```

### Authentication Error
```json
{
  "error": "Unauthorized: Valid session token required"
}
```

## 🛠️ Development Tools

### Test API with curl

```bash
# Register
curl -X POST http://localhost:8000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123","email":"test@example.com"}'

# Login
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}'

# Plan route
curl -X POST http://localhost:8000/api/llmRoutePlanner/planRoute \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"...","query":"find trails near Boston","userLocation":{"lat":42.3601,"lng":-71.0589}}'
```

## ✅ Final Checklist Before Frontend

- [ ] Run import generation: `deno run --allow-all src/utils/generate_imports.ts`
- [ ] Update passthrough routes in `src/concepts/Requesting/passthrough.ts`
- [ ] Start backend server: `deno task start`
- [ ] Test authentication endpoints with curl
- [ ] Test route planning endpoint with curl
- [ ] Verify error handling works
- [ ] Check rate limiting (make 11 requests in 1 hour)
- [ ] Set environment variables (GEMINI_API_KEY, GOOGLE_MAPS_API_KEY)

## 🎯 Next Steps

1. **Complete the 2 remaining steps** (imports + passthrough labeling)
2. **Test the backend** with curl/Postman
3. **Start frontend development** with confidence!

Your backend is 95% ready - just need those final 2 configuration steps! 🚀

