import { Db } from "npm:mongodb";
import { GeoPoint, BoundingBox, POIInfo } from "../../utils/mappingTypes.ts";
import { getMappingCollections, ensureMappingCollections } from "../../utils/database.ts";
import POIService from "../../services/POIService.ts";
import GeocodingService from "../../services/GeocodingService.ts";

/**
 * POI Search concept for finding and searching points of interest
 * Provides endpoints for location search, geocoding, and POI discovery
 */
export class POISearchConcept {
  private poiService: POIService;
  private geocodingService: GeocodingService;

  constructor(private db: Db) {
    this.poiService = new POIService(db);
    this.geocodingService = new GeocodingService();
  }

  /**
   * Search for POIs near a location
   */
  async searchPOIs(
    center: GeoPoint,
    types: string[],
    radiusKm: number = 5,
    limit: number = 50
  ): Promise<POIInfo[]> {
    if (radiusKm < 0.1 || radiusKm > 1000) {
      throw new Error("Radius must be between 0.1 and 1000 km");
    }

    if (limit < 1 || limit > 200) {
      throw new Error("Limit must be between 1 and 200");
    }

    return await this.poiService.searchPOIs(center, types, radiusKm, limit);
  }

  /**
   * Find trails near a location
   */
  async findTrails(
    center: GeoPoint,
    radiusKm: number = 10,
    difficulty?: string,
    surface?: string
  ): Promise<POIInfo[]> {
    return await this.poiService.findTrails(center, radiusKm, difficulty, surface);
  }

  /**
   * Find trailheads near a location
   */
  async findTrailheads(
    center: GeoPoint,
    radiusKm: number = 15
  ): Promise<POIInfo[]> {
    return await this.poiService.findTrailheads(center, radiusKm);
  }

  /**
   * Find transit stops near a location
   */
  async findTransitStops(
    center: GeoPoint,
    radiusKm: number = 2
  ): Promise<POIInfo[]> {
    return await this.poiService.findTransitStops(center, radiusKm);
  }

  /**
   * Find amenities near a location
   */
  async findAmenities(
    center: GeoPoint,
    amenityTypes: string[],
    radiusKm: number = 3
  ): Promise<POIInfo[]> {
    return await this.poiService.findAmenities(center, amenityTypes, radiusKm);
  }

  /**
   * Search POIs by name
   */
  async searchPOIsByName(
    name: string,
    center?: GeoPoint,
    radiusKm?: number,
    types?: string[]
  ): Promise<POIInfo[]> {
    if (!name || name.trim().length < 2) {
      throw new Error("Search name must be at least 2 characters");
    }

    return await this.poiService.searchPOIsByName(name, center, radiusKm, types);
  }

  /**
   * Get POI details by ID
   */
  async getPOIDetails(poiId: string): Promise<POIInfo | null> {
    if (!poiId || poiId.trim().length === 0) {
      throw new Error("POI ID is required");
    }

    return await this.poiService.getPOIDetails(poiId);
  }

  /**
   * Get POIs within a bounding box
   */
  async getPOIsInBounds(
    bounds: BoundingBox,
    types: string[],
    limit: number = 100
  ): Promise<POIInfo[]> {
    return await this.poiService.getPOIsInBounds(bounds, types, limit);
  }

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address: string, limit: number = 5): Promise<GeoPoint[]> {
    if (!address || address.trim().length < 3) {
      throw new Error("Address must be at least 3 characters");
    }

    return await this.geocodingService.geocode(address, limit);
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(point: GeoPoint): Promise<string> {
    if (!this.geocodingService.isValidCoordinates(point)) {
      throw new Error("Invalid coordinates provided");
    }

    return await this.geocodingService.reverseGeocode(point);
  }

  /**
   * Search for places by name with optional location bias
   */
  async searchPlaces(
    query: string,
    center?: GeoPoint,
    radiusKm?: number,
    limit: number = 10
  ): Promise<any[]> {
    if (!query || query.trim().length < 2) {
      throw new Error("Search query must be at least 2 characters");
    }

    return await this.geocodingService.searchPlaces(query, center, radiusKm, limit);
  }

  /**
   * Get coordinates for a specific address
   */
  async getCoordinates(address: string): Promise<GeoPoint | null> {
    return await this.geocodingService.getCoordinates(address);
  }

  /**
   * Get formatted address for coordinates
   */
  async getAddress(point: GeoPoint): Promise<string> {
    return await this.geocodingService.getAddress(point);
  }

  /**
   * Find the closest POI from a list of candidates
   */
  findClosestPOI(
    target: GeoPoint,
    candidates: POIInfo[]
  ): { poi: POIInfo; distance: number } | null {
    if (candidates.length === 0) return null;

    let closest = candidates[0];
    let minDistance = this.calculateDistance(target, closest.location);

    for (const poi of candidates) {
      const distance = this.calculateDistance(target, poi.location);
      if (distance < minDistance) {
        minDistance = distance;
        closest = poi;
      }
    }

    return { poi: closest, distance: minDistance };
  }

  /**
   * Get popular POI types
   */
  getPopularPOITypes(): string[] {
    return this.poiService.getPopularPOITypes();
  }

  /**
   * Get POI type descriptions
   */
  getPOITypeDescriptions(): Record<string, string> {
    return this.poiService.getPOITypeDescriptions();
  }

  /**
   * Get search suggestions based on partial input
   */
  async getSearchSuggestions(
    partialQuery: string,
    center?: GeoPoint,
    limit: number = 5
  ): Promise<{
    suggestions: string[];
    categories: string[];
  }> {
    if (!partialQuery || partialQuery.trim().length < 1) {
      return { suggestions: [], categories: [] };
    }

    const suggestions: string[] = [];
    const categories: string[] = [];

    try {
      // Search for places
      const places = await this.geocodingService.searchPlaces(partialQuery, center, 10, limit);
      suggestions.push(...places.map(p => p.display_name));

      // Search for POIs
      const pois = await this.poiService.searchPOIsByName(partialQuery, center, 10, limit);
      suggestions.push(...pois.map(p => p.name));

      // Get unique suggestions
      const uniqueSuggestions = [...new Set(suggestions)].slice(0, limit);
      
      // Extract categories from POI types
      const poiTypes = [...new Set(pois.map(p => p.type))];
      categories.push(...poiTypes);

      return {
        suggestions: uniqueSuggestions,
        categories
      };
    } catch (error) {
      console.error('Search suggestions error:', error);
      return { suggestions: [], categories: [] };
    }
  }

  /**
   * Get search statistics
   */
  async getSearchStats(): Promise<{
    totalCachedQueries: number;
    expiredQueries: number;
    averagePOIsPerQuery: number;
  }> {
    return await this.poiService.getCacheStats();
  }

  /**
   * Clean up expired search cache
   */
  async cleanupExpiredCache(): Promise<number> {
    return await this.poiService.cleanupExpiredCache();
  }

  /**
   * Initialize POI search collections
   */
  async initialize(): Promise<void> {
    await ensureMappingCollections(this.db);
  }

  /**
   * Query OSM for trails within specified bounds
   */
  async queryOSMForTrails(south: number, west: number, north: number, east: number): Promise<any[]> {
    const bounds: BoundingBox = { south, west, north, east };
    
    // Use the POI service to find trails in the bounds
    return await this.poiService.findTrailsInBounds(bounds);
  }

  // Private helper methods

  private calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export default POISearchConcept;

