import { Db } from "npm:mongodb";
import { TransitRoutePlannerConcept } from "./TransitRoutePlanner.ts";
import { DynamicExitPlannerConcept } from "./DynamicExitPlanner.ts";
import { ConstraintMonitorConcept } from "./ConstraintMonitor.ts";
import { ExternalRoutingEngineConcept } from "./ExternalRoutingEngine.ts";
import MapVisualizationConcept from "./MapVisualizationConcept.ts";
import POISearchConcept from "./POISearchConcept.ts";
import UnifiedRoutingConcept from "./UnifiedRoutingConcept.ts";
import SearchHistoryConcept from "./SearchHistoryConcept.ts";
import LocationSearchConcept from "./LocationSearchConcept.ts";

/**
 * Main HikingApp concept that coordinates all hiking-related functionality.
 * This serves as the primary interface for the TrailLink application.
 */
export class HikingAppConcept {
  private transitRoutePlanner: TransitRoutePlannerConcept;
  private dynamicExitPlanner: DynamicExitPlannerConcept;
  private constraintMonitor: ConstraintMonitorConcept;
  private externalRoutingEngine: ExternalRoutingEngineConcept;
  private mapVisualization: MapVisualizationConcept;
  private poiSearch: POISearchConcept;
  private unifiedRouting: UnifiedRoutingConcept;
  private searchHistory: SearchHistoryConcept;
  private locationSearch: LocationSearchConcept;

  constructor(private db: Db) {
    this.transitRoutePlanner = new TransitRoutePlannerConcept(db);
    this.dynamicExitPlanner = new DynamicExitPlannerConcept(db);
    this.constraintMonitor = new ConstraintMonitorConcept(db);
    this.externalRoutingEngine = new ExternalRoutingEngineConcept(db);
    this.mapVisualization = new MapVisualizationConcept(db);
    this.poiSearch = new POISearchConcept(db);
    this.unifiedRouting = new UnifiedRoutingConcept(db);
    this.searchHistory = new SearchHistoryConcept(db);
    this.locationSearch = new LocationSearchConcept(db);
  }

  /**
   * Unified route calculation - main entry point for all routing
   */
  async calculateRoute(request: any) {
    return await this.unifiedRouting.calculateRoute(request);
  }

  /**
   * Plan a complete hiking route with transit access (legacy method)
   */
  async planRoute(origin: any, destination: any, constraints: any) {
    return await this.transitRoutePlanner.planRoute(origin, destination, constraints);
  }

  /**
   * Get alternative routes based on criteria
   */
  async getAlternativeRoutes(route: any, criteria: string) {
    return await this.transitRoutePlanner.getAlternativeRoutes(route, criteria);
  }

  /**
   * Update route constraints
   */
  async updateRouteConstraints(route: any, newConstraints: any) {
    return await this.transitRoutePlanner.updateRouteConstraints(route, newConstraints);
  }

  /**
   * Start a new hike
   */
  async startHike(route: any, user: any) {
    return await this.dynamicExitPlanner.startHike(route, user);
  }

  /**
   * Update hike location
   */
  async updateLocation(hike: any, newLocation: any) {
    return await this.dynamicExitPlanner.updateLocation(hike, newLocation);
  }

  /**
   * Get exit strategies for current location
   */
  async getExitStrategies(hike: any) {
    return await this.dynamicExitPlanner.getExitStrategies(hike);
  }

  /**
   * End a hike
   */
  async endHike(hike: any, exitPoint: any) {
    return await this.dynamicExitPlanner.endHike(hike, exitPoint);
  }

  /**
   * Update transit schedules
   */
  async updateTransitSchedules() {
    return await this.constraintMonitor.updateTransitSchedules();
  }

  /**
   * Check weather conditions
   */
  async checkWeatherConditions(location: any) {
    return await this.constraintMonitor.checkWeatherConditions(location);
  }

  /**
   * Get trail conditions
   */
  async getTrailConditions(trail: any) {
    return await this.constraintMonitor.getTrailConditions(trail);
  }

  /**
   * Generate constraint alerts
   */
  async generateAlerts(route: any) {
    return await this.constraintMonitor.generateAlerts(route);
  }

  /**
   * Calculate route using external engine (legacy method - use calculateRoute instead)
   */
  async calculateRouteExternal(origin: any, destination: any, mode: string, constraints: any) {
    return await this.externalRoutingEngine.calculateRoute(origin, destination, mode, constraints);
  }

  /**
   * Get alternative routes from external engine (internal method)
   */
  async getAlternativeRoutesFromEngine(origin: any, destination: any, mode: string, maxAlternatives: number) {
    return await this.externalRoutingEngine.getAlternativeRoutes(origin, destination, mode, maxAlternatives);
  }

  /**
   * Update network data
   */
  async updateNetworkData() {
    return await this.externalRoutingEngine.updateNetworkData();
  }

  // =============================================================================
  // NEW MAPPING AND OSM METHODS
  // =============================================================================

  /**
   * Calculate hiking route using OSM data
   */
  async calculateHikingRoute(origin: any, destination: any, preferences?: any) {
    return await this.externalRoutingEngine.calculateHikingRoute(origin, destination, preferences);
  }

  /**
   * Calculate multi-modal route (transit + hiking)
   */
  async calculateMultiModalRoute(origin: any, destination: any, options?: any) {
    return await this.externalRoutingEngine.calculateMultiModalRoute(origin, destination, options);
  }

  /**
   * Find nearby trails and trailheads
   */
  async findNearbyTrails(center: any, radiusKm?: number) {
    return await this.externalRoutingEngine.findNearbyTrails(center, radiusKm);
  }

  /**
   * Get route alternatives using different criteria
   */
  async getRouteAlternatives(origin: any, destination: any, criteria: string) {
    return await this.externalRoutingEngine.getRouteAlternatives(origin, destination, criteria);
  }

  /**
   * Get map tile data
   */
  async getMapTile(z: number, x: number, y: number, style?: string) {
    return await this.mapVisualization.getMapTile(z, x, y, style);
  }

  /**
   * Get map tiles for a bounding box
   */
  async getMapTilesForBounds(bounds: any, zoom: number, style?: string) {
    return await this.mapVisualization.getMapTilesForBounds(bounds, zoom, style);
  }

  /**
   * Get map style configuration
   */
  async getMapStyle(style?: string) {
    return this.mapVisualization.getMapStyle(style);
  }

  /**
   * Get available map styles
   */
  async getAvailableStyles() {
    return this.mapVisualization.getAvailableStyles();
  }

  /**
   * Get route visualization data
   */
  async getRouteVisualization(routeSegments: any[], options?: any) {
    return await this.mapVisualization.getRouteVisualization(routeSegments, options);
  }

  /**
   * Get POI visualization data
   */
  async getPOIVisualization(center: any, radiusKm?: number, types?: string[]) {
    return await this.mapVisualization.getPOIVisualization(center, radiusKm, types);
  }

  /**
   * Search for POIs near a location
   */
  async searchPOIs(center: any, types: string[], radiusKm?: number, limit?: number) {
    return await this.poiSearch.searchPOIs(center, types, radiusKm, limit);
  }

  /**
   * Find trails near a location
   */
  async findTrails(center: any, radiusKm?: number, difficulty?: string, surface?: string) {
    return await this.poiSearch.findTrails(center, radiusKm, difficulty, surface);
  }

  /**
   * Find trailheads near a location
   */
  async findTrailheads(center: any, radiusKm?: number) {
    return await this.poiSearch.findTrailheads(center, radiusKm);
  }

  /**
   * Find transit stops near a location
   */
  async findTransitStops(center: any, radiusKm?: number) {
    return await this.poiSearch.findTransitStops(center, radiusKm);
  }

  /**
   * Find amenities near a location
   */
  async findAmenities(center: any, amenityTypes: string[], radiusKm?: number) {
    return await this.poiSearch.findAmenities(center, amenityTypes, radiusKm);
  }

  /**
   * Search POIs by name
   */
  async searchPOIsByName(name: string, center?: any, radiusKm?: number, types?: string[]) {
    return await this.poiSearch.searchPOIsByName(name, center, radiusKm, types);
  }

  /**
   * Get POI details by ID
   */
  async getPOIDetails(poiId: string) {
    return await this.poiSearch.getPOIDetails(poiId);
  }

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address: string, limit?: number) {
    return await this.poiSearch.geocodeAddress(address, limit);
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(point: any) {
    return await this.poiSearch.reverseGeocode(point);
  }

  /**
   * Search for places by name
   */
  async searchPlaces(query: string, center?: any, radiusKm?: number, limit?: number) {
    return await this.poiSearch.searchPlaces(query, center, radiusKm, limit);
  }

  /**
   * Get POI search suggestions (for place names)
   */
  async getPOISearchSuggestions(partialQuery: string, center?: any, limit?: number) {
    return await this.poiSearch.getSearchSuggestions(partialQuery, center, limit);
  }

  /**
   * Get map configuration for client
   */
  async getMapConfig(center: any, zoom?: number) {
    return this.mapVisualization.getMapConfig(center, zoom);
  }

  /**
   * Calculate bounding box from center and radius
   */
  async calculateBounds(center: any, radiusKm: number) {
    return this.mapVisualization.calculateBounds(center, radiusKm);
  }

  /**
   * Calculate optimal zoom level for bounds
   */
  async calculateOptimalZoom(bounds: any, maxTiles?: number) {
    return this.mapVisualization.calculateOptimalZoom(bounds, maxTiles);
  }

  /**
   * Get popular POI types
   */
  async getPopularPOITypes() {
    return this.poiSearch.getPopularPOITypes();
  }

  /**
   * Get POI type descriptions
   */
  async getPOITypeDescriptions() {
    return this.poiSearch.getPOITypeDescriptions();
  }

  /**
   * Get map service statistics
   */
  async getMapStats() {
    return await this.mapVisualization.getMapStats();
  }

  /**
   * Get search statistics
   */
  async getSearchStats() {
    return await this.poiSearch.getSearchStats();
  }

  /**
   * Clean up expired cache
   */
  async cleanupExpiredCache() {
    const [mapCleanup, poiCleanup] = await Promise.all([
      this.mapVisualization.cleanupExpiredTiles(),
      this.poiSearch.cleanupExpiredCache()
    ]);
    
    return {
      mapTilesCleaned: mapCleanup,
      poiCacheCleaned: poiCleanup
    };
  }

  /**
   * Initialize all mapping services
   */
  async initializeMapping() {
    await Promise.all([
      this.mapVisualization.initialize(),
      this.poiSearch.initialize()
    ]);
  }

  /**
   * Get trail segments within specified bounds
   */
  async getTrailSegments(bounds: any) {
    const { south, west, north, east } = bounds;
    
    // Query OSM data for hiking trails in the bounds
    const trails = await this.poiSearch.queryOSMForTrails(south, west, north, east);
    
    return {
      trails: trails.map(trail => ({
        id: trail.id,
        name: trail.name,
        type: trail.tags?.highway || 'path', // 'hiking', 'footway', 'path', etc.
        coordinates: trail.coordinates,
        difficulty: trail.difficulty,
        surface: trail.surface
      }))
    };
  }

  // =============================================================================
  // NEW UNIFIED API METHODS
  // =============================================================================

  /**
   * Search for locations with autocomplete
   * Returns locations enriched with route information for navigation
   */
  async searchLocations(requestOrQuery: any, options?: any) {
    // Handle both direct calls and API calls via concept server
    let query: string;
    let limit: number;
    
    if (typeof requestOrQuery === 'string') {
      // Direct call with string query
      query = requestOrQuery;
      limit = options?.limit || 10;
    } else if (requestOrQuery && typeof requestOrQuery === 'object') {
      // API call with request body object
      query = requestOrQuery.query;
      limit = requestOrQuery.options?.limit || requestOrQuery.limit || 10;
    } else {
      throw new Error("Invalid search request: query must be a string or request object");
    }
    
    // Validate query
    if (!query || typeof query !== 'string') {
      throw new Error("Search query is required and must be a string");
    }
    
    // Get location results
    const locations = await this.unifiedRouting.searchLocations(query, limit);
    
    // Enrich locations with route-ready coordinate segments for navigation
    return await Promise.all(locations.map(async (location: any) => {
      // Create a route segment from the location
      // This makes the location "navigation-ready" by providing start/end coordinates
      const coords = location.location;
      
      // For trails, try to fetch actual trail geometry from database
      let trailCoordinates = [
        { lat: coords.lat, lon: coords.lon }
      ];
      
      let distance = 0;
      let duration = 0;
      
      if (location.type === "trail") {
        // Fetch trail details from database to get actual geometry
        const trail = await this.db.collection("trails").findOne({ _id: location.id });
        
        if (trail && trail.geometry && trail.geometry.type === "LineString") {
          // Convert LineString coordinates to lat/lon array
          trailCoordinates = trail.geometry.coordinates.map((coord: number[]) => ({
            lat: coord[1],
            lon: coord[0]
          }));
          
          // Calculate approximate distance (in meters) and duration (in seconds)
          distance = trail.length_meters || this.calculateDistance(trailCoordinates);
          duration = Math.round(distance / 1.4); // ~1.4 m/s walking speed
        } else {
          // Create a simple 1km loop as fallback
          const offset = 0.005; // roughly 500m in degrees
          trailCoordinates = [
            { lat: coords.lat, lon: coords.lon },
            { lat: coords.lat + offset, lon: coords.lon + offset },
            { lat: coords.lat + offset, lon: coords.lon },
            { lat: coords.lat, lon: coords.lon }
          ];
          distance = 1000; // 1km
          duration = 720; // 12 minutes
        }
      } else {
        // For trailheads and other locations, create a simple point-to-point route
        // Add a second point slightly offset to make it a valid route
        const offset = 0.001; // roughly 100m
        trailCoordinates = [
          { lat: coords.lat, lon: coords.lon },
          { lat: coords.lat + offset, lon: coords.lon + offset }
        ];
        distance = 100; // 100m
        duration = 72; // ~1 minute
      }
      
      // Ensure we have at least 2 coordinates (start and end)
      if (trailCoordinates.length < 2) {
        const offset = 0.001;
        trailCoordinates.push({
          lat: coords.lat + offset,
          lon: coords.lon + offset
        });
      }
      
      return {
        ...location,
        // Add route-specific fields needed by frontend
        coordinates: trailCoordinates,
        segments: [
          {
            type: location.type,
            from: trailCoordinates[0],
            to: trailCoordinates[trailCoordinates.length - 1],
            distance,
            duration,
            mode: "hiking",
            instructions: [
              `Start at ${location.name}`,
              `Follow trail for ${(distance / 1000).toFixed(1)} km`,
              `End at ${location.name}`
            ],
            coordinates: trailCoordinates
          }
        ],
        // Route metadata
        startLocation: trailCoordinates[0],
        endLocation: trailCoordinates[trailCoordinates.length - 1],
        distance,
        duration,
        difficulty: location.type === "trail" ? "moderate" : "easy"
      };
    }));
  }

  /**
   * Calculate distance between coordinates using Haversine formula
   */
  private calculateDistance(coordinates: { lat: number; lon: number }[]): number {
    if (coordinates.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const from = coordinates[i];
      const to = coordinates[i + 1];
      
      const R = 6371000; // Earth's radius in meters
      const φ1 = from.lat * Math.PI / 180;
      const φ2 = to.lat * Math.PI / 180;
      const Δφ = (to.lat - from.lat) * Math.PI / 180;
      const Δλ = (to.lon - from.lon) * Math.PI / 180;
      
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      
      totalDistance += R * c;
    }
    
    return totalDistance;
  }

  /**
   * Get recent searches
   */
  async getRecentSearches(userId?: string, limit?: number) {
    return await this.unifiedRouting.getRecentSearches(userId, limit);
  }

  /**
   * Get location details
   */
  async getLocationDetails(locationId: string, type: string) {
    return await this.locationSearch.getLocationDetails(locationId, type);
  }

  /**
   * Reverse geocode coordinates to location (uses location search)
   */
  async reverseGeocodeLocation(requestOrLat: any, lon?: number) {
    // Handle both direct calls and API calls via concept server
    let lat: number;
    let longitude: number;
    
    if (typeof requestOrLat === 'number') {
      // Direct call with numbers
      lat = requestOrLat;
      longitude = lon!;
    } else if (requestOrLat && typeof requestOrLat === 'object') {
      // API call with request body object
      lat = requestOrLat.lat;
      longitude = requestOrLat.lon;
    } else {
      throw new Error("Invalid reverse geocode request");
    }
    
    return await this.locationSearch.reverseGeocode(lat, longitude);
  }

  /**
   * Get nearby locations
   */
  async getNearbyLocations(requestOrCenter: any, radius?: number, types?: string[], limit?: number) {
    // Handle both direct calls and API calls via concept server
    let center: { lat: number; lon: number };
    let searchRadius: number;
    let searchTypes: string[];
    let searchLimit: number;
    
    if (requestOrCenter && requestOrCenter.center) {
      // API call with request body object
      center = requestOrCenter.center;
      searchRadius = requestOrCenter.radius || 1000;
      searchTypes = requestOrCenter.types || ["trailhead", "transit_stop"];
      searchLimit = requestOrCenter.limit || 20;
    } else if (requestOrCenter && requestOrCenter.lat !== undefined) {
      // Direct call with center object
      center = requestOrCenter;
      searchRadius = radius || 1000;
      searchTypes = types || ["trailhead", "transit_stop"];
      searchLimit = limit || 20;
    } else {
      throw new Error("Invalid nearby locations request");
    }
    
    return await this.locationSearch.getNearbyLocations(center, searchRadius, searchTypes, searchLimit);
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(query: string, userId?: string, limit?: number) {
    return await this.searchHistory.getSearchSuggestions(query, userId, limit);
  }

  /**
   * Get search history statistics
   */
  async getSearchHistoryStats(userId?: string, days?: number) {
    return await this.searchHistory.getSearchStats(userId, days);
  }

  /**
   * Clear search history
   */
  async clearSearchHistory(userId?: string, sessionId?: string) {
    return await this.searchHistory.clearHistory(userId, sessionId);
  }

  // =============================================================================
  // NAVIGATION STATUS API
  // =============================================================================

  /**
   * Start navigation for a route
   * Initializes an active hike for navigation tracking
   */
  async startNavigation(request: {
    routeId: string;
    userId?: string;
    startLocation: { lat: number; lon: number };
  }) {
    const { routeId, userId = "anonymous", startLocation } = request;
    
    // Start the hike using DynamicExitPlanner
    const activeHikeId = await this.dynamicExitPlanner.startHike(
      routeId,
      userId,
      startLocation.lat,
      startLocation.lon
    );
    
    return {
      success: true,
      activeHikeId,
      status: "active",
      startTime: new Date().toISOString(),
      currentLocation: startLocation
    };
  }

  /**
   * Update navigation location
   * Updates the current position during active navigation
   */
  async updateNavigationLocation(request: {
    activeHikeId: string;
    location: { lat: number; lon: number };
  }) {
    const { activeHikeId, location } = request;
    
    // Update location using DynamicExitPlanner
    await this.dynamicExitPlanner.updateLocation(
      activeHikeId,
      location.lat,
      location.lon
    );
    
    // Get updated exit strategies
    const exitStrategies = await this.dynamicExitPlanner.getExitStrategies(activeHikeId);
    
    return {
      success: true,
      currentLocation: location,
      exitStrategiesAvailable: exitStrategies.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get navigation status for a route
   * Returns current navigation state and available exit options
   */
  async getNavigationStatus(request: {
    routeId: string;
    location?: { lat: number; lon: number };
  }) {
    const { routeId, location } = request;
    
    // Find active hike for this route
    const activeHikes = await this.db.collection("active_hikes").find({
      plannedRouteId: routeId,
      status: "active"
    }).toArray();
    
    if (activeHikes.length === 0) {
      // No active hike, return basic status
      return {
        isNavigating: false,
        routeId,
        message: "No active navigation for this route"
      };
    }
    
    const activeHike = activeHikes[0];
    
    // Update location if provided
    if (location) {
      await this.dynamicExitPlanner.updateLocation(
        activeHike._id,
        location.lat,
        location.lon
      );
    }
    
    // Get exit strategies
    const exitStrategies = await this.dynamicExitPlanner.getExitStrategies(activeHike._id);
    
    return {
      isNavigating: true,
      activeHikeId: activeHike._id,
      routeId: activeHike.plannedRouteId,
      startTime: activeHike.startIso,
      currentLocation: {
        lat: activeHike.loc.coordinates[1],
        lon: activeHike.loc.coordinates[0]
      },
      exitStrategies: exitStrategies.slice(0, 3), // Return top 3 strategies
      lastUpdate: activeHike.lastUpdateIso
    };
  }

  /**
   * End navigation
   * Completes an active hike
   */
  async endNavigation(request: {
    activeHikeId: string;
    exitPointId?: string;
    location: { lat: number; lon: number };
  }) {
    const { activeHikeId, exitPointId, location } = request;
    
    // If no exit point specified, create a default one
    let finalExitPointId = exitPointId;
    
    if (!finalExitPointId) {
      // Find nearest exit point or use current location
      const exitPoints = await this.db.collection("exit_points").find({
        loc: {
          $near: {
            $geometry: { type: "Point", coordinates: [location.lon, location.lat] },
            $maxDistance: 5000 // 5km
          }
        }
      }).limit(1).toArray();
      
      if (exitPoints.length > 0) {
        finalExitPointId = exitPoints[0]._id;
      } else {
        // Create a temporary exit point
        finalExitPointId = "completed";
      }
    }
    
    // End the hike
    const completedHikeId = await this.dynamicExitPlanner.endHike(
      activeHikeId,
      finalExitPointId
    );
    
    return {
      success: true,
      completedHikeId,
      endTime: new Date().toISOString(),
      message: "Navigation completed successfully"
    };
  }

  /**
   * Get status updates
   * Returns real-time updates for active navigation
   */
  async getStatusUpdates(request?: {
    userId?: string;
    activeHikeId?: string;
  }) {
    const { userId = "anonymous", activeHikeId } = request || {};
    
    // Build query
    const query: any = { status: "active" };
    if (userId) {
      query.userId = userId;
    }
    if (activeHikeId) {
      query._id = activeHikeId;
    }
    
    // Get active hikes
    const activeHikes = await this.db.collection("active_hikes")
      .find(query)
      .limit(10)
      .toArray();
    
    // Get exit strategies for each active hike
    const updates = await Promise.all(
      activeHikes.map(async (hike: any) => {
        const exitStrategies = await this.dynamicExitPlanner.getExitStrategies(hike._id);
        
        return {
          activeHikeId: hike._id,
          routeId: hike.plannedRouteId,
          userId: hike.userId,
          currentLocation: {
            lat: hike.loc.coordinates[1],
            lon: hike.loc.coordinates[0]
          },
          startTime: hike.startIso,
          lastUpdate: hike.lastUpdateIso,
          status: hike.status,
          exitStrategiesCount: exitStrategies.length,
          topExitStrategies: exitStrategies.slice(0, 2)
        };
      })
    );
    
    return {
      updates,
      timestamp: new Date().toISOString(),
      count: updates.length
    };
  }
}

export default HikingAppConcept;
