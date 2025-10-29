#!/usr/bin/env -S deno run --allow-net

/**
 * Test CORS headers from the backend server
 * This simulates what the browser does with preflight requests
 */

async function testCORS() {
  console.log("🧪 Testing CORS Configuration...\n");

  const baseURL = "http://localhost:8000";
  const endpoints = [
    "/api/HikingApp/searchLocations",
    "/api/HikingApp/getRecentSearches",
    "/api/HikingApp/calculateRoute"
  ];

  // Test 1: OPTIONS preflight request
  console.log("1️⃣ Testing OPTIONS preflight request...");
  try {
    const response = await fetch(`${baseURL}${endpoints[0]}`, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      }
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   CORS Headers:`);
    console.log(`   - Access-Control-Allow-Origin: ${response.headers.get("Access-Control-Allow-Origin")}`);
    console.log(`   - Access-Control-Allow-Methods: ${response.headers.get("Access-Control-Allow-Methods")}`);
    console.log(`   - Access-Control-Allow-Headers: ${response.headers.get("Access-Control-Allow-Headers")}`);
    
    if (response.headers.get("Access-Control-Allow-Origin")) {
      console.log("   ✅ CORS preflight request successful!\n");
    } else {
      console.log("   ❌ CORS headers not found!\n");
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 2: Actual POST request with CORS
  console.log("2️⃣ Testing POST request with CORS...");
  try {
    const response = await fetch(`${baseURL}${endpoints[1]}`, {
      method: "POST",
      headers: {
        "Origin": "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 5 })
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   CORS Headers:`);
    console.log(`   - Access-Control-Allow-Origin: ${response.headers.get("Access-Control-Allow-Origin")}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Request successful!`);
      console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}...\n`);
    } else {
      console.log(`   ❌ Request failed with status ${response.status}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 3: Test multiple origins
  console.log("3️⃣ Testing different origin ports...");
  const origins = ["http://localhost:3000", "http://localhost:5173", "http://localhost:4200"];
  
  for (const origin of origins) {
    try {
      const response = await fetch(`${baseURL}${endpoints[1]}`, {
        method: "POST",
        headers: {
          "Origin": origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 1 })
      });

      const allowedOrigin = response.headers.get("Access-Control-Allow-Origin");
      if (allowedOrigin === origin || allowedOrigin === "*") {
        console.log(`   ✅ ${origin} - Allowed`);
      } else {
        console.log(`   ❌ ${origin} - Not allowed`);
      }
    } catch (error) {
      console.log(`   ❌ ${origin} - Error: ${error.message}`);
    }
  }

  console.log("\n🎉 CORS testing completed!");
  console.log("\n📋 Summary:");
  console.log("   - Backend should accept requests from localhost:3000, 5173, and 4200");
  console.log("   - OPTIONS preflight requests should return CORS headers");
  console.log("   - POST requests should work with proper CORS headers");
  console.log("\n✅ Your frontend should now be able to make API requests!");
}

// Run the test
if (import.meta.main) {
  await testCORS();
}



