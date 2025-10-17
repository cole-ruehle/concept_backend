---
timestamp: 'Thu Oct 16 2025 19:21:25 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_192125.09bbbf52.md]]'
content_id: c67ec48e7d82af35f5498fe5f547600c5096c34060bbe0efc9b655f6e6487bb9
---

# response:

Here is the implementation for `TransitRoutePlanner.ts`.

### `/src/concepts/TransitRoutePlanner.ts`

````typescript
/**
 * @module TransitRoutePlannerConcept
 *
 * Implements the TransitRoutePlanner for planning multi-modal journeys combining
 * public transit and hiking.
 *
 * ## Environment Variables
 * - MONGODB_URL: The connection string for your MongoDB Atlas cluster.
 * - DB_NAME: The name of the database to use.
 * - GEMINI_API_KEY: (Optional) API key for Google Gemini to enable "scenic" route classification.
 *
 * ## MongoDB Collections & Indexes
 * This module relies on the following collections and indexes, which can be
 * created by calling the exported `ensureCollections` function.
 *
 * - `transit_stops`:
 *   - Indexes: `2dsphere(loc)`, `unique(name)`
 * - `trailheads`:
 *   - Indexes: `2dsphere(loc)`, `unique(name)`
 * - `trails`: (Note: Inferred from spec's `connectingTrailIds`)
 *   - Indexes: `_id`
 * - `planned_routes`:
 *   - Indexes: `destinationTrailheadId`, `criteria`
 *
 * ## Usage
 *
 * ```ts
 * import {
 *   TransitRoutePlannerConcept,
 *   connectMongo,
 *   ensureCollections,
 *   makeGeminiLLM,
 * } from "./TransitRoutePlanner.ts";
 * import { load } from "https://deno.land/std/dotenv/mod.ts";
 *
 * const env = await load();
 * const MONGODB_URL = env["MONGODB_URL"];
 * const DB_NAME = env["DB_NAME"];
 * const GEMINI_API_KEY = env["GEMINI_API_KEY"];
 *
 * const db = await connectMongo(MONGODB_URL, DB_NAME);
 * await ensureCollections(db);
 *
 * // Without LLM
 * const planner = new TransitRoutePlannerConcept(db);
 *
 * // With optional LLM for "scenic" routes
 * const llm = GEMINI_API_KEY ? makeGeminiLLM(GEMINI_API_KEY) : undefined;
 * const scenicPlanner = new TransitRoutePlannerConcept(db, llm);
 * ```
 *
 * ## API Normalization
 * The public API is normalized to only accept and return primitives or string IDs.
 * Complex objects like `Location` or `PlannedRoute` are used internally but are not
 * exposed directly through the class's public methods.
 */

import {
  MongoClient,
  Db,
  Collection,
  ObjectId,
} from "npm:mongo";

// --- Custom Errors ---
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

// --- LLM Adapter (Optional) ---
export interface TransitRoutePlannerLLM {
  classifyScenic(trailName: string, trailDescription?: string): Promise<boolean>;
}

export function makeGeminiLLM(
  apiKey: string,
  model = "gemini-1.5-flash",
): TransitRoutePlannerLLM {
  const API_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  return {
    async classifyScenic(
      trailName: string,
      trailDescription?: string,
    ): Promise<boolean> {
      const prompt =
        `Is the following hiking trail likely to be scenic? Answer only "true" or "false".\n\nTrail Name: ${trailName}\nDescription: ${
          trailDescription || "No description provided."
        }`;

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 5,
            },
          }),
        });

        if (!response.ok) {
          console.error("Gemini API request failed:", await response.text());
          return false; // Default to not scenic on API failure
        }

        const data = await response.json();
        const text =
          data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() ||
          "";
        return text === "true";
      } catch (error) {
        console.error("Error calling Gemini API:", error);
        return false;
      }
    },
  };
}

// --- Constants & Database Setup ---
export const TRANSIT_STOPS_COLLECTION = "transit_stops";
export const TRAILHEADS_COLLECTION = "trailheads";
export const TRAILS_COLLECTION = "trails";
export const PLANNED_ROUTES_COLLECTION = "planned_routes";

/**
 * Connects to MongoDB and returns a Db instance.
 */
export async function connectMongo(
  url: string,
  dbName: string,
): Promise<Db> {
  const client = new MongoClient(url);
  await client.connect();
  return client.db(dbName);
}

/**
 * Ensures that the required collections and indexes exist in the database.
 * This function is idempotent.
 */
export async function ensureCollections(db: Db): Promise<void> {
  await Promise.all([
    db.command({
      createIndexes: TRANSIT_STOPS_COLLECTION,
      indexes: [
        { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
        { key: { name: 1 }, name: "name_unique", unique: true },
      ],
    }),
    db.command({
      createIndexes: TRAILHEADS_COLLECTION,
      indexes: [
        { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
        { key: { name: 1 }, name: "name_unique", unique: true },
      ],
    }),
    db.command({
      createIndexes: PLANNED_ROUTES_COLLECTION,
      indexes: [
        { key: { destinationTrailheadId: 1 }, name: "destinationTrailheadId_idx" },
        { key: { criteria: 1 }, name: "criteria_idx" },
      ],
    }),
    // The 'trails' collection can have a simple default index on _id
    db.createCollection(TRAILS_COLLECTION).catch(err => {
      if (err.codeName !== 'NamespaceExists') throw err;
    })
  ]);
}

// --- Internal Types (for clarity inside the class) ---
type GeoPoint = { type: "Point"; coordinates: [number, number] }; // [lon, lat]

interface TransitStop {
  _id: ObjectId;
  name: string;
  loc: GeoPoint;
  routes: string[];
}

interface Trailhead {
  _id: ObjectId;
  name: string;
  loc: GeoPoint;
  connectingTrailIds: string[];
}

interface Trail {
  _id: ObjectId;
  name: string;
  minutes: number;
  description?: string;
}

interface PlannedRoute {
  _id: ObjectId;
  origin: { lat: number; lon: number };
  destinationTrailheadId: string;
  transitSegments: { fromStopId: string; toStopId: string; minutes: number }[];
  hikingSegments: { trailId: string; minutes: number }[];
  totalMinutes: number;
  transitMinutes: number;
  hikingMinutes: number;
  criteria: "default" | "faster" | "shorter" | "scenic";
  constraints: {
    maxTravelMinutes: number;
    preferredDepartureIso?: string;
    accessibility?: string[];
  };
}

// --- Main Class ---
export class TransitRoutePlannerConcept {
  private transitStops: Collection<TransitStop>;
  private trailheads: Collection<Trailhead>;
  private trails: Collection<Trail>;
  private plannedRoutes: Collection<PlannedRoute>;

  private static AVG_SPEED_KMH_DEFAULT = 30;
  private static AVG_SPEED_KMH_FASTER = 50;
  private static EARTH_RADIUS_KM = 6371;

  constructor(private db: Db, private llm?: TransitRoutePlannerLLM) {
    this.transitStops = db.collection<TransitStop>(TRANSIT_STOPS_COLLECTION);
    this.trailheads = db.collection<Trailhead>(TRAILHEADS_COLLECTION);
    this.trails = db.collection<Trail>(TRAILS_COLLECTION);
    this.plannedRoutes = db.collection<PlannedRoute>(PLANNED_ROUTES_COLLECTION);
  }

  // --- Public API Methods ---

  async planRoute(
    originLat: number,
    originLon: number,
    destinationTrailheadId: string,
    maxTravelMinutes: number,
    preferredDepartureIso?: string,
    accessibility?: string[],
  ): Promise<string> {
    const plannedRoute = await this._planRouteInternal(
      { lat: originLat, lon: originLon },
      destinationTrailheadId,
      { maxTravelMinutes, preferredDepartureIso, accessibility },
      "default",
    );
    const result = await this.plannedRoutes.insertOne(plannedRoute);
    return result.toHexString();
  }

  async getAlternativeRoutes(
    plannedRouteId: string,
    criteria: "faster" | "shorter" | "scenic",
  ): Promise<string[]> {
    if (!["faster", "shorter", "scenic"].includes(criteria)) {
      throw new ValidationError(`Invalid criteria: ${criteria}`);
    }

    const originalRoute = await this.plannedRoutes.findOne({
      _id: new ObjectId(plannedRouteId),
    });
    if (!originalRoute) {
      throw new NotFoundError(`Planned route with id ${plannedRouteId} not found.`);
    }

    try {
      const alternativeRoute = await this._planRouteInternal(
        originalRoute.origin,
        originalRoute.destinationTrailheadId,
        originalRoute.constraints,
        criteria,
      );
      
      // Ensure the alternative is actually different
      if (alternativeRoute.hikingMinutes === originalRoute.hikingMinutes && alternativeRoute.transitMinutes === originalRoute.transitMinutes) {
          return []; // No different alternative found
      }
      
      const result = await this.plannedRoutes.insertOne(alternativeRoute);
      return [result.toHexString()];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        // It's possible an alternative cannot be planned (e.g., no shorter hike exists)
        return [];
      }
      throw error;
    }
  }

  async updateRouteConstraints(
    plannedRouteId: string,
    maxTravelMinutes: number,
    preferredDepartureIso?: string,
    accessibility?: string[],
  ): Promise<string | null> {
    const originalRoute = await this.plannedRoutes.findOne({
      _id: new ObjectId(plannedRouteId),
    });
    if (!originalRoute) {
      throw new NotFoundError(`Planned route with id ${plannedRouteId} not found.`);
    }

    const newConstraints = { maxTravelMinutes, preferredDepartureIso, accessibility };

    try {
      const updatedRoute = await this._planRouteInternal(
        originalRoute.origin,
        originalRoute.destinationTrailheadId,
        newConstraints,
        originalRoute.criteria as any, // Recalculate with original criteria
      );
      const result = await this.plannedRoutes.insertOne(updatedRoute);
      return result.toHexString();
    } catch (error) {
      if (error instanceof ValidationError) {
        return null; // No valid route exists with new constraints
      }
      throw error;
    }
  }

  // --- Query Helpers ---

  async getPlannedRouteSummary(
    plannedRouteId: string,
  ): Promise<{ id: string; totalMinutes: number; transitMinutes: number; hikingMinutes: number; segmentsCount: number }> {
    const route = await this.plannedRoutes.findOne({
      _id: new ObjectId(plannedRouteId),
    });
    if (!route) {
      throw new NotFoundError(`Planned route with id ${plannedRouteId} not found.`);
    }
    return {
      id: route._id.toHexString(),
      totalMinutes: route.totalMinutes,
      transitMinutes: route.transitMinutes,
      hikingMinutes: route.hikingMinutes,
      segmentsCount: route.transitSegments.length + route.hikingSegments.length,
    };
  }

  async getTrailheadCoords(trailheadId: string): Promise<{ lat: number; lon: number }> {
    const trailhead = await this.trailheads.findOne({ _id: new ObjectId(trailheadId) });
    if (!trailhead) {
        throw new NotFoundError(`Trailhead with id ${trailheadId} not found.`);
    }
    return { lat: trailhead.loc.coordinates[1], lon: trailhead.loc.coordinates[0] };
  }

  // --- Private Helper Methods ---

  private async _planRouteInternal(
    origin: { lat: number, lon: number },
    destinationTrailheadId: string,
    constraints: { maxTravelMinutes: number, preferredDepartureIso?: string, accessibility?: string[] },
    criteria: "default" | "faster" | "shorter" | "scenic",
  ): Promise<Omit<PlannedRoute, "_id">> {
    // 1. Validation
    this._validateCoordinates(origin.lat, origin.lon);
    if (constraints.maxTravelMinutes <= 0) {
      throw new ValidationError("maxTravelMinutes must be positive.");
    }
    if (!ObjectId.isValid(destinationTrailheadId)) {
        throw new ValidationError(`Invalid destinationTrailheadId: ${destinationTrailheadId}`);
    }

    // 2. Find nearest stops and trailhead
    const originCoords: [number, number] = [origin.lon, origin.lat];
    const originStop = await this._findNearestStop(originCoords);

    const destinationTrailhead = await this.trailheads.findOne({ _id: new ObjectId(destinationTrailheadId) });
    if (!destinationTrailhead) {
      throw new NotFoundError(`Trailhead with id ${destinationTrailheadId} not found.`);
    }
    const destinationStop = await this._findNearestStop(destinationTrailhead.loc.coordinates);

    // 3. Compute transit time (round trip)
    const oneWayTransitMinutes = this._calculateTransitMinutes(
      originStop.loc.coordinates,
      destinationStop.loc.coordinates,
      criteria,
    );
    const totalTransitMinutes = Math.round(oneWayTransitMinutes * 2);

    // 4. Calculate available hiking time
    const availableHikingMinutes = constraints.maxTravelMinutes - totalTransitMinutes;
    if (availableHikingMinutes <= 0) {
      throw new ValidationError("Insufficient time for hiking after accounting for transit.");
    }

    // 5. Find the best hiking path based on criteria
    const hikingPath = await this._findBestHikingPath(
      destinationTrailhead,
      availableHikingMinutes,
      criteria,
    );
    const totalHikingMinutes = hikingPath.reduce((sum, seg) => sum + seg.minutes, 0);

    if (totalHikingMinutes === 0) {
        throw new ValidationError("No suitable hiking trails found within the available time.");
    }

    // 6. Assemble the route document
    const plannedRoute: Omit<PlannedRoute, "_id"> = {
      origin,
      destinationTrailheadId,
      transitSegments: [
        { fromStopId: originStop._id.toHexString(), toStopId: destinationStop._id.toHexString(), minutes: oneWayTransitMinutes },
        { fromStopId: destinationStop._id.toHexString(), toStopId: originStop._id.toHexString(), minutes: oneWayTransitMinutes },
      ],
      hikingSegments: hikingPath.map(p => ({ trailId: p.id, minutes: p.minutes })),
      totalMinutes: totalTransitMinutes + totalHikingMinutes,
      transitMinutes: totalTransitMinutes,
      hikingMinutes: totalHikingMinutes,
      criteria,
      constraints,
    };

    return plannedRoute;
  }

  private _validateCoordinates(lat: number, lon: number) {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new ValidationError(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
  }

  private async _findNearestStop(coordinates: [number, number]): Promise<TransitStop> {
    const stop = await this.transitStops.findOne({
      loc: { $near: { $geometry: { type: "Point", coordinates } } },
    });
    if (!stop) {
      throw new NotFoundError("No transit stops found in the database.");
    }
    return stop;
  }

  private _calculateTransitMinutes(
    fromCoords: [number, number],
    toCoords: [number, number],
    criteria: "default" | "faster" | "shorter" | "scenic",
  ): number {
    const [lon1, lat1] = fromCoords;
    const [lon2, lat2] = toCoords;

    const toRad = (deg: number) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = TransitRoutePlannerConcept.EARTH_RADIUS_KM * c;

    const speed = criteria === "faster"
      ? TransitRoutePlannerConcept.AVG_SPEED_KMH_FASTER
      : TransitRoutePlannerConcept.AVG_SPEED_KMH_DEFAULT;
    
    return (distanceKm / speed) * 60; // Convert hours to minutes
  }

  private async _findBestHikingPath(
    trailhead: Trailhead,
    availableMinutes: number,
    criteria: "default" | "faster" | "shorter" | "scenic",
  ): Promise<{ id: string; minutes: number; name: string; description?: string }[]> {
    if (!trailhead.connectingTrailIds || trailhead.connectingTrailIds.length === 0) {
      return [];
    }

    const trailObjectIds = trailhead.connectingTrailIds.map(id => new ObjectId(id));
    const availableTrails = await this.trails.find({
        _id: { $in: trailObjectIds },
        minutes: { $lte: availableMinutes },
    }).toArray();

    if (availableTrails.length === 0) return [];
    
    // Sort for deterministic behavior
    const trails = availableTrails.map(t => ({
      id: t._id.toHexString(),
      minutes: t.minutes,
      name: t.name,
      description: t.description,
    })).sort((a,b) => a.name.localeCompare(b.name));

    switch (criteria) {
      case "shorter":
        return [trails.sort((a, b) => a.minutes - b.minutes)[0]];
      
      case "scenic":
        if (this.llm) {
            const scenicScores = await Promise.all(
                trails.map(t => this.llm!.classifyScenic(t.name, t.description))
            );
            const scenicTrails = trails.filter((_, i) => scenicScores[i]);
            if (scenicTrails.length > 0) {
                // Pick longest among the scenic trails that fits
                return [scenicTrails.sort((a, b) => b.minutes - a.minutes)[0]];
            }
        }
        // Fallback for "scenic" is the longest trail (proxy for more to see)
        return [trails.sort((a, b) => b.minutes - a.minutes)[0]];

      case "default":
      case "faster": // "faster" criteria affects transit, for hiking it's same as default
      default:
        // Greedy approach: pick the longest trail that fits. For simplicity, we only pick one.
        return [trails.sort((a, b) => b.minutes - a.minutes)[0]];
    }
  }
}
````

***

### `/src/concepts/TransitRoutePlanner.test.ts`

```typescript
/**
 * Deno tests for TransitRoutePlannerConcept.
 *
 * To run:
 * deno test -A --env ./src/concepts/TransitRoutePlanner.test.ts
 *
 * Required permissions:
 * --allow-net: For connecting to MongoDB and the optional Gemini API.
 * --allow-env: For reading MONGODB_URL and DB_NAME from the environment.
 * --allow-read: For loading .env file.
 */
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
```
