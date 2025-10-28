#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { getDb } from "../utils/database.ts";
import { TransitRoutePlannerConcept } from "../concepts/HikingApp/TransitRoutePlanner.ts";

async function simpleRoutingTest() {
  console.log("🧪 Simple routing test with fake data...");
  
  const [db, client] = await getDb();
  
  try {
    // Test 1: List available trailheads
    console.log("\n📍 Available trailheads (first 10):");
    const trailheads = await db.collection("trailheads").find({}).limit(10).toArray();
    trailheads.forEach((trailhead, index) => {
      const [lon, lat] = trailhead.loc.coordinates;
      console.log(`${index + 1}. ${trailhead.name} (${lat.toFixed(4)}, ${lon.toFixed(4)}) - ${trailhead.tags.difficulty}`);
    });
    
    // Test 2: List available transit stops
    console.log("\n🚌 Available transit stops:");
    const transitStops = await db.collection("transit_stops").find({}).toArray();
    transitStops.forEach((stop, index) => {
      const [lon, lat] = stop.loc.coordinates;
      console.log(`${index + 1}. ${stop.name} (${lat.toFixed(4)}, ${lon.toFixed(4)}) - Routes: ${stop.routes.join(", ")}`);
    });
    
    // Test 3: Test transit route planning
    console.log("\n🗺️ Testing transit route planning...");
    const transitPlanner = new TransitRoutePlannerConcept(db);
    
    // Find a trailhead with transit access
    const trailheadWithTransit = await db.collection("trailheads").findOne({
      transit_stops: { $exists: true, $ne: [] }
    });
    
    if (trailheadWithTransit) {
      console.log(`Planning route to: ${trailheadWithTransit.name}`);
      
      // Use a random origin point (San Francisco)
      const origin = { lat: 37.7749, lon: -122.4194 };
      const trailheadId = trailheadWithTransit._id.toHexString();
      
      try {
        const routeId = await transitPlanner.planRoute(
          origin.lat,
          origin.lon,
          trailheadId,
          480, // 8 hours max travel time
          undefined, // no preferred departure time
          [] // no accessibility requirements
        );
        
        console.log(`✅ Route planned successfully! Route ID: ${routeId}`);
        
        // Get route summary
        const summary = await transitPlanner.getPlannedRouteSummary(routeId);
        console.log(`📊 Route Summary:`);
        console.log(`   Total time: ${summary.totalMinutes} minutes`);
        console.log(`   Transit time: ${summary.transitMinutes} minutes`);
        console.log(`   Hiking time: ${summary.hikingMinutes} minutes`);
        console.log(`   Segments: ${summary.segmentsCount}`);
        
      } catch (error) {
        console.log(`❌ Route planning failed: ${error.message}`);
      }
    } else {
      console.log("⚠️ No trailheads with transit access found");
      
      // Let's check what trailheads we have and their transit_stops
      console.log("\n🔍 Checking trailhead transit connections...");
      const allTrailheads = await db.collection("trailheads").find({}).limit(5).toArray();
      allTrailheads.forEach((th, i) => {
        console.log(`${i + 1}. ${th.name} - Transit stops: ${th.transit_stops?.length || 0}`);
      });
    }
    
    // Test 4: Test route alternatives
    console.log("\n🔄 Testing route alternatives...");
    try {
      // Get any trailhead for testing
      const anyTrailhead = await db.collection("trailheads").findOne({});
      if (anyTrailhead) {
        const origin = { lat: 37.7749, lon: -122.4194 };
        const trailheadId = anyTrailhead._id.toHexString();
        
        // First create a route
        const routeId = await transitPlanner.planRoute(
          origin.lat,
          origin.lon,
          trailheadId,
          480,
          undefined,
          []
        );
        
        console.log(`Created base route: ${routeId}`);
        
        // Test alternatives
        const fasterRoutes = await transitPlanner.getAlternativeRoutes(routeId, "faster");
        const shorterRoutes = await transitPlanner.getAlternativeRoutes(routeId, "shorter");
        const scenicRoutes = await transitPlanner.getAlternativeRoutes(routeId, "scenic");
        
        console.log(`Faster alternatives: ${fasterRoutes.length}`);
        console.log(`Shorter alternatives: ${shorterRoutes.length}`);
        console.log(`Scenic alternatives: ${scenicRoutes.length}`);
      }
    } catch (error) {
      console.log(`❌ Route alternatives test failed: ${error.message}`);
    }
    
    console.log("\n🎉 Simple routing test completed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await client.close();
  }
}

// Run the test
if (import.meta.main) {
  await simpleRoutingTest();
}
