# 🚀 Orchestrate Server Setup Guide

The new streamlined backend using LLM orchestration + Google Maps APIs.

## 📋 Prerequisites

1. **Gemini API Key** - Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Google Maps API Key** - Get from [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
   - Enable: Places API, Directions API, Geocoding API
3. **MongoDB** - Running locally or cloud instance

## 🔧 Environment Variables

Create a `.env` file in the project root (it's gitignored for security):

```bash
# Copy the template
cp env.template .env

# Edit with your actual keys
nano .env
```

Your `.env` file should contain:

```bash
# Gemini API Key (for LLM orchestration)
GEMINI_API_KEY=your_gemini_api_key_here

# Google Maps API Key (for Places, Directions, Geocoding)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# MongoDB Connection (optional, uses defaults if not set)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=hiking_app

# Server Port (optional, defaults to 8000)
PORT=8000
```

**⚠️ Important:** Never commit your `.env` file! It's already in `.gitignore`.

## 🏃 Running the Server

```bash
# Start the server
deno task start

# Start with auto-reload on file changes
deno task dev
```

## 📡 API Endpoints

### **POST /api/plan-route**
Main endpoint for route planning.

**Request:**
```json
{
  "query": "Find hiking trails near me accessible by public transit",
  "userLocation": {
    "lat": 42.3601,
    "lng": -71.0589
  },
  "preferences": {
    "duration": 3,
    "difficulty": "moderate",
    "transportModes": ["transit", "walking"]
  }
}
```

**Response:**
```json
{
  "route": {
    "route_id": "route-123",
    "name": "Blue Hills via Red Line",
    "metrics": {
      "totalMin": 180,
      "etaArrival": "2024-01-15T15:30:00Z"
    },
    "origin": { "lat": 42.3601, "lng": -71.0589 },
    "destination": { "lat": 42.2114, "lng": -71.1089 },
    "waypoints": [
      { "lat": 42.2114, "lng": -71.1089, "name": "Blue Hills" }
    ],
    "segments": [
      {
        "mode": "transit",
        "instructions": "Take Red Line to Ashmont",
        "distance": 12.5,
        "duration": 45
      },
      {
        "mode": "hiking",
        "instructions": "Hike at Blue Hills",
        "distance": 8.5,
        "duration": 135
      }
    ]
  },
  "suggestions": [
    "Consider starting earlier to avoid crowds",
    "Check transit schedules for return trip timing"
  ]
}
```

### **GET /api/health**
Health check endpoint.

### **GET /api/logs?limit=10**
View recent request logs (for debugging).

## 🏗️ Architecture

### **Simple Flow:**
1. **Frontend** → sends natural language query + user location
2. **Gemini LLM** → understands query, creates structured plan
3. **Google Maps APIs** → executes plan (Places, Directions, Geocoding)
4. **MongoDB** → logs all requests for monitoring
5. **Backend** → returns formatted route response

### **Key Files:**
- `src/orchestrate_server.ts` - Main server with /api/plan-route endpoint
- `src/services/RoutePlannerOrchestrator.ts` - LLM orchestration logic
- `src/services/GeminiClient.ts` - Gemini API wrapper
- `src/services/GoogleMapsClient.ts` - Google Maps API wrapper

## 🔄 Migration from Old System

The old concept-based system is still available via:
```bash
deno task concepts
```

But the new orchestrate server is **much simpler** and **more powerful**:

| Old System | New System |
|------------|------------|
| 17+ concept files | 4 service files |
| Complex state management | Stateless |
| Manual route logic | LLM-orchestrated |
| ~2000+ lines | ~600 lines |

## 🧪 Testing

Example curl request:
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

## 📊 Monitoring

Check recent requests:
```bash
curl http://localhost:8000/api/logs?limit=5
```

View MongoDB logs:
```bash
mongosh hiking_app
db.request_logs.find().sort({timestamp: -1}).limit(5)
```

## 🎯 Benefits

- **Single endpoint** handles all route planning
- **Natural language** queries (user-friendly)
- **Multi-modal** routes (transit + hiking)
- **LLM-powered** intelligence
- **Stateless** and scalable
- **Request logging** for debugging
- **Much less code** to maintain

