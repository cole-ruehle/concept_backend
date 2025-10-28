#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { getDb } from "../utils/database.ts";
import { TransitRoutePlannerConcept } from "../concepts/HikingApp/TransitRoutePlanner.ts";
import { ExternalRoutingEngineConcept } from "../concepts/HikingApp/ExternalRoutingEngine.ts";

async function testRoutingWithFakeData() {
  console.log("🧪 Testing routing with fake hiking data...");
  
  const [db, client] = await getDb();
  
  try {
    // Test 1: List available trailheads
    console.log("\n📍 Available trailheads:");
    const trailheads = await db.collection("trailheads").find({}).limit(10).toArray();
    trailheads.forEach((trailhead, index) => {
      const [lon, lat] = trailhead.loc.coordinates;
      console.log(`${index + 1}. ${trailhead.name} (${lat.toFixed(4)}, ${lon.toFixed(4)}) - ${trailhead.tags.difficulty}`);
    });
    
    // Test 2: List available transit stops
    console.log("\n🚌 Available transit stops:");
    const transitStops = await db.collection("transit_stops").find({}).limit(5).toArray();
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
      const trailheadId = trailheadWithTransit._id.toString();
      
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
    }
    
    // Test 4: Test external routing engine
    console.log("\n🛣️ Testing external routing engine...");
    const routingEngine = new ExternalRoutingEngineConcept(db);
    
    // Test hiking route calculation
    const origin = { lat: 37.7749, lon: -122.4194 }; // San Francisco
    const destination = { lat: 37.7489, lon: -119.5890 }; // Yosemite Valley
    
    try {
      console.log("Calculating hiking route from San Francisco to Yosemite Valley...");
      const hikingRoute = await routingEngine.calculateHikingRoute(origin, destination, {
        preferTrails: true,
        difficulty: "moderate"
      });
      
      console.log(`✅ Hiking route calculated with ${hikingRoute.length} segments`);
      hikingRoute.forEach((segment, index) => {
        console.log(`   Segment ${index + 1}: ${segment.instructions[0]} (${Math.round(segment.distance)}m, ${Math.round(segment.duration/60)}min)`);
      });
      
    } catch (error) {
      console.log(`❌ Hiking route calculation failed: ${error.message}`);
    }
    
    // Test 5: Find nearby trails
    console.log("\n🔍 Testing nearby trail search...");
    try {
      const nearbyTrails = await routingEngine.findNearbyTrails(origin, 100); // 100km radius
      console.log(`✅ Found ${nearbyTrails.trails.length} trails and ${nearbyTrails.trailheads.length} trailheads nearby`);
    } catch (error) {
      console.log(`❌ Nearby trail search failed: ${error.message}`);
    }
    
    console.log("\n🎉 Routing tests completed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await client.close();
  }
}

// Run the test
if (import.meta.main) {
  await testRoutingWithFakeData();
}
