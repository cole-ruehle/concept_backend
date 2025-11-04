# TrailLink API Specification

**Version**: 1.0.0  
**Base URL**: `http://localhost:8000/api` (development)  
**Last Updated**: November 2025

## Table of Contents
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Core Endpoints](#core-endpoints)
  - [User Management](#user-management)
  - [Profile Management](#profile-management)
  - [Activity & History](#activity--history)
  - [Route Planning (LLM)](#route-planning-llm)
  - [Public Queries](#public-queries)

---

## Authentication

Most endpoints require a session token obtained through login.

### How Authentication Works
1. Register or login to receive a `sessionToken`
2. Include `sessionToken` in request body for all protected endpoints
3. Token is validated via User.authenticate synchronization
4. Invalid/expired tokens return `401 Unauthorized`

### Session Management
- Sessions expire after 7 days of inactivity
- Each request refreshes the `lastAccessedAt` timestamp
- Logout invalidates the session immediately

---

## Error Handling

### Success Response Format
```json
{
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d",
  "success": true
}
```

### Error Response Format
```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes
- `200 OK` - Successful request
- `400 Bad Request` - Invalid input parameters
- `401 Unauthorized` - Missing or invalid session token
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server-side error
- `504 Gateway Timeout` - Request timed out

---

## Rate Limiting

### LLM Route Planning
- **Limit**: 10 requests per hour per user
- **Applies to**: `/api/llmRoutePlanner/planRoute`
- **Reason**: Expensive API calls (Gemini LLM + Google Maps)
- **Response when exceeded**:
```json
{
  "error": "Rate limit exceeded. You can make 10 route planning requests per hour. Please try again later."
}
```

### Other Endpoints
- No rate limiting currently applied
- May be added in future for abuse prevention

---

## Core Endpoints

## User Management

### POST `/api/user/register`
**Description**: Create a new user account  
**Authentication**: ❌ None required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "username": "johndoe",
  "password": "password123",
  "email": "john@example.com"
}
```

**Validation**:
- `username`: min 3 characters, must be unique
- `password`: min 8 characters
- `email`: valid email format, must be unique

**Success Response** (200):
```json
{
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d"
}
```

**Error Responses**:
```json
{ "error": "Username must be at least 3 characters long" }
{ "error": "Password must be at least 8 characters long" }
{ "error": "Invalid email format" }
{ "error": "Username already taken" }
{ "error": "Email already registered" }
```

**Side Effects**:
- Automatically creates Profile with default settings
- Records "account_created" activity in UserHistory (private)

---

### POST `/api/user/login`
**Description**: Login and receive session token  
**Authentication**: ❌ None required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "username": "johndoe",
  "password": "password123"
}
```

**Success Response** (200):
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d"
}
```

**Error Response**:
```json
{ "error": "Invalid username or password" }
```

**Notes**:
- Session expires after 7 days
- Multiple sessions allowed per user

---

### POST `/api/user/authenticate`
**Description**: Validate session token and get userId  
**Authentication**: ✅ Required (validates the token)  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6..."
}
```

**Success Response** (200):
```json
{
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d"
}
```

**Error Responses**:
```json
{ "error": "Invalid session token" }
{ "error": "Session expired" }
```

---

### POST `/api/user/logout`
**Description**: Invalidate session token  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6..."
}
```

**Success Response** (200):
```json
{
  "success": true
}
```

**Error Response**:
```json
{ "error": "Session not found" }
```

---

### POST `/api/user/updatePassword`
**Description**: Change user password  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d",
  "oldPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

**Validation**:
- `newPassword`: min 8 characters
- `oldPassword`: must match current password

**Success Response** (200):
```json
{
  "success": true
}
```

**Error Responses**:
```json
{ "error": "User not found" }
{ "error": "Current password is incorrect" }
{ "error": "New password must be at least 8 characters long" }
```

---

### POST `/api/user/getUserProfile`
**Description**: Get user account information  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d"
}
```

**Success Response** (200):
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "createdAt": "2025-11-04T12:00:00.000Z"
}
```

**Error Response**:
```json
{ "error": "User not found" }
```

---

## Profile Management

### POST `/api/profile/createProfile`
**Description**: Create user profile (usually automatic on registration)  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d",
  "displayName": "John Doe",
  "bio": "Avid hiker from Boston",
  "experienceLevel": "intermediate"
}
```

**Field Constraints**:
- `displayName`: 2-50 characters (required)
- `bio`: max 500 characters (optional)
- `experienceLevel`: "beginner" | "intermediate" | "advanced" | "expert" (optional, default: "intermediate")

**Success Response** (200):
```json
{
  "profileId": "019a2e14-1567-7c2a-8d3f-9e4a5b6c7d8e"
}
```

**Error Responses**:
```json
{ "error": "Display name must be between 2 and 50 characters" }
{ "error": "Invalid experience level" }
{ "error": "User already has a profile" }
```

**Side Effects**:
- Creates default visibility settings:
  - `showLiveLocation`: false
  - `profileVisibility`: "public"
  - `shareStats`: true
  - `shareHomeLocation`: false

---

### POST `/api/profile/updateProfile`
**Description**: Update profile information  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d",
  "displayName": "John Smith",
  "bio": "Experienced hiker exploring New England trails",
  "avatarUrl": "https://example.com/avatar.jpg",
  "homeLocation": {
    "type": "Point",
    "coordinates": [-71.0589, 42.3601]
  },
  "experienceLevel": "advanced"
}
```

**Notes**:
- All fields are optional (only update provided fields)
- `homeLocation` uses GeoJSON Point format: [longitude, latitude]

**Success Response** (200):
```json
{
  "success": true
}
```

**Error Responses**:
```json
{ "error": "Profile not found" }
{ "error": "Display name must be between 2 and 50 characters" }
{ "error": "Bio must be 500 characters or less" }
{ "error": "Invalid experience level" }
```

---

### POST `/api/profile/setVisibility`
**Description**: Update privacy settings  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d",
  "showLiveLocation": true,
  "profileVisibility": "public",
  "shareStats": true,
  "shareHomeLocation": false
}
```

**Field Options**:
- `showLiveLocation`: boolean (show real-time location during active hikes)
- `profileVisibility`: "public" | "hikers-only" | "private"
- `shareStats`: boolean (include stats when profile viewed)
- `shareHomeLocation`: boolean (show home location in profile)

**Success Response** (200):
```json
{
  "success": true
}
```

**Error Responses**:
```json
{ "error": "Profile not found" }
{ "error": "Invalid profile visibility" }
```

---

### POST `/api/profile/getProfile`
**Description**: Get detailed profile information  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d",
  "viewerUserId": "019a2e14-15ab-7d4e-9f5a-1b2c3d4e5f6g"
}
```

**Notes**:
- `viewerUserId` is optional
- Returned data respects privacy settings
- If `shareStats` is true, includes UserHistory stats

**Success Response** (200):
```json
{
  "profile": {
    "displayName": "John Doe",
    "bio": "Avid hiker from Boston",
    "avatarUrl": "https://example.com/avatar.jpg",
    "experienceLevel": "intermediate",
    "homeLocation": {
      "type": "Point",
      "coordinates": [-71.0589, 42.3601]
    }
  }
}
```

**With Stats** (if shareStats enabled):
```json
{
  "profile": { /* same as above */ },
  "stats": {
    "totalHikes": 25,
    "totalDistance": 150.5,
    "totalDuration": 3600,
    "completionRate": 0.85,
    "favoriteLocations": ["Blue Hills", "Middlesex Fells"],
    "lastActiveAt": "2025-11-04T12:00:00.000Z"
  }
}
```

**Error Response**:
```json
{ "profile": null }  // Profile not found or private
```

---

### POST `/api/profile/deleteProfile`
**Description**: Delete user profile  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d"
}
```

**Success Response** (200):
```json
{
  "success": true
}
```

**Error Response**:
```json
{ "error": "Profile not found" }
```

**Side Effects**:
- Deletes profile and all visibility settings
- UserHistory entries remain for data integrity

---

## Activity & History

### POST `/api/userHistory/getUserHistory`
**Description**: Get user's activity history  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d",
  "limit": 20,
  "activityType": "hike_completed"
}
```

**Parameters**:
- `limit`: optional, default 50, max 100
- `activityType`: optional filter ("hike_completed" | "route_saved" | "route_planned" | "trail_rated" | "poi_visited")

**Success Response** (200):
```json
{
  "entries": [
    {
      "entryId": "019a2e14-16cd-8e5f-a1b2-c3d4e5f6g7h8",
      "activityType": "hike_completed",
      "activityData": {
        "routeId": "route-123",
        "distance": 5.2,
        "duration": 120
      },
      "location": {
        "type": "Point",
        "coordinates": [-71.0589, 42.3601]
      },
      "timestamp": "2025-11-04T12:00:00.000Z",
      "visibility": "public"
    }
  ]
}
```

---

### POST `/api/userHistory/getUserStats`
**Description**: Get aggregated user statistics  
**Authentication**: ✅ Required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d"
}
```

**Success Response** (200):
```json
{
  "stats": {
    "totalHikes": 25,
    "totalDistance": 150.5,
    "totalDuration": 3600,
    "completionRate": 0.85,
    "favoriteLocations": ["Blue Hills Reservation", "Middlesex Fells"],
    "lastActiveAt": "2025-11-04T12:00:00.000Z"
  }
}
```

---

### POST `/api/userHistory/getPublicFeed`
**Description**: Get public activity feed (nearby activities)  
**Authentication**: ❌ None required (public data)  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "location": {
    "type": "Point",
    "coordinates": [-71.0589, 42.3601]
  },
  "radius": 50000,
  "limit": 20
}
```

**Parameters**:
- `location`: optional, center point for geographic filtering
- `radius`: optional, meters (default: no filter)
- `limit`: optional, default 50, max 100

**Success Response** (200):
```json
{
  "entries": [
    {
      "entryId": "019a2e14-16cd-8e5f-a1b2-c3d4e5f6g7h8",
      "userId": "019a2e14-14cb-7a4e-959c-6c4ed485322d",
      "activityType": "hike_completed",
      "activityData": {
        "routeId": "route-123",
        "routeName": "Blue Hills Loop"
      },
      "location": {
        "type": "Point",
        "coordinates": [-71.0589, 42.3601]
      },
      "timestamp": "2025-11-04T12:00:00.000Z"
    }
  ]
}
```

---

### POST `/api/userHistory/getPopularRoutes`
**Description**: Get most popular routes in time window  
**Authentication**: ❌ None required (aggregate public data)  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "timeWindow": "week",
  "limit": 20
}
```

**Parameters**:
- `timeWindow`: "day" | "week" | "month" | "year" (required)
- `limit`: optional, default 20, max 100

**Success Response** (200):
```json
{
  "routes": [
    {
      "routeId": "route-123",
      "count": 45,
      "avgRating": 4.5
    }
  ]
}
```

---

## Route Planning (LLM)

### POST `/api/llmRoutePlanner/planRoute`
**Description**: Plan routes using natural language  
**Authentication**: ✅ Required  
**Rate Limit**: ✅ 10 requests/hour per user

**Request Body** (New Route):
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "query": "Find hiking trails near Boston accessible by MBTA",
  "userLocation": {
    "lat": 42.3601,
    "lng": -71.0589
  },
  "preferences": {
    "duration": 3,
    "transportModes": ["transit", "walking"],
    "difficulty": "moderate",
    "avoid": ["tolls"],
    "accessibility": false
  }
}
```

**Request Body** (Modify Existing Route):
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "query": "Add a scenic viewpoint to my route",
  "userLocation": {
    "lat": 42.3601,
    "lng": -71.0589
  },
  "currentRoute": {
    "route_id": "route-abc123",
    "name": "Blue Hills Hike",
    "origin": { "lat": 42.3601, "lng": -71.0589 },
    "destination": { "lat": 42.2114, "lng": -71.1089 },
    "waypoints": [],
    "segments": [],
    "metrics": {
      "totalMin": 180,
      "etaArrival": "2025-11-04T15:00:00.000Z"
    }
  }
}
```

**Request Body** (Emergency Exit):
```json
{
  "sessionToken": "a1b2c3d4e5f6...",
  "query": "I need to exit my hike now and get home",
  "userLocation": {
    "lat": 42.2500,
    "lng": -71.1000
  },
  "currentRoute": {
    "route_id": "route-abc123",
    "origin": { "lat": 42.3601, "lng": -71.0589 },
    "destination": { "lat": 42.2114, "lng": -71.1089 }
  }
}
```

**Success Response** (200):
```json
{
  "route": {
    "route_id": "route-def456",
    "name": "Blue Hills Reservation Hike via MBTA",
    "metrics": {
      "totalMin": 180,
      "etaArrival": "2025-11-04T15:00:00.000Z"
    },
    "origin": {
      "lat": 42.3601,
      "lng": -71.0589
    },
    "destination": {
      "lat": 42.2114,
      "lng": -71.1089
    },
    "waypoints": [
      {
        "lat": 42.3500,
        "lng": -71.0700,
        "name": "Scenic Overlook"
      }
    ],
    "segments": [
      {
        "mode": "transit",
        "instructions": "Take Red Line to Alewife",
        "distance": 5.2,
        "duration": 15,
        "waypoints": [...]
      },
      {
        "mode": "walking",
        "instructions": "Walk to bus stop",
        "distance": 0.5,
        "duration": 5
      },
      {
        "mode": "transit",
        "instructions": "Take Bus 76 to trailhead",
        "distance": 8.3,
        "duration": 20
      },
      {
        "mode": "hiking",
        "instructions": "Follow blue trail for 4.2 miles",
        "distance": 6.7,
        "duration": 120
      }
    ]
  },
  "suggestions": [
    "Pack extra water for this moderate difficulty hike",
    "Last bus back is at 6:30 PM - plan accordingly",
    "Trail has some steep sections - good hiking boots recommended"
  ]
}
```

**Error Responses**:
```json
{ "error": "Unauthorized: Valid session token required" }
{ "error": "Rate limit exceeded. You can make 10 route planning requests per hour. Please try again later." }
{ "error": "Query cannot be empty" }
{ "error": "Invalid user location" }
{ "error": "Failed to plan route" }
```

**Example Queries**:
- "Find easy hiking trails near me"
- "Plan a 3-hour hike accessible by public transit"
- "Find trails with scenic views within 2 hours"
- "I need to exit my hike now and get home" (emergency)
- "Add a lunch stop to my current route" (modification)

---

### POST `/api/llmRoutePlanner/getGlobalStats`
**Description**: Get system-wide statistics  
**Authentication**: ❌ None required (aggregate public data)  
**Rate Limit**: ❌ None

**Request Body**:
```json
{}
```

**Success Response** (200):
```json
{
  "stats": {
    "totalRequests": 1250,
    "totalUsers": 85,
    "overallSuccessRate": 0.92,
    "avgDurationMs": 1500,
    "requestsLast24h": 45
  }
}
```

---

## Public Queries

### POST `/api/UnifiedRouting/searchLocations`
**Description**: Search for trails and locations  
**Authentication**: ❌ None required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "query": "Blue Hills",
  "limit": 10
}
```

**Success Response** (200):
```json
[
  {
    "id": "trail-123",
    "name": "Blue Hills Reservation",
    "type": "trail",
    "location": {
      "lat": 42.2114,
      "lng": -71.1089
    },
    "coordinates": [...],
    "segments": [...],
    "distance": 6700,
    "duration": 7200
  }
]
```

---

### POST `/api/LocationSearch/geocodeAddress`
**Description**: Convert address to coordinates  
**Authentication**: ❌ None required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "address": "Boston, MA",
  "limit": 5
}
```

**Success Response** (200):
```json
[
  {
    "formattedAddress": "Boston, MA, USA",
    "location": {
      "lat": 42.3601,
      "lng": -71.0589
    },
    "placeId": "ChIJGzE9DS1l44kRoOhiASS_fHg"
  }
]
```

---

### POST `/api/LocationSearch/reverseGeocode`
**Description**: Convert coordinates to address  
**Authentication**: ❌ None required  
**Rate Limit**: ❌ None

**Request Body**:
```json
{
  "lat": 42.3601,
  "lng": -71.0589
}
```

**Success Response** (200):
```json
{
  "formattedAddress": "Boston, MA 02108, USA",
  "placeId": "ChIJGzE9DS1l44kRoOhiASS_fHg",
  "components": {
    "city": "Boston",
    "state": "Massachusetts",
    "country": "USA",
    "postalCode": "02108"
  }
}
```

---

## Data Types

### GeoJSON Point
```typescript
{
  "type": "Point",
  "coordinates": [longitude, latitude]  // Note: longitude first!
}
```

### Location (Simple)
```typescript
{
  "lat": number,
  "lng": number  // or "lon" in some contexts
}
```

### Experience Levels
```typescript
type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "expert"
```

### Profile Visibility
```typescript
type ProfileVisibility = "public" | "hikers-only" | "private"
```

### Activity Types
```typescript
type ActivityType = 
  | "hike_completed" 
  | "route_saved" 
  | "route_planned" 
  | "trail_rated" 
  | "poi_visited"
```

### Visibility Levels
```typescript
type Visibility = "public" | "private" | "friends"
```

---

## Authentication Flow Example

```typescript
// 1. Register
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

// 3. Store token
localStorage.setItem('sessionToken', sessionToken);

// 4. Use token for authenticated requests
const planRouteResponse = await fetch('/api/llmRoutePlanner/planRoute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionToken: localStorage.getItem('sessionToken'),
    query: 'Find hiking trails near Boston',
    userLocation: { lat: 42.3601, lng: -71.0589 }
  })
});
```

---

## Notes for Frontend Developers

### CORS
- CORS is configured to allow requests from your frontend domain
- Set `REQUESTING_ALLOWED_DOMAIN` environment variable on backend

### Environment Setup
Backend requires these environment variables:
```bash
GEMINI_API_KEY=your_gemini_key
GOOGLE_MAPS_API_KEY=your_maps_key
MONGODB_URL=mongodb://...
DB_NAME=hiking_app
PORT=8000
REQUESTING_BASE_URL=/api
```

### TypeScript Types
Consider creating these TypeScript interfaces for type safety:

```typescript
interface SessionToken {
  sessionToken: string;
}

interface User {
  userId: string;
  username: string;
  email: string;
  createdAt: Date;
}

interface Profile {
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  homeLocation?: GeoJSONPoint;
}

interface Route {
  route_id: string;
  name: string;
  metrics: {
    totalMin: number;
    etaArrival: string;
  };
  origin: Location;
  destination: Location;
  waypoints: Array<Location & { name?: string }>;
  segments: RouteSegment[];
}

interface RouteSegment {
  mode: 'transit' | 'walking' | 'hiking' | 'bicycling';
  instructions: string;
  distance: number;  // km
  duration: number;  // minutes
  waypoints?: Location[];
}
```

### Testing
Use curl or Postman to test endpoints:
```bash
# Test public endpoint
curl -X POST http://localhost:8000/api/userHistory/getPublicFeed \
  -H "Content-Type: application/json" \
  -d '{}'

# Test authenticated endpoint
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}'
```

---

**End of API Specification**

For questions or issues, contact the backend team.

