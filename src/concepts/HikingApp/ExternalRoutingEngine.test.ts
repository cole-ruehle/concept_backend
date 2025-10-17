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
} from "./ExternalRoutingEngine.ts";
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