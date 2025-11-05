#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { generateFakeHikingData } from "./generateFakeHikingData.ts";
import { generateFakeUserData } from "./generateFakeUserData.ts";

console.log("🚀 Starting complete data generation...");
console.log("");

console.log("Step 1/2: Generating hiking data (trails, trailheads, transit stops)...");
await generateFakeHikingData();
console.log("");

console.log("Step 2/2: Generating user data (users, profiles, activities)...");
await generateFakeUserData();
console.log("");

console.log("🎉 Complete data generation finished!");
console.log("");
console.log("✅ Your database is now populated with:");
console.log("   - Trailheads and trails across the US");
console.log("   - Transit stops near major cities");
console.log("   - Fake users with profiles");
console.log("   - User activity history (hikes, ratings, saved routes)");
console.log("");
console.log("You can now test live activity and community features! 🌟");

