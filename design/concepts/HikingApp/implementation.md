# prompt: Implement ExternalRoutingEngine (minimal Deno + MongoDB + provider-injected)
# Depricated



[@spec](./ExternalRoutingEngine.md)

## Goal
Implement **ExternalRoutingEngine** as a single TypeScript class that delegates routing to an **injectable provider** (Valhalla / OpenRouteService / Google, etc.). Keep deps minimal (Mongo driver only). Public API is normalized to **ids + primitives**; all composites remain internal.

## Platform + constraints
- **Runtime:** Deno (latest), TypeScript
- **DB:** MongoDB Atlas via `.env` (`MONGODB_URL`), `DB_NAME`
- **Deps:** only `npm:mongo` and Deno std if needed. **No other packages**.
- **Providers:** a tiny `RoutingProvider` interface; default impl uses `fetch` and can target Valhalla/ORS/Google by config.
- **API surface:** only ids + primitives (strings, numbers, booleans, ISO timestamps, lat/lon).
- **Modularity:** no calls to other concepts; no cross-state reads/writes.
- **Errors:** `ValidationError`, `NotFoundError`, `ExternalServiceError`, `ConflictError`.

## Public API normalization (ids + primitives only)
Original actions use composite `Location`, `RoutingResult`, etc. Normalize as:

- `calculateRoute(originLat: number, originLon: number, destLat: number, destLon: number, mode: "driving"|"walking"|"transit"|"cycling", constraintsJson?: string): Promise<string /* routingResultId */>`
- `getAlternativeRoutes(originLat: number, originLon: number, destLat: number, destLon: number, mode: "driving"|"walking"|"transit"|"cycling", maxAlternatives: number, constraintsJson?: string): Promise<string[] /* routingResultIds */>`
- `updateNetworkData(source?: string): Promise<boolean /* updated */>`

**Read helpers (primitive-only)**
- `getRoutingSummary(id: string): Promise<{ id: string; distanceMeters: number; durationMinutes: number; mode: string; createdAtIso: string }>`
- `getTurnByTurn(id: string): Promise<string[] /* instructions */>`
- (optional) `getPolyline(id: string): Promise<string /* encoded polyline or GeoJSON as string */>`

This Is the implementation for a single concept so it should be in a single file it's critical for de bugging and understanding purposes that the concept of self contained the testing, of course could be in a separate file but ensure that this is one file for the single concept THis will be part of a backend so does nto need a main. Your output should be safe. 

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
# Implement Tests in the following style. 

import {
  assert,
  assertEquals,
  assertRejects,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { beforeAll, afterAll, describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  TransitRoutePlannerConcept,
  connectMongo,
  ensureCollections,
  ValidationError,
  NotFoundError,
  TransitRoutePlannerLLM,
  TRANSIT_STOPS_COLLECTION,
  TRAILHEADS_COLLECTION,
  TRAILS_COLLECTION,
  PLANNED_ROUTES_COLLECTION,
} from "./TransitRoutePlanner.ts";
import { Db, ObjectId } from "npm:mongo";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// --- Test Setup ---
const env = await load({ export: true });
const MONGODB_URL = Deno.env.get("MONGODB_URL");
const DB_NAME_BASE = Deno.env.get("DB_NAME");

if (!MONGODB_URL || !DB_NAME_BASE) {
  throw new Error("MONGODB_URL and DB_NAME must be set in the environment.");
}

const DB_NAME_TEST = `${DB_NAME_BASE}-test`;

describe("TransitRoutePlannerConcept", () => {
  let db: Db;
  let planner: TransitRoutePlannerConcept;
  let testData: {
    originStopId: string;
    destStopId: string;
    trailheadId: string;
    trailShortId: string;
    trailLongId: string;
    trailScenicId: string;
  };

  beforeAll(async () => {
    db = await connectMongo(MONGODB_URL, DB_NAME_TEST);
    await ensureCollections(db);
    planner = new TransitRoutePlannerConcept(db);

    // Clean up before seeding
    await Promise.all([
        db.collection(TRANSIT_STOPS_COLLECTION).deleteMany({}),
        db.collection(TRAILHEADS_COLLECTION).deleteMany({}),
        db.collection(TRAILS_COLLECTION).deleteMany({}),
        db.collection(PLANNED_ROUTES_COLLECTION).deleteMany({}),
    ]);

    // Seed data
    const originStopRes = await db.collection(TRANSIT_STOPS_COLLECTION).insertOne({
      _id: new ObjectId(),
      name: "Downtown Central",
      loc: { type: "Point", coordinates: [-122.4194, 37.7749] }, // San Francisco
      routes: ["5R", "N"],
    });
    const destStopRes = await db.collection(TRANSIT_STOPS_COLLECTION).insertOne({
      _id: new ObjectId(),
      name: "Mountain View Transit Center",
      loc: { type: "Point", coordinates: [-122.0763, 37.3942] }, // Near a hiking area
      routes: ["22", "522"],
    });
    const trailShortRes = await db.collection(TRAILS_COLLECTION).insertOne({
      _id: new ObjectId(), name: "Creek Loop", minutes: 45 
    });
    const trailLongRes = await db.collection(TRAILS_COLLECTION).insertOne({
      _id: new ObjectId(), name: "Ridge Trail", minutes: 120 
    });
    const trailScenicRes = await db.collection(TRAILS_COLLECTION).insertOne({
      _id: new ObjectId(), name: "Ocean View Path", minutes: 75, description: "A beautiful coastal walk."
    });
    const trailheadRes = await db.collection(TRAILHEADS_COLLECTION).insertOne({
      _id: new ObjectId(),
      name: "Rancho San Antonio Trailhead",
      loc: { type: "Point", coordinates: [-122.08, 37.39] }, // Close to dest stop
      connectingTrailIds: [
        trailShortRes.toHexString(),
        trailLongRes.toHexString(),
        trailScenicRes.toHexString(),
      ],
    });

    testData = {
        originStopId: originStopRes.toHexString(),
        destStopId: destStopRes.toHexString(),
        trailheadId: trailheadRes.toHexString(),
        trailShortId: trailShortRes.toHexString(),
        trailLongId: trailLongRes.toHexString(),
        trailScenicId: trailScenicRes.toHexString(),
    };
  });

  afterAll(async () => {
    await db.dropDatabase();
    await db.client.close();
  });

  it("Operational Principle (happy path): should plan a feasible route", async () => {
    const originLat = 37.775;
    const originLon = -122.419;
    const maxTravelMinutes = 300; // 5 hours

    console.log("\n--- Testing Happy Path ---");
    console.log(`Input: origin=(${originLat},${originLon}), trailheadId=${testData.trailheadId}, maxTime=${maxTravelMinutes}min`);

    const routeId = await planner.planRoute(
      originLat,
      originLon,
      testData.trailheadId,
      maxTravelMinutes
    );
    assert(ObjectId.isValid(routeId), "Should return a valid ObjectId string");
    
    const summary = await planner.getPlannedRouteSummary(routeId);
    console.log("Output Summary:", summary);

    assertEquals(summary.id, routeId);
    assertEquals(summary.totalMinutes, summary.transitMinutes + summary.hikingMinutes);
    assert(summary.hikingMinutes > 0, "Hiking minutes should be positive");
    assert(summary.totalMinutes <= maxTravelMinutes, "Total time should not exceed max");
    // Default behavior is to pick the longest hike that fits
    assertEquals(summary.hikingMinutes, 120, "Should have picked the longest trail");
  });

  it("Scenario: Tight time window should select a shorter hike", async () => {
    const originLat = 37.775;
    const originLon = -122.419;
    // Estimated transit is ~90-100 mins round trip.
    // 150 mins total leaves ~50-60 mins for hiking. Should pick the 45-min trail.
    const maxTravelMinutes = 150; 
    
    console.log("\n--- Testing Tight Time Window ---");
    console.log(`Input: maxTime=${maxTravelMinutes}min`);

    const routeId = await planner.planRoute(
      originLat,
      originLon,
      testData.trailheadId,
      maxTravelMinutes
    );
    const summary = await planner.getPlannedRouteSummary(routeId);
    console.log("Output Summary:", summary);

    assertEquals(summary.hikingMinutes, 45, "Should have picked the shorter 45-min trail");
  });
  
  it("Scenario: Zero/negative remaining time should throw ValidationError", async () => {
    console.log("\n--- Testing Insufficient Time ---");
    await assertRejects(
      () => planner.planRoute(37.775, -122.419, testData.trailheadId, 60), // Not enough time
      ValidationError,
      "Insufficient time for hiking"
    );
    console.log("Correctly threw ValidationError for insufficient time.");
  });
  
  it("Scenario: getAlternativeRoutes('shorter') should return a shorter hike", async () => {
    const originalRouteId = await planner.planRoute(37.775, -122.419, testData.trailheadId, 300);
    const originalSummary = await planner.getPlannedRouteSummary(originalRouteId);
    assertEquals(originalSummary.hikingMinutes, 120); // Starts with the long hike

    console.log("\n--- Testing getAlternativeRoutes('shorter') ---");
    const [altRouteId] = await planner.getAlternativeRoutes(originalRouteId, "shorter");
    assert(altRouteId, "Should return an alternative route ID");
    assertNotEquals(altRouteId, originalRouteId);

    const altSummary = await planner.getPlannedRouteSummary(altRouteId);
    console.log("Original Summary:", originalSummary);
    console.log("Shorter Alt Summary:", altSummary);

    assert(altSummary.hikingMinutes < originalSummary.hikingMinutes, "Alternative hike should be shorter");
    assertEquals(altSummary.hikingMinutes, 45); // The shortest available
  });

  it("Scenario: updateRouteConstraints with a smaller limit should return a new valid route or null", async () => {
    const originalRouteId = await planner.planRoute(37.775, -122.419, testData.trailheadId, 300);
    const originalSummary = await planner.getPlannedRouteSummary(originalRouteId);
    assertEquals(originalSummary.hikingMinutes, 120);

    console.log("\n--- Testing updateRouteConstraints (feasible) ---");
    const updatedRouteId = await planner.updateRouteConstraints(originalRouteId, 180); // Tighter budget
    assert(updatedRouteId, "Should return a new route ID for a feasible update");
    const updatedSummary = await planner.getPlannedRouteSummary(updatedRouteId as string);
    console.log("Updated Summary (180 min):", updatedSummary);
    assert(updatedSummary.hikingMinutes < originalSummary.hikingMinutes);
    assertEquals(updatedSummary.hikingMinutes, 75); // Should pick the 75 min trail

    console.log("\n--- Testing updateRouteConstraints (infeasible) ---");
    const nullRouteId = await planner.updateRouteConstraints(originalRouteId, 80); // Impossible budget
    console.log("Updated Summary (80 min):", nullRouteId);
    assertEquals(nullRouteId, null, "Should return null for an infeasible update");
  });

  it("Scenario: 'scenic' criteria with mock LLM should select the specific scenic trail", async () => {
      // Mock LLM that identifies "Ocean View Path" as scenic
      const mockLLM: TransitRoutePlannerLLM = {
          async classifyScenic(trailName: string): Promise<boolean> {
              return trailName === "Ocean View Path";
          }
      };
      const scenicPlanner = new TransitRoutePlannerConcept(db, mockLLM);
      const originalRouteId = await scenicPlanner.planRoute(37.775, -122.419, testData.trailheadId, 300);

      console.log("\n--- Testing getAlternativeRoutes('scenic') with Mock LLM ---");
      const [scenicRouteId] = await scenicPlanner.getAlternativeRoutes(originalRouteId, "scenic");
      assert(scenicRouteId, "Should return a scenic alternative");
      
      const routeDoc = await db.collection(PLANNED_ROUTES_COLLECTION).findOne({_id: new ObjectId(scenicRouteId)});
      
      assertEquals(routeDoc?.hikingSegments[0].trailId, testData.trailScenicId);
      assertEquals(routeDoc?.hikingMinutes, 75);
      console.log("Correctly selected the mock scenic trail (75 min).");
  });

  it("Error Handling: Should throw NotFoundError for invalid IDs", async () => {
      console.log("\n--- Testing NotFoundError ---");
      const invalidId = new ObjectId().toHexString();
      await assertRejects(
          () => planner.getPlannedRouteSummary(invalidId),
          NotFoundError,
          `Planned route with id ${invalidId} not found.`
      );
      await assertRejects(
          () => planner.getTrailheadCoords(invalidId),
          NotFoundError,
          `Trailhead with id ${invalidId} not found.`
      );
      console.log("Correctly threw NotFoundError for invalid IDs.");
  });
});
# response:

```typescript
import {
  assert,
  assertEquals,
  assertRejects,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  ExternalRoutingEngine,
  RoutingProvider,
  ValidationError,
  NotFoundError,
  ExternalServiceError,
} from "./external-routing-engine.ts";
import { Db, MongoClient, ObjectId } from "npm:mongodb";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// --- Mock Provider Setup ---

// A normalized response structure returned by a RoutingProvider.
type ProviderRouteResponse = {
  distanceMeters: number;
  durationSeconds: number;
  instructions: string[];
  polyline?: string;
  geojson?: Record<string, any>;
  rawResponse: Record<string, any>;
};

// Internal representation of a geographical location.
type Location = {
  lat: number;
  lon: number;
};

/**
 * A mock implementation of RoutingProvider for deterministic testing.
 */
class MockRoutingProvider implements RoutingProvider {
  private responses: ProviderRouteResponse[] = [];
  private shouldThrow = false;
  private errorMessage = "Mock provider failure";

  /**
   * Configures the mock to return specific route responses.
   * @param responses An array of responses to return on the next call.
   */
  public setNextResponse(responses: ProviderRouteResponse[]): void {
    this.responses = responses;
    this.shouldThrow = false;
  }

  /**
   * Configures the mock to throw an error on the next call.
   * @param message The error message to throw.
   */
  public setNextError(message: string): void {
    this.shouldThrow = true;
    this.errorMessage = message;
    this.responses = [];
  }

  fetchRoutes(
    _origin: Location,
    _destination: Location,
    _mode: string,
    maxAlternatives: number,
    _constraints?: Record<string, any>,
  ): Promise<ProviderRouteResponse[]> {
    if (this.shouldThrow) {
      return Promise.reject(new ExternalServiceError(this.errorMessage));
    }
    // Return up to the requested number of alternatives
    return Promise.resolve(this.responses.slice(0, maxAlternatives));
  }
}

// --- Test Suite ---
const env = await load({ export: true });
const MONGODB_URL = Deno.env.get("MONGODB_URL");
const DB_NAME_BASE = Deno.env.get("DB_NAME");

if (!MONGODB_URL || !DB_NAME_BASE) {
  throw new Error("MONGODB_URL and DB_NAME must be set in the environment.");
}

const DB_NAME_TEST = `${DB_NAME_BASE}-test`;
// Override env for the create() method
Deno.env.set("DB_NAME", DB_NAME_TEST);

describe("ExternalRoutingEngine", () => {
  let client: MongoClient;
  let db: Db;
  let engine: ExternalRoutingEngine;
  let mockProvider: MockRoutingProvider;

  // Test constants
  const origin = { lat: 40.7128, lon: -74.0060 }; // NYC
  const dest = { lat: 34.0522, lon: -118.2437 }; // LA
  const mockRoute1: ProviderRouteResponse = {
    distanceMeters: 4500 * 1000,
    durationSeconds: 150000,
    instructions: ["Start route", "Continue straight", "Arrive"],
    polyline: "xyz_polyline_string_abc",
    geojson: { type: "LineString", coordinates: [[-74.0060, 40.7128], [-118.2437, 34.0522]] },
    rawResponse: { some: "data" },
  };
  const mockRoute2: ProviderRouteResponse = {
    distanceMeters: 4800 * 1000,
    durationSeconds: 162000,
    instructions: ["Start alternative route", "Turn left", "Arrive"],
    polyline: "def_polyline_string_ghi",
    geojson: { type: "LineString", coordinates: [] },
    rawResponse: { some: "other_data" },
  };


  beforeAll(async () => {
    mockProvider = new MockRoutingProvider();
    // The `create` method handles DB connection using env vars we've set
    engine = await ExternalRoutingEngine.create(mockProvider);

    // We also need a direct client handle for cleanup
    client = new MongoClient(MONGODB_URL);
    await client.connect();
    db = client.db(DB_NAME_TEST);
  });

  afterAll(async () => {
    if (db) await db.dropDatabase();
    if (client) await client.close();
    // Restore original env var if other tests need it
    if(DB_NAME_BASE) Deno.env.set("DB_NAME", DB_NAME_BASE);
  });

  beforeEach(async () => {
    // Clean all relevant collections before each test
    await Promise.all([
      db.collection("routingRequests").deleteMany({}),
      db.collection("routingResults").deleteMany({}),
      db.collection("networkData").deleteMany({}),
    ]);
    // Reset mock provider state
    mockProvider.setNextResponse([mockRoute1, mockRoute2]);
  });


  it("Operational Principle (happy path): calculateRoute should fetch, store, and return an ID", async () => {
    console.log("\n--- Testing calculateRoute Happy Path ---");
    const resultId = await engine.calculateRoute(
      origin.lat, origin.lon,
      dest.lat, dest.lon,
      "driving"
    );
    
    assert(ObjectId.isValid(resultId), "Should return a valid ObjectId string");

    // Verify stored data via read helpers
    const summary = await engine.getRoutingSummary(resultId);
    console.log("Output Summary:", summary);
    assertEquals(summary.id, resultId);
    assertEquals(summary.distanceMeters, mockRoute1.distanceMeters);
    assertEquals(summary.durationMinutes, Math.round(mockRoute1.durationSeconds / 60));
    assertEquals(summary.mode, "driving");

    const instructions = await engine.getTurnByTurn(resultId);
    assertEquals(instructions, mockRoute1.instructions);

    const polyline = await engine.getPolyline(resultId);
    assertEquals(polyline, mockRoute1.polyline);
  });

  it("Operational Principle (happy path): getAlternativeRoutes should return multiple IDs", async () => {
    console.log("\n--- Testing getAlternativeRoutes Happy Path ---");
    const resultIds = await engine.getAlternativeRoutes(
        origin.lat, origin.lon,
        dest.lat, dest.lon,
        "driving",
        2 // Request exactly 2 alternatives
    );

    assertEquals(resultIds.length, 2, "Should return two route IDs");
    assert(ObjectId.isValid(resultIds[0]));
    assert(ObjectId.isValid(resultIds[1]));
    assertNotEquals(resultIds[0], resultIds[1]);

    // Check the second result to ensure its data was stored correctly
    const summary2 = await engine.getRoutingSummary(resultIds[1]);
    console.log("Second Route Summary:", summary2);
    assertEquals(summary2.distanceMeters, mockRoute2.distanceMeters);
    assertEquals(summary2.durationMinutes, Math.round(mockRoute2.durationSeconds / 60));
  });

  it("Scenario: Provider returns no routes should result in an error or empty array", async () => {
      console.log("\n--- Testing Provider No Routes ---");
      mockProvider.setNextResponse([]); // No routes available

      await assertRejects(
          () => engine.calculateRoute(origin.lat, origin.lon, dest.lat, dest.lon, "walking"),
          ExternalServiceError,
          "Routing service did not return a valid route."
      );

      const altRoutes = await engine.getAlternativeRoutes(origin.lat, origin.lon, dest.lat, dest.lon, "walking", 3);
      assertEquals(altRoutes, [], "getAlternativeRoutes should return an empty array when no routes are found");
  });

  it("Scenario: updateNetworkData should return true on first call and false on second", async () => {
      console.log("\n--- Testing updateNetworkData ---");
      const updatedFirst = await engine.updateNetworkData("osm_main");
      assert(updatedFirst, "First call should report an update");

      const dataCount = await db.collection("networkData").countDocuments({source: "osm_main"});
      assertEquals(dataCount, 1, "Should have inserted one network data document");

      const updatedSecond = await engine.updateNetworkData("osm_main");
      assertEquals(updatedSecond, false, "Second call with same data should report no update");
  });

  it("Error Handling: Should throw ValidationError for invalid inputs", async () => {
      console.log("\n--- Testing ValidationError ---");
      await assertRejects(
          () => engine.calculateRoute(91, 0, 0, 0, "driving"),
          ValidationError,
          "Invalid coordinates"
      );
      await assertRejects(
          () => engine.getAlternativeRoutes(0, 0, 0, 0, "cycling", 0),
          ValidationError,
          "maxAlternatives must be greater than 0"
      );
      await assertRejects(
          () => engine.calculateRoute(0, 0, 0, 0, "driving", "{not-json"),
          ValidationError,
          "constraintsJson is not valid JSON"
      );
      await assertRejects(
          () => engine.getRoutingSummary("not-a-valid-id"),
          ValidationError,
          "Invalid ID format"
      );
  });

  it("Error Handling: Should throw NotFoundError for valid but non-existent IDs", async () => {
      console.log("\n--- Testing NotFoundError ---");
      const nonExistentId = new ObjectId().toHexString();
      await assertRejects(
          () => engine.getRoutingSummary(nonExistentId),
          NotFoundError,
          `RoutingResult with id ${nonExistentId} not found.`
      );
       await assertRejects(
          () => engine.getTurnByTurn(nonExistentId),
          NotFoundError,
          `RoutingResult with id ${nonExistentId} not found.`
      );
  });

  it("Error Handling: Should throw ExternalServiceError when provider fails", async () => {
      console.log("\n--- Testing ExternalServiceError ---");
      const providerErrorMessage = "API rate limit exceeded";
      mockProvider.setNextError(providerErrorMessage);

      await assertRejects(
          () => engine.calculateRoute(origin.lat, origin.lon, dest.lat, dest.lon, "transit"),
          ExternalServiceError,
          providerErrorMessage
      );
  });

  it("API Surface: Polyline helper should fall back to GeoJSON if polyline is missing", async () => {
    console.log("\n--- Testing Polyline Fallback ---");
    const noPolylineRoute: ProviderRouteResponse = {
      distanceMeters: 100,
      durationSeconds: 100,
      instructions: ["Walk"],
      // polyline is missing
      geojson: { type: "Point", coordinates: [1, 1] },
      rawResponse: {},
    };
    mockProvider.setNextResponse([noPolylineRoute]);

    const resultId = await engine.calculateRoute(0,0,1,1,"walking");
    const geoJsonString = await engine.getPolyline(resultId);

    assertEquals(geoJsonString, JSON.stringify(noPolylineRoute.geojson));
  });

});
```