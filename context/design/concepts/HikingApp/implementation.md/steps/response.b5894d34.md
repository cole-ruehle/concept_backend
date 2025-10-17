---
timestamp: 'Thu Oct 16 2025 21:00:47 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_210047.d81a87a7.md]]'
content_id: b5894d34b93b85072bf715c71ab1fa8b0cedd024b0338b88a10e7156958350c0
---

# response:

```typescript
// deno-lint-ignore-file no-explicit-any
/**
 * external-routing-engine.ts
 *
 * Implements the ExternalRoutingEngine concept for a Deno environment.
 * This single-file module provides a class to calculate routes by delegating
 * to external services, storing results in MongoDB. It uses an injectable
*  provider pattern for flexibility with different routing APIs (e.g., Valhalla, ORS).
 *
 * @module
 */

import {
  Collection,
  Db,
  MongoClient,
  ObjectId,
} from "npm:mongodb";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

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
      throw new ExternalServiceError(`Fetch failed for Valhalla service: ${error.message}`);
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

  private constructor(db: Db, provider: RoutingProvider) {
    this.db = db;
    this.provider = provider;
    this.requests = db.collection<RoutingRequestDoc>("routingRequests");
    this.results = db.collection<RoutingResultDoc>("routingResults");
    this.networkData = db.collection<NetworkDataDoc>("networkData");
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
    const requestInsertResult = await this.requests.insertOne(requestDoc);
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

    const resultInsertResult = await this.results.insertMany(resultDocs);
    const insertedIds = Object.values(resultInsertResult.insertedIds).map(id => id.toHexString());

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
        version: `1.${Math.floor(Math.random() * 10)}`,
        timestamp: new Date().toISOString(),
    };
    
    // Use a simple hash to check for changes
    const newDataHash = await this.hashObject(mockFetchedData);

    const existingData = await this.networkData.findOne({ source: source });

    if (existingData && existingData.dataHash === newDataHash) {
        return false; // No update needed
    }

    await this.networkData.updateOne(
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

    return true;
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
}


/*
// =============================================================================
// 5. EXAMPLE USAGE (requires a .env file)
// =============================================================================

// To run this example:
// 1. Create a .env file with:
//    MONGODB_URL="your_mongodb_atlas_connection_string"
//    DB_NAME="your_db_name"
//    ROUTING_PROVIDER_URL="http://localhost:8002/route" # Example for local Valhalla
//    ROUTING_PROVIDER_TYPE="valhalla"
// 2. Run with Deno:
//    deno run --allow-net --allow-env --allow-read external-routing-engine.ts

if (import.meta.main) {
  console.log("Running ExternalRoutingEngine example...");

  try {
    const engine = await ExternalRoutingEngine.create();
    console.log("Engine created and connected to MongoDB.");

    // --- Calculate a single walking route ---
    console.log("\nCalculating a single walking route...");
    const origin = { lat: 40.748817, lon: -73.985428 }; // Empire State Building
    const dest = { lat: 40.7580, lon: -73.9855 };      // Times Square
    
    const resultId = await engine.calculateRoute(
        origin.lat, origin.lon,
        dest.lat, dest.lon,
        "walking"
    );
    console.log(` -> Route calculated. Result ID: ${resultId}`);

    // --- Get summary and instructions ---
    const summary = await engine.getRoutingSummary(resultId);
    console.log(" -> Route Summary:", summary);

    const instructions = await engine.getTurnByTurn(resultId);
    console.log(` -> First 3 instructions: [${instructions.slice(0, 3).join(", ")}]`);
    
    const polyline = await engine.getPolyline(resultId);
    console.log(` -> Polyline starts with: ${polyline.substring(0, 50)}...`);

    // --- Get alternative driving routes ---
    console.log("\nCalculating alternative driving routes...");
    const altResultIds = await engine.getAlternativeRoutes(
        origin.lat, origin.lon,
        dest.lat, dest.lon,
        "driving",
        3
    );
    console.log(` -> Found ${altResultIds.length} alternative routes.`);
    for (const id of altResultIds) {
        const altSummary = await engine.getRoutingSummary(id);
        console.log(`   - Route ${id}: ${altSummary.durationMinutes} min, ${altSummary.distanceMeters} m`);
    }

    // --- Update network data ---
    console.log("\nUpdating network data...");
    const updated = await engine.updateNetworkData("osm_manhattan");
    console.log(` -> Network data was updated: ${updated}`);
    const updatedAgain = await engine.updateNetworkData("osm_manhattan");
    console.log(` -> Network data was updated on second try: ${updatedAgain}`);


  } catch (error) {
    console.error("\n--- AN ERROR OCCURRED ---");
    console.error(`Error Type: ${error.name}`);
    console.error(`Message: ${error.message}`);
    // console.error(error.stack);
  } finally {
    // In a real app, you'd manage the client connection lifecycle.
    // For this script, we'll exit.
    Deno.exit(0);
  }
}
*/
```
