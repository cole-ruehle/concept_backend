import { 
  GeoPoint, 
  BoundingBox, 
  OverpassResponse, 
  OSMElement, 
  OverpassQuery,
  TrailInfo,
  TrailheadInfo,
  TransitStopInfo,
  POIInfo
} from "../utils/mappingTypes.ts";

/**
 * Core OpenStreetMap service using Overpass API
 * Provides access to OSM data for trails, transit, and POIs
 */
export class OSMService {
  private readonly OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
  private readonly NOMINATIM_API_URL = "https://nominatim.openstreetmap.org";
  private readonly USER_AGENT = "TrailLink-HikingApp/1.0";
  
  private cache = new Map<string, { data: any; expires: number }>();

  /**
   * Query Overpass API with caching
   */
  async queryOverpass(query: OverpassQuery): Promise<OverpassResponse> {
    const cacheKey = this.generateCacheKey(query);
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const response = await fetch(this.OVERPASS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.USER_AGENT,
      },
      body: `data=${encodeURIComponent(query.query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data: OverpassResponse = await response.json();
    
    // Cache for 1 hour
    this.cache.set(cacheKey, {
      data,
      expires: Date.now() + 60 * 60 * 1000
    });

    return data;
  }

  /**
   * Find hiking trails near a location
   */
  async findTrails(
    center: GeoPoint, 
    radiusKm: number = 5
  ): Promise<TrailInfo[]> {
    const bbox = this.createBoundingBox(center, radiusKm);
    
    const query = `
      [out:json][timeout:25];
      (
        way["highway"="footway"]["footway"!="sidewalk"]["footway"!="crossing"](bbox);
        way["highway"="path"](bbox);
        way["highway"="track"](bbox);
        way["highway"="bridleway"](bbox);
        way["highway"="steps"](bbox);
        way["leisure"="nature_reserve"](bbox);
        way["natural"="trail"](bbox);
        way["route"="hiking"](bbox);
      );
      out geom;
    `.replace('bbox', `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`);

    const response = await this.queryOverpass({ query });
    return this.parseTrailsFromOSM(response.elements);
  }

  /**
   * Find hiking trails within specified bounds
   */
  async findTrailsInBounds(bounds: BoundingBox): Promise<TrailInfo[]> {
    const query = `
      [out:json][timeout:25];
      (
        way["highway"="footway"]["footway"!="sidewalk"]["footway"!="crossing"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        way["highway"="path"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        way["highway"="track"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        way["highway"="bridleway"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        way["highway"="steps"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        way["leisure"="nature_reserve"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        way["natural"="trail"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        way["route"="hiking"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      );
      out geom;
    `;

    const response = await this.queryOverpass({ query });
    return this.parseTrailsFromOSM(response.elements);
  }

  /**
   * Find trailheads near a location
   */
  async findTrailheads(
    center: GeoPoint, 
    radiusKm: number = 10
  ): Promise<TrailheadInfo[]> {
    const bbox = this.createBoundingBox(center, radiusKm);
    
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="parking"]["tourism"="trailhead"](bbox);
        node["leisure"="nature_reserve"]["tourism"="trailhead"](bbox);
        node["natural"="trailhead"](bbox);
        node["highway"="trailhead"](bbox);
        node["tourism"="trailhead"](bbox);
        node["amenity"="parking"]["name"~"trail",i](bbox);
        node["amenity"="parking"]["name"~"hiking",i](bbox);
      );
      out;
    `.replace('bbox', `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`);

    const response = await this.queryOverpass({ query });
    return this.parseTrailheadsFromOSM(response.elements);
  }

  /**
   * Find transit stops near a location
   */
  async findTransitStops(
    center: GeoPoint, 
    radiusKm: number = 2
  ): Promise<TransitStopInfo[]> {
    const bbox = this.createBoundingBox(center, radiusKm);
    
    const query = `
      [out:json][timeout:25];
      (
        node["public_transport"="stop_position"](bbox);
        node["highway"="bus_stop"](bbox);
        node["railway"="station"](bbox);
        node["railway"="halt"](bbox);
        node["railway"="tram_stop"](bbox);
        node["amenity"="bus_station"](bbox);
      );
      out;
    `.replace('bbox', `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`);

    const response = await this.queryOverpass({ query });
    return this.parseTransitStopsFromOSM(response.elements);
  }

  /**
   * Search for POIs by type and location
   */
  async searchPOIs(
    center: GeoPoint,
    types: string[],
    radiusKm: number = 5
  ): Promise<POIInfo[]> {
    const bbox = this.createBoundingBox(center, radiusKm);
    
    const typeQueries = types.map(type => {
      switch (type) {
        case 'water':
          return 'node["amenity"="drinking_water"](bbox);';
        case 'restroom':
          return 'node["amenity"="toilets"](bbox);';
        case 'shelter':
          return 'node["amenity"="shelter"](bbox);';
        case 'parking':
          return 'node["amenity"="parking"](bbox);';
        default:
          return '';
      }
    }).filter(q => q);

    const query = `
      [out:json][timeout:25];
      (
        ${typeQueries.join('\n        ')}
      );
      out;
    `.replace(/bbox/g, `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`);

    const response = await this.queryOverpass({ query });
    return this.parsePOIsFromOSM(response.elements, types);
  }

  /**
   * Geocode an address to coordinates
   */
  async geocode(address: string): Promise<GeoPoint[]> {
    const cacheKey = `geocode:${address}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const url = new URL(`${this.NOMINATIM_API_URL}/search`);
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": this.USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`Geocoding error: ${response.status}`);
    }

    const results = await response.json();
    const points = results.map((r: any) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon)
    }));

    // Cache for 24 hours
    this.cache.set(cacheKey, {
      data: points,
      expires: Date.now() + 24 * 60 * 60 * 1000
    });

    return points;
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(point: GeoPoint): Promise<string> {
    const cacheKey = `reverse:${point.lat},${point.lon}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const url = new URL(`${this.NOMINATIM_API_URL}/reverse`);
    url.searchParams.set('lat', point.lat.toString());
    url.searchParams.set('lon', point.lon.toString());
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": this.USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding error: ${response.status}`);
    }

    const result = await response.json();
    const address = result.display_name || 'Unknown location';

    // Cache for 24 hours
    this.cache.set(cacheKey, {
      data: address,
      expires: Date.now() + 24 * 60 * 60 * 1000
    });

    return address;
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

  private generateCacheKey(query: OverpassQuery): string {
    return `overpass:${btoa(query.query)}`;
  }

  private parseTrailsFromOSM(elements: OSMElement[]): TrailInfo[] {
    return elements
      .filter(el => el.type === 'way' && el.nodes && el.nodes.length > 0)
      .map(way => {
        const tags = way.tags || {};
        const coordinates = this.extractCoordinatesFromWay(way);
        
        return {
          id: `trail_${way.id}`,
          name: tags.name || tags.ref || `Trail ${way.id}`,
          difficulty: this.parseDifficulty(tags),
          surface: tags.surface || 'unknown',
          length: this.calculateLength(coordinates),
          elevation_gain: 0, // Would need elevation data
          coordinates,
          tags,
          condition: this.parseCondition(tags),
          last_updated: new Date().toISOString()
        };
      });
  }

  private parseTrailheadsFromOSM(elements: OSMElement[]): TrailheadInfo[] {
    return elements
      .filter(el => el.type === 'node' && el.lat && el.lon)
      .map(node => {
        const tags = node.tags || {};
        
        return {
          id: `trailhead_${node.id}`,
          name: tags.name || `Trailhead ${node.id}`,
          location: { lat: node.lat!, lon: node.lon! },
          parking: tags.parking === 'yes' || tags.amenity === 'parking',
          facilities: this.parseFacilities(tags),
          accessibility: this.parseAccessibility(tags),
          transit_stops: [], // Would need to find nearby stops
          trails: [], // Would need to find connected trails
          tags
        };
      });
  }

  private parseTransitStopsFromOSM(elements: OSMElement[]): TransitStopInfo[] {
    return elements
      .filter(el => el.type === 'node' && el.lat && el.lon)
      .map(node => {
        const tags = node.tags || {};
        
        return {
          id: `transit_${node.id}`,
          name: tags.name || `Stop ${node.id}`,
          location: { lat: node.lat!, lon: node.lon! },
          routes: this.parseRoutes(tags),
          wheelchair_accessible: tags.wheelchair === 'yes',
          shelter: tags.shelter === 'yes',
          real_time_info: tags.realtime === 'yes',
          tags
        };
      });
  }

  private parsePOIsFromOSM(elements: OSMElement[], types: string[]): POIInfo[] {
    return elements
      .filter(el => el.type === 'node' && el.lat && el.lon)
      .map(node => {
        const tags = node.tags || {};
        const poiType = this.determinePOIType(tags, types);
        
        return {
          id: `poi_${node.id}`,
          name: tags.name || `${poiType} ${node.id}`,
          type: poiType,
          location: { lat: node.lat!, lon: node.lon! },
          description: tags.description || tags.note,
          tags
        };
      });
  }

  private extractCoordinatesFromWay(way: OSMElement): GeoPoint[] {
    // This is a simplified version - in reality, you'd need to resolve node references
    // For now, return empty array as we'd need the actual node coordinates
    return [];
  }

  private calculateLength(coordinates: GeoPoint[]): number {
    if (coordinates.length < 2) return 0;
    
    let total = 0;
    for (let i = 1; i < coordinates.length; i++) {
      total += this.haversineDistance(coordinates[i-1], coordinates[i]);
    }
    return total;
  }

  private haversineDistance(p1: GeoPoint, p2: GeoPoint): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lon - p1.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private parseDifficulty(tags: Record<string, string>): 'easy' | 'moderate' | 'hard' | 'expert' {
    const difficulty = tags.difficulty || tags.sac_scale || '';
    if (difficulty.includes('easy') || difficulty.includes('1')) return 'easy';
    if (difficulty.includes('moderate') || difficulty.includes('2')) return 'moderate';
    if (difficulty.includes('hard') || difficulty.includes('3')) return 'hard';
    if (difficulty.includes('expert') || difficulty.includes('4')) return 'expert';
    return 'moderate';
  }

  private parseCondition(tags: Record<string, string>): 'open' | 'closed' | 'maintenance' {
    if (tags.access === 'no' || tags.status === 'closed') return 'closed';
    if (tags.maintenance === 'yes' || tags.status === 'maintenance') return 'maintenance';
    return 'open';
  }

  private parseFacilities(tags: Record<string, string>): string[] {
    const facilities: string[] = [];
    if (tags.toilets === 'yes') facilities.push('restroom');
    if (tags.drinking_water === 'yes') facilities.push('water');
    if (tags.shelter === 'yes') facilities.push('shelter');
    if (tags.parking === 'yes') facilities.push('parking');
    return facilities;
  }

  private parseAccessibility(tags: Record<string, string>): string[] {
    const accessibility: string[] = [];
    if (tags.wheelchair === 'yes') accessibility.push('wheelchair');
    if (tags.tactile_paving === 'yes') accessibility.push('tactile_paving');
    return accessibility;
  }

  private parseRoutes(tags: Record<string, string>): string[] {
    const routes: string[] = [];
    if (tags.route_ref) routes.push(tags.route_ref);
    if (tags.ref) routes.push(tags.ref);
    return routes;
  }

  private determinePOIType(tags: Record<string, string>, types: string[]): 'trail' | 'trailhead' | 'transit_stop' | 'parking' | 'restroom' | 'water' | 'shelter' {
    if (tags.amenity === 'toilets') return 'restroom';
    if (tags.amenity === 'drinking_water') return 'water';
    if (tags.amenity === 'shelter') return 'shelter';
    if (tags.amenity === 'parking') return 'parking';
    if (tags.public_transport === 'stop_position') return 'transit_stop';
    if (tags.tourism === 'trailhead') return 'trailhead';
    return 'trail';
  }
}

export default OSMService;

