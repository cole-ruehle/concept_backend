/**
 * Test script for the orchestrate endpoint
 */

const BASE_URL = "http://localhost:8000";

interface TestCase {
  name: string;
  request: {
    query: string;
    userLocation: { lat: number; lng: number };
    preferences?: any;
  };
}

const testCases: TestCase[] = [
  {
    name: "Boston hiking with transit",
    request: {
      query: "Find hiking trails near me accessible by public transit",
      userLocation: { lat: 42.3601, lng: -71.0589 }, // Boston
      preferences: {
        duration: 3,
        difficulty: "moderate",
        transportModes: ["transit", "walking"],
      },
    },
  },
  {
    name: "Middlesex Fells reservation",
    request: {
      query: "Middlesex Fells hiking trails",
      userLocation: { lat: 42.4584, lng: -71.0598 }, // Medford
      preferences: {
        duration: 2,
        transportModes: ["walking"],
      },
    },
  },
  {
    name: "Blue Hills with transit",
    request: {
      query: "Blue Hills reservation accessible by MBTA",
      userLocation: { lat: 42.3601, lng: -71.0589 }, // Boston
      preferences: {
        duration: 4,
        transportModes: ["transit", "walking"],
      },
    },
  },
];

async function runTest(testCase: TestCase): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 Testing: ${testCase.name}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Query: "${testCase.request.query}"`);
  console.log(
    `Location: ${testCase.request.userLocation.lat}, ${testCase.request.userLocation.lng}`
  );

  try {
    const startTime = Date.now();

    const response = await fetch(`${BASE_URL}/api/plan-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testCase.request),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Request failed (${response.status}):`, error);
      return false;
    }

    const result = await response.json();

    console.log(`\n✅ Success! (${duration}ms)`);
    console.log(`\n📍 Route Details:`);
    console.log(`   ID: ${result.route.route_id}`);
    console.log(`   Name: ${result.route.name}`);
    console.log(`   Total time: ${result.route.metrics.totalMin} minutes`);
    console.log(
      `   ETA: ${new Date(result.route.metrics.etaArrival).toLocaleString()}`
    );

    console.log(`\n🗺️  Segments:`);
    result.route.segments.forEach((segment: any, i: number) => {
      console.log(`   ${i + 1}. [${segment.mode}] ${segment.instructions}`);
      console.log(
        `      ${segment.distance.toFixed(1)} km, ${segment.duration} min`
      );
    });

    console.log(`\n💡 Suggestions:`);
    result.suggestions.forEach((suggestion: string) => {
      console.log(`   • ${suggestion}`);
    });

    return true;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log("\n🚀 Orchestrate Endpoint Test Suite");
  console.log(`   Base URL: ${BASE_URL}\n`);

  // Health check first
  try {
    const health = await fetch(`${BASE_URL}/api/health`);
    if (!health.ok) {
      console.error("❌ Server health check failed!");
      Deno.exit(1);
    }
    console.log("✅ Server is healthy\n");
  } catch (error) {
    console.error("❌ Cannot connect to server:", error.message);
    console.log("\n💡 Make sure the server is running:");
    console.log("   deno task start\n");
    Deno.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const success = await runTest(testCase);
    if (success) {
      passed++;
    } else {
      failed++;
    }

    // Wait between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 Test Results`);
  console.log(`${"=".repeat(60)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  console.log();

  if (failed > 0) {
    Deno.exit(1);
  }
}

main();

