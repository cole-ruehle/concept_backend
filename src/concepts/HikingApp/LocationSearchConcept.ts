import { Db, Collection } from "npm:mongodb";
import { GeocodingService } from "../../services/GeocodingService.ts";
import { POISearchConcept } from "./POISearchConcept.ts";

export interface LocationSearchResult {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lon: number };
  type: "trailhead" | "trail" | "transit_stop" | "poi" | "address";
  relevance: number; // 0-1, higher is more relevant
  distance?: number; // in meters from search center
  tags?: string[];
}

export interface AutocompleteResult {
  suggestions: LocationSearchResult[];
  total: number;
  hasMore: boolean;
}

export class LocationSearchConcept {
  private geocodingService: GeocodingService;
  private poiSearch: POISearchConcept;
  private searchCache: Collection<any>;

  constructor(private db: Db) {
    this.geocodingService = new GeocodingService();
    this.poiSearch = new POISearchConcept(db);
    this.searchCache = db.collection("location_search_cache");
  }

  /**
   * Search for locations with autocomplete functionality
   */
  async searchLocations(
    query: string,
    options: {
      center?: { lat: number; lon: number };
      radius?: number; // in meters
      types?: string[];
      limit?: number;
      includeAddresses?: boolean;
    } = {}
  ): Promise<AutocompleteResult> {
    const {
      center,
      radius = 50000, // 50km default
      types = ["trailhead", "trail", "transit_stop", "poi"],
      limit = 10,
      includeAddresses = true
    } = options;

    // Check cache first
    const cacheKey = this.generateCacheKey(query, options);
    const cached = await this.searchCache.findOne({ 
      query_hash: cacheKey,
      expires_at: { $gt: new Date() }
    });

    if (cached) {
      return cached.data;
    }

    const results: LocationSearchResult[] = [];

    // Search POIs (trailheads, trails, transit stops)
    if (types.some(t => ["trailhead", "trail", "transit_stop", "poi"].includes(t))) {
      const poiResults = await this.searchPOIs(query, center, radius, types, limit);
      results.push(...poiResults);
    }

    // Search addresses if requested
    if (includeAddresses && query.length > 2) {
      const addressResults = await this.searchAddresses(query, center, radius, limit - results.length);
      results.push(...addressResults);
    }

    // Sort by relevance and distance
    const sortedResults = this.sortResults(results, center);

    // Limit results
    const limitedResults = sortedResults.slice(0, limit);

    const result: AutocompleteResult = {
      suggestions: limitedResults,
      total: results.length,
      hasMore: results.length > limit
    };

    // Cache the result
    await this.cacheResult(cacheKey, result);

    return result;
  }

  /**
   * Get location details by ID
   */
  async getLocationDetails(locationId: string, type: string): Promise<LocationSearchResult | null> {
    switch (type) {
      case "trailhead":
        const trailhead = await this.db.collection("trailheads").findOne({ _id: locationId });
        if (trailhead) {
          return this.formatTrailheadResult(trailhead);
        }
        break;
      
      case "trail":
        const trail = await this.db.collection("trails").findOne({ _id: locationId });
        if (trail) {
          return this.formatTrailResult(trail);
        }
        break;
      
      case "transit_stop":
        const stop = await this.db.collection("transit_stops").findOne({ _id: locationId });
        if (stop) {
          return this.formatTransitStopResult(stop);
        }
        break;
      
      case "poi":
        return await this.poiSearch.getPOIDetails(locationId);
      
      default:
        return null;
    }

    return null;
  }

  /**
   * Reverse geocoding - get address from coordinates
   */
  async reverseGeocode(lat: number, lon: number): Promise<LocationSearchResult | null> {
    try {
      const result = await this.geocodingService.reverseGeocode(lat, lon);
      if (result) {
        return {
          id: `reverse_${lat}_${lon}`,
          name: result.display_name,
          address: result.display_name,
          location: { lat: parseFloat(result.lat), lon: parseFloat(result.lon) },
          type: "address",
          relevance: 1.0,
          tags: ["reverse_geocoded"]
        };
      }
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
    }
    return null;
  }

  /**
   * Get nearby locations
   */
  async getNearbyLocations(
    center: { lat: number; lon: number },
    radius: number = 1000,
    types: string[] = ["trailhead", "trail", "transit_stop"],
    limit: number = 20
  ): Promise<LocationSearchResult[]> {
    const results: LocationSearchResult[] = [];

    for (const type of types) {
      let collection: string;
      switch (type) {
        case "trailhead":
          collection = "trailheads";
          break;
        case "trail":
          collection = "trails";
          break;
        case "transit_stop":
          collection = "transit_stops";
          break;
        default:
          continue;
      }

      const nearby = await this.db.collection(collection).find({
        loc: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [center.lon, center.lat]
            },
            $maxDistance: radius
          }
        }
      }).limit(limit).toArray();

      for (const item of nearby) {
        const distance = this.calculateDistance(center, {
          lat: item.loc.coordinates[1],
          lon: item.loc.coordinates[0]
        });

        results.push({
          id: item._id.toString(),
          name: item.name,
          address: item.address || "",
          location: {
            lat: item.loc.coordinates[1],
            lon: item.loc.coordinates[0]
          },
          type: type as any,
          relevance: 1.0,
          distance,
          tags: item.tags ? Object.values(item.tags) : []
        });
      }
    }

    return results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  // Private helper methods

  private async searchPOIs(
    query: string,
    center?: { lat: number; lon: number },
    radius?: number,
    types?: string[],
    limit?: number
  ): Promise<LocationSearchResult[]> {
    const results: LocationSearchResult[] = [];

    // Search trailheads
    if (types?.includes("trailhead")) {
      const trailheads = await this.db.collection("trailheads").find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { "tags.state": { $regex: query, $options: "i" } }
        ]
      }).limit(limit || 10).toArray();

      for (const trailhead of trailheads) {
        const distance = center ? this.calculateDistance(center, {
          lat: trailhead.loc.coordinates[1],
          lon: trailhead.loc.coordinates[0]
        }) : undefined;

        results.push({
          id: trailhead._id.toString(),
          name: trailhead.name,
          address: `${trailhead.tags?.state || ""}`,
          location: {
            lat: trailhead.loc.coordinates[1],
            lon: trailhead.loc.coordinates[0]
          },
          type: "trailhead",
          relevance: this.calculateRelevance(query, trailhead.name),
          distance,
          tags: trailhead.tags ? Object.values(trailhead.tags) : []
        });
      }
    }

    // Search trails
    if (types?.includes("trail")) {
      const trails = await this.db.collection("trails").find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } }
        ]
      }).limit(limit || 10).toArray();

      for (const trail of trails) {
        results.push({
          id: trail._id.toString(),
          name: trail.name,
          address: trail.description || "",
          location: { lat: 0, lon: 0 }, // Trails don't have specific locations
          type: "trail",
          relevance: this.calculateRelevance(query, trail.name),
          tags: [trail.difficulty, trail.surface].filter(Boolean)
        });
      }
    }

    // Search transit stops
    if (types?.includes("transit_stop")) {
      const stops = await this.db.collection("transit_stops").find({
        name: { $regex: query, $options: "i" }
      }).limit(limit || 10).toArray();

      for (const stop of stops) {
        const distance = center ? this.calculateDistance(center, {
          lat: stop.loc.coordinates[1],
          lon: stop.loc.coordinates[0]
        }) : undefined;

        results.push({
          id: stop._id.toString(),
          name: stop.name,
          address: stop.tags?.city || "",
          location: {
            lat: stop.loc.coordinates[1],
            lon: stop.loc.coordinates[0]
          },
          type: "transit_stop",
          relevance: this.calculateRelevance(query, stop.name),
          distance,
          tags: stop.routes || []
        });
      }
    }

    return results;
  }

  private async searchAddresses(
    query: string,
    center?: { lat: number; lon: number },
    radius?: number,
    limit?: number
  ): Promise<LocationSearchResult[]> {
    try {
      const results = await this.geocodingService.geocode(query);
      return results.slice(0, limit || 5).map((result, index) => ({
        id: `geocoded_${index}`,
        name: result.display_name,
        address: result.display_name,
        location: {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon)
        },
        type: "address" as const,
        relevance: 0.8 - (index * 0.1), // Decrease relevance for later results
        distance: center ? this.calculateDistance(center, {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon)
        }) : undefined,
        tags: ["geocoded"]
      }));
    } catch (error) {
      console.error("Geocoding failed:", error);
      return [];
    }
  }

  private calculateRelevance(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    if (textLower === queryLower) return 1.0;
    if (textLower.startsWith(queryLower)) return 0.9;
    if (textLower.includes(queryLower)) return 0.7;
    
    // Check for word matches
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    const matchingWords = queryWords.filter(qw => 
      textWords.some(tw => tw.includes(qw) || qw.includes(tw))
    );
    
    return matchingWords.length / queryWords.length * 0.5;
  }

  private calculateDistance(
    point1: { lat: number; lon: number },
    point2: { lat: number; lon: number }
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private sortResults(
    results: LocationSearchResult[],
    center?: { lat: number; lon: number }
  ): LocationSearchResult[] {
    return results.sort((a, b) => {
      // First sort by relevance
      if (a.relevance !== b.relevance) {
        return b.relevance - a.relevance;
      }
      
      // Then by distance if center is provided
      if (center && a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      
      return 0;
    });
  }

  private formatTrailheadResult(trailhead: any): LocationSearchResult {
    return {
      id: trailhead._id.toString(),
      name: trailhead.name,
      address: trailhead.tags?.state || "",
      location: {
        lat: trailhead.loc.coordinates[1],
        lon: trailhead.loc.coordinates[0]
      },
      type: "trailhead",
      relevance: 1.0,
      tags: trailhead.tags ? Object.values(trailhead.tags) : []
    };
  }

  private formatTrailResult(trail: any): LocationSearchResult {
    return {
      id: trail._id.toString(),
      name: trail.name,
      address: trail.description || "",
      location: { lat: 0, lon: 0 },
      type: "trail",
      relevance: 1.0,
      tags: [trail.difficulty, trail.surface].filter(Boolean)
    };
  }

  private formatTransitStopResult(stop: any): LocationSearchResult {
    return {
      id: stop._id.toString(),
      name: stop.name,
      address: stop.tags?.city || "",
      location: {
        lat: stop.loc.coordinates[1],
        lon: stop.loc.coordinates[0]
      },
      type: "transit_stop",
      relevance: 1.0,
      tags: stop.routes || []
    };
  }

  private generateCacheKey(query: string, options: any): string {
    const key = JSON.stringify({ query, options });
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '');
  }

  private async cacheResult(key: string, data: AutocompleteResult): Promise<void> {
    try {
      await this.searchCache.replaceOne(
        { query_hash: key },
        {
          query_hash: key,
          data,
          cached_at: new Date(),
          expires_at: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        },
        { upsert: true }
      );
    } catch (error) {
      console.warn("Failed to cache search result:", error);
    }
  }
}

export default LocationSearchConcept;

