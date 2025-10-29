#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

/**
 * Startup test script - runs essential endpoint tests on server startup
 * Validates that critical endpoints are working before server accepts requests
 */

import { getDb } from "../utils/database.ts";
import { HikingAppConcept } from "../concepts/HikingApp/HikingAppConcept.ts";

async function startupTest(): Promise<boolean> {
  console.log("\n🔧 STARTUP VALIDATION");
  console.log("=" .repeat(50));
  
  const [db, client] = await getDb();
  const hikingApp = new HikingAppConcept(db);
  
  let allPassed = true;
  const tests: Array<{ name: string; passed: boolean }> = [];
  
  try {
    // Test 1: Database Connection
    console.log("1. Database connection...");
    try {
      await db.collection("trailheads").findOne({});
      console.log("   ✅ Connected to database");
      tests.push({ name: "Database", passed: true });
    } catch (error) {
      console.log("   ❌ Database connection failed");
      tests.push({ name: "Database", passed: false });
      allPassed = false;
    }
    
    // Test 2: Search Functionality
    console.log("2. Search functionality...");
    try {
      const results = await hikingApp.searchLocations("Yosemite", { limit: 1 });
      if (results && results.length > 0) {
        console.log("   ✅ Search working");
        tests.push({ name: "Search", passed: true });
      } else {
        throw new Error("No results");
      }
    } catch (error) {
      console.log("   ❌ Search failed:", error.message);
      tests.push({ name: "Search", passed: false });
      allPassed = false;
    }
    
    // Test 3: Data Population
    console.log("3. Database populated...");
    try {
      const trailheadCount = await db.collection("trailheads").countDocuments();
      const trailCount = await db.collection("trails").countDocuments();
      
      if (trailheadCount > 0 && trailCount > 0) {
        console.log(`   ✅ Found ${trailheadCount} trailheads, ${trailCount} trails`);
        tests.push({ name: "Data", passed: true });
      } else {
        console.log(`   ⚠️  Warning: Low data count (${trailheadCount} trailheads, ${trailCount} trails)`);
        console.log(`      Run: deno run --allow-all src/scripts/runDataGeneration.ts`);
        tests.push({ name: "Data", passed: false });
        allPassed = false;
      }
    } catch (error) {
      console.log("   ❌ Data check failed:", error.message);
      tests.push({ name: "Data", passed: false });
      allPassed = false;
    }
    
    // Test 4: Geospatial Indexes
    console.log("4. Geospatial indexes...");
    try {
      const indexes = await db.collection("trailheads").listIndexes().toArray();
      const hasGeoIndex = indexes.some((idx: any) => idx.name.includes("2dsphere") || idx.name.includes("loc"));
      
      if (hasGeoIndex) {
        console.log("   ✅ Geospatial indexes configured");
        tests.push({ name: "Indexes", passed: true });
      } else {
        console.log("   ⚠️  Warning: Geospatial index missing");
        tests.push({ name: "Indexes", passed: false });
      }
    } catch (error) {
      console.log("   ⚠️  Could not verify indexes:", error.message);
      tests.push({ name: "Indexes", passed: false });
    }
    
    console.log("=".repeat(50));
    
    if (allPassed) {
      console.log("✅ All startup tests passed - Server ready!\n");
      return true;
    } else {
      console.log("⚠️  Some tests failed - Server may have limited functionality\n");
      return false;
    }
    
  } catch (error) {
    console.error("❌ Startup test error:", error);
    return false;
  } finally {
    await client.close();
  }
}

// Run if called directly
if (import.meta.main) {
  const passed = await startupTest();
  Deno.exit(passed ? 0 : 1);
}

export { startupTest };

