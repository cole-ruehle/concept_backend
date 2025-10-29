import { GeoPoint, GeocodingResult, ReverseGeocodingResult } from "../utils/mappingTypes.ts";

/**
 * Geocoding service using Nominatim (OpenStreetMap's geocoding service)
 * Provides address-to-coordinates and coordinates-to-address conversion
 */
export class GeocodingService {
  private readonly NOMINATIM_API_URL = "https://nominatim.openstreetmap.org";
  private readonly USER_AGENT = "TrailLink-HikingApp/1.0";
  
  private cache = new Map<string, { data: any; expires: number }>();

  /**
   * Geocode an address to coordinates
   */
  async geocode(
    address: string, 
    limit: number = 5
  ): Promise<GeocodingResult[]> {
    const cacheKey = `geocode:${address}:${limit}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const url = new URL(`${this.NOMINATIM_API_URL}/search`);
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('namedetails', '1');

    try {
      const response = await fetch(url.toString(), {
        headers: { 
          "User-Agent": this.USER_AGENT,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Geocoding error: ${response.status} ${response.statusText}`);
      }

      const results = await response.json();
      const geocodingResults: GeocodingResult[] = results.map((r: any) => ({
        display_name: r.display_name,
        lat: r.lat,
        lon: r.lon,
        type: r.type,
        importance: r.importance,
        address: r.address ? {
          house_number: r.address.house_number,
          road: r.address.road,
          city: r.address.city || r.address.town || r.address.village,
          state: r.address.state,
          postcode: r.address.postcode,
          country: r.address.country
        } : undefined
      }));

      // Cache for 24 hours
      this.cache.set(cacheKey, {
        data: geocodingResults,
        expires: Date.now() + 24 * 60 * 60 * 1000
      });

      return geocodingResults;
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error(`Failed to geocode address: ${address}`);
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(
    point: GeoPoint,
    zoom: number = 18
  ): Promise<ReverseGeocodingResult> {
    const cacheKey = `reverse:${point.lat},${point.lon}:${zoom}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const url = new URL(`${this.NOMINATIM_API_URL}/reverse`);
    url.searchParams.set('lat', point.lat.toString());
    url.searchParams.set('lon', point.lon.toString());
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('namedetails', '1');
    url.searchParams.set('zoom', zoom.toString());

    try {
      const response = await fetch(url.toString(), {
        headers: { 
          "User-Agent": this.USER_AGENT,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Reverse geocoding error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const reverseGeocodingResult: ReverseGeocodingResult = {
        display_name: result.display_name,
        address: {
          house_number: result.address?.house_number,
          road: result.address?.road,
          city: result.address?.city || result.address?.town || result.address?.village,
          state: result.address?.state,
          postcode: result.address?.postcode,
          country: result.address?.country
        },
        lat: result.lat,
        lon: result.lon
      };

      // Cache for 24 hours
      this.cache.set(cacheKey, {
        data: reverseGeocodingResult,
        expires: Date.now() + 24 * 60 * 60 * 1000
      });

      return reverseGeocodingResult;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw new Error(`Failed to reverse geocode coordinates: ${point.lat}, ${point.lon}`);
    }
  }

  /**
   * Search for places by name with optional location bias
   */
  async searchPlaces(
    query: string,
    center?: GeoPoint,
    radiusKm?: number,
    limit: number = 10
  ): Promise<GeocodingResult[]> {
    const cacheKey = `search:${query}:${center ? `${center.lat},${center.lon}` : 'global'}:${limit}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const url = new URL(`${this.NOMINATIM_API_URL}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('namedetails', '1');

    if (center) {
      url.searchParams.set('lat', center.lat.toString());
      url.searchParams.set('lon', center.lon.toString());
      if (radiusKm) {
        url.searchParams.set('radius', (radiusKm * 1000).toString());
      }
    }

    try {
      const response = await fetch(url.toString(), {
        headers: { 
          "User-Agent": this.USER_AGENT,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Place search error: ${response.status} ${response.statusText}`);
      }

      const results = await response.json();
      const searchResults: GeocodingResult[] = results.map((r: any) => ({
        display_name: r.display_name,
        lat: r.lat,
        lon: r.lon,
        type: r.type,
        importance: r.importance,
        address: r.address ? {
          house_number: r.address.house_number,
          road: r.address.road,
          city: r.address.city || r.address.town || r.address.village,
          state: r.address.state,
          postcode: r.address.postcode,
          country: r.address.country
        } : undefined
      }));

      // Cache for 1 hour
      this.cache.set(cacheKey, {
        data: searchResults,
        expires: Date.now() + 60 * 60 * 1000
      });

      return searchResults;
    } catch (error) {
      console.error('Place search error:', error);
      throw new Error(`Failed to search places: ${query}`);
    }
  }

  /**
   * Get coordinates for a specific address with high precision
   */
  async getCoordinates(address: string): Promise<GeoPoint | null> {
    const results = await this.geocode(address, 1);
    if (results.length === 0) {
      return null;
    }

    return {
      lat: parseFloat(results[0].lat),
      lon: parseFloat(results[0].lon)
    };
  }

  /**
   * Get formatted address for coordinates
   */
  async getAddress(point: GeoPoint): Promise<string> {
    const result = await this.reverseGeocode(point);
    return result.display_name;
  }

  /**
   * Validate if coordinates are within reasonable bounds
   */
  isValidCoordinates(point: GeoPoint): boolean {
    return (
      point.lat >= -90 && point.lat <= 90 &&
      point.lon >= -180 && point.lon <= 180 &&
      !isNaN(point.lat) && !isNaN(point.lon)
    );
  }

  /**
   * Calculate distance between two points in meters
   */
  calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Find the closest point from a list of candidates
   */
  findClosestPoint(
    target: GeoPoint, 
    candidates: GeoPoint[]
  ): { point: GeoPoint; distance: number } | null {
    if (candidates.length === 0) return null;

    let closest = candidates[0];
    let minDistance = this.calculateDistance(target, closest);

    for (let i = 1; i < candidates.length; i++) {
      const distance = this.calculateDistance(target, candidates[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closest = candidates[i];
      }
    }

    return { point: closest, distance: minDistance };
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default GeocodingService;




