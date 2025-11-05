/**
 * Test script to verify LLM API (Gemini) is working
 */

import { load } from "jsr:@std/dotenv";
import { GeminiClient } from "../services/GeminiClient.ts";

// Load environment variables
await load({ export: true });

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in environment");
  Deno.exit(1);
}

console.log("✅ GEMINI_API_KEY found");
console.log("🧪 Testing Gemini API connection...\n");

try {
  const gemini = new GeminiClient(GEMINI_API_KEY);

  // Test 1: Simple text generation
  console.log("Test 1: Simple text generation");
  const startTime = Date.now();
  const response = await gemini.generateContent(
    "Say 'Hello, I am working!' in exactly 5 words."
  );
  const duration = Date.now() - startTime;
  
  console.log(`✅ Response received in ${duration}ms`);
  console.log(`   Response: "${response.trim()}"`);
  console.log();

  // Test 2: JSON generation (like route planning uses)
  console.log("Test 2: JSON generation");
  const startTime2 = Date.now();
  const jsonResponse = await gemini.generateJSON<{
    destination: string;
    requiresTransit: boolean;
  }>(
    `User wants to hike at Blue Hills Reservation from Boston.
    Respond with JSON containing:
    - destination: name of the hiking location
    - requiresTransit: true (since they're coming from Boston)`,
    "You are a helpful route planning assistant."
  );
  const duration2 = Date.now() - startTime2;
  
  console.log(`✅ JSON response received in ${duration2}ms`);
  console.log(`   Response:`, JSON.stringify(jsonResponse, null, 2));
  console.log();

  console.log("🎉 All tests passed! Gemini API is working correctly.");
  
} catch (error) {
  console.error("❌ Error testing Gemini API:");
  console.error(error);
  
  if (error instanceof Error && error.message.includes("API error")) {
    console.error("\n💡 This looks like an API authentication or quota issue.");
    console.error("   Check that your API key is valid and has quota remaining.");
    console.error("   Visit: https://makersuite.google.com/app/apikey");
  }
  
  Deno.exit(1);
}

