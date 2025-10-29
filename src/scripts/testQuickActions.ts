/**
 * Test script for quick actions with currentRoute
 */

const BASE_URL = "http://localhost:8000";

async function testCreateRoute() {
  console.log("\n" + "=".repeat(60));
  console.log("Test 1: Create New Route");
  console.log("=".repeat(60));

  const response = await fetch(`${BASE_URL}/api/plan-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "Find hiking trails near Boston accessible by public transit",
      userLocation: { lat: 42.3601, lng: -71.0589 },
      preferences: {
        duration: 3,
        transportModes: ["transit", "walking"],
      },
    }),
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log(`SUCCESS: Route created: ${data.route.route_id}`);
    console.log(`   Name: ${data.route.name}`);
    console.log(`   Total time: ${data.route.metrics.totalMin} minutes`);
    console.log(`   Waypoints: ${data.route.waypoints.length}`);
    return data.route;
  } else {
    console.error(`FAILED:`, data.error);
    return null;
  }
}

async function testAddScenic(currentRoute: any) {
  console.log("\n" + "=".repeat(60));
  console.log("Test 2: Add Scenic Stop to Existing Route");
  console.log("=".repeat(60));
  console.log(`   Modifying route: ${currentRoute.route_id}`);

  const response = await fetch(`${BASE_URL}/api/plan-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "add a scenic viewpoint to my route",
      userLocation: { lat: 42.3601, lng: -71.0589 },
      currentRoute: {
        route_id: currentRoute.route_id,
        name: currentRoute.name,
        origin: currentRoute.origin,
        destination: currentRoute.destination,
        waypoints: currentRoute.waypoints,
        metrics: currentRoute.metrics,
      },
    }),
  });

  const data = await response.json();

  if (response.ok) {
    console.log(`SUCCESS: Waypoint added!`);
    console.log(`   Route ID: ${data.route.route_id} (${data.route.route_id === currentRoute.route_id ? 'SAME' : 'DIFFERENT'})`);
    console.log(`   New name: ${data.route.name}`);
    console.log(`   Waypoints: ${currentRoute.waypoints.length} → ${data.route.waypoints.length}`);
    console.log(`   Time: ${currentRoute.metrics.totalMin} → ${data.route.metrics.totalMin} min`);
    return data.route;
  } else {
    console.error(`FAILED:`, data.error);
    return currentRoute;
  }
}

async function testExitNow(currentRoute: any) {
  console.log("\n" + "=".repeat(60));
  console.log("Test 3: Exit Now (Emergency)");
  console.log("=".repeat(60));
  console.log(`   Current route: ${currentRoute.route_id}`);
  console.log(`   Current location: 42.2500, -71.1000 (simulated mid-hike)`);

  const response = await fetch(`${BASE_URL}/api/plan-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "I need to exit now and get home",
      userLocation: { lat: 42.2500, lng: -71.1000 },  // Mid-hike location
      currentRoute: {
        route_id: currentRoute.route_id,
        origin: currentRoute.origin,
        destination: currentRoute.destination,
      },
    }),
  });

  const data = await response.json();

  if (response.ok) {
    console.log(`SUCCESS: Exit route created!`);
    console.log(`   Route ID: ${data.route.route_id}`);
    console.log(`   Name: ${data.route.name}`);
    console.log(`   From current location → Home`);
    console.log(`   ETA: ${data.route.metrics.totalMin} minutes`);
    console.log(`   Suggestions: ${data.suggestions.slice(0, 2).join(', ')}`);
  } else {
    console.error(`FAILED:`, data.error);
  }
}

async function testAdjustTime(currentRoute: any) {
  console.log("\n" + "=".repeat(60));
  console.log("Test 4: Adjust Timing");
  console.log("=".repeat(60));
  console.log(`   Original time: ${currentRoute.metrics.totalMin} minutes`);

  const response = await fetch(`${BASE_URL}/api/plan-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "I need to finish by 5pm",
      userLocation: currentRoute.origin,
      preferences: {
        duration: 2,  // Reduce from 3 to 2 hours
      },
      currentRoute: {
        route_id: currentRoute.route_id,
        origin: currentRoute.origin,
        destination: currentRoute.destination,
        metrics: currentRoute.metrics,
      },
    }),
  });

  const data = await response.json();

  if (response.ok) {
    console.log(`SUCCESS: Timing adjusted!`);
    console.log(`   Route ID: ${data.route.route_id} (${data.route.route_id === currentRoute.route_id ? 'SAME' : 'DIFFERENT'})`);
    console.log(`   Time: ${currentRoute.metrics.totalMin} → ${data.route.metrics.totalMin} min`);
    console.log(`   New ETA: ${data.route.metrics.etaArrival}`);
  } else {
    console.error(`FAILED:`, data.error);
  }
}

async function main() {
  console.log("\nQuick Actions Test Suite");
  console.log(`   Base URL: ${BASE_URL}\n`);

  // Health check
  try {
    const health = await fetch(`${BASE_URL}/api/health`);
    if (!health.ok) {
      console.error("ERROR: Server health check failed!");
      Deno.exit(1);
    }
    console.log("Server is healthy\n");
  } catch (error) {
    console.error("ERROR: Cannot connect to server:", error.message);
    console.log("\nTIP: Make sure the server is running:");
    console.log("   deno task start\n");
    Deno.exit(1);
  }

  // Run tests in sequence
  let currentRoute = await testCreateRoute();
  if (!currentRoute) {
    console.error("\nFailed to create initial route. Stopping tests.");
    Deno.exit(1);
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  currentRoute = await testAddScenic(currentRoute);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await testExitNow(currentRoute);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await testAdjustTime(currentRoute);

  console.log("\n" + "=".repeat(60));
  console.log("All tests completed!");
  console.log("=".repeat(60));
  console.log("\nCheck server logs to see LLM decision-making\n");
}

main();

