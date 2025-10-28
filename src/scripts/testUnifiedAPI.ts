#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { getDb } from "../utils/database.ts";
import { HikingAppConcept } from "../concepts/HikingApp/HikingAppConcept.ts";

async function testUnifiedAPI() {
  console.log("🧪 Testing Unified API...");
  
  const [db, client] = await getDb();
  const hikingApp = new HikingAppConcept(db);
  
  try {
    // Test 1: Search locations with autocomplete
    console.log("\n🔍 Testing location search...");
    const searchResults = await hikingApp.searchLocations("Yosemite", { limit: 5 });
    console.log(`Found ${searchResults.length} locations:`);
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.name} (${result.type}) - ${result.address}`);
    });

    // Test 2: Calculate a route
    console.log("\n🗺️ Testing route calculation...");
    const routeRequest = {
      origin: { lat: 37.7749, lon: -122.4194, address: "San Francisco, CA" },
      destination: { lat: 37.7489, lon: -119.5890, address: "Yosemite Valley, CA" },
      mode: "hiking",
      preferences: {
        maxDistance: 10000,
        difficulty: "moderate"
      }
    };

    try {
      const route = await hikingApp.calculateRoute(routeRequest);
      console.log(`✅ Route calculated successfully!`);
      console.log(`   ID: ${route.id}`);
      console.log(`   Distance: ${route.totalDistanceFormatted}`);
      console.log(`   Duration: ${route.totalDurationFormatted}`);
      console.log(`   Segments: ${route.segments.length}`);
      console.log(`   Difficulty: ${route.difficulty}`);
    } catch (error) {
      console.log(`❌ Route calculation failed: ${error.message}`);
    }

    // Test 3: Get recent searches
    console.log("\n📚 Testing recent searches...");
    const recentSearches = await hikingApp.getRecentSearches(undefined, 5);
    console.log(`Found ${recentSearches.length} recent searches:`);
    recentSearches.forEach((search, index) => {
      console.log(`  ${index + 1}. ${search.origin.address || 'Unknown'} → ${search.destination.address || 'Unknown'} (${search.mode})`);
    });

    // Test 4: Get search suggestions
    console.log("\n💡 Testing search suggestions...");
    const suggestions = await hikingApp.getSearchSuggestions("Yos", undefined, 5);
    console.log(`Found ${suggestions.length} suggestions:`);
    suggestions.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. ${suggestion.text} (${suggestion.type})`);
    });

    // Test 5: Get nearby locations
    console.log("\n📍 Testing nearby locations...");
    const nearbyLocations = await hikingApp.getNearbyLocations(
      { lat: 37.7749, lon: -122.4194 },
      10000, // 10km radius
      ["trailhead", "transit_stop"],
      5
    );
    console.log(`Found ${nearbyLocations.length} nearby locations:`);
    nearbyLocations.forEach((location, index) => {
      console.log(`  ${index + 1}. ${location.name} (${location.type}) - ${location.distance ? Math.round(location.distance) + 'm' : 'unknown distance'}`);
    });

    // Test 6: Reverse geocoding
    console.log("\n🔄 Testing reverse geocoding...");
    try {
      const reverseResult = await hikingApp.reverseGeocode(37.7749, -122.4194);
      if (reverseResult) {
        console.log(`✅ Reverse geocoding successful: ${reverseResult.name}`);
      } else {
        console.log("❌ Reverse geocoding returned no results");
      }
    } catch (error) {
      console.log(`❌ Reverse geocoding failed: ${error.message}`);
    }

    // Test 7: Get search statistics
    console.log("\n📊 Testing search statistics...");
    try {
      const stats = await hikingApp.getSearchStats(undefined, 7);
      console.log(`Search stats (last 7 days):`);
      console.log(`  Total searches: ${stats.totalSearches}`);
      console.log(`  Popular destinations: ${stats.popularDestinations.length}`);
      console.log(`  Popular modes: ${stats.popularModes.length}`);
    } catch (error) {
      console.log(`❌ Search stats failed: ${error.message}`);
    }

    console.log("\n🎉 Unified API test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await client.close();
  }
}

// Run the test
if (import.meta.main) {
  await testUnifiedAPI();
}

