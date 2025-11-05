#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { generateFakeUserData } from "./generateFakeUserData.ts";

console.log("🚀 Starting fake user data generation...");
await generateFakeUserData();
console.log("🎉 User data generation complete!");

