#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { getDb } from "../utils/database.ts";
import { HikingAppConcept } from "../concepts/HikingApp/HikingAppConcept.ts";

async function testFixes() {
  console.log("🔧 Testing Backend Fixes...");
  
  const [db, client] = await getDb();
  const hikingApp = new HikingAppConcept(db);
  
  try {
    // Test 1: Search suggestions with proper input validation
    console.log("\n💡 Testing search suggestions...");
    try {
      const suggestions = await hikingApp.getSearchSuggestions("Yos", undefined, 5);
      console.log(`✅ Search suggestions working: ${suggestions.length} results`);
    } catch (error) {
      console.log(`❌ Search suggestions failed: ${error.message}`);
    }

    // Test 2: Location search with fixed radius
    console.log("\n🔍 Testing location search...");
    try {
      const locations = await hikingApp.searchLocations("Yosemite", 5);
      console.log(`✅ Location search working: ${locations.length} results`);
      locations.forEach((loc, index) => {
        console.log(`   ${index + 1}. ${loc.name} (${loc.type})`);
      });
    } catch (error) {
      console.log(`❌ Location search failed: ${error.message}`);
    }

    // Test 3: Route calculation with proper validation
    console.log("\n🗺️ Testing route calculation...");
    try {
      const route = await hikingApp.calculateRoute({
        origin: { lat: 37.7749, lon: -122.4194, address: "San Francisco, CA" },
        destination: { lat: 37.7489, lon: -119.5890, address: "Yosemite Valley, CA" },
        mode: "hiking",
        preferences: { difficulty: "moderate" }
      });
      console.log(`✅ Route calculation working: ${route.id}`);
    } catch (error) {
      console.log(`❌ Route calculation failed: ${error.message}`);
    }

    // Test 4: Test with invalid inputs to ensure proper error handling
    console.log("\n⚠️ Testing error handling...");
    
    // Test search suggestions with invalid input
    try {
      const invalidSuggestions = await hikingApp.getSearchSuggestions(null as any, undefined, 5);
      console.log(`✅ Invalid input handled gracefully: ${invalidSuggestions.length} results`);
    } catch (error) {
      console.log(`❌ Invalid input not handled: ${error.message}`);
    }

    // Test route calculation with missing coordinates
    try {
      const invalidRoute = await hikingApp.calculateRoute({
        origin: { lat: 37.7749, lon: -122.4194 },
        destination: null as any,
        mode: "hiking"
      });
      console.log(`❌ Should have failed with invalid destination`);
    } catch (error) {
      console.log(`✅ Invalid route input properly rejected: ${error.message}`);
    }

    console.log("\n🎉 Backend fixes test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await client.close();
  }
}

// Run the test
if (import.meta.main) {
  await testFixes();
}


