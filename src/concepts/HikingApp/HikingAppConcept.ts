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
   */
  async searchLocations(query: string, options: any = {}) {
    return await this.unifiedRouting.searchLocations(query, options.limit || 10);
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
  async reverseGeocodeLocation(lat: number, lon: number) {
    return await this.locationSearch.reverseGeocode(lat, lon);
  }

  /**
   * Get nearby locations
   */
  async getNearbyLocations(center: any, radius?: number, types?: string[], limit?: number) {
    return await this.locationSearch.getNearbyLocations(center, radius, types, limit);
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
}

export default HikingAppConcept;
