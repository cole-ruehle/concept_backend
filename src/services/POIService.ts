import { Db } from "npm:mongodb";
import { GeoPoint, BoundingBox, POIInfo, POICacheDoc } from "../utils/mappingTypes.ts";
import { getMappingCollections } from "../utils/database.ts";
import OSMService from "./OSMService.ts";

/**
 * Points of Interest service for searching and caching POI data
 * Integrates with OSM data via Overpass API
 */
export class POIService {
  private osmService: OSMService;
  private poiCache: any;

  constructor(private db: Db) {
    this.osmService = new OSMService();
    const collections = getMappingCollections(db);
    this.poiCache = collections.poiCache;
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
    const bbox = this.createBoundingBox(center, radiusKm);
    const queryHash = this.generateQueryHash(center, types, radiusKm, limit);
    
    // Check cache first
    const cached = await this.poiCache.findOne({ query_hash: queryHash });
    if (cached && cached.expires_at > new Date()) {
      return cached.data;
    }

    try {
      // Fetch from OSM
      const pois = await this.osmService.searchPOIs(center, types, radiusKm);
      
      // Limit results
      const limitedPOIs = pois.slice(0, limit);
      
      // Calculate distances and sort
      const poisWithDistance = limitedPOIs.map(poi => ({
        ...poi,
        distance: this.calculateDistance(center, poi.location)
      })).sort((a, b) => (a.distance || 0) - (b.distance || 0));

      // Cache results
      const cacheDoc: Omit<POICacheDoc, '_id'> = {
        query_hash: queryHash,
        data: poisWithDistance,
        cached_at: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        bbox
      };

      await this.poiCache.replaceOne(
        { query_hash: queryHash },
        cacheDoc,
        { upsert: true }
      );

      return poisWithDistance;
    } catch (error) {
      console.error('POI search error:', error);
      throw new Error(`Failed to search POIs: ${error.message}`);
    }
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
    const types = ['trail'];
    const allPOIs = await this.searchPOIs(center, types, radiusKm);
    
    let filteredPOIs = allPOIs;
    
    if (difficulty) {
      filteredPOIs = filteredPOIs.filter(poi => 
        poi.tags.difficulty === difficulty || 
        poi.tags.sac_scale === difficulty
      );
    }
    
    if (surface) {
      filteredPOIs = filteredPOIs.filter(poi => 
        poi.tags.surface === surface
      );
    }
    
    return filteredPOIs;
  }

  /**
   * Find trailheads near a location
   */
  async findTrailheads(
    center: GeoPoint,
    radiusKm: number = 15
  ): Promise<POIInfo[]> {
    const types = ['trailhead'];
    return await this.searchPOIs(center, types, radiusKm);
  }

  /**
   * Find transit stops near a location
   */
  async findTransitStops(
    center: GeoPoint,
    radiusKm: number = 2
  ): Promise<POIInfo[]> {
    const types = ['transit_stop'];
    return await this.searchPOIs(center, types, radiusKm);
  }

  /**
   * Find amenities near a location
   */
  async findAmenities(
    center: GeoPoint,
    amenityTypes: string[],
    radiusKm: number = 3
  ): Promise<POIInfo[]> {
    const types = amenityTypes.map(type => {
      switch (type) {
        case 'water':
          return 'water';
        case 'restroom':
          return 'restroom';
        case 'shelter':
          return 'shelter';
        case 'parking':
          return 'parking';
        default:
          return type;
      }
    });
    
    return await this.searchPOIs(center, types, radiusKm);
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
    const searchTypes = types || ['trail', 'trailhead', 'transit_stop'];
    const searchRadius = radiusKm || 10;
    const searchCenter = center || { lat: 0, lon: 0 };
    
    const allPOIs = await this.searchPOIs(searchCenter, searchTypes, searchRadius, 100);
    
    // Filter by name (case-insensitive)
    const nameLower = name.toLowerCase();
    return allPOIs.filter(poi => 
      poi.name.toLowerCase().includes(nameLower)
    );
  }

  /**
   * Get POI details by ID
   */
  async getPOIDetails(poiId: string): Promise<POIInfo | null> {
    // This would typically involve a more specific query
    // For now, we'll search through cached data
    const cachedPOIs = await this.poiCache.find({}).toArray();
    
    for (const cache of cachedPOIs) {
      const poi = cache.data.find((p: POIInfo) => p.id === poiId);
      if (poi) {
        return poi;
      }
    }
    
    return null;
  }

  /**
   * Get POIs within a bounding box
   */
  async getPOIsInBounds(
    bounds: BoundingBox,
    types: string[],
    limit: number = 100
  ): Promise<POIInfo[]> {
    const center = {
      lat: (bounds.north + bounds.south) / 2,
      lon: (bounds.east + bounds.west) / 2
    };
    
    const radiusKm = Math.max(
      this.calculateDistance(center, { lat: bounds.north, lon: bounds.east }),
      this.calculateDistance(center, { lat: bounds.south, lon: bounds.west })
    ) / 1000;
    
    return await this.searchPOIs(center, types, radiusKm, limit);
  }

  /**
   * Find trails within specified bounds
   */
  async findTrailsInBounds(bounds: BoundingBox): Promise<any[]> {
    try {
      // Query OSM directly for trails in the bounds
      const trails = await this.osmService.findTrailsInBounds(bounds);
      return trails;
    } catch (error) {
      console.error('Error finding trails in bounds:', error);
      throw new Error(`Failed to find trails: ${error.message}`);
    }
  }

  /**
   * Get popular POI types
   */
  getPopularPOITypes(): string[] {
    return [
      'trail',
      'trailhead', 
      'transit_stop',
      'parking',
      'water',
      'restroom',
      'shelter'
    ];
  }

  /**
   * Get POI type descriptions
   */
  getPOITypeDescriptions(): Record<string, string> {
    return {
      'trail': 'Hiking and walking trails',
      'trailhead': 'Starting points for trails',
      'transit_stop': 'Public transportation stops',
      'parking': 'Parking areas',
      'water': 'Drinking water sources',
      'restroom': 'Restroom facilities',
      'shelter': 'Shelters and covered areas'
    };
  }

  /**
   * Clean up expired POI cache
   */
  async cleanupExpiredCache(): Promise<number> {
    const result = await this.poiCache.deleteMany({
      expires_at: { $lt: new Date() }
    });
    
    return result.deletedCount || 0;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalCachedQueries: number;
    expiredQueries: number;
    averagePOIsPerQuery: number;
  }> {
    const totalQueries = await this.poiCache.countDocuments();
    const expiredQueries = await this.poiCache.countDocuments({
      expires_at: { $lt: new Date() }
    });
    
    const sampleQueries = await this.poiCache.find({}).limit(10).toArray();
    const averagePOIsPerQuery = sampleQueries.length > 0
      ? sampleQueries.reduce((sum, query) => sum + query.data.length, 0) / sampleQueries.length
      : 0;

    return {
      totalCachedQueries: totalQueries,
      expiredQueries,
      averagePOIsPerQuery: Math.round(averagePOIsPerQuery)
    };
  }

  // Private helper methods

  private createBoundingBox(center: GeoPoint, radiusKm: number): BoundingBox {
    const latDelta = radiusKm / 111; // Approximate degrees per km
    const lonDelta = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));

    return {
      north: center.lat + latDelta,
      south: center.lat - latDelta,
      east: center.lon + lonDelta,
      west: center.lon - lonDelta
    };
  }

  private generateQueryHash(
    center: GeoPoint,
    types: string[],
    radiusKm: number,
    limit: number
  ): string {
    const typesStr = Array.isArray(types) ? types.join(',') : (types || '');
    const queryString = `${center.lat},${center.lon}:${typesStr}:${radiusKm}:${limit}`;
    return btoa(queryString);
  }

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

export default POIService;

