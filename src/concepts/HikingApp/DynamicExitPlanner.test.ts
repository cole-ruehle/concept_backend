
import {
  assert,
  assertEquals,
  assertRejects,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Db } from "npm:mongodb";
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