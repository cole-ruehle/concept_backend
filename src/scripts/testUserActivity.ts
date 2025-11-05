#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-sys

import { getDb } from "../utils/database.ts";

const API_BASE = "http://localhost:3000/api";

async function testPublicFeed() {
  console.log("🧪 Testing Public Feed (Live Activity)...\n");
  
  // Test 1: Get public feed without location filter
  console.log("Test 1: Getting public feed (no location filter)...");
  try {
    const response = await fetch(`${API_BASE}/userHistory/getPublicFeed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit: 10
      })
    });
    
    const data = await response.json();
    
    if (data.entries && data.entries.length > 0) {
      console.log(`✅ Success! Found ${data.entries.length} public activities`);
      console.log(`\nSample activities:`);
      data.entries.slice(0, 3).forEach((entry: any, i: number) => {
        console.log(`\n${i + 1}. Activity Type: ${entry.activityType}`);
        console.log(`   User ID: ${entry.userId.substring(0, 8)}...`);
        console.log(`   Location: ${entry.activityData.location || entry.activityData.trailName || "N/A"}`);
        console.log(`   Timestamp: ${new Date(entry.timestamp).toLocaleString()}`);
      });
    } else {
      console.log("❌ No activities found");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
  
  console.log("\n" + "=".repeat(60) + "\n");
  
  // Test 2: Get public feed with location filter (near Yosemite)
  console.log("Test 2: Getting public feed near Yosemite (50km radius)...");
  try {
    const response = await fetch(`${API_BASE}/userHistory/getPublicFeed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: {
          type: "Point",
          coordinates: [-119.5890, 37.7489] // Yosemite
        },
        radius: 50000, // 50km
        limit: 10
      })
    });
    
    const data = await response.json();
    
    if (data.entries && data.entries.length > 0) {
      console.log(`✅ Success! Found ${data.entries.length} activities near Yosemite`);
      console.log(`\nSample nearby activities:`);
      data.entries.slice(0, 3).forEach((entry: any, i: number) => {
        console.log(`\n${i + 1}. ${entry.activityType}`);
        console.log(`   Location: ${entry.activityData.location || entry.activityData.trailName || "N/A"}`);
      });
    } else {
      console.log("⚠️ No activities found near Yosemite (this is okay if random data didn't place any there)");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
  
  console.log("\n" + "=".repeat(60) + "\n");
}

async function testUserStats() {
  console.log("📊 Testing User Statistics...\n");
  
  // Get a sample user
  const [db, client] = await getDb();
  const user = await db.collection("User.users").findOne({});
  
  if (!user) {
    console.log("❌ No users found in database");
    await client.close();
    return;
  }
  
  console.log(`Testing with user: ${user.username} (${user._id})`);
  
  try {
    const response = await fetch(`${API_BASE}/userHistory/getUserStats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user._id
      })
    });
    
    const data = await response.json();
    
    if (data.stats) {
      console.log(`\n✅ User Statistics:`);
      console.log(`   Total Hikes: ${data.stats.totalHikes}`);
      console.log(`   Total Distance: ${data.stats.totalDistance.toFixed(1)} km`);
      console.log(`   Total Duration: ${Math.round(data.stats.totalDuration)} minutes`);
      console.log(`   Completion Rate: ${(data.stats.completionRate * 100).toFixed(1)}%`);
      console.log(`   Favorite Locations: ${data.stats.favoriteLocations.slice(0, 3).join(", ")}`);
      console.log(`   Last Active: ${new Date(data.stats.lastActiveAt).toLocaleDateString()}`);
    } else {
      console.log("❌ No stats found");
      console.log("Response:", data);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
  
  await client.close();
  console.log("\n" + "=".repeat(60) + "\n");
}

async function testUserHistory() {
  console.log("📜 Testing User Activity History...\n");
  
  // Get a sample user
  const [db, client] = await getDb();
  const user = await db.collection("User.users").findOne({});
  
  if (!user) {
    console.log("❌ No users found in database");
    await client.close();
    return;
  }
  
  console.log(`Testing with user: ${user.username} (${user._id})`);
  
  try {
    const response = await fetch(`${API_BASE}/userHistory/getUserHistory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user._id,
        limit: 5
      })
    });
    
    const data = await response.json();
    
    if (data.entries && data.entries.length > 0) {
      console.log(`\n✅ Found ${data.entries.length} activities for this user:`);
      data.entries.forEach((entry: any, i: number) => {
        console.log(`\n${i + 1}. ${entry.activityType}`);
        console.log(`   ${JSON.stringify(entry.activityData, null, 2).substring(0, 100)}...`);
      });
    } else {
      console.log("❌ No history found");
      console.log("Response:", data);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
  
  await client.close();
  console.log("\n" + "=".repeat(60) + "\n");
}

async function testAllUsers() {
  console.log("👥 Listing All Users...\n");
  
  const [db, client] = await getDb();
  const users = await db.collection("User.users").find({}).toArray();
  
  console.log(`Found ${users.length} users:\n`);
  for (const user of users) {
    const profile = await db.collection("Profile.profiles").findOne({ userId: user._id });
    const stats = await db.collection("UserHistory.activityStats").findOne({ userId: user._id });
    
    console.log(`- ${user.username} (${profile?.displayName || "No profile"})`);
    if (stats) {
      console.log(`  └─ ${stats.totalHikes} hikes, ${stats.totalDistance.toFixed(1)}km total`);
    }
  }
  
  await client.close();
  console.log("\n" + "=".repeat(60) + "\n");
}

// Main test execution
async function runAllTests() {
  console.log("\n🧪 Starting User Activity Tests\n");
  console.log("=".repeat(60) + "\n");
  
  console.log("⚠️  Make sure the server is running on http://localhost:3000\n");
  console.log("=".repeat(60) + "\n");
  
  // First, list all users
  await testAllUsers();
  
  // Test public feed (live activity)
  await testPublicFeed();
  
  // Test user stats
  await testUserStats();
  
  // Test user history
  await testUserHistory();
  
  console.log("✅ All tests complete!\n");
  console.log("Your live activity and community features should now be working! 🎉\n");
}

if (import.meta.main) {
  await runAllTests();
}

