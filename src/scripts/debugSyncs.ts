/**
 * Debug script to check which syncs are registered
 */

import syncs from "../syncs/syncs.ts";

console.log("\n🔍 Registered Synchronizations:\n");

const llmSyncs = Object.keys(syncs).filter(key => key.includes("llmRoutePlanner"));

console.log(`Found ${llmSyncs.length} LLM Route Planner syncs:\n`);

llmSyncs.forEach(syncName => {
  console.log(`  ✓ ${syncName}`);
});

console.log("\n");

// Check if the new sync exists
if (llmSyncs.includes("HikingApp.llmRoutePlanner.LLMRoutePlannerAutoAuthenticate")) {
  console.log("✅ LLMRoutePlannerAutoAuthenticate sync is registered!");
} else {
  console.log("❌ LLMRoutePlannerAutoAuthenticate sync is NOT registered!");
  console.log("   You need to restart the server.");
}

console.log("\nAll syncs:");
Object.keys(syncs).forEach(key => console.log(`  - ${key}`));

