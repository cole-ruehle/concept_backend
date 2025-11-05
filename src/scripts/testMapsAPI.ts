/**
 * Test script to verify Google Maps API is working
 */

import { load } from "jsr:@std/dotenv";
import { GoogleMapsClient } from "../services/GoogleMapsClient.ts";

// Load environment variables
await load({ export: true });

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

if (!GOOGLE_MAPS_API_KEY) {
  console.error("❌ GOOGLE_MAPS_API_KEY not found in environment");
  Deno.exit(1);
}

console.log("✅ GOOGLE_MAPS_API_KEY found");
console.log("🧪 Testing Google Maps API connection...\n");

try {
  const maps = new GoogleMapsClient(GOOGLE_MAPS_API_KEY);

  // Test 1: Text Search (Places API)
  console.log("Test 1: Places API - Text Search");
  const startTime = Date.now();
  const places = await maps.textSearch("Blue Hills Reservation hiking trail");
  const duration = Date.now() - startTime;
  
  console.log(`✅ Response received in ${duration}ms`);
  console.log(`   Found ${places.length} places`);
  if (places.length > 0) {
    console.log(`   First result: ${places[0].name}`);
    console.log(`   Location: ${places[0].location.lat}, ${places[0].location.lng}`);
  }
  console.log();

  // Test 2: Directions API
  console.log("Test 2: Directions API");
  const startTime2 = Date.now();
  const directions = await maps.directions(
    { lat: 42.3601, lng: -71.0589 }, // Boston
    { lat: 42.2121, lng: -71.0662 }, // Blue Hills
    "transit"
  );
  const duration2 = Date.now() - startTime2;
  
  console.log(`✅ Response received in ${duration2}ms`);
  if (directions.routes.length > 0) {
    const route = directions.routes[0];
    console.log(`   Found route: ${route.summary || 'unnamed'}`);
    console.log(`   Duration: ${route.legs[0].duration.text}`);
    console.log(`   Distance: ${route.legs[0].distance.text}`);
  }
  console.log();

  // Test 3: Geocoding API
  console.log("Test 3: Geocoding API");
  const startTime3 = Date.now();
  const geocode = await maps.geocode("Blue Hills Reservation, Milton, MA");
  const duration3 = Date.now() - startTime3;
  
  console.log(`✅ Response received in ${duration3}ms`);
  if (geocode.results.length > 0) {
    console.log(`   Address: ${geocode.results[0].formatted_address}`);
    const loc = geocode.results[0].geometry.location;
    console.log(`   Location: ${loc.lat}, ${loc.lng}`);
  }
  console.log();

  console.log("🎉 All tests passed! Google Maps API is working correctly.");
  
} catch (error) {
  console.error("❌ Error testing Google Maps API:");
  console.error(error);
  
  if (error instanceof Error) {
    if (error.message.includes("REQUEST_DENIED")) {
      console.error("\n💡 API key is invalid or APIs are not enabled.");
      console.error("   Visit: https://console.cloud.google.com/google/maps-apis");
      console.error("   Make sure these APIs are enabled:");
      console.error("   - Places API");
      console.error("   - Directions API");
      console.error("   - Geocoding API");
    } else if (error.message.includes("OVER_QUERY_LIMIT")) {
      console.error("\n💡 You've exceeded your API quota.");
      console.error("   Check your usage at: https://console.cloud.google.com/google/maps-apis");
    }
  }
  
  Deno.exit(1);
}

