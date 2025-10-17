---
timestamp: 'Thu Oct 16 2025 20:18:30 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_201830.8bf307f6.md]]'
content_id: a1bd71369f7619b63fe369482b11a1b1062676af69c96335fb9b13f42635ecb6
---

# response:

An implementation of `DynamicExitPlanner.ts` is provided first, followed by its corresponding Deno test file.

### Implementation: `/src/concepts/DynamicExitPlanner.ts`

```typescript
// /src/concepts/DynamicExitPlanner.ts

/**
 * DynamicExitPlanner Concept Implementation
 *
 * Environment Variables:
 * - MONGODB_URL: Connection string for MongoDB Atlas.
 * - DB_NAME: The name of the database to use.
 * - GEMINI_API_KEY: (Optional) API key for Google Gemini, used by the LLM adapter.
 *
 * Collections:
 * - active_hikes: Stores ongoing hikes.
 * - exit_points: Pre-defined points of egress from trails.
 * - exit_strategies: Computed return routes for active hikes.
 * - completed_hikes: Archive of finished hikes.
 *
 * Indexes:
 * - active_hikes:
 *   - 2dsphere on `loc` for geospatial queries.
 *   - unique on `{ userId: 1, status: 1 }` with a partial filter `{ status: "active" }`
 *     to ensure a user has only one active hike at a time.
 * - exit_points:
 *   - 2dsphere on `loc`.
 *   - unique on `name`.
 * - exit_strategies:
 *   - on `activeHikeId` for fast lookups.
 *   - on `exitPointId`.
 * - completed_hikes:
 *   - on `userId` and `endedAtIso`.
 *
 * API Normalization:
 * The public API of this class is "normalized", meaning it only accepts and returns
 * primitive types (strings, numbers, booleans) and string-based IDs. This avoids
 * complex object serialization at the application boundary.
 *
 * LLM Integration:
 * An optional LLM adapter can be injected into the constructor to provide
 * qualitative scoring for exit strategies. The `makeGeminiLLM` factory provides
 * a minimal implementation using `fetch`.
 */

import {
  Db,
  MongoClient,
  Collection,
  Filter,
} from "npm:mongo";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// --- Custom Errors ---
class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
export class ValidationError extends BaseError {}
export class NotFoundError extends BaseError {}
export class ConflictError extends BaseError {}
export class StateError extends BaseError {}

// --- Database Connection & Setup ---
let mongoClient: MongoClient | null = null;

export async function connectMongo(): Promise<Db> {
  if (mongoClient && mongoClient.connected) {
    const dbName = Deno.env.get("DB_NAME");
    if (!dbName) throw new Error("DB_NAME environment variable not set.");
    return mongoClient.db(dbName);
  }
  await load({ export: true });
  const mongoUrl = Deno.env.get("MONGODB_URL");
  const dbName = Deno.env.get("DB_NAME");

  if (!mongoUrl || !dbName) {
    throw new Error("MONGODB_URL and DB_NAME environment variables must be set.");
  }

  mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();
  console.log("MongoDB connected.");
  return mongoClient.db(dbName);
}

// --- Collection Constants ---
export const ACTIVE_HIKES = "active_hikes";
export const EXIT_POINTS = "exit_points";
export const EXIT_STRATEGIES = "exit_strategies";
export const COMPLETED_HIKES = "completed_hikes";

// --- Collection Schemas (for type safety) ---
interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

interface ActiveHike {
  _id: string;
  userId: string;
  plannedRouteId: string;
  loc: GeoJsonPoint;
  startedAtIso: string;
  lastUpdateIso?: string;
  status: "active" | "ended";
}

interface ExitPoint {
  _id: string;
  name: string;
  loc: GeoJsonPoint;
  accessibility: string[];
  transitStopIds: string[];
}

interface ExitStrategy {
  _id: string;
  activeHikeId: string;
  exitPointId: string;
  criteria: "fastest" | "fewest_transfers" | "safest";
  onFootMinutes: number;
  transitMinutes: number;
  etaMinutes: number;
  scoring?: number;
  computedAtIso: string;
}

interface CompletedHike {
  _id: string;
  activeHikeId: string;
  userId: string;
  plannedRouteId: string;
  endedAtIso: string;
  exitPointId: string;
  durationMinutes: number;
}


export async function ensureCollections(db: Db): Promise<void> {
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (!collectionNames.includes(ACTIVE_HIKES)) {
        await db.createCollection(ACTIVE_HIKES);
        await db.collection(ACTIVE_HIKES).createIndexes([
            { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
            {
                key: { userId: 1, status: 1 },
                name: "userId_status_unique_active",
                unique: true,
                partialFilterExpression: { status: "active" },
            },
        ]);
    }

    if (!collectionNames.includes(EXIT_POINTS)) {
        await db.createCollection(EXIT_POINTS);
        await db.collection(EXIT_POINTS).createIndexes([
            { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
            { key: { name: 1 }, name: "name_unique", unique: true },
        ]);
    }

    if (!collectionNames.includes(EXIT_STRATEGIES)) {
        await db.createCollection(EXIT_STRATEGIES);
        await db.collection(EXIT_STRATEGIES).createIndexes([
            { key: { activeHikeId: 1 }, name: "activeHikeId_idx" },
            { key: { exitPointId: 1 }, name: "exitPointId_idx" },
        ]);
    }

    if (!collectionNames.includes(COMPLETED_HIKES)) {
        await db.createCollection(COMPLETED_HIKES);
        await db.collection(COMPLETED_HIKES).createIndexes([
            { key: { userId: 1 }, name: "userId_idx" },
            { key: { endedAtIso: 1 }, name: "endedAtIso_idx" },
        ]);
    }
}


// --- LLM Adapter (Optional) ---
export interface DynamicExitPlannerLLM {
  scoreExit(input: string): Promise<number>;
}

export function makeGeminiLLM(apiKey: string, model = "gemini-1.5-flash-latest"): DynamicExitPlannerLLM {
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  return {
    async scoreExit(input: string): Promise<number> {
      try {
        const prompt = `Based on the following scenario, provide a safety and convenience score from 1 to 100. Higher is better. Return ONLY the number. Scenario: ${input}`;
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 5,
            }
          }),
        });

        if (!response.ok) {
          console.error("Gemini API Error:", await response.text());
          return 50; // Default score on error
        }

        const data = await response.json();
        const text = data.candidates[0]?.content.parts[0]?.text.trim();
        const score = parseInt(text, 10);

        return isNaN(score) ? 50 : Math.max(1, Math.min(100, score));
      } catch (error) {
        console.error("Failed to call Gemini API:", error);
        return 50; // Default score on fetch failure
      }
    },
  };
}

// --- Core Logic Class ---

const WALKING_SPEED_KMH = 4.5;
const TRANSIT_WAIT_PENALTY_MINUTES = 10;
const MAX_EXIT_POINT_SEARCH_RADIUS_METERS = 20000; // 20km

export class DynamicExitPlannerConcept {
  private db: Db;
  private llm?: DynamicExitPlannerLLM;
  private activeHikes: Collection<ActiveHike>;
  private exitPoints: Collection<ExitPoint>;
  private exitStrategies: Collection<ExitStrategy>;
  private completedHikes: Collection<CompletedHike>;

  constructor(db: Db, llm?: DynamicExitPlannerLLM) {
    this.db = db;
    this.llm = llm;
    this.activeHikes = db.collection<ActiveHike>(ACTIVE_HIKES);
    this.exitPoints = db.collection<ExitPoint>(EXIT_POINTS);
    this.exitStrategies = db.collection<ExitStrategy>(EXIT_STRATEGIES);
    this.completedHikes = db.collection<CompletedHike>(COMPLETED_HIKES);
  }

  // --- Private Helpers ---

  private _validateLatLon(lat: number, lon: number) {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new ValidationError(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
  }

  private _haversineMinutes(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    return (distanceKm / WALKING_SPEED_KMH) * 60;
  }
  
  private async _recomputeStrategies(hike: ActiveHike, currentLat: number, currentLon: number): Promise<void> {
    // 1. Delete old strategies for this hike
    await this.exitStrategies.deleteMany({ activeHikeId: hike._id });

    // 2. Find nearby exit points
    const nearbyExitPoints = await this.exitPoints.find({
      loc: {
        $near: {
          $geometry: { type: "Point", coordinates: [currentLon, currentLat] },
          $maxDistance: MAX_EXIT_POINT_SEARCH_RADIUS_METERS,
        },
      },
    }).limit(10).toArray();

    if (nearbyExitPoints.length === 0) {
        return; // No points nearby, no strategies to create
    }

    // 3. Create new strategies
    const nowIso = new Date().toISOString();
    const strategiesToInsert: ExitStrategy[] = [];

    for (const point of nearbyExitPoints) {
      const onFootMinutes = Math.round(this._haversineMinutes(currentLat, currentLon, point.loc.coordinates[1], point.loc.coordinates[0]));
      const transitMinutes = point.transitStopIds.length > 0 ? TRANSIT_WAIT_PENALTY_MINUTES : 0;
      const etaMinutes = onFootMinutes + transitMinutes;
      
      let scoring: number | undefined = undefined;
      if(this.llm) {
        const llmInput = `Hiker is at (${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}). Proposed exit is '${point.name}' which is a ${onFootMinutes} minute walk. Accessibility: ${point.accessibility.join(', ') || 'none'}.`;
        scoring = await this.llm.scoreExit(llmInput);
      }

      strategiesToInsert.push({
        _id: crypto.randomUUID(),
        activeHikeId: hike._id,
        exitPointId: point._id,
        criteria: "fastest", // Simple default for now
        onFootMinutes,
        transitMinutes,
        etaMinutes,
        scoring,
        computedAtIso: nowIso,
      });
    }

    if (strategiesToInsert.length > 0) {
      await this.exitStrategies.insertMany(strategiesToInsert);
    }
  }


  // --- Public API Methods ---

  async startHike(plannedRouteId: string, userId: string, startLat: number, startLon: number, startIso?: string): Promise<string> {
    if (!plannedRouteId || !userId) {
      throw new ValidationError("plannedRouteId and userId are required.");
    }
    this._validateLatLon(startLat, startLon);

    const existingHike = await this.activeHikes.findOne({ userId, status: "active" });
    if (existingHike) {
      throw new ConflictError(`User ${userId} already has an active hike.`);
    }

    const activeHikeId = crypto.randomUUID();
    const newHike: ActiveHike = {
      _id: activeHikeId,
      userId,
      plannedRouteId,
      loc: { type: "Point", coordinates: [startLon, startLat] },
      startedAtIso: startIso || new Date().toISOString(),
      status: "active",
    };

    await this.activeHikes.insertOne(newHike);
    return activeHikeId;
  }

  async updateLocation(activeHikeId: string, lat: number, lon: number, atIso?: string): Promise<void> {
    this._validateLatLon(lat, lon);
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });

    if (!hike) {
      throw new NotFoundError(`Active hike with id ${activeHikeId} not found.`);
    }
    if (hike.status !== "active") {
      throw new StateError(`Hike ${activeHikeId} is not active.`);
    }

    // Recompute strategies first
    await this._recomputeStrategies(hike, lat, lon);

    // Then update the hike's location
    await this.activeHikes.updateOne(
      { _id: activeHikeId },
      {
        $set: {
          loc: { type: "Point", coordinates: [lon, lat] },
          lastUpdateIso: atIso || new Date().toISOString(),
        },
      }
    );
  }

  async getExitStrategies(activeHikeId: string): Promise<string[]> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId, status: "active" });
    if (!hike) {
      throw new NotFoundError(`Active hike with id ${activeHikeId} not found or is not active.`);
    }

    const strategies = await this.exitStrategies.find({ activeHikeId })
      .sort({ scoring: -1, etaMinutes: 1 }) // Prioritize score, then ETA
      .toArray();

    return strategies.map(s => s._id);
  }

  async endHike(activeHikeId: string, exitPointId: string, endIso?: string): Promise<string> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });
    if (!hike) {
      throw new NotFoundError(`Active hike with id ${activeHikeId} not found.`);
    }
    if (hike.status !== "active") {
      throw new StateError(`Hike ${activeHikeId} has already ended.`);
    }

    const exitPoint = await this.exitPoints.findOne({ _id: exitPointId });
    if (!exitPoint) {
        throw new NotFoundError(`Exit point with id ${exitPointId} not found.`);
    }

    const endedAt = new Date(endIso || new Date().toISOString());
    const startedAt = new Date(hike.startedAtIso);
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60));

    const completedHikeId = crypto.randomUUID();
    const completedHike: CompletedHike = {
      _id: completedHikeId,
      activeHikeId,
      userId: hike.userId,
      plannedRouteId: hike.plannedRouteId,
      endedAtIso: endedAt.toISOString(),
      exitPointId,
      durationMinutes,
    };

    await this.completedHikes.insertOne(completedHike);
    await this.activeHikes.updateOne({ _id: activeHikeId }, { $set: { status: "ended" } });

    return completedHikeId;
  }

  // --- Query Helpers ---

  async getActiveHikeSummary(activeHikeId: string): Promise<{ id: string; userId: string; lat: number; lon: number; startedAtIso: string; strategiesCount: number }> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });
    if (!hike) {
      throw new NotFoundError(`Hike with id ${activeHikeId} not found.`);
    }

    const strategiesCount = await this.exitStrategies.countDocuments({ activeHikeId });

    return {
      id: hike._id,
      userId: hike.userId,
      lat: hike.loc.coordinates[1],
      lon: hike.loc.coordinates[0],
      startedAtIso: hike.startedAtIso,
      strategiesCount,
    };
  }

  async getExitStrategyDetail(exitStrategyId: string): Promise<{ id: string; exitPointId: string; etaMinutes: number; transitMinutes: number; onFootMinutes: number; scoring?: number }> {
    const strategy = await this.exitStrategies.findOne({ _id: exitStrategyId });
    if (!strategy) {
      throw new NotFoundError(`Exit strategy with id ${exitStrategyId} not found.`);
    }

    return {
      id: strategy._id,
      exitPointId: strategy.exitPointId,
      etaMinutes: strategy.etaMinutes,
      transitMinutes: strategy.transitMinutes,
      onFootMinutes: strategy.onFootMinutes,
      scoring: strategy.scoring,
    };
  }
}
```

### Tests: `/src/concepts/DynamicExitPlanner.test.ts`

```typescript
// /src/concepts/DynamicExitPlanner.test.ts
// deno-lint-ignore-file no-explicit-any
//
// Deno test command with permissions:
// deno test -A --env src/concepts/DynamicExitPlanner.test.ts

import {
  assert,
  assertEquals,
  assertRejects,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Db } from "npm:mongo";
import {
  DynamicExitPlannerConcept,
  connectMongo,
  ensureCollections,
  ConflictError,
  StateError,
  NotFoundError,
  ValidationError,
  DynamicExitPlannerLLM,
  EXIT_POINTS,
} from "./DynamicExitPlanner.ts";

// --- Test Setup ---
let db: Db;
let planner: DynamicExitPlannerConcept;

const setup = async () => {
  try {
    db = await connectMongo();
    await db.dropDatabase();
    await ensureCollections(db);
    planner = new DynamicExitPlannerConcept(db);
  } catch (e) {
    console.error("Setup failed:", e);
    throw e;
  }
};

const teardown = async () => {
    // No explicit teardown needed as we drop DB at start of each run.
    // In a real suite, you might close the client connection.
};

const testWrapper = (name: string, fn: (t: Deno.TestContext) => Promise<void>) => {
  Deno.test({
    name,
    async fn(t) {
      await setup();
      try {
        await fn(t);
      } finally {
        await teardown();
      }
    },
    sanitizeOps: false,
    sanitizeResources: false,
  });
};

// --- Test Data ---
const testUser = { id: "user-alice-123" };
const testRoute = { id: "route-yosemite-4-mile" };
const startLoc = { lat: 37.739, lon: -119.585 }; // Near trailhead

const exitPoints = [
  {
    _id: "ep-001",
    name: "Valley Visitor Center",
    loc: { type: "Point", coordinates: [-119.588, 37.748] }, // North, ~1km
    accessibility: ["paved", "wheelchair"],
    transitStopIds: ["stop-A", "stop-B"],
  },
  {
    _id: "ep-002",
    name: "Glacier Point Turnout",
    loc: { type: "Point", coordinates: [-119.575, 37.730] }, // South-east, ~1.5km
    accessibility: ["dirt_path"],
    transitStopIds: [],
  },
  {
    _id: "ep-003",
    name: "Far Away Point",
    loc: { type: "Point", coordinates: [-120.0, 38.0] }, // > 20km away
    accessibility: [],
    transitStopIds: [],
  },
];

// --- Tests ---

testWrapper("Operational Principle: Full hike lifecycle", async (t) => {
  let activeHikeId: string;
  let exitStrategyIds: string[];

  await t.step("1. Seed exit points", async () => {
    const result = await db.collection(EXIT_POINTS).insertMany(exitPoints as any);
    assertEquals(result.insertedCount, 3);
    console.log("  -> Seeded 3 exit points.");
  });

  await t.step("2. Start a hike", async () => {
    activeHikeId = await planner.startHike(
      testRoute.id,
      testUser.id,
      startLoc.lat,
      startLoc.lon
    );
    assertExists(activeHikeId);
    console.log(`  -> Hike started with ID: ${activeHikeId}`);
    const summary = await planner.getActiveHikeSummary(activeHikeId);
    assertEquals(summary.strategiesCount, 0);
  });
  
  await t.step("3. Update location and generate strategies", async () => {
    const newLoc = { lat: 37.742, lon: -119.586 }; // Moved north
    await planner.updateLocation(activeHikeId, newLoc.lat, newLoc.lon);
    console.log(`  -> Updated location to (${newLoc.lat}, ${newLoc.lon})`);
    const summary = await planner.getActiveHikeSummary(activeHikeId);
    assertEquals(summary.strategiesCount, 2); // ep-001 and ep-002 are nearby
  });
  
  await t.step("4. Get and verify exit strategies", async () => {
    exitStrategyIds = await planner.getExitStrategies(activeHikeId);
    assertEquals(exitStrategyIds.length, 2);
    console.log(`  -> Retrieved 2 strategies: [${exitStrategyIds.join(", ")}]`);

    const firstStrategy = await planner.getExitStrategyDetail(exitStrategyIds[0]);
    const secondStrategy = await planner.getExitStrategyDetail(exitStrategyIds[1]);

    // ep-001 should be closer/faster from the new location
    assertEquals(firstStrategy.exitPointId, "ep-001");
    assert(firstStrategy.etaMinutes < secondStrategy.etaMinutes, "First strategy should have lower ETA");
    assertEquals(firstStrategy.transitMinutes, 10, "First strategy should have transit penalty");
    assertEquals(secondStrategy.transitMinutes, 0, "Second strategy should have no transit");
    console.log(`  -> Verified strategies are ordered by ETA: ${firstStrategy.etaMinutes}m < ${secondStrategy.etaMinutes}m`);
  });

  await t.step("5. End the hike", async () => {
    const chosenExitPointId = "ep-001";
    const completedHikeId = await planner.endHike(activeHikeId, chosenExitPointId);
    assertExists(completedHikeId);
    console.log(`  -> Hike ended. Completed ID: ${completedHikeId}`);
  });
  
  await t.step("6. Verify hike status is 'ended'", async () => {
    const hike = await db.collection("active_hikes").findOne({ _id: activeHikeId });
    assertEquals(hike?.status, "ended");
    console.log("  -> Confirmed active hike status is now 'ended'.");
  });
});

testWrapper("Conflict: Starting a second hike for the same user fails", async () => {
  await planner.startHike(testRoute.id, testUser.id, startLoc.lat, startLoc.lon);
  console.log("  -> Started first hike for user", testUser.id);
  
  await assertRejects(
    async () => {
      await planner.startHike("another-route", testUser.id, startLoc.lat, startLoc.lon);
    },
    ConflictError,
    `User ${testUser.id} already has an active hike.`
  );
  console.log("  -> Correctly rejected second hike with ConflictError.");
});

testWrapper("StateError: Updating a completed hike fails", async () => {
    await db.collection(EXIT_POINTS).insertOne(exitPoints[0] as any);
    const hikeId = await planner.startHike(testRoute.id, testUser.id, startLoc.lat, startLoc.lon);
    console.log("  -> Started and ended a hike:", hikeId);
    await planner.endHike(hikeId, "ep-001");

    await assertRejects(
        async () => {
            await planner.updateLocation(hikeId, 38, -120);
        },
        StateError,
        `Hike ${hikeId} is not active.`
    );
    console.log("  -> Correctly rejected updateLocation with StateError.");
});

testWrapper("Scenario: No strategies are generated if no exit points are nearby", async () => {
    await db.collection(EXIT_POINTS).insertOne(exitPoints[2] as any); // Insert only the far away point
    const hikeId = await planner.startHike(testRoute.id, testUser.id, startLoc.lat, startLoc.lon);
    await planner.updateLocation(hikeId, startLoc.lat, startLoc.lon);
    
    const strategies = await planner.getExitStrategies(hikeId);
    assertEquals(strategies.length, 0);
    console.log("  -> Correctly returned 0 strategies when no exit points are in range.");
});

testWrapper("Scenario: LLM scoring re-orders strategies", async () => {
    const mockLLM: DynamicExitPlannerLLM = {
        scoreExit: async (input: string): Promise<number> => {
            if (input.includes("Glacier Point")) return 95; // Slower, but LLM prefers it
            if (input.includes("Visitor Center")) return 20; // Faster, but LLM dislikes it
            return 50;
        }
    };
    const llmPlanner = new DynamicExitPlannerConcept(db, mockLLM);

    await db.collection(EXIT_POINTS).insertMany([exitPoints[0], exitPoints[1]] as any);
    const hikeId = await llmPlanner.startHike(testRoute.id, testUser.id, startLoc.lat, startLoc.lon);
    await llmPlanner.updateLocation(hikeId, 37.742, -119.586);

    const strategyIds = await llmPlanner.getExitStrategies(hikeId);
    assertEquals(strategyIds.length, 2);
    console.log("  -> Retrieved 2 strategies with LLM scoring.");

    const firstStrategy = await llmPlanner.getExitStrategyDetail(strategyIds[0]);
    const secondStrategy = await llmPlanner.getExitStrategyDetail(strategyIds[1]);

    console.log(`  -> Strategy 1: ${firstStrategy.exitPointId}, Score: ${firstStrategy.scoring}, ETA: ${firstStrategy.etaMinutes}m`);
    console.log(`  -> Strategy 2: ${secondStrategy.exitPointId}, Score: ${secondStrategy.scoring}, ETA: ${secondStrategy.etaMinutes}m`);

    // "Glacier Point" (ep-002) has a worse ETA but a better score, so it should be first.
    assertEquals(firstStrategy.exitPointId, "ep-002");
    assert(firstStrategy.scoring! > secondStrategy.scoring!, "First strategy should have higher score");
    assert(firstStrategy.etaMinutes > secondStrategy.etaMinutes, "First strategy has worse ETA but is preferred by LLM");
    console.log("  -> Verified that higher-scoring strategy is ranked first, despite longer ETA.");
});

testWrapper("ValidationError: Invalid inputs are rejected", async (t) => {
    await t.step("invalid lat/lon on start", async () => {
        await assertRejects(
            () => planner.startHike(testRoute.id, testUser.id, 91, -119),
            ValidationError,
            "Invalid coordinates"
        );
    });

    await t.step("invalid lat/lon on update", async () => {
        const hikeId = await planner.startHike(testRoute.id, testUser.id, 37, -119);
        await assertRejects(
            () => planner.updateLocation(hikeId, 37, -181),
            ValidationError,
            "Invalid coordinates"
        );
    });
    
    await t.step("empty userId", async () => {
        await assertRejects(
            () => planner.startHike(testRoute.id, "", 37, -119),
            ValidationError,
            "userId are required"
        );
    });
    console.log("  -> Correctly rejected various invalid inputs with ValidationError.");
});

testWrapper("NotFoundError: Referencing non-existent entities fails", async (t) => {
    await t.step("updating non-existent hike", async () => {
        await assertRejects(
            () => planner.updateLocation("non-existent-hike", 37, -119),
            NotFoundError
        );
    });

    await t.step("ending non-existent hike", async () => {
        await assertRejects(
            () => planner.endHike("non-existent-hike", "ep-001"),
            NotFoundError
        );
    });
    
    await t.step("ending with non-existent exit point", async () => {
        const hikeId = await planner.startHike(testRoute.id, testUser.id, 37, -119);
        await assertRejects(
            () => planner.endHike(hikeId, "non-existent-exit-point"),
            NotFoundError
        );
    });
    console.log("  -> Correctly rejected actions on non-existent entities with NotFoundError.");
});
```
