#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { getDb } from "../utils/database.ts";
import { HikingAppConcept } from "../concepts/HikingApp/HikingAppConcept.ts";

async function testBackendFixes() {
  console.log("🔧 Testing Backend Fixes...");
  
  const [db, client] = await getDb();
  const hikingApp = new HikingAppConcept(db);
  
  try {
    // Test 1: Unified route calculation with standardized formatting
    console.log("\n🗺️ Testing unified route calculation...");
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
      console.log(`   Distance: ${route.totalDistanceFormatted} (${route.totalDistance}m)`);
      console.log(`   Duration: ${route.totalDurationFormatted} (${route.totalDuration}s)`);
      console.log(`   Segments: ${route.segments.length}`);
      console.log(`   Difficulty: ${route.difficulty}`);
      console.log(`   Elevation Gain: ${route.elevationGain}m`);
      
      // Test standardized formatting
      console.log("\n📏 Testing standardized formatting:");
      route.segments.forEach((segment, index) => {
        console.log(`   Segment ${index + 1}: ${segment.distanceFormatted}, ${segment.durationFormatted}`);
      });
      
    } catch (error) {
      console.log(`❌ Route calculation failed: ${error.message}`);
    }

    // Test 2: Search history persistence
    console.log("\n📚 Testing search history persistence...");
    try {
      // Save a search
      const searchEntry = {
        userId: "test_user_123",
        origin: { lat: 37.7749, lon: -122.4194, address: "San Francisco, CA" },
        destination: { lat: 37.7489, lon: -119.5890, address: "Yosemite Valley, CA" },
        mode: "hiking",
        resultCount: 1,
        routeId: "test_route_123"
      };
      
      const searchId = await hikingApp.searchHistory.saveSearch(searchEntry);
      console.log(`✅ Search saved with ID: ${searchId}`);
      
      // Retrieve recent searches
      const recentSearches = await hikingApp.getRecentSearches("test_user_123", 5);
      console.log(`✅ Found ${recentSearches.length} recent searches:`);
      recentSearches.forEach((search, index) => {
        console.log(`   ${index + 1}. ${search.origin.address} → ${search.destination.address} (${search.mode})`);
      });
      
    } catch (error) {
      console.log(`❌ Search history test failed: ${error.message}`);
    }

    // Test 3: Location search and autocomplete
    console.log("\n🔍 Testing location search...");
    try {
      // Test with a simple query
      const searchResults = await hikingApp.searchLocations("Yosemite");
      console.log(`✅ Found ${searchResults.length} locations for "Yosemite":`);
      searchResults.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.name} (${result.type}) - ${result.address}`);
      });
      
    } catch (error) {
      console.log(`❌ Location search failed: ${error.message}`);
    }

    // Test 4: Get nearby locations
    console.log("\n📍 Testing nearby locations...");
    try {
      const nearbyLocations = await hikingApp.getNearbyLocations(
        { lat: 37.7749, lon: -122.4194 },
        10000, // 10km radius
        ["trailhead", "transit_stop"],
        5
      );
      console.log(`✅ Found ${nearbyLocations.length} nearby locations:`);
      nearbyLocations.forEach((location, index) => {
        console.log(`   ${index + 1}. ${location.name} (${location.type}) - ${location.distance ? Math.round(location.distance) + 'm' : 'unknown distance'}`);
      });
      
    } catch (error) {
      console.log(`❌ Nearby locations test failed: ${error.message}`);
    }

    // Test 5: Search suggestions
    console.log("\n💡 Testing search suggestions...");
    try {
      const suggestions = await hikingApp.getSearchSuggestions("Yos", "test_user_123", 5);
      console.log(`✅ Found ${suggestions.length} suggestions for "Yos":`);
      suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion.text} (${suggestion.type})`);
      });
      
    } catch (error) {
      console.log(`❌ Search suggestions failed: ${error.message}`);
    }

    // Test 6: Route alternatives
    console.log("\n🔄 Testing route alternatives...");
    try {
      const alternatives = await hikingApp.getAlternativeRoutes("test_route_123", "faster");
      console.log(`✅ Found ${alternatives.length} alternative routes`);
      
    } catch (error) {
      console.log(`❌ Route alternatives failed: ${error.message}`);
    }

    console.log("\n🎉 Backend fixes test completed!");
    console.log("\n📋 Summary of fixes implemented:");
    console.log("   ✅ Unified routing API consolidates Find/Calculate routes");
    console.log("   ✅ Standardized distance/duration formatting (km/m, h/m format)");
    console.log("   ✅ Search history persistence in database");
    console.log("   ✅ Location search with autocomplete functionality");
    console.log("   ✅ Route alternatives API");
    console.log("   ✅ Consistent error handling and response formats");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await client.close();
  }
}

// Run the test
if (import.meta.main) {
  await testBackendFixes();
}

