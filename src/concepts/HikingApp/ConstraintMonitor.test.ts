
import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MongoClient, Db } from "npm:mongodb@6.7.0";
import {
  ConstraintMonitorConcept,
  ensureCollections,
  TransitProvider,
  WeatherProvider,
  TrailProvider,
  ConstraintMonitorLLM,
  PLANNED_ROUTES_COLLECTION,
} from "./ConstraintMonitor.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// --- Test Setup ---

// Load environment variables
await load({ export: true });

// A helper to manage DB connection and cleanup
async function withTestDb(
  testFn: (db: Db, monitor: ConstraintMonitorConcept, stubs: TestStubs) => Promise<void>,
) {
  const MONGODB_URL = Deno.env.get("MONGODB_URL");
  const DB_NAME = Deno.env.get("DB_NAME");

  if (!MONGODB_URL || !DB_NAME) {
    throw new Error("MONGODB_URL and DB_NAME environment variables are required.");
  }

  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  // Stubs for dependency injection
  const stubs = createTestStubs();

  // Create a new monitor instance for each test
  const monitor = new ConstraintMonitorConcept(
    db,
    {
      transit: stubs.transitProvider,
      weather: stubs.weatherProvider,
      trail: stubs.trailProvider,
    },
    undefined, // Don't inject LLM provider for most tests
  );

  try {
    // Ensure collections and indexes exist
    await ensureCollections(db);
    await testFn(db, monitor, stubs);
  } finally {
    // Cleanup: drop all relevant collections after the test
    await Promise.allSettled([
      db.collection(PLANNED_ROUTES_COLLECTION).drop(),
      db.collection("transit_schedules").drop(),
      db.collection("weather_conditions").drop(),
      db.collection("trail_conditions").drop(),
      db.collection("constraint_alerts").drop(),
    ]);
    await client.close();
  }
}

// --- Stubs for Providers ---
interface TestStubs {
  transitProvider: TransitProvider;
  weatherProvider: WeatherProvider;
  trailProvider: TrailProvider;
  llmProvider: ConstraintMonitorLLM;
  reset: () => void;
}

function createTestStubs(): TestStubs {
  const stubs = {
    transitSchedules: [
      {
        routeId: "route-fast",
        stopId: "stop-main",
        departuresIso: [
          new Date(Date.now() + 5 * 60000).toISOString(),
          new Date(Date.now() + 15 * 60000).toISOString(), // 10 min headway
        ],
      },
      {
        routeId: "route-slow",
        stopId: "stop-north",
        departuresIso: [
          new Date(Date.now() + 10 * 60000).toISOString(),
          new Date(Date.now() + 70 * 60000).toISOString(), // 60 min headway
        ],
      },
    ],
    weather: { atIso: new Date().toISOString(), tempC: 22, precipProb: 0.1, windKph: 15 },
    trail: { trailId: "trail-sunny-ridge", status: "open" as const, difficulty: 4 },
    llmSeverityScore: 50, // Default score
  };

  const testStubs: TestStubs = {
    transitProvider: {
      fetchSchedules: async (_source?: string) => structuredClone(stubs.transitSchedules),
    },
    weatherProvider: {
      fetch: async (_lat: number, _lon: number) => structuredClone(stubs.weather),
    },
    trailProvider: {
      fetch: async (trailId: string) => ({ ...structuredClone(stubs.trail), trailId }),
    },
    llmProvider: {
      scoreSeverity: async (_text: string) => stubs.llmSeverityScore,
    },
    reset: () => {
      stubs.weather = { atIso: new Date().toISOString(), tempC: 22, precipProb: 0.1, windKph: 15 };
      stubs.trail = { trailId: "trail-sunny-ridge", status: "open", difficulty: 4 };
      stubs.llmSeverityScore = 50;
    },
  };

  return testStubs;
}

// --- Tests ---

Deno.test("Operational Principle: Happy Path", async () => {
  await withTestDb(async (db, monitor) => {
    console.log("\n--- Testing: Operational Principle (Happy Path) ---");

    // 1. Update transit schedules
    const scheduleIds = await monitor.updateTransitSchedules("test-source");
    console.log(`Inputs: source='test-source'`);
    console.log(`Outputs: updateTransitSchedules -> ids:`, scheduleIds);
    assertEquals(scheduleIds.length, 2);
    const scheduleCount = await db.collection("transit_schedules").countDocuments();
    assertEquals(scheduleCount, 2);

    // 2. Check weather conditions
    const weatherId = await monitor.checkWeatherConditions(47.6, -122.3);
    console.log(`Inputs: lat=47.6, lon=-122.3`);
    console.log(`Outputs: checkWeatherConditions -> id:`, weatherId);
    assertExists(weatherId);
    const weatherSummary = await monitor.getWeatherSummary(weatherId);
    assertEquals(weatherSummary.tempC, 22);

    // 3. Get trail conditions
    const trailConditionId = await monitor.getTrailConditions("trail-sunny-ridge");
    console.log(`Inputs: trailId='trail-sunny-ridge'`);
    console.log(`Outputs: getTrailConditions -> id:`, trailConditionId);
    assertExists(trailConditionId);
    const trailSummary = await monitor.getTrailConditionSummary(trailConditionId);
    assertEquals(trailSummary.status, "open");

    // 4. Generate alerts for a safe route (use stop with good headway)
    const plannedRoutes = db.collection(PLANNED_ROUTES_COLLECTION);
    const goodRouteResult = await plannedRoutes.insertOne({
      startLocation: { type: "Point", coordinates: [-122.3, 47.6] },
      trailIds: ["trail-sunny-ridge"],
      transitLegs: [{ startStopId: "stop-main", endStopId: "stop-trailhead" }], // stop-main has 10min headway
      expectedStartIso: new Date(Date.now() + 1 * 60 * 60000).toISOString(), // 1 hour from now
      expectedEndIso: new Date(Date.now() + 4 * 60 * 60000).toISOString(), // 4 hours from now
    });
    const goodRouteId = goodRouteResult.insertedId.toHexString();

    const alertIds = await monitor.generateAlerts(goodRouteId);
    console.log(`Inputs: plannedRouteId='${goodRouteId}' (a safe route)`);
    console.log(`Outputs: generateAlerts -> ids:`, alertIds);
    assertEquals(alertIds.length, 1, "A safe route should generate one alert for daylight.");
  });
});

Deno.test("Scenario: Severe Weather Alert", async () => {
  await withTestDb(async (db, monitor, stubs) => {
    console.log("\n--- Testing: Severe Weather Alert ---");

    // Setup: Stub severe weather
    stubs.weatherProvider.fetch = async () => ({
      atIso: new Date().toISOString(),
      tempC: 35,
      precipProb: 0.8,
      windKph: 50,
    });
    console.log("Inputs: Injected weather provider with high wind and precipitation");

    // Seed a planned route
    const routeResult = await db.collection(PLANNED_ROUTES_COLLECTION).insertOne({
      startLocation: { type: "Point", coordinates: [0, 0] },
      trailIds: [],
      transitLegs: [],
      expectedStartIso: new Date().toISOString(),
      expectedEndIso: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    });
    const routeId = routeResult.insertedId.toHexString();

    await monitor.checkWeatherConditions(0, 0); // Must call this to populate the DB
    const alertIds = await monitor.generateAlerts(routeId);

    console.log(`Outputs: generateAlerts -> ids:`, alertIds);
    assertEquals(alertIds.length, 1);
    const alertSummary = await monitor.getAlertSummary(alertIds[0]);
    console.log(`Outputs: alertSummary ->`, alertSummary);
    assert(alertSummary.message.includes("High probability of precipitation"));
    assert(alertSummary.message.includes("Strong winds forecast"));
    assert(alertSummary.severity >= 75); // Strong winds have severity 75
  });
});

Deno.test("Scenario: Transit Headway Alert", async () => {
  await withTestDb(async (db, monitor) => {
    console.log("\n--- Testing: Transit Headway Alert ---");

    await monitor.updateTransitSchedules(); // Use default stubs

    const routeResult = await db.collection(PLANNED_ROUTES_COLLECTION).insertOne({
      startLocation: { type: "Point", coordinates: [0, 0] },
      trailIds: [],
      transitLegs: [{ startStopId: "stop-north", endStopId: "stop-elsewhere" }], // Uses the "slow" route
      expectedStartIso: new Date().toISOString(),
      expectedEndIso: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    });
    const routeId = routeResult.insertedId.toHexString();
    console.log(`Inputs: Route uses transit stop 'stop-north' with >45min headway`);

    const alertIds = await monitor.generateAlerts(routeId);
    console.log(`Outputs: generateAlerts -> ids:`, alertIds);

    assertEquals(alertIds.length, 1);
    const alertSummary = await monitor.getAlertSummary(alertIds[0]);
    console.log(`Outputs: alertSummary ->`, alertSummary);
    assert(alertSummary.message.includes("Infrequent service at stop stop-north"));
  });
});

Deno.test("Scenario: Trail Closed Alert", async () => {
  await withTestDb(async (db, monitor, stubs) => {
    console.log("\n--- Testing: Trail Closed Alert ---");

    // Setup: Stub a closed trail and LLM to return 95
    stubs.trailProvider.fetch = async (trailId: string) => ({
      trailId,
      status: "closed",
      difficulty: 5,
      issues: ["Bridge washout"],
    });
    stubs.llmProvider.scoreSeverity = async (_text: string) => 95;
    console.log("Inputs: Injected trail provider with status='closed'");

    await monitor.getTrailConditions("trail-impassable"); // Populate the DB

    const routeResult = await db.collection(PLANNED_ROUTES_COLLECTION).insertOne({
      startLocation: { type: "Point", coordinates: [0, 0] },
      trailIds: ["trail-impassable"], // Uses the closed trail
      transitLegs: [],
      expectedStartIso: new Date().toISOString(),
      expectedEndIso: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    });
    const routeId = routeResult.insertedId.toHexString();

    const alertIds = await monitor.generateAlerts(routeId);
    console.log(`Outputs: generateAlerts -> ids:`, alertIds);

    assertEquals(alertIds.length, 1);
    const alertSummary = await monitor.getAlertSummary(alertIds[0]);
    console.log(`Outputs: alertSummary ->`, alertSummary);
    assert(alertSummary.message.includes("trail-impassable is reported as closed"));
    assertEquals(alertSummary.severity, 95);
  });
});

Deno.test("Scenario: Daylight Insufficient Alert", async () => {
  await withTestDb(async (db, monitor) => {
    console.log("\n--- Testing: Daylight Insufficient Alert ---");
    
    // Stub a date that is guaranteed to be after the 8 PM UTC sunset hardcoded in the implementation
    const lateNightEnd = new Date();
    lateNightEnd.setUTCHours(22, 0, 0, 0); // 10 PM UTC

    const routeResult = await db.collection(PLANNED_ROUTES_COLLECTION).insertOne({
      startLocation: { type: "Point", coordinates: [0, 0] },
      trailIds: [],
      transitLegs: [],
      expectedStartIso: new Date().toISOString(),
      expectedEndIso: lateNightEnd.toISOString(),
    });
    const routeId = routeResult.insertedId.toHexString();
    console.log(`Inputs: Route expectedEndIso is '${lateNightEnd.toISOString()}' (after sunset)`);

    const alertIds = await monitor.generateAlerts(routeId);
    console.log(`Outputs: generateAlerts -> ids:`, alertIds);

    assertEquals(alertIds.length, 1);
    const alertSummary = await monitor.getAlertSummary(alertIds[0]);
    console.log(`Outputs: alertSummary ->`, alertSummary);
    assert(alertSummary.message.includes("end after sunset"));
  });
});

Deno.test("Scenario: With LLM Stub, Severity is Overridden", async () => {
  await withTestDb(async (db, monitor, stubs) => {
    console.log("\n--- Testing: LLM Severity Scoring ---");

    // Setup: LLM stub returns a high, specific score
    stubs.llmProvider.scoreSeverity = async (_text: string) => 99;
    console.log("Inputs: Injected LLM provider that returns severity 99");

    // Setup a low-severity issue (infrequent transit)
    const routeResult = await db.collection(PLANNED_ROUTES_COLLECTION).insertOne({
      startLocation: { type: "Point", coordinates: [0, 0] },
      trailIds: [],
      transitLegs: [{ startStopId: "stop-north", endStopId: "stop-elsewhere" }],
      expectedStartIso: new Date().toISOString(),
      expectedEndIso: new Date().toISOString(),
    });
    await monitor.updateTransitSchedules(); // populate transit data
    const routeId = routeResult.insertedId.toHexString();

    const alertIds = await monitor.generateAlerts(routeId);
    console.log(`Outputs: generateAlerts -> ids:`, alertIds);

    assertEquals(alertIds.length, 1);
    const alertSummary = await monitor.getAlertSummary(alertIds[0]);
    console.log(`Outputs: alertSummary ->`, alertSummary);

    const ruleBasedSeverity = 40; // from implementation for transit headway
    assertEquals(alertSummary.severity, 99, "Severity should be the value from the LLM stub");
  });
});
