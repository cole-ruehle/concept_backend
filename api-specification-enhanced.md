# Enhanced API Specification: HikingApp Backend with OSM Integration

**Base URL:** `http://localhost:8000/api`

This enhanced API provides comprehensive mapping functionality using OpenStreetMap data, enabling real route calculation, map visualization, and POI discovery for the TrailLink hiking application.

---

## 🗺️ **New Mapping & OSM Endpoints**

### POST /api/HikingApp/calculateHikingRoute

**Description:** Calculate real hiking routes using OpenStreetMap data.

**Request Body:**
```json
{
  "origin": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "destination": {
    "lat": 42.3656,
    "lon": -71.1044
  },
  "preferences": {
    "avoidHighways": true,
    "preferTrails": true,
    "maxDistance": 10000,
    "difficulty": "moderate"
  }
}
```

**Success Response:**
```json
{
  "segments": [
    {
      "from": { "lat": 42.3601, "lon": -71.0589 },
      "to": { "lat": 42.3656, "lon": -71.1044 },
      "distance": 2500,
      "duration": 1800,
      "instructions": ["Follow Main Trail"],
      "surface": "dirt",
      "difficulty": "moderate",
      "elevation_gain": 150,
      "waypoints": [
        { "lat": 42.3601, "lon": -71.0589 },
        { "lat": 42.3656, "lon": -71.1044 }
      ]
    }
  ]
}
```

---

### POST /api/HikingApp/calculateMultiModalRoute

**Description:** Calculate multi-modal routes combining transit and hiking.

**Request Body:**
```json
{
  "origin": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "destination": {
    "lat": 42.3656,
    "lon": -71.1044
  },
  "options": {
    "maxTransitTime": 30,
    "preferDirectRoutes": true,
    "avoidTransfers": false
  }
}
```

**Success Response:**
```json
{
  "segments": [
    {
      "from": { "lat": 42.3601, "lon": -71.0589 },
      "to": { "lat": 42.3610, "lon": -71.0590 },
      "distance": 100,
      "duration": 120,
      "instructions": ["Walk to transit"],
      "surface": "pavement",
      "difficulty": "easy",
      "elevation_gain": 0,
      "waypoints": []
    },
    {
      "from": { "lat": 42.3610, "lon": -71.0590 },
      "to": { "lat": 42.3640, "lon": -71.1000 },
      "distance": 5000,
      "duration": 600,
      "instructions": ["Take transit from Central Station to Trailhead Stop"],
      "surface": "transit",
      "difficulty": "easy",
      "elevation_gain": 0,
      "waypoints": []
    }
  ]
}
```

---

### POST /api/HikingApp/findNearbyTrails

**Description:** Find trails and trailheads near a location.

**Request Body:**
```json
{
  "center": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "radiusKm": 10
}
```

**Success Response:**
```json
{
  "trails": [
    {
      "id": "trail_12345",
      "name": "Blue Hills Trail",
      "difficulty": "moderate",
      "surface": "dirt",
      "length": 5000,
      "elevation_gain": 200,
      "coordinates": [
        { "lat": 42.3601, "lon": -71.0589 },
        { "lat": 42.3656, "lon": -71.1044 }
      ],
      "tags": {
        "highway": "footway",
        "surface": "dirt"
      },
      "condition": "open",
      "last_updated": "2025-01-11T10:00:00Z"
    }
  ],
  "trailheads": [
    {
      "id": "trailhead_67890",
      "name": "Blue Hills Trailhead",
      "location": { "lat": 42.3601, "lon": -71.0589 },
      "parking": true,
      "facilities": ["restroom", "water"],
      "accessibility": ["wheelchair"],
      "transit_stops": ["stop_123"],
      "trails": ["trail_12345"],
      "tags": {}
    }
  ]
}
```

---

### POST /api/HikingApp/getRouteAlternatives

**Description:** Get route alternatives based on different criteria.

**Request Body:**
```json
{
  "origin": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "destination": {
    "lat": 42.3656,
    "lon": -71.1044
  },
  "criteria": "scenic"
}
```

**Success Response:**
```json
{
  "alternatives": [
    [
      {
        "from": { "lat": 42.3601, "lon": -71.0589 },
        "to": { "lat": 42.3656, "lon": -71.1044 },
        "distance": 3000,
        "duration": 2400,
        "instructions": ["Follow Scenic Trail"],
        "surface": "dirt",
        "difficulty": "easy",
        "elevation_gain": 100,
        "waypoints": []
      }
    ]
  ]
}
```

---

## 🗺️ **Map Visualization Endpoints**

### POST /api/HikingApp/getMapTile

**Description:** Get map tile data for rendering.

**Request Body:**
```json
{
  "z": 10,
  "x": 512,
  "y": 384,
  "style": "streets"
}
```

**Success Response:**
```json
{
  "z": 10,
  "x": 512,
  "y": 384,
  "data": "base64_encoded_tile_data",
  "format": "png",
  "cached_at": "2025-01-11T10:00:00Z",
  "expires_at": "2025-01-18T10:00:00Z"
}
```

---

### POST /api/HikingApp/getMapTilesForBounds

**Description:** Get multiple map tiles for a bounding box.

**Request Body:**
```json
{
  "bounds": {
    "north": 42.3700,
    "south": 42.3500,
    "east": -71.0400,
    "west": -71.0800
  },
  "zoom": 12,
  "style": "streets"
}
```

**Success Response:**
```json
{
  "tiles": [
    {
      "z": 12,
      "x": 1024,
      "y": 768,
      "data": "base64_encoded_tile_data",
      "format": "png",
      "cached_at": "2025-01-11T10:00:00Z",
      "expires_at": "2025-01-18T10:00:00Z"
    }
  ]
}
```

---

### POST /api/HikingApp/getMapStyle

**Description:** Get map style configuration.

**Request Body:**
```json
{
  "style": "streets"
}
```

**Success Response:**
```json
{
  "version": 8,
  "name": "Streets",
  "sources": {
    "maptiler": {
      "type": "raster",
      "tiles": ["https://api.maptiler.com/tiles/streets/{z}/{x}/{y}.png?key=..."],
      "tileSize": 256
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "raster",
      "source": "maptiler"
    }
  ]
}
```

---

### POST /api/HikingApp/getAvailableStyles

**Description:** Get available map styles.

**Request Body:**
```json
{}
```

**Success Response:**
```json
{
  "styles": ["streets", "satellite", "terrain", "openstreetmap"]
}
```

---

### POST /api/HikingApp/getRouteVisualization

**Description:** Get route visualization data as GeoJSON.

**Request Body:**
```json
{
  "routeSegments": [
    {
      "from": { "lat": 42.3601, "lon": -71.0589 },
      "to": { "lat": 42.3656, "lon": -71.1044 },
      "distance": 2500,
      "duration": 1800,
      "instructions": ["Follow Main Trail"],
      "surface": "dirt",
      "difficulty": "moderate",
      "elevation_gain": 150,
      "waypoints": [
        { "lat": 42.3601, "lon": -71.0589 },
        { "lat": 42.3656, "lon": -71.1044 }
      ]
    }
  ],
  "options": {
    "includeWaypoints": true,
    "includeElevation": true,
    "style": "streets"
  }
}
```

**Success Response:**
```json
{
  "route": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "type": "route",
          "distance": 2500,
          "duration": 1800,
          "segments": 1
        },
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [-71.0589, 42.3601],
            [-71.1044, 42.3656]
          ]
        }
      },
      {
        "type": "Feature",
        "properties": {
          "type": "waypoint",
          "segmentIndex": 0,
          "pointType": "start",
          "instruction": "Follow Main Trail"
        },
        "geometry": {
          "type": "Point",
          "coordinates": [-71.0589, 42.3601]
        }
      }
    ]
  },
  "bounds": {
    "north": 42.3656,
    "south": 42.3601,
    "east": -71.0589,
    "west": -71.1044
  },
  "style": "streets"
}
```

---

## 🔍 **POI Search Endpoints**

### POST /api/HikingApp/searchPOIs

**Description:** Search for points of interest near a location.

**Request Body:**
```json
{
  "center": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "types": ["trail", "trailhead", "transit_stop"],
  "radiusKm": 5,
  "limit": 50
}
```

**Success Response:**
```json
{
  "pois": [
    {
      "id": "poi_12345",
      "name": "Blue Hills Trail",
      "type": "trail",
      "location": { "lat": 42.3601, "lon": -71.0589 },
      "description": "Scenic hiking trail",
      "tags": {
        "highway": "footway",
        "surface": "dirt"
      },
      "distance": 500
    }
  ]
}
```

---

### POST /api/HikingApp/findTrails

**Description:** Find trails with optional filtering.

**Request Body:**
```json
{
  "center": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "radiusKm": 10,
  "difficulty": "moderate",
  "surface": "dirt"
}
```

**Success Response:**
```json
{
  "trails": [
    {
      "id": "trail_12345",
      "name": "Blue Hills Trail",
      "type": "trail",
      "location": { "lat": 42.3601, "lon": -71.0589 },
      "description": "Moderate difficulty dirt trail",
      "tags": {
        "highway": "footway",
        "surface": "dirt",
        "difficulty": "moderate"
      },
      "distance": 500
    }
  ]
}
```

---

### POST /api/HikingApp/findTrailheads

**Description:** Find trailheads near a location.

**Request Body:**
```json
{
  "center": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "radiusKm": 15
}
```

**Success Response:**
```json
{
  "trailheads": [
    {
      "id": "trailhead_67890",
      "name": "Blue Hills Trailhead",
      "type": "trailhead",
      "location": { "lat": 42.3601, "lon": -71.0589 },
      "description": "Main trailhead with parking",
      "tags": {
        "amenity": "parking",
        "tourism": "trailhead"
      },
      "distance": 200
    }
  ]
}
```

---

### POST /api/HikingApp/findTransitStops

**Description:** Find transit stops near a location.

**Request Body:**
```json
{
  "center": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "radiusKm": 2
}
```

**Success Response:**
```json
{
  "transitStops": [
    {
      "id": "transit_12345",
      "name": "Central Station",
      "type": "transit_stop",
      "location": { "lat": 42.3601, "lon": -71.0589 },
      "description": "Main transit hub",
      "tags": {
        "public_transport": "stop_position",
        "railway": "station"
      },
      "distance": 100
    }
  ]
}
```

---

### POST /api/HikingApp/findAmenities

**Description:** Find amenities near a location.

**Request Body:**
```json
{
  "center": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "amenityTypes": ["water", "restroom", "parking"],
  "radiusKm": 3
}
```

**Success Response:**
```json
{
  "amenities": [
    {
      "id": "amenity_12345",
      "name": "Drinking Water",
      "type": "water",
      "location": { "lat": 42.3601, "lon": -71.0589 },
      "description": "Public drinking fountain",
      "tags": {
        "amenity": "drinking_water"
      },
      "distance": 150
    }
  ]
}
```

---

## 🌍 **Geocoding Endpoints**

### POST /api/HikingApp/geocodeAddress

**Description:** Convert address to coordinates.

**Request Body:**
```json
{
  "address": "Boston Common, Boston, MA",
  "limit": 5
}
```

**Success Response:**
```json
{
  "coordinates": [
    {
      "lat": 42.3551,
      "lon": -71.0656
    }
  ]
}
```

---

### POST /api/HikingApp/reverseGeocode

**Description:** Convert coordinates to address.

**Request Body:**
```json
{
  "point": {
    "lat": 42.3551,
    "lon": -71.0656
  }
}
```

**Success Response:**
```json
{
  "address": "Boston Common, Boston, MA 02108, USA"
}
```

---

### POST /api/HikingApp/searchPlaces

**Description:** Search for places by name.

**Request Body:**
```json
{
  "query": "Blue Hills",
  "center": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "radiusKm": 10,
  "limit": 10
}
```

**Success Response:**
```json
{
  "places": [
    {
      "display_name": "Blue Hills Reservation, Milton, MA, USA",
      "lat": "42.2108",
      "lon": "-71.1089",
      "type": "park",
      "importance": 0.8,
      "address": {
        "city": "Milton",
        "state": "Massachusetts",
        "country": "United States"
      }
    }
  ]
}
```

---

## 🔧 **Utility Endpoints**

### POST /api/HikingApp/getMapConfig

**Description:** Get map configuration for client initialization.

**Request Body:**
```json
{
  "center": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "zoom": 10
}
```

**Success Response:**
```json
{
  "center": { "lat": 42.3601, "lon": -71.0589 },
  "zoom": 12,
  "styles": ["streets", "satellite", "terrain", "openstreetmap"],
  "defaultStyle": "streets",
  "bounds": {
    "north": 42.3651,
    "south": 42.3551,
    "east": -71.0539,
    "west": -71.0639
  }
}
```

---

### POST /api/HikingApp/getSearchSuggestions

**Description:** Get search suggestions for autocomplete.

**Request Body:**
```json
{
  "partialQuery": "Blue",
  "center": {
    "lat": 42.3601,
    "lon": -71.0589
  },
  "limit": 5
}
```

**Success Response:**
```json
{
  "suggestions": [
    "Blue Hills Reservation",
    "Blue Hills Trail",
    "Blue Hills Trailhead"
  ],
  "categories": ["trail", "trailhead", "park"]
}
```

---

### POST /api/HikingApp/getPopularPOITypes

**Description:** Get popular POI types.

**Request Body:**
```json
{}
```

**Success Response:**
```json
{
  "types": [
    "trail",
    "trailhead",
    "transit_stop",
    "parking",
    "water",
    "restroom",
    "shelter"
  ]
}
```

---

### POST /api/HikingApp/getPOITypeDescriptions

**Description:** Get POI type descriptions.

**Request Body:**
```json
{}
```

**Success Response:**
```json
{
  "descriptions": {
    "trail": "Hiking and walking trails",
    "trailhead": "Starting points for trails",
    "transit_stop": "Public transportation stops",
    "parking": "Parking areas",
    "water": "Drinking water sources",
    "restroom": "Restroom facilities",
    "shelter": "Shelters and covered areas"
  }
}
```

---

## 📊 **Statistics Endpoints**

### POST /api/HikingApp/getMapStats

**Description:** Get map service statistics.

**Request Body:**
```json
{}
```

**Success Response:**
```json
{
  "totalTiles": 1250,
  "expiredTiles": 50,
  "memoryCacheSize": 25,
  "averageTileSize": 15420
}
```

---

### POST /api/HikingApp/getSearchStats

**Description:** Get search service statistics.

**Request Body:**
```json
{}
```

**Success Response:**
```json
{
  "totalCachedQueries": 500,
  "expiredQueries": 25,
  "averagePOIsPerQuery": 12
}
```

---

### POST /api/HikingApp/cleanupExpiredCache

**Description:** Clean up expired cache data.

**Request Body:**
```json
{}
```

**Success Response:**
```json
{
  "mapTilesCleaned": 50,
  "poiCacheCleaned": 25
}
```

---

## 🚨 **Error Responses**

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error

---

## 📝 **Data Types**

### GeoPoint
```json
{
  "lat": 42.3601,
  "lon": -71.0589
}
```

### BoundingBox
```json
{
  "north": 42.3700,
  "south": 42.3500,
  "east": -71.0400,
  "west": -71.0800
}
```

### RouteSegment
```json
{
  "from": { "lat": 42.3601, "lon": -71.0589 },
  "to": { "lat": 42.3656, "lon": -71.1044 },
  "distance": 2500,
  "duration": 1800,
  "instructions": ["Follow Main Trail"],
  "surface": "dirt",
  "difficulty": "moderate",
  "elevation_gain": 150,
  "waypoints": [
    { "lat": 42.3601, "lon": -71.0589 },
    { "lat": 42.3656, "lon": -71.1044 }
  ]
}
```

### POIInfo
```json
{
  "id": "poi_12345",
  "name": "Blue Hills Trail",
  "type": "trail",
  "location": { "lat": 42.3601, "lon": -71.0589 },
  "description": "Scenic hiking trail",
  "tags": {
    "highway": "footway",
    "surface": "dirt"
  },
  "distance": 500
}
```

---

## 🔄 **Rate Limiting**

- **Default:** 60 requests per minute per IP
- **Burst:** 10 requests per burst
- **Caching:** Responses are cached to minimize API calls

---

## 🌐 **CORS Support**

The API supports CORS for frontend integration:
- **Allowed Origins:** `*` (configurable)
- **Allowed Methods:** `GET, POST, OPTIONS`
- **Allowed Headers:** `Content-Type, Authorization`

---

This enhanced API provides comprehensive mapping functionality with real OpenStreetMap integration, enabling rich hiking route planning and visualization features for your frontend application.


