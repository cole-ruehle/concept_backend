# Hiking App Backend API Specification

## Overview

This API provides comprehensive hiking route planning, location search, and user experience features. The backend is populated with **110+ hiking locations** across the United States, including trailheads, trails, and transit stops.

## Base URL
```
http://localhost:8000/HikingApp
```

**Note:** All endpoints are registered at `/HikingApp/{methodName}`. The server does NOT use an `/api` prefix.

## Authentication
Currently no authentication required. All endpoints accept anonymous requests.

---

## ⚡ **Quick Test Guide**

**Test the search endpoint immediately:**
```bash
# Search for Yosemite locations
curl -X POST http://localhost:8000/HikingApp/searchLocations \
  -H "Content-Type: application/json" \
  -d '{"query": "Yosemite", "options": {"limit": 5}}'

# Search for Grand Canyon
curl -X POST http://localhost:8000/HikingApp/searchLocations \
  -H "Content-Type: application/json" \
  -d '{"query": "Grand Canyon", "options": {"limit": 5}}'
```

**Working search terms:** `"Yosemite"`, `"Grand Canyon"`, `"Rocky Mountain"`, `"Mount Rainier"`, `"Crater Lake"`, `"Zion"`, `"Half Dome"`, `"Denali"`, `"Everglades"`, etc.

**Each search returns an array** with trailheads and trails that match your query.

---

## 🗺️ **Route Planning API**

### 1. Calculate Route
**Endpoint:** `POST /calculateRoute`

**Description:** Main route calculation endpoint that consolidates all routing functionality.

**Request Body:**
```typescript
{
  origin: {
    lat: number;           // Required: Latitude
    lon: number;           // Required: Longitude  
    address?: string;      // Optional: Human-readable address
    name?: string;         // Optional: Location name
  };
  destination: {
    lat: number;           // Required: Latitude
    lon: number;           // Required: Longitude
    address?: string;      // Optional: Human-readable address
    name?: string;         // Optional: Location name
  };
  mode: "hiking" | "transit" | "driving" | "walking" | "cycling" | "multimodal";
  preferences?: {
    maxDistance?: number;        // Maximum distance in meters
    maxDuration?: number;        // Maximum duration in minutes
    difficulty?: "easy" | "moderate" | "hard" | "expert";
    avoidHighways?: boolean;
    preferTrails?: boolean;
    accessibility?: string[];    // e.g., ["wheelchair"]
  };
  alternatives?: number;         // Number of alternative routes (default: 1)
}
```

**Response:**
```typescript
{
  id: string;                    // Unique route identifier
  mode: string;                  // Route mode
  totalDistance: number;         // Total distance in meters
  totalDuration: number;         // Total duration in seconds
  totalDistanceFormatted: string; // e.g., "4.5 km" or "850m"
  totalDurationFormatted: string; // e.g., "1h 6m" or "53m"
  segments: RouteSegment[];
  summary: {
    transitTime: number;         // Transit time in seconds
    hikingTime: number;          // Hiking time in seconds
    walkingTime: number;         // Walking time in seconds
    drivingTime: number;         // Driving time in seconds
  };
  polyline?: string;             // Encoded polyline for map display
  geojson?: any;                 // GeoJSON geometry
  instructions: string[];        // Turn-by-turn instructions
  difficulty: string;            // Overall route difficulty
  elevationGain: number;         // Total elevation gain in meters
  createdAt: string;             // ISO timestamp
}

interface RouteSegment {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  distance: number;              // Distance in meters
  duration: number;              // Duration in seconds
  distanceFormatted: string;     // e.g., "2.1 km"
  durationFormatted: string;     // e.g., "25m"
  instructions: string[];        // Segment instructions
  surface: string;               // e.g., "dirt", "paved", "transit"
  difficulty: string;            // Segment difficulty
  elevationGain: number;         // Segment elevation gain
  waypoints: { lat: number; lon: number }[];
  mode: "transit" | "hiking" | "walking" | "driving";
}
```

**Example Request:**
```json
{
  "origin": {
    "lat": 37.7749,
    "lon": -122.4194,
    "address": "San Francisco, CA"
  },
  "destination": {
    "lat": 37.7489,
    "lon": -119.5890,
    "address": "Yosemite Valley, CA"
  },
  "mode": "hiking",
  "preferences": {
    "maxDistance": 10000,
    "difficulty": "moderate"
  }
}
```

### 2. Get Alternative Routes
**Endpoint:** `POST /getAlternativeRoutes`

**Request Body:**
```typescript
{
  routeId: string;
  criteria: "faster" | "shorter" | "scenic" | "easier";
}
```

**Response:** Array of `RouteResponse` objects

---

## 🔍 **Location Search API**

### 3. Search Locations
**Endpoint:** `POST /searchLocations`

**Description:** Search for locations with autocomplete functionality. Searches the database for trailheads, trails, and transit stops using case-insensitive name matching.

> **💡 How It Works:**
> - Searches **110 trailheads**, **110 trails**, and **12 transit stops** in the MongoDB database
> - Uses case-insensitive partial name matching (e.g., "yosemite" matches "Yosemite Valley Trailhead")
> - Returns results from database collections, **not external APIs**
> - Each trailhead and trail are stored separately, so you'll typically get 2 results per location

**Request Body:**
```typescript
{
  query: string;                 // Search query (required)
  options?: {
    limit?: number;              // Max results (default: 10)
  }
}
```

**Response:**
```typescript
LocationSearchResult[]

interface LocationSearchResult {
  id: string;                    // MongoDB ObjectId as string
  name: string;
  address: string;               // State code for trailheads (e.g., "CA")
  location: { lat: number; lon: number };
  type: "trailhead" | "trail" | "transit_stop";
}
```

**✅ Recommended Search Terms:**
Use these proven search terms that work with your database:

**Popular Locations:**
- `"Yosemite"` - California (Yosemite Valley, Half Dome)
- `"Grand Canyon"` - Arizona
- `"Rocky Mountain"` - Colorado
- `"Mount Rainier"` - Washington
- `"Crater Lake"` - Oregon
- `"Zion"` - Utah
- `"Denali"` - Alaska
- `"Everglades"` - Florida

**By State:**
- California: `"Half Dome"`, `"Mount Whitney"`, `"Big Sur"`, `"Joshua Tree"`, `"Death Valley"`
- Colorado: `"Maroon Bells"`, `"Pikes Peak"`, `"Hanging Lake"`
- Washington: `"Olympic"`, `"Mount St. Helens"`, `"North Cascades"`
- Oregon: `"Multnomah Falls"`, `"Mount Hood"`, `"Cannon Beach"`
- Arizona: `"Sedona"`, `"Havasu Falls"`, `"Monument Valley"`
- Utah: `"Bryce Canyon"`, `"Arches"`, `"Canyonlands"`

**Example Request:**
```json
{
  "query": "Yosemite",
  "options": {
    "limit": 5
  }
}
```

**Example Response:**
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "name": "Yosemite Valley Trailhead",
    "address": "CA",
    "location": { "lat": 37.7489, "lon": -119.5890 },
    "type": "trailhead"
  },
  {
    "id": "507f1f77bcf86cd799439012",
    "name": "Yosemite Valley Trailhead Trail",
    "address": "A moderate 8.5-mile trail in CA with 1200ft elevation gain.",
    "location": { "lat": 0, "lon": 0 },
    "type": "trail"
  }
]
```

### 4. Get Location Details
**Endpoint:** `POST /getLocationDetails`

**Request Body:**
```typescript
{
  locationId: string;
  type: "trailhead" | "trail" | "transit_stop" | "poi";
}
```

**Response:** `LocationSearchResult` object

### 5. Reverse Geocoding
**Endpoint:** `POST /reverseGeocode`

**Request Body:**
```typescript
{
  lat: number;
  lon: number;
}
```

**Response:** `LocationSearchResult` object with address information

### 6. Get Nearby Locations
**Endpoint:** `POST /getNearbyLocations`

**Description:** Find locations near a specific point using geospatial search.

> **⚠️ Important:** This endpoint requires **valid numeric coordinates**:
> - `lat` must be a number between -90 and 90 (NOT null/undefined)
> - `lon` must be a number between -180 and 180 (NOT null/undefined)
> - If coordinates are invalid, you'll get an error: `"Invalid coordinates: lat and lon must be valid numbers"`

**Request Body:**
```typescript
{
  center: { 
    lat: number;    // Required: Latitude (-90 to 90)
    lon: number;    // Required: Longitude (-180 to 180)
  };
  radius?: number;               // Radius in meters (default: 1000)
  types?: string[];              // Location types (default: ["trailhead", "trail", "transit_stop"])
  limit?: number;                // Max results (default: 20)
}
```

**Response:** Array of `LocationSearchResult` objects, sorted by distance

**Example Request:**
```json
{
  "center": { "lat": 37.7489, "lon": -119.5890 },
  "radius": 5000,
  "types": ["trailhead", "transit_stop"],
  "limit": 10
}
```

**Example Response:**
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "name": "Yosemite Valley Trailhead",
    "address": "CA",
    "location": { "lat": 37.7489, "lon": -119.5890 },
    "type": "trailhead",
    "relevance": 1.0,
    "distance": 245,
    "tags": ["CA", "moderate", "1200"]
  }
]
```

---

## 📚 **Search History API**

### 7. Get Recent Searches
**Endpoint:** `POST /getRecentSearches`

**Request Body:**
```typescript
{
  userId?: string;               // Optional user ID
  limit?: number;                // Max results (default: 10)
}
```

**Response:**
```typescript
SearchHistoryEntry[];

interface SearchHistoryEntry {
  id: string;
  origin: { lat: number; lon: number; address?: string; name?: string };
  destination: { lat: number; lon: number; address?: string; name?: string };
  mode: string;
  searchedAt: string;            // ISO timestamp
  resultCount: number;
}
```

### 8. Get Search Suggestions
**Endpoint:** `POST /getSearchSuggestions`

**Request Body:**
```typescript
{
  query: string;                 // Partial search query
  userId?: string;               // Optional user ID
  limit?: number;                // Max suggestions (default: 5)
}
```

**Response:**
```typescript
{
  text: string;
  type: "origin" | "destination" | "mode";
  location?: { lat: number; lon: number };
}[]
```

### 9. Get Search Statistics
**Endpoint:** `POST /getSearchStats`

**Request Body:**
```typescript
{
  userId?: string;               // Optional user ID
  days?: number;                 // Number of days to analyze (default: 30)
}
```

**Response:**
```typescript
{
  totalSearches: number;
  popularDestinations: Array<{
    location: { lat: number; lon: number; name: string };
    count: number;
  }>;
  popularModes: Array<{
    mode: string;
    count: number;
  }>;
  recentSearches: SearchHistoryEntry[];
}
```

### 10. Clear Search History
**Endpoint:** `POST /clearSearchHistory`

**Request Body:**
```typescript
{
  userId?: string;               // Either userId or sessionId required
  sessionId?: string;
}
```

**Response:**
```typescript
{
  deletedCount: number;          // Number of entries deleted
}
```

---

## 🏔️ **Hiking Data Overview**

The backend is populated with **110+ hiking locations** across the United States:

### **Geographic Coverage:**
- **California**: Yosemite, Big Sur, Joshua Tree, Death Valley, etc.
- **Colorado**: Rocky Mountain National Park, Maroon Bells, Pikes Peak, etc.
- **Washington**: Mount Rainier, Olympic National Park, North Cascades, etc.
- **Oregon**: Crater Lake, Mount Hood, Columbia River Gorge, etc.
- **Arizona**: Grand Canyon, Sedona, Antelope Canyon, etc.
- **Utah**: Zion, Bryce Canyon, Arches, Canyonlands, etc.
- **Montana**: Glacier National Park, Yellowstone, Bob Marshall Wilderness, etc.
- **Wyoming**: Grand Teton, Wind River Range, Devils Tower, etc.
- **Alaska**: Denali, Kenai Fjords, Wrangell-St. Elias, etc.
- **Texas**: Big Bend, Guadalupe Mountains, Palo Duro Canyon, etc.
- **Florida**: Everglades, Big Cypress, Ocala National Forest, etc.

### **Data Types:**
- **110 Trailheads**: Starting points with parking, facilities, accessibility info
- **110 Trails**: Individual trail segments with difficulty, length, elevation data
- **12 Transit Stops**: Public transportation access points near major cities

### **Location Properties:**
```typescript
interface Trailhead {
  id: string;
  name: string;
  location: { lat: number; lon: number };
  parking: boolean;
  facilities: string[];           // e.g., ["restroom", "water"]
  accessibility: string[];       // e.g., ["wheelchair"]
  transit_stops: string[];       // Connected transit stop IDs
  trails: string[];              // Connected trail IDs
  tags: {
    state: string;
    difficulty: string;
    elevation_gain: string;
  };
}

interface Trail {
  id: string;
  name: string;
  minutes: number;               // Estimated duration in minutes
  description: string;
  difficulty: "easy" | "moderate" | "hard" | "expert";
  length: number;                // Length in meters
  elevation_gain: number;        // Elevation gain in meters
  surface: string;               // e.g., "dirt", "paved"
  condition: "open" | "closed" | "maintenance";
  last_updated: string;          // ISO timestamp
}
```

---

## 🚀 **Frontend Integration Guide**

### **1. Route Planning Flow:**
```javascript
// 1. User searches for hiking destinations (searches MongoDB database)
const response = await fetch('http://localhost:8000/HikingApp/searchLocations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    query: 'Yosemite',
    options: { limit: 5 }
  })
});

const results = await response.json();
// Returns: Array of { id, name, address, location: {lat, lon}, type }

// 2. User selects a trailhead from results
const selectedTrailhead = results.find(r => r.type === 'trailhead');

// 3. Calculate route to trailhead
const routeResponse = await fetch('http://localhost:8000/HikingApp/calculateRoute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    origin: { lat: 37.7749, lon: -122.4194, address: 'San Francisco, CA' },
    destination: selectedTrailhead.location,
    mode: 'hiking',
    preferences: { difficulty: 'moderate' }
  })
});

const route = await routeResponse.json();

// 4. Display route with standardized formatting
console.log(`Distance: ${route.totalDistanceFormatted}`);
console.log(`Duration: ${route.totalDurationFormatted}`);
```

### **2. Location Search with Autocomplete:**
```javascript
// Search for hiking locations (case-insensitive, partial matching)
const searchHikingLocations = async (userInput) => {
  const response = await fetch('http://localhost:8000/HikingApp/searchLocations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: userInput,  // e.g., "yosemite", "grand canyon", "mount"
      options: { limit: 10 }
    })
  });
  
  const locations = await response.json();
  
  // Filter to show only trailheads in autocomplete
  return locations.filter(loc => loc.type === 'trailhead');
};

// Example usage: Real-time autocomplete
document.getElementById('searchInput').addEventListener('input', async (e) => {
  const query = e.target.value;
  
  if (query.length < 2) return; // Wait for 2+ characters
  
  const suggestions = await searchHikingLocations(query);
  displaySuggestions(suggestions); // Show in dropdown
});

// Example: Search button click
document.getElementById('searchBtn').addEventListener('click', async () => {
  const query = document.getElementById('searchInput').value;
  const results = await searchHikingLocations(query);
  
  results.forEach(location => {
    console.log(`${location.name} - ${location.address}`);
    console.log(`  Coordinates: ${location.location.lat}, ${location.location.lon}`);
  });
});
```

### **3. Recent Searches:**
```javascript
// Load recent searches on app start
const recentSearches = await fetch('http://localhost:8000/HikingApp/getRecentSearches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 10 })
});

// Display in UI: "Boston, MA – Just now"
recentSearches.forEach(search => {
  console.log(`${search.origin.address} → ${search.destination.address} – ${search.searchedAt}`);
});
```

### **4. Error Handling:**
```javascript
try {
  const response = await fetch('http://localhost:8000/HikingApp/calculateRoute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ /* your route request */ })
  });
  const data = await response.json();
  
  if (data.error) {
    console.error('API Error:', data.error);
    // Handle specific error cases
  } else {
    // Process successful response
    displayRoute(data);
  }
} catch (error) {
  console.error('Network Error:', error);
  // Handle network issues
}
```

---

## 📊 **Performance Considerations**

- **Caching**: Search results cached for 5 minutes
- **Pagination**: Use `limit` parameter to control result size
- **Geographic Queries**: Optimized with MongoDB 2dsphere indexes
- **Rate Limiting**: Consider implementing client-side rate limiting for search

## 🔧 **Development Setup**

1. **Start Backend Server:**
   ```bash
   deno run --allow-net --allow-env --allow-read --allow-sys src/concept_server.ts
   ```

2. **Populate Test Data:**
   ```bash
   deno run --allow-net --allow-env --allow-read --allow-sys src/scripts/runDataGeneration.ts
   ```

3. **Test API:**
   ```bash
   deno run --allow-net --allow-env --allow-read --allow-sys src/scripts/testBackendFixes.ts
   ```

This API specification ensures your frontend can fully integrate with the backend's comprehensive hiking location data and routing capabilities! 🏔️🥾
