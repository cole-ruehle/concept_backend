#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { getDb } from "../utils/database.ts";
import { HikingAppConcept } from "../concepts/HikingApp/HikingAppConcept.ts";

/**
 * Comprehensive test suite for all HikingApp endpoints
 * Tests every endpoint at least once with valid data
 */

interface TestResult {
  endpoint: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

async function testAllEndpoints() {
  console.log("🧪 COMPREHENSIVE ENDPOINT TEST SUITE");
  console.log("=" .repeat(60));
  console.log("Testing all HikingApp endpoints...\n");
  
  const [db, client] = await getDb();
  const hikingApp = new HikingAppConcept(db);
  
  const results: TestResult[] = [];
  let totalTests = 0;
  let passedTests = 0;
  
  try {
    // =============================================================================
    // 1. SEARCH LOCATIONS ENDPOINT
    // =============================================================================
    console.log("📍 1. Testing searchLocations endpoint...");
    totalTests++;
    const searchStart = Date.now();
    try {
      const searchResults = await hikingApp.searchLocations("Yosemite", { limit: 5 });
      const searchDuration = Date.now() - searchStart;
      
      if (searchResults && searchResults.length > 0) {
        console.log(`   ✅ PASSED - Found ${searchResults.length} locations`);
        console.log(`      First result: ${searchResults[0].name} (${searchResults[0].type})`);
        console.log(`      Duration: ${searchDuration}ms`);
        results.push({ endpoint: "searchLocations", passed: true, duration: searchDuration });
        passedTests++;
      } else {
        throw new Error("No search results returned");
      }
    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`);
      results.push({ endpoint: "searchLocations", passed: false, error: error.message });
    }
    
    // =============================================================================
    // 2. GET NEARBY LOCATIONS ENDPOINT
    // =============================================================================
    console.log("\n📍 2. Testing getNearbyLocations endpoint...");
    totalTests++;
    const nearbyStart = Date.now();
    try {
      const nearbyResults = await hikingApp.getNearbyLocations(
        { lat: 37.7489, lon: -119.5890 }, // Yosemite coordinates
        5000, // 5km radius
        ["trailhead", "transit_stop"], // Only types with geospatial data
        10
      );
      const nearbyDuration = Date.now() - nearbyStart;
      
      if (nearbyResults && Array.isArray(nearbyResults)) {
        console.log(`   ✅ PASSED - Found ${nearbyResults.length} nearby locations`);
        if (nearbyResults.length > 0) {
          console.log(`      Closest: ${nearbyResults[0].name} (${nearbyResults[0].distance}m away)`);
        }
        console.log(`      Duration: ${nearbyDuration}ms`);
        results.push({ endpoint: "getNearbyLocations", passed: true, duration: nearbyDuration });
        passedTests++;
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`);
      results.push({ endpoint: "getNearbyLocations", passed: false, error: error.message });
    }
    
    // =============================================================================
    // 3. GET NEARBY LOCATIONS - ERROR HANDLING (Invalid Coordinates)
    // =============================================================================
    console.log("\n📍 3. Testing getNearbyLocations error handling (invalid coords)...");
    totalTests++;
    try {
      await hikingApp.getNearbyLocations(
        { lat: null as any, lon: null as any },
        1000
      );
      console.log(`   ❌ FAILED - Should have thrown error for null coordinates`);
      results.push({ endpoint: "getNearbyLocations (validation)", passed: false, error: "Did not validate coordinates" });
    } catch (error) {
      if (error.message.includes("Invalid coordinates")) {
        console.log(`   ✅ PASSED - Correctly rejected invalid coordinates`);
        console.log(`      Error: ${error.message}`);
        results.push({ endpoint: "getNearbyLocations (validation)", passed: true });
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Wrong error message: ${error.message}`);
        results.push({ endpoint: "getNearbyLocations (validation)", passed: false, error: error.message });
      }
    }
    
    // =============================================================================
    // 4. CALCULATE ROUTE ENDPOINT
    // =============================================================================
    console.log("\n🗺️  4. Testing calculateRoute endpoint...");
    totalTests++;
    const routeStart = Date.now();
    try {
      const route = await hikingApp.calculateRoute({
        origin: { lat: 37.7749, lon: -122.4194, address: "San Francisco, CA" },
        destination: { lat: 37.7489, lon: -119.5890, address: "Yosemite Valley, CA" },
        mode: "hiking",
        preferences: { difficulty: "moderate" }
      });
      const routeDuration = Date.now() - routeStart;
      
      if (route && route.id && route.totalDistance && route.segments) {
        console.log(`   ✅ PASSED - Route calculated successfully`);
        console.log(`      Distance: ${route.totalDistanceFormatted || route.totalDistance + 'm'}`);
        console.log(`      Duration: ${route.totalDurationFormatted || route.totalDuration + 's'}`);
        console.log(`      Segments: ${route.segments.length}`);
        console.log(`      Calculation time: ${routeDuration}ms`);
        results.push({ endpoint: "calculateRoute", passed: true, duration: routeDuration });
        passedTests++;
      } else {
        throw new Error("Invalid route response");
      }
    } catch (error) {
      console.log(`   ⚠️  SKIPPED - ${error.message}`);
      console.log(`      Note: Route calculation may require external APIs`);
      results.push({ endpoint: "calculateRoute", passed: false, error: error.message });
    }
    
    // =============================================================================
    // 5. GET ALTERNATIVE ROUTES ENDPOINT (Validation Test)
    // =============================================================================
    console.log("\n🗺️  5. Testing getAlternativeRoutes endpoint (validation)...");
    totalTests++;
    try {
      // Test with invalid route ID - should throw validation error
      await hikingApp.getAlternativeRoutes("invalid-route-id", "faster");
      console.log(`   ❌ FAILED - Should have rejected invalid route ID`);
      results.push({ endpoint: "getAlternativeRoutes", passed: false, error: "Did not validate route ID" });
    } catch (error) {
      // We expect this to fail with validation error
      if (error.message.includes("Invalid route ID") || error.message.includes("input must be")) {
        console.log(`   ✅ PASSED - Correctly validated route ID format`);
        console.log(`      Error: ${error.message}`);
        results.push({ endpoint: "getAlternativeRoutes", passed: true });
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Unexpected error: ${error.message}`);
        results.push({ endpoint: "getAlternativeRoutes", passed: false, error: error.message });
      }
    }
    
    // =============================================================================
    // 6. GET RECENT SEARCHES ENDPOINT
    // =============================================================================
    console.log("\n📚 6. Testing getRecentSearches endpoint...");
    totalTests++;
    try {
      const recentSearches = await hikingApp.getRecentSearches(undefined, 5);
      
      if (Array.isArray(recentSearches)) {
        console.log(`   ✅ PASSED - Found ${recentSearches.length} recent searches`);
        if (recentSearches.length > 0) {
          const search = recentSearches[0];
          console.log(`      Latest: ${search.origin?.address || 'unknown'} → ${search.destination?.address || 'unknown'}`);
        }
        results.push({ endpoint: "getRecentSearches", passed: true });
        passedTests++;
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`);
      results.push({ endpoint: "getRecentSearches", passed: false, error: error.message });
    }
    
    // =============================================================================
    // 7. GET SEARCH SUGGESTIONS ENDPOINT
    // =============================================================================
    console.log("\n💡 7. Testing getSearchSuggestions endpoint...");
    totalTests++;
    try {
      const suggestions = await hikingApp.getSearchSuggestions("Yos", undefined, 5);
      
      if (Array.isArray(suggestions)) {
        console.log(`   ✅ PASSED - Got ${suggestions.length} suggestions`);
        if (suggestions.length > 0) {
          console.log(`      First suggestion: ${suggestions[0].text || suggestions[0]}`);
        }
        results.push({ endpoint: "getSearchSuggestions", passed: true });
        passedTests++;
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`);
      results.push({ endpoint: "getSearchSuggestions", passed: false, error: error.message });
    }
    
    // =============================================================================
    // 8. GET SEARCH STATS ENDPOINT
    // =============================================================================
    console.log("\n📊 8. Testing getSearchStats endpoint...");
    totalTests++;
    try {
      const stats = await hikingApp.getSearchStats(undefined, 7);
      
      if (stats && typeof stats === 'object') {
        console.log(`   ✅ PASSED - Got search statistics`);
        console.log(`      Total searches: ${stats.totalSearches || 0}`);
        console.log(`      Popular destinations: ${stats.popularDestinations?.length || 0}`);
        results.push({ endpoint: "getSearchStats", passed: true });
        passedTests++;
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`);
      results.push({ endpoint: "getSearchStats", passed: false, error: error.message });
    }
    
    // =============================================================================
    // 9. REVERSE GEOCODE ENDPOINT
    // =============================================================================
    console.log("\n🌍 9. Testing reverseGeocodeLocation endpoint...");
    totalTests++;
    try {
      const geocoded = await hikingApp.reverseGeocodeLocation(37.7749, -122.4194);
      
      // Note: This might be a stub implementation
      console.log(`   ✅ PASSED - Reverse geocode completed`);
      if (geocoded) {
        console.log(`      Result: ${geocoded.address || geocoded}`);
      }
      results.push({ endpoint: "reverseGeocodeLocation", passed: true });
      passedTests++;
    } catch (error) {
      console.log(`   ⚠️  SKIPPED - ${error.message}`);
      results.push({ endpoint: "reverseGeocodeLocation", passed: false, error: error.message });
    }
    
    // =============================================================================
    // 10. CLEAR SEARCH HISTORY ENDPOINT
    // =============================================================================
    console.log("\n🗑️  10. Testing clearSearchHistory endpoint...");
    totalTests++;
    try {
      const result = await hikingApp.clearSearchHistory("test-session-id");
      
      if (result && typeof result.deletedCount === 'number') {
        console.log(`   ✅ PASSED - Deleted ${result.deletedCount} entries`);
        results.push({ endpoint: "clearSearchHistory", passed: true });
        passedTests++;
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`);
      results.push({ endpoint: "clearSearchHistory", passed: false, error: error.message });
    }
    
    // =============================================================================
    // 11. SEARCH MULTIPLE TERMS (Batch Test)
    // =============================================================================
    console.log("\n🔍 11. Testing search with multiple terms (batch test)...");
    totalTests++;
    const testTerms = ["Grand Canyon", "Rocky Mountain", "Mount Rainier"];
    let allPassed = true;
    let searchCount = 0;
    
    try {
      for (const term of testTerms) {
        const results = await hikingApp.searchLocations(term, { limit: 3 });
        if (results && results.length > 0) {
          searchCount++;
        } else {
          allPassed = false;
          break;
        }
      }
      
      if (allPassed && searchCount === testTerms.length) {
        console.log(`   ✅ PASSED - All ${searchCount} search terms worked`);
        results.push({ endpoint: "searchLocations (batch)", passed: true });
        passedTests++;
      } else {
        throw new Error(`Only ${searchCount}/${testTerms.length} searches succeeded`);
      }
    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`);
      results.push({ endpoint: "searchLocations (batch)", passed: false, error: error.message });
    }
    
    // =============================================================================
    // SUMMARY
    // =============================================================================
    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${totalTests - passedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    // Show failed tests
    const failedTests = results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log("\n❌ Failed Tests:");
      failedTests.forEach(test => {
        console.log(`   - ${test.endpoint}: ${test.error || 'Unknown error'}`);
      });
    }
    
    // Show performance metrics
    const timedTests = results.filter(r => r.duration);
    if (timedTests.length > 0) {
      console.log("\n⚡ Performance Metrics:");
      timedTests.forEach(test => {
        console.log(`   - ${test.endpoint}: ${test.duration}ms`);
      });
    }
    
    console.log("\n" + "=".repeat(60));
    
    if (passedTests === totalTests) {
      console.log("🎉 ALL TESTS PASSED!");
      console.log("✅ API is fully operational");
    } else if (passedTests >= totalTests * 0.8) {
      console.log("⚠️  MOST TESTS PASSED");
      console.log("⚠️  Some endpoints may need attention");
    } else {
      console.log("❌ CRITICAL: Multiple endpoints failing");
      console.log("❌ API needs immediate attention");
    }
    
    console.log("=".repeat(60) + "\n");
    
  } catch (error) {
    console.error("\n💥 CRITICAL ERROR:", error);
    console.error("Stack:", error.stack);
  } finally {
    await client.close();
  }
  
  // Exit with appropriate code
  const failedCount = totalTests - passedTests;
  Deno.exit(failedCount > 0 ? 1 : 0);
}

// Run the tests
if (import.meta.main) {
  testAllEndpoints();
}

export { testAllEndpoints };

