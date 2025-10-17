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
import { Db, ObjectId } from "npm:mongodb";
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
        trailShortRes.insertedId.toHexString(),
        trailLongRes.insertedId.toHexString(),
        trailScenicRes.insertedId.toHexString(),
      ],
    });

    testData = {
        originStopId: originStopRes.insertedId.toHexString(),
        destStopId: destStopRes.insertedId.toHexString(),
        trailheadId: trailheadRes.insertedId.toHexString(),
        trailShortId: trailShortRes.insertedId.toHexString(),
        trailLongId: trailLongRes.insertedId.toHexString(),
        trailScenicId: trailScenicRes.insertedId.toHexString(),
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
    assertEquals(summary.hikingMinutes, 75, "Should have picked the longest trail that fits (75 min)");
  });

  it("Scenario: Tight time window should select a shorter hike", async () => {
    const originLat = 37.775;
    const originLon = -122.419;
    // Estimated transit is ~90-100 mins round trip.
    // 150 mins total leaves ~50-60 mins for hiking. Should pick the 45-min trail.
    const maxTravelMinutes = 280; // This should force selection of 45 min trail (280 - 208 = 72 min available)
    
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
    assertEquals(originalSummary.hikingMinutes, 75); // Starts with the longest hike that fits

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
    assertEquals(originalSummary.hikingMinutes, 75);

    console.log("\n--- Testing updateRouteConstraints (feasible) ---");
    const updatedRouteId = await planner.updateRouteConstraints(originalRouteId, 280); // Increased from 250 to 280
    assert(updatedRouteId, "Should return a new route ID for a feasible update");
    const updatedSummary = await planner.getPlannedRouteSummary(updatedRouteId as string);
    console.log("Updated Summary (180 min):", updatedSummary);
    assert(updatedSummary.hikingMinutes < originalSummary.hikingMinutes);
    assertEquals(updatedSummary.hikingMinutes, 45); // Should pick the shorter 45 min trail

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
      const originalRouteId = await scenicPlanner.planRoute(37.775, -122.419, testData.trailheadId, 350); // Larger budget to pick 120-min trail

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