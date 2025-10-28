import {
  Collection,
  Db,
  MongoClient,
  ObjectId,
} from "npm:mongodb";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { GeoPoint, RouteSegment, RouteCacheDoc } from "../../utils/mappingTypes.ts";
import { getMappingCollections } from "../../utils/database.ts";
import OSMService from "../../services/OSMService.ts";

// =============================================================================
// 1. CUSTOM ERROR CLASSES
// =============================================================================

/**
 * Base class for application-specific errors.
 */
class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown for invalid input parameters provided by the client.
 */
export class ValidationError extends AppError {}

/**
 * Thrown when a requested resource (e.g., by ID) is not found.
 */
export class NotFoundError extends AppError {}

/**
 * Thrown when an external service call fails or returns an error.
 */
export class ExternalServiceError extends AppError {}

/**
 * Thrown when an operation would result in a duplicate resource.
 */
export class ConflictError extends AppError {}


// =============================================================================
// 2. TYPE DEFINITIONS & INTERFACES
// =============================================================================

// --- Internal Composite Types ---

/**
 * Internal representation of a geographical location.
 */
type Location = {
  lat: number;
  lon: number;
};

/**
 * A normalized response structure returned by a RoutingProvider.
 * This decouples the Engine from the specific format of any external API.
 */
type ProviderRouteResponse = {
  distanceMeters: number;
  durationSeconds: number;
  instructions: string[];
  polyline?: string; // Encoded polyline
  geojson?: Record<string, any>; // GeoJSON geometry object
  rawResponse: Record<string, any>;
};


// --- Database Schema Types ---

type RoutingRequestDoc = {
  _id: ObjectId;
  origin: Location;
  destination: Location;
  mode: string;
  constraints?: Record<string, any>;
  createdAt: Date;
};

type RoutingResultDoc = {
  _id: ObjectId;
  requestId: ObjectId;
  mode: string;
  distanceMeters: number;
  durationSeconds: number;
  instructions: string[];
  polyline?: string;
  geojson?: Record<string, any>;
  rawProviderResponse: Record<string, any>;
  createdAt: Date;
};

type NetworkDataDoc = {
    _id: ObjectId;
    source: string;
    data: Record<string, any>;
    lastUpdatedAt: Date;
    dataHash: string; // To check for updates
};


// --- Provider-related Interfaces ---

/**
 * Configuration for the DefaultRoutingProvider.
 */
export type DefaultRoutingProviderConfig = {
  type: "valhalla" | "ors"; // Add other providers like 'google' here
  baseUrl: string;
  apiKey?: string;
};

/**
 * Defines the contract for any injectable routing provider.
 */
export interface RoutingProvider {
  /**
   * Fetches one or more routes from the external service.
   * @returns A promise that resolves to an array of normalized route responses.
   */
  fetchRoutes(
    origin: Location,
    destination: Location,
    mode: string,
    maxAlternatives: number,
    constraints?: Record<string, any>,
  ): Promise<ProviderRouteResponse[]>;
}


// =============================================================================
// 3. DEFAULT ROUTING PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * A default implementation of `RoutingProvider` that uses `fetch` to connect
 * to external routing services like Valhalla or OpenRouteService.
 */
export class DefaultRoutingProvider implements RoutingProvider {
  private config: DefaultRoutingProviderConfig;

  constructor(config: DefaultRoutingProviderConfig) {
    this.config = config;
  }

  async fetchRoutes(
    origin: Location,
    destination: Location,
    mode: string,
    maxAlternatives: number,
    constraints?: Record<string, any>,
  ): Promise<ProviderRouteResponse[]> {
    switch (this.config.type) {
      case "valhalla":
        return this.fetchValhallaRoutes(origin, destination, mode, maxAlternatives, constraints);
      case "ors":
        // Implementation for OpenRouteService would go here
        throw new Error("OpenRouteService provider is not implemented yet.");
      default:
        throw new ExternalServiceError(`Unsupported provider type: ${this.config.type}`);
    }
  }

  /**
   * Specific implementation for Valhalla's `/route` endpoint.
   */
  private async fetchValhallaRoutes(
    origin: Location,
    destination: Location,
    mode: string,
    maxAlternatives: number,
    constraints?: Record<string, any>,
  ): Promise<ProviderRouteResponse[]> {
    const valhallaModeMap: Record<string, string> = {
      driving: "auto",
      walking: "pedestrian",
      cycling: "bicycle",
      transit: "multimodal",
    };

    const costing = valhallaModeMap[mode];
    if (!costing) {
      throw new ValidationError(`Mode '${mode}' is not supported by the Valhalla provider.`);
    }

    const requestBody = {
      locations: [
        { lat: origin.lat, lon: origin.lon },
        { lat: destination.lat, lon: destination.lon },
      ],
      costing: costing,
      alternates: Math.max(0, maxAlternatives - 1), // Valhalla: 0 means 1 route, 1 means 2 routes, etc.
      ...constraints,
    };

    const url = new URL(this.config.baseUrl);
    url.searchParams.set("json", JSON.stringify(requestBody));
    if (this.config.apiKey) {
        url.searchParams.set("api_key", this.config.apiKey);
    }
    
    let response;
    try {
      response = await fetch(url.toString(), {
        method: "GET", // Valhalla can use GET with JSON in query param
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      throw new ExternalServiceError(`Fetch failed for Valhalla service: ${(error as Error).message}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ExternalServiceError(
        `Valhalla API error (${response.status}): ${errorBody}`,
      );
    }

    const data = await response.json();
    if (!data.trip && !data.alternates) {
      throw new ExternalServiceError("Invalid response structure from Valhalla API.");
    }

    const routes = [data.trip, ...(data.alternates || [])].filter(Boolean);
    return routes.map(this.normalizeValhallaRoute);
  }

  private normalizeValhallaRoute(trip: any): ProviderRouteResponse {
    const summary = trip.summary;
    const instructions = trip.legs.flatMap((leg: any) =>
      leg.maneuvers.map((maneuver: any) => maneuver.instruction)
    );

    return {
      distanceMeters: summary.length * 1000, // Valhalla distance is in km
      durationSeconds: summary.time,
      instructions: instructions,
      polyline: trip.legs[0]?.shape, // Encoded polyline6
      geojson: {
        type: "LineString",
        // Valhalla polyline needs decoding, but for now we pass it as-is
        // A full implementation would decode this to a coordinate array.
        // For this minimal example, we'll omit the coordinates.
        coordinates: [], 
      },
      rawResponse: trip,
    };
  }
}

// =============================================================================
// 4. MAIN CLASS: ExternalRoutingEngine
// =============================================================================

export class ExternalRoutingEngine {
  private db: Db;
  private requests: Collection<RoutingRequestDoc>;
  private results: Collection<RoutingResultDoc>;
  private networkData: Collection<NetworkDataDoc>;
  private provider: RoutingProvider;
  private osmService: OSMService;
  private routeCache: any;

  private constructor(db: Db, provider: RoutingProvider) {
    this.db = db;
    this.provider = provider;
    this.osmService = new OSMService();
    this.requests = db.collection<RoutingRequestDoc>("routingRequests");
    this.results = db.collection<RoutingResultDoc>("routingResults");
    this.networkData = db.collection<NetworkDataDoc>("networkData");
    
    const collections = getMappingCollections(db);
    this.routeCache = collections.routeCache;
  }

  /**
   * Factory function to create and initialize an instance of ExternalRoutingEngine.
   * Loads environment variables, connects to MongoDB, and sets up a default provider.
   */
  public static async create(provider?: RoutingProvider): Promise<ExternalRoutingEngine> {
    const env = await load();
    const MONGODB_URL = env["MONGODB_URL"];
    const DB_NAME = env["DB_NAME"];

    if (!MONGODB_URL || !DB_NAME) {
      throw new Error("MONGODB_URL and DB_NAME must be set in the environment.");
    }
    
    const client = new MongoClient(MONGODB_URL);
    await client.connect();
    const db = client.db(DB_NAME);

    // Use injected provider or create a default one from env vars
    const defaultProvider = provider || new DefaultRoutingProvider({
        type: (env["ROUTING_PROVIDER_TYPE"] as any) || "valhalla",
        baseUrl: env["ROUTING_PROVIDER_URL"]!,
        apiKey: env["ROUTING_PROVIDER_API_KEY"],
    });

    if(!defaultProvider) {
        throw new Error("Routing provider could not be initialized. Check ROUTING_PROVIDER_URL in env.");
    }

    return new ExternalRoutingEngine(db, defaultProvider);
  }

  // Add a new factory method that accepts a Db instance
  public static createWithDb(db: Db, provider: RoutingProvider): ExternalRoutingEngine {
    return new ExternalRoutingEngine(db, provider);
  }

  /**
   * Validates latitude and longitude values.
   */
  private _validateCoordinates(lat: number, lon: number): void {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new ValidationError(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
  }

  /**
   * Calculates a single route between an origin and destination.
   *
   * @param originLat - Latitude of the starting point.
   * @param originLon - Longitude of the starting point.
   * @param destLat - Latitude of the destination point.
   * @param destLon - Longitude of the destination point.
   * @param mode - The mode of travel (e.g., "driving", "walking").
   * @param constraintsJson - Optional JSON string for provider-specific constraints.
   * @returns The ID of the stored routing result.
   */
  async calculateRoute(
    originLat: number,
    originLon: number,
    destLat: number,
    destLon: number,
    mode: "driving" | "walking" | "transit" | "cycling",
    constraintsJson?: string,
  ): Promise<string> {
      const ids = await this.getAlternativeRoutes(originLat, originLon, destLat, destLon, mode, 1, constraintsJson);
      if (ids.length === 0) {
          throw new ExternalServiceError("Routing service did not return a valid route.");
      }
      return ids[0];
  }

  /**
   * Calculates multiple alternative routes.
   *
   * @param maxAlternatives - The maximum number of alternative routes to return.
   * @returns An array of IDs for the stored routing results.
   */
  async getAlternativeRoutes(
    originLat: number,
    originLon: number,
    destLat: number,
    destLon: number,
    mode: "driving" | "walking" | "transit" | "cycling",
    maxAlternatives: number,
    constraintsJson?: string,
  ): Promise<string[]> {
    this._validateCoordinates(originLat, originLon);
    this._validateCoordinates(destLat, destLon);
    if (maxAlternatives <= 0) {
        throw new ValidationError("maxAlternatives must be greater than 0.");
    }

    const origin: Location = { lat: originLat, lon: originLon };
    const destination: Location = { lat: destLat, lon: destLon };
    let constraints: Record<string, any> | undefined;
    if (constraintsJson) {
        try {
            constraints = JSON.parse(constraintsJson);
        } catch {
            throw new ValidationError("constraintsJson is not valid JSON.");
        }
    }

    const requestDoc: Omit<RoutingRequestDoc, '_id'> = {
        origin,
        destination,
        mode,
        constraints,
        createdAt: new Date(),
    };
    const requestInsertResult = await this.requests.insertOne(requestDoc as RoutingRequestDoc);
    const requestId = requestInsertResult.insertedId;

    const providerResponses = await this.provider.fetchRoutes(
      origin,
      destination,
      mode,
      maxAlternatives,
      constraints,
    );

    if (providerResponses.length === 0) {
        return [];
    }

    const resultDocs: Omit<RoutingResultDoc, '_id'>[] = providerResponses.map(res => ({
        requestId: requestId,
        mode: mode,
        distanceMeters: res.distanceMeters,
        durationSeconds: res.durationSeconds,
        instructions: res.instructions,
        polyline: res.polyline,
        geojson: res.geojson,
        rawProviderResponse: res.rawResponse,
        createdAt: new Date(),
    }));

    const resultInsertResult = await this.results.insertMany(resultDocs as RoutingResultDoc[]);
    const insertedIds = Object.values(resultInsertResult.insertedIds).map((id: any) => id.toHexString());

    return insertedIds;
  }

  /**
   * Refreshes cached network data from an external source.
   * For this minimal implementation, this is a placeholder.
   *
   * @param source - A string identifying the data source (e.g., 'osm_data').
   * @returns True if data was updated, false otherwise.
   */
  async updateNetworkData(source = 'default'): Promise<boolean> {
    // In a real implementation, this would fetch data from a source URL
    // For now, we simulate fetching new data.
    const mockFetchedData = {
        name: `Network data for ${source}`,
        version: `1.0`,
        timestamp: `2025-01-01T00:00:00.000Z`, // Fixed timestamp for consistent hashing
    };
    
    // Use a simple hash to check for changes
    const newDataHash = await this.hashObject(mockFetchedData);

    const existingData = await this.networkData.findOne({ source: source });
    console.log("DEBUG: existingData:", existingData);
    console.log("DEBUG: newDataHash:", newDataHash);

    if (existingData && existingData.dataHash === newDataHash) {
        console.log("DEBUG: No update needed, data unchanged");
        return false; // No update needed
    }

    console.log("DEBUG: Performing upsert operation");
    const result = await this.networkData.updateOne(
        { source: source },
        {
            $set: {
                data: mockFetchedData,
                lastUpdatedAt: new Date(),
                dataHash: newDataHash,
            },
            $setOnInsert: {
                source: source
            }
        },
        { upsert: true }
    );

    console.log("DEBUG: Upsert result:", result);
    
    // Check if document was actually inserted
    const insertedDoc = await this.networkData.findOne({ source: source });
    console.log("DEBUG: Document after upsert:", insertedDoc);
    
    // Count documents to verify
    const docCount = await this.networkData.countDocuments({ source: source });
    console.log("DEBUG: Document count for source:", source, "is:", docCount);

    return true; // Data was updated
  }
  
  private async hashObject(obj: object): Promise<string> {
    const jsonString = JSON.stringify(obj);
    const msgUint8 = new TextEncoder().encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // --- Read Helpers ---

  /**
   * Retrieves a summary of a specific routing result.
   * @param id - The hex string ID of the routing result.
   */
  async getRoutingSummary(id: string): Promise<{
    id: string;
    distanceMeters: number;
    durationMinutes: number;
    mode: string;
    createdAtIso: string;
  }> {
    if (!ObjectId.isValid(id)) throw new ValidationError("Invalid ID format.");
    const objectId = new ObjectId(id);

    const result = await this.results.findOne({ _id: objectId });
    if (!result) {
      throw new NotFoundError(`RoutingResult with id ${id} not found.`);
    }

    return {
      id: result._id.toHexString(),
      distanceMeters: Math.round(result.distanceMeters),
      durationMinutes: Math.round(result.durationSeconds / 60),
      mode: result.mode,
      createdAtIso: result.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves the turn-by-turn instructions for a specific routing result.
   * @param id - The hex string ID of the routing result.
   */
  async getTurnByTurn(id: string): Promise<string[]> {
    if (!ObjectId.isValid(id)) throw new ValidationError("Invalid ID format.");
    const objectId = new ObjectId(id);
    
    const result = await this.results.findOne(
        { _id: objectId },
        { projection: { instructions: 1 } }
    );

    if (!result) {
        throw new NotFoundError(`RoutingResult with id ${id} not found.`);
    }

    return result.instructions || [];
  }

  /**
   * Retrieves the encoded polyline or a stringified GeoJSON for a route.
   * @param id - The hex string ID of the routing result.
   */
  async getPolyline(id: string): Promise<string> {
    if (!ObjectId.isValid(id)) throw new ValidationError("Invalid ID format.");
    const objectId = new ObjectId(id);

    const result = await this.results.findOne(
        { _id: objectId },
        { projection: { polyline: 1, geojson: 1 } }
    );

    if (!result) {
        throw new NotFoundError(`RoutingResult with id ${id} not found.`);
    }

    // Prefer polyline, fall back to stringified GeoJSON
    if (result.polyline) {
        return result.polyline;
    }
    if (result.geojson) {
        return JSON.stringify(result.geojson);
    }
    
    throw new NotFoundError(`No polyline or GeoJSON available for route ${id}.`);
  }

  // =============================================================================
  // NEW OSM-BASED ROUTING METHODS
  // =============================================================================

  /**
   * Calculate hiking route using OSM data
   */
  async calculateHikingRoute(
    origin: GeoPoint,
    destination: GeoPoint,
    preferences?: {
      avoidHighways?: boolean;
      preferTrails?: boolean;
      maxDistance?: number;
      difficulty?: string;
    }
  ): Promise<RouteSegment[]> {
    const routeHash = this.generateRouteHash(origin, destination, 'hiking', preferences);
    
    // Check cache first
    const cached = await this.routeCache.findOne({ route_hash: routeHash });
    if (cached && cached.expires_at > new Date()) {
      return cached.data;
    }

    try {
      // Find trails near origin and destination
      const originTrails = await this.osmService.findTrails(origin, 2);
      const destTrails = await this.osmService.findTrails(destination, 2);
      
      // Find trailheads
      const originTrailheads = await this.osmService.findTrailheads(origin, 5);
      const destTrailheads = await this.osmService.findTrailheads(destination, 5);
      
      // Create route segments
      const segments: RouteSegment[] = [];
      
      // Add approach to trail
      if (originTrails.length > 0) {
        const nearestTrail = this.findNearestTrail(origin, originTrails);
        segments.push(this.createApproachSegment(origin, nearestTrail.coordinates[0]));
        segments.push(this.createTrailSegment(nearestTrail));
      } else if (originTrailheads.length > 0) {
        const nearestTrailhead = this.findNearestTrailhead(origin, originTrailheads);
        segments.push(this.createApproachSegment(origin, nearestTrailhead.location));
      }
      
      // Add destination approach
      if (destTrails.length > 0) {
        const nearestDestTrail = this.findNearestTrail(destination, destTrails);
        segments.push(this.createApproachSegment(nearestDestTrail.coordinates[0], destination));
      } else if (destTrailheads.length > 0) {
        const nearestDestTrailhead = this.findNearestTrailhead(destination, destTrailheads);
        segments.push(this.createApproachSegment(nearestDestTrailhead.location, destination));
      }
      
      // Cache the result
      const cacheDoc: Omit<RouteCacheDoc, '_id'> = {
        route_hash: routeHash,
        data: segments,
        cached_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        origin,
        destination,
        mode: 'hiking'
      };
      
      await this.routeCache.replaceOne(
        { route_hash: routeHash },
        cacheDoc,
        { upsert: true }
      );
      
      return segments;
    } catch (error) {
      console.error('Hiking route calculation error:', error);
      throw new ExternalServiceError(`Failed to calculate hiking route: ${error.message}`);
    }
  }

  /**
   * Calculate multi-modal route (transit + hiking)
   */
  async calculateMultiModalRoute(
    origin: GeoPoint,
    destination: GeoPoint,
    options?: {
      maxTransitTime?: number;
      preferDirectRoutes?: boolean;
      avoidTransfers?: boolean;
    }
  ): Promise<RouteSegment[]> {
    const routeHash = this.generateRouteHash(origin, destination, 'multimodal', options);
    
    // Check cache first
    const cached = await this.routeCache.findOne({ route_hash: routeHash });
    if (cached && cached.expires_at > new Date()) {
      return cached.data;
    }

    try {
      const segments: RouteSegment[] = [];
      
      // Find transit stops near origin and destination
      const originStops = await this.osmService.findTransitStops(origin, 1);
      const destStops = await this.osmService.findTransitStops(destination, 1);
      
      if (originStops.length > 0 && destStops.length > 0) {
        // Add walking to transit
        const nearestOriginStop = this.findNearestTransitStop(origin, originStops);
        segments.push(this.createWalkingSegment(origin, nearestOriginStop.location, 'Walk to transit'));
        
        // Add transit segment (simplified - would need real transit routing)
        segments.push(this.createTransitSegment(nearestOriginStop, destStops[0]));
        
        // Add walking from transit to destination
        const nearestDestStop = this.findNearestTransitStop(destination, destStops);
        segments.push(this.createWalkingSegment(nearestDestStop.location, destination, 'Walk to destination'));
      } else {
        // Fallback to direct walking route
        segments.push(this.createWalkingSegment(origin, destination, 'Direct walking route'));
      }
      
      // Cache the result
      const cacheDoc: Omit<RouteCacheDoc, '_id'> = {
        route_hash: routeHash,
        data: segments,
        cached_at: new Date(),
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        origin,
        destination,
        mode: 'multimodal'
      };
      
      await this.routeCache.replaceOne(
        { route_hash: routeHash },
        cacheDoc,
        { upsert: true }
      );
      
      return segments;
    } catch (error) {
      console.error('Multi-modal route calculation error:', error);
      throw new ExternalServiceError(`Failed to calculate multi-modal route: ${error.message}`);
    }
  }

  /**
   * Find nearby trails and trailheads
   */
  async findNearbyTrails(
    center: GeoPoint,
    radiusKm: number = 10
  ): Promise<{ trails: any[], trailheads: any[] }> {
    const [trails, trailheads] = await Promise.all([
      this.osmService.findTrails(center, radiusKm),
      this.osmService.findTrailheads(center, radiusKm)
    ]);
    
    return { trails, trailheads };
  }

  /**
   * Get route alternatives using different criteria
   */
  async getRouteAlternatives(
    origin: GeoPoint,
    destination: GeoPoint,
    criteria: 'fastest' | 'shortest' | 'scenic' | 'easiest'
  ): Promise<RouteSegment[][]> {
    const alternatives: RouteSegment[][] = [];
    
    try {
      // Calculate different route options based on criteria
      switch (criteria) {
        case 'fastest':
          alternatives.push(await this.calculateHikingRoute(origin, destination, { avoidHighways: true }));
          break;
        case 'shortest':
          alternatives.push(await this.calculateHikingRoute(origin, destination, { maxDistance: 5000 }));
          break;
        case 'scenic':
          alternatives.push(await this.calculateHikingRoute(origin, destination, { preferTrails: true }));
          break;
        case 'easiest':
          alternatives.push(await this.calculateHikingRoute(origin, destination, { difficulty: 'easy' }));
          break;
      }
      
      return alternatives;
    } catch (error) {
      console.error('Route alternatives error:', error);
      return [];
    }
  }

  // Private helper methods for OSM routing

  private generateRouteHash(
    origin: GeoPoint, 
    destination: GeoPoint, 
    mode: string, 
    options?: any
  ): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    const hashString = `${origin.lat},${origin.lon}:${destination.lat},${destination.lon}:${mode}:${optionsStr}`;
    return btoa(hashString);
  }

  private findNearestTrail(center: GeoPoint, trails: any[]): any {
    let nearest = trails[0];
    let minDistance = this.calculateDistance(center, nearest.coordinates[0]);
    
    for (const trail of trails) {
      const distance = this.calculateDistance(center, trail.coordinates[0]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = trail;
      }
    }
    
    return nearest;
  }

  private findNearestTrailhead(center: GeoPoint, trailheads: any[]): any {
    let nearest = trailheads[0];
    let minDistance = this.calculateDistance(center, nearest.location);
    
    for (const trailhead of trailheads) {
      const distance = this.calculateDistance(center, trailhead.location);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = trailhead;
      }
    }
    
    return nearest;
  }

  private findNearestTransitStop(center: GeoPoint, stops: any[]): any {
    let nearest = stops[0];
    let minDistance = this.calculateDistance(center, nearest.location);
    
    for (const stop of stops) {
      const distance = this.calculateDistance(center, stop.location);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = stop;
      }
    }
    
    return nearest;
  }

  private createApproachSegment(from: GeoPoint, to: GeoPoint): RouteSegment {
    return {
      from,
      to,
      distance: this.calculateDistance(from, to),
      duration: this.calculateWalkingTime(from, to),
      instructions: [`Walk from ${this.formatCoordinates(from)} to ${this.formatCoordinates(to)}`],
      surface: 'pavement',
      difficulty: 'easy',
      elevation_gain: 0,
      waypoints: [from, to]
    };
  }

  private createTrailSegment(trail: any): RouteSegment {
    const coordinates = trail.coordinates || [];
    if (coordinates.length < 2) {
      throw new Error('Trail must have at least 2 coordinates');
    }
    
    return {
      from: coordinates[0],
      to: coordinates[coordinates.length - 1],
      distance: trail.length || this.calculateTrailLength(coordinates),
      duration: this.calculateTrailDuration(trail),
      instructions: [`Follow ${trail.name} trail`],
      surface: trail.surface || 'dirt',
      difficulty: trail.difficulty || 'moderate',
      elevation_gain: trail.elevation_gain || 0,
      waypoints: coordinates
    };
  }

  private createWalkingSegment(from: GeoPoint, to: GeoPoint, instruction: string): RouteSegment {
    return {
      from,
      to,
      distance: this.calculateDistance(from, to),
      duration: this.calculateWalkingTime(from, to),
      instructions: [instruction],
      surface: 'pavement',
      difficulty: 'easy',
      elevation_gain: 0,
      waypoints: [from, to]
    };
  }

  private createTransitSegment(fromStop: any, toStop: any): RouteSegment {
    return {
      from: fromStop.location,
      to: toStop.location,
      distance: this.calculateDistance(fromStop.location, toStop.location),
      duration: this.calculateTransitTime(fromStop.location, toStop.location),
      instructions: [`Take transit from ${fromStop.name} to ${toStop.name}`],
      surface: 'transit',
      difficulty: 'easy',
      elevation_gain: 0,
      waypoints: [fromStop.location, toStop.location]
    };
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

  private calculateWalkingTime(from: GeoPoint, to: GeoPoint): number {
    const distance = this.calculateDistance(from, to);
    const walkingSpeed = 1.4; // m/s (5 km/h)
    return Math.round(distance / walkingSpeed);
  }

  private calculateTransitTime(from: GeoPoint, to: GeoPoint): number {
    const distance = this.calculateDistance(from, to);
    const transitSpeed = 8.3; // m/s (30 km/h average)
    return Math.round(distance / transitSpeed);
  }

  private calculateTrailLength(coordinates: GeoPoint[]): number {
    let total = 0;
    for (let i = 1; i < coordinates.length; i++) {
      total += this.calculateDistance(coordinates[i-1], coordinates[i]);
    }
    return total;
  }

  private calculateTrailDuration(trail: any): number {
    const distance = trail.length || 0;
    const hikingSpeed = 1.0; // m/s (3.6 km/h average hiking speed)
    return Math.round(distance / hikingSpeed);
  }

  private formatCoordinates(point: GeoPoint): string {
    return `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`;
  }
}

// Concept wrapper for the concept server
export class ExternalRoutingEngineConcept {
  private engine: ExternalRoutingEngine;

  constructor(private db: Db) {
    // Create a default provider for the concept
    const defaultProvider = new DefaultRoutingProvider({
      type: "valhalla",
      baseUrl: "http://localhost:8002",
      apiKey: undefined,
    });
    this.engine = ExternalRoutingEngine.createWithDb(db, defaultProvider);
  }

  async calculateRoute(origin: any, destination: any, mode: string, constraints: any) {
    // Validate inputs
    if (!origin || !destination) {
      throw new Error("Origin and destination are required");
    }
    
    const originLat = origin.latitude || origin.lat;
    const originLon = origin.longitude || origin.lon;
    const destLat = destination.latitude || destination.lat;
    const destLon = destination.longitude || destination.lon;
    
    if (!originLat || !originLon || !destLat || !destLon) {
      throw new Error("Valid coordinates are required for origin and destination");
    }
    
    return await this.engine.calculateRoute(
      originLat,
      originLon,
      destLat,
      destLon,
      mode as any,
      constraints ? JSON.stringify(constraints) : undefined
    );
  }

  async getAlternativeRoutes(origin: any, destination: any, mode: string, maxAlternatives: number) {
    return await this.engine.getAlternativeRoutes(
      origin.latitude || origin.lat,
      origin.longitude || origin.lon,
      destination.latitude || destination.lat,
      destination.longitude || destination.lon,
      mode as any,
      maxAlternatives
    );
  }

  async updateNetworkData() {
    return await this.engine.updateNetworkData();
  }

  // New OSM-based methods
  async calculateHikingRoute(origin: any, destination: any, preferences?: any) {
    return await this.engine.calculateHikingRoute(
      { lat: origin.latitude || origin.lat, lon: origin.longitude || origin.lon },
      { lat: destination.latitude || destination.lat, lon: destination.longitude || destination.lon },
      preferences
    );
  }

  async calculateMultiModalRoute(origin: any, destination: any, options?: any) {
    return await this.engine.calculateMultiModalRoute(
      { lat: origin.latitude || origin.lat, lon: origin.longitude || origin.lon },
      { lat: destination.latitude || destination.lat, lon: destination.longitude || destination.lon },
      options
    );
  }

  async findNearbyTrails(center: any, radiusKm?: number) {
    return await this.engine.findNearbyTrails(
      { lat: center.latitude || center.lat, lon: center.longitude || center.lon },
      radiusKm
    );
  }

  async getRouteAlternatives(origin: any, destination: any, criteria: string) {
    return await this.engine.getRouteAlternatives(
      { lat: origin.latitude || origin.lat, lon: origin.longitude || origin.lon },
      { lat: destination.latitude || destination.lat, lon: destination.longitude || destination.lon },
      criteria as any
    );
  }
}

export default ExternalRoutingEngineConcept;