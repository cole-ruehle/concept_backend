import { Db, MongoClient, ObjectId } from "npm:mongodb";
import { getDb } from "../utils/database.ts";

// Fake user profiles
const FAKE_USERS = [
  { username: "hikeramy", email: "amy@example.com", password: "password123", displayName: "Amy Trail Runner", bio: "Weekend warrior, loves mountain trails", experienceLevel: "advanced" },
  { username: "mountainmike", email: "mike@example.com", password: "password123", displayName: "Mike Mountain", bio: "Climbing peaks one at a time", experienceLevel: "expert" },
  { username: "naturenancy", email: "nancy@example.com", password: "password123", displayName: "Nancy Nature", bio: "Nature photographer and casual hiker", experienceLevel: "beginner" },
  { username: "trailblazer", email: "alex@example.com", password: "password123", displayName: "Alex Trailblazer", bio: "Exploring trails across America", experienceLevel: "intermediate" },
  { username: "outdoorsolivia", email: "olivia@example.com", password: "password123", displayName: "Olivia Outdoor", bio: "Hiking enthusiast from Seattle", experienceLevel: "intermediate" },
  { username: "peaksam", email: "sam@example.com", password: "password123", displayName: "Sam Summiteer", bio: "14er collector", experienceLevel: "advanced" },
  { username: "wanderwill", email: "will@example.com", password: "password123", displayName: "Will Wanderer", bio: "Thru-hiker and trail blogger", experienceLevel: "expert" },
  { username: "hikerhannah", email: "hannah@example.com", password: "password123", displayName: "Hannah Hills", bio: "Family hiking and nature walks", experienceLevel: "beginner" },
  { username: "summitsarah", email: "sarah@example.com", password: "password123", displayName: "Sarah Summit", bio: "Peak bagging in the Rockies", experienceLevel: "advanced" },
  { username: "forestfrank", email: "frank@example.com", password: "password123", displayName: "Frank Forest", bio: "Forest trails and wildlife watching", experienceLevel: "intermediate" },
  { username: "adventureanna", email: "anna@example.com", password: "password123", displayName: "Anna Adventure", bio: "Solo hiker, camp under the stars", experienceLevel: "advanced" },
  { username: "trailerjoe", email: "joe@example.com", password: "password123", displayName: "Joe Trailer", bio: "New to hiking, learning the ropes", experienceLevel: "beginner" },
  { username: "alpineemily", email: "emily@example.com", password: "password123", displayName: "Emily Alpine", bio: "Alpine lakes and mountain passes", experienceLevel: "expert" },
  { username: "ridgerunnerben", email: "ben@example.com", password: "password123", displayName: "Ben Ridge Runner", bio: "Trail running and fast packing", experienceLevel: "advanced" },
  { username: "canyoncarla", email: "carla@example.com", password: "password123", displayName: "Carla Canyon", bio: "Desert hikes and slot canyons", experienceLevel: "intermediate" }
];

// Activity types and their relative frequencies
const ACTIVITY_TYPES = [
  { type: "hike_completed", weight: 40 },
  { type: "route_saved", weight: 25 },
  { type: "route_planned", weight: 20 },
  { type: "trail_rated", weight: 10 },
  { type: "poi_visited", weight: 5 }
];

// Popular hiking locations (subset from generateFakeHikingData.ts)
const POPULAR_LOCATIONS = [
  { name: "Yosemite Valley Trailhead", lat: 37.7489, lon: -119.5890, state: "CA" },
  { name: "Half Dome Trail", lat: 37.7459, lon: -119.5332, state: "CA" },
  { name: "Grand Canyon South Rim Trail", lat: 36.1069, lon: -112.1129, state: "AZ" },
  { name: "Rocky Mountain National Park Trail", lat: 40.3428, lon: -105.6836, state: "CO" },
  { name: "Mount Rainier Skyline Trail", lat: 46.8523, lon: -121.7603, state: "WA" },
  { name: "Zion Narrows Trail", lat: 37.2982, lon: -112.9473, state: "UT" },
  { name: "Crater Lake Rim Trail", lat: 42.8684, lon: -122.1685, state: "OR" },
  { name: "Glacier National Park Going-to-the-Sun", lat: 48.6967, lon: -113.7181, state: "MT" },
  { name: "Grand Teton National Park", lat: 43.7904, lon: -110.6818, state: "WY" },
  { name: "Acadia National Park", lat: 44.3386, lon: -68.2733, state: "ME" },
  { name: "Shenandoah National Park", lat: 38.2928, lon: -78.6795, state: "VA" },
  { name: "Great Smoky Mountains", lat: 35.6532, lon: -83.5070, state: "TN" },
  { name: "Mount Washington", lat: 44.2706, lon: -71.3033, state: "NH" },
  { name: "Big Sur Coastal Trail", lat: 36.2705, lon: -121.8070, state: "CA" },
  { name: "Sedona Cathedral Rock", lat: 34.8697, lon: -111.7603, state: "AZ" },
  { name: "Maroon Bells Scenic Trail", lat: 39.0994, lon: -106.9431, state: "CO" },
  { name: "Olympic National Park Hoh Rainforest", lat: 47.8021, lon: -123.6044, state: "WA" },
  { name: "Bryce Canyon Rim Trail", lat: 37.5930, lon: -112.1871, state: "UT" },
  { name: "Multnomah Falls Trail", lat: 45.5761, lon: -122.1154, state: "OR" },
  { name: "Yellowstone Old Faithful Trail", lat: 44.4605, lon: -110.8281, state: "MT" }
];

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function weightedRandomChoice(choices: { type: string; weight: number }[]): string {
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const choice of choices) {
    random -= choice.weight;
    if (random <= 0) {
      return choice.type;
    }
  }
  
  return choices[0].type;
}

function generateActivityData(activityType: string, location: typeof POPULAR_LOCATIONS[0]): any {
  const routeId = `route_${location.name.toLowerCase().replace(/\s+/g, '_')}_${Math.floor(Math.random() * 1000)}`;
  
  switch (activityType) {
    case "hike_completed":
      return {
        routeId,
        trailName: location.name,
        distance: Math.round((Math.random() * 15 + 2) * 10) / 10, // 2-17 km
        duration: Math.round(Math.random() * 180 + 30), // 30-210 minutes
        elevationGain: Math.round(Math.random() * 1500 + 100), // 100-1600 meters
        difficulty: randomChoice(["easy", "moderate", "hard", "expert"]),
        weatherConditions: randomChoice(["sunny", "partly cloudy", "overcast", "light rain", "clear"]),
        location: location.name
      };
    
    case "route_saved":
      return {
        routeId,
        routeName: `${location.name} Loop`,
        estimatedDuration: Math.round(Math.random() * 120 + 60), // 60-180 minutes
        difficulty: randomChoice(["easy", "moderate", "hard", "expert"]),
        location: location.name
      };
    
    case "route_planned":
      return {
        routeId,
        plannedDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Within next 30 days
        trailName: location.name,
        estimatedDistance: Math.round((Math.random() * 12 + 3) * 10) / 10, // 3-15 km
        location: location.name
      };
    
    case "trail_rated":
      return {
        routeId,
        trailName: location.name,
        rating: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0-5.0 rating
        review: randomChoice([
          "Beautiful scenery and well-maintained trail!",
          "Challenging but rewarding hike.",
          "Great views at the summit!",
          "Perfect for a morning hike.",
          "Trail was muddy but worth it.",
          "Stunning views, highly recommend!",
          "Family-friendly and not too crowded.",
          "Excellent workout with amazing payoff."
        ]),
        location: location.name
      };
    
    case "poi_visited":
      return {
        poiName: `${location.name} Viewpoint`,
        poiType: randomChoice(["viewpoint", "waterfall", "summit", "lake", "campsite"]),
        photos: Math.floor(Math.random() * 5),
        location: location.name
      };
    
    default:
      return { routeId };
  }
}

async function populateUserData() {
  console.log("👥 Starting to populate database with fake user data...");
  
  const [db, client] = await getDb();
  
  try {
    // Clear existing user data
    console.log("🧹 Clearing existing user data...");
    await db.collection("User.users").deleteMany({});
    await db.collection("User.sessions").deleteMany({});
    await db.collection("Profile.profiles").deleteMany({});
    await db.collection("UserHistory.historyEntries").deleteMany({});
    await db.collection("UserHistory.activityStats").deleteMany({});
    
    const userIds: string[] = [];
    
    // Create users and profiles
    console.log("👤 Creating users and profiles...");
    for (const fakeUser of FAKE_USERS) {
      const userId = new ObjectId().toHexString();
      userIds.push(userId);
      
      // Create user
      const passwordHash = await hashPassword(fakeUser.password);
      await db.collection("User.users").insertOne({
        _id: userId,
        username: fakeUser.username,
        passwordHash,
        email: fakeUser.email,
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
      });
      
      // Create profile
      const profileId = new ObjectId().toHexString();
      const homeLocation = randomChoice(POPULAR_LOCATIONS);
      await db.collection("Profile.profiles").insertOne({
        _id: profileId,
        userId,
        displayName: fakeUser.displayName,
        bio: fakeUser.bio,
        experienceLevel: fakeUser.experienceLevel,
        homeLocation: {
          type: "Point",
          coordinates: [homeLocation.lon, homeLocation.lat]
        },
        preferredDifficulty: fakeUser.experienceLevel === "beginner" ? ["easy"] :
                            fakeUser.experienceLevel === "intermediate" ? ["easy", "moderate"] :
                            fakeUser.experienceLevel === "advanced" ? ["moderate", "hard"] :
                            ["hard", "expert"],
        maxDistance: fakeUser.experienceLevel === "beginner" ? 5 :
                    fakeUser.experienceLevel === "intermediate" ? 10 :
                    fakeUser.experienceLevel === "advanced" ? 20 : 30,
        visibility: "public",
        profilePicture: `https://i.pravatar.cc/150?u=${fakeUser.username}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    console.log(`✅ Created ${FAKE_USERS.length} users and profiles`);
    
    // Generate activity history
    console.log("📝 Generating activity history...");
    let totalActivities = 0;
    
    for (const userId of userIds) {
      // Each user gets 10-50 random activities
      const numActivities = Math.floor(Math.random() * 40 + 10);
      
      for (let i = 0; i < numActivities; i++) {
        const activityType = weightedRandomChoice(ACTIVITY_TYPES);
        const location = randomChoice(POPULAR_LOCATIONS);
        const activityData = generateActivityData(activityType, location);
        
        // Generate timestamp within last 90 days
        const timestamp = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
        
        // 80% of activities are public, 20% private
        const visibility = Math.random() < 0.8 ? "public" : "private";
        
        const entryId = new ObjectId().toHexString();
        await db.collection("UserHistory.historyEntries").insertOne({
          _id: entryId,
          userId,
          activityType,
          activityData,
          location: {
            type: "Point",
            coordinates: [location.lon, location.lat]
          },
          timestamp,
          visibility
        });
        
        totalActivities++;
      }
      
      // Create activity stats for each user
      const entries = await db.collection("UserHistory.historyEntries").find({ userId }).toArray();
      const completedHikes = entries.filter((e: any) => e.activityType === "hike_completed");
      
      const totalDistance = completedHikes.reduce((sum: number, e: any) => 
        sum + (e.activityData.distance || 0), 0
      );
      
      const totalDuration = completedHikes.reduce((sum: number, e: any) => 
        sum + (e.activityData.duration || 0), 0
      );
      
      const locationCounts: Record<string, number> = {};
      completedHikes.forEach((e: any) => {
        const loc = e.activityData.location;
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      });
      
      const favoriteLocations = Object.entries(locationCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([loc]) => loc);
      
      const statsId = new ObjectId().toHexString();
      await db.collection("UserHistory.activityStats").insertOne({
        _id: statsId,
        userId,
        totalHikes: completedHikes.length,
        totalDistance,
        totalDuration,
        completionRate: Math.min(0.95, 0.7 + (completedHikes.length * 0.01)),
        favoriteLocations,
        lastActiveAt: entries.length > 0 ? 
          new Date(Math.max(...entries.map((e: any) => e.timestamp.getTime()))) : 
          new Date()
      });
    }
    
    console.log(`✅ Created ${totalActivities} activity entries`);
    console.log(`📊 Created ${userIds.length} activity stat records`);
    
    // Print summary
    console.log("\n📈 Summary:");
    console.log(`   Users: ${FAKE_USERS.length}`);
    console.log(`   Profiles: ${FAKE_USERS.length}`);
    console.log(`   Activities: ${totalActivities}`);
    console.log(`   Public Activities: ${await db.collection("UserHistory.historyEntries").countDocuments({ visibility: "public" })}`);
    
    // Sample some public feed data
    console.log("\n🌍 Sample public feed:");
    const sampleFeed = await db.collection("UserHistory.historyEntries")
      .find({ visibility: "public" })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    
    for (const entry of sampleFeed) {
      const user = await db.collection("User.users").findOne({ _id: entry.userId });
      console.log(`   - ${user?.username}: ${entry.activityType} at ${entry.activityData.location || entry.activityData.trailName}`);
    }
    
    console.log("\n✨ User data population complete!");
    
  } catch (error) {
    console.error("❌ Error populating user data:", error);
    throw error;
  } finally {
    await client.close();
  }
}

// Export the function for use in other scripts
export { populateUserData as generateFakeUserData };

// Run the script
if (import.meta.main) {
  await populateUserData();
}

