#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { generateFakeHikingData } from "./generateFakeHikingData.ts";

console.log("🚀 Starting fake hiking data generation...");
await generateFakeHikingData();
console.log("🎉 Data generation complete!");
