import { Db, MongoClient, ObjectId } from "npm:mongodb";
import { getDb } from "../utils/database.ts";

// Fake hiking locations across the United States
const FAKE_HIKING_LOCATIONS = [
  // California
  { name: "Yosemite Valley Trailhead", lat: 37.7489, lon: -119.5890, state: "CA", difficulty: "moderate", length: 8.5, elevation: 1200 },
  { name: "Half Dome Trail", lat: 37.7459, lon: -119.5332, state: "CA", difficulty: "hard", length: 16.0, elevation: 1600 },
  { name: "Muir Woods Redwood Trail", lat: 37.8955, lon: -122.5815, state: "CA", difficulty: "easy", length: 2.0, elevation: 100 },
  { name: "Mount Whitney Trail", lat: 36.5785, lon: -118.2920, state: "CA", difficulty: "expert", length: 22.0, elevation: 2100 },
  { name: "Big Sur Coastal Trail", lat: 36.2705, lon: -121.8070, state: "CA", difficulty: "moderate", length: 6.5, elevation: 800 },
  { name: "Joshua Tree Hidden Valley", lat: 33.8734, lon: -115.9010, state: "CA", difficulty: "easy", length: 1.0, elevation: 50 },
  { name: "Point Reyes Lighthouse Trail", lat: 38.1551, lon: -122.9780, state: "CA", difficulty: "easy", length: 0.5, elevation: 20 },
  { name: "Lassen Peak Trail", lat: 40.4882, lon: -121.5054, state: "CA", difficulty: "moderate", length: 5.0, elevation: 2000 },
  { name: "Redwood National Park Trail", lat: 41.2132, lon: -124.0046, state: "CA", difficulty: "easy", length: 3.0, elevation: 150 },
  { name: "Death Valley Badwater Basin", lat: 36.2303, lon: -116.7719, state: "CA", difficulty: "easy", length: 2.0, elevation: -85 },

  // Colorado
  { name: "Rocky Mountain National Park Trail", lat: 40.3428, lon: -105.6836, state: "CO", difficulty: "moderate", length: 4.5, elevation: 1200 },
  { name: "Maroon Bells Scenic Trail", lat: 39.0994, lon: -106.9431, state: "CO", difficulty: "moderate", length: 3.5, elevation: 600 },
  { name: "Garden of the Gods Loop", lat: 38.8800, lon: -104.8750, state: "CO", difficulty: "easy", length: 2.0, elevation: 200 },
  { name: "Hanging Lake Trail", lat: 39.6011, lon: -107.1917, state: "CO", difficulty: "moderate", length: 2.4, elevation: 1000 },
  { name: "Pikes Peak Summit Trail", lat: 38.8409, lon: -105.0423, state: "CO", difficulty: "expert", length: 13.0, elevation: 2400 },
  { name: "Great Sand Dunes Trail", lat: 37.7306, lon: -105.5122, state: "CO", difficulty: "moderate", length: 5.0, elevation: 300 },
  { name: "Mesa Verde Cliff Palace", lat: 37.1661, lon: -108.4610, state: "CO", difficulty: "easy", length: 1.0, elevation: 100 },
  { name: "Black Canyon Trail", lat: 38.5739, lon: -107.7178, state: "CO", difficulty: "hard", length: 8.0, elevation: 1500 },
  { name: "Boulder Flatirons Trail", lat: 39.9991, lon: -105.2917, state: "CO", difficulty: "moderate", length: 6.0, elevation: 1000 },
  { name: "Aspen Maroon Lake Trail", lat: 39.0994, lon: -106.9431, state: "CO", difficulty: "easy", length: 1.5, elevation: 200 },

  // Washington
  { name: "Mount Rainier Skyline Trail", lat: 46.8523, lon: -121.7603, state: "WA", difficulty: "moderate", length: 5.5, elevation: 1700 },
  { name: "Olympic National Park Hoh Rainforest", lat: 47.8021, lon: -123.6044, state: "WA", difficulty: "easy", length: 2.0, elevation: 100 },
  { name: "Mount St. Helens Summit", lat: 46.1914, lon: -122.1956, state: "WA", difficulty: "expert", length: 10.0, elevation: 2200 },
  { name: "North Cascades Trail", lat: 48.7716, lon: -121.2982, state: "WA", difficulty: "hard", length: 12.0, elevation: 1800 },
  { name: "Snoqualmie Falls Trail", lat: 47.5444, lon: -121.8369, state: "WA", difficulty: "easy", length: 1.5, elevation: 200 },
  { name: "Deception Pass Trail", lat: 48.4120, lon: -122.6446, state: "WA", difficulty: "easy", length: 3.0, elevation: 150 },
  { name: "Mount Baker Trail", lat: 48.7767, lon: -121.8144, state: "WA", difficulty: "hard", length: 8.5, elevation: 2000 },
  { name: "San Juan Islands Trail", lat: 48.5313, lon: -123.0326, state: "WA", difficulty: "moderate", length: 4.0, elevation: 400 },
  { name: "Columbia River Gorge Trail", lat: 45.7115, lon: -121.5195, state: "WA", difficulty: "moderate", length: 6.0, elevation: 800 },
  { name: "Mount Pilchuck Trail", lat: 48.0597, lon: -121.8081, state: "WA", difficulty: "moderate", length: 5.5, elevation: 1200 },

  // Oregon
  { name: "Crater Lake Rim Trail", lat: 42.8684, lon: -122.1685, state: "OR", difficulty: "moderate", length: 3.5, elevation: 600 },
  { name: "Multnomah Falls Trail", lat: 45.5761, lon: -122.1154, state: "OR", difficulty: "easy", length: 2.6, elevation: 700 },
  { name: "Mount Hood Timberline Trail", lat: 45.3311, lon: -121.7111, state: "OR", difficulty: "hard", length: 40.0, elevation: 3000 },
  { name: "Cannon Beach Haystack Rock", lat: 45.8843, lon: -123.9682, state: "OR", difficulty: "easy", length: 1.0, elevation: 0 },
  { name: "Smith Rock State Park", lat: 44.3667, lon: -121.1367, state: "OR", difficulty: "moderate", length: 4.0, elevation: 500 },
  { name: "Silver Falls State Park", lat: 44.8767, lon: -122.6517, state: "OR", difficulty: "moderate", length: 7.2, elevation: 800 },
  { name: "Cape Perpetua Trail", lat: 44.2833, lon: -124.1000, state: "OR", difficulty: "moderate", length: 3.0, elevation: 400 },
  { name: "Three Sisters Wilderness", lat: 44.1333, lon: -121.7667, state: "OR", difficulty: "hard", length: 15.0, elevation: 2000 },
  { name: "Wallowa Lake Trail", lat: 45.2667, lon: -117.2167, state: "OR", difficulty: "moderate", length: 5.0, elevation: 600 },
  { name: "Deschutes River Trail", lat: 44.0500, lon: -121.3167, state: "OR", difficulty: "easy", length: 2.5, elevation: 200 },

  // Arizona
  { name: "Grand Canyon South Rim Trail", lat: 36.1069, lon: -112.1129, state: "AZ", difficulty: "moderate", length: 6.0, elevation: 1000 },
  { name: "Havasu Falls Trail", lat: 36.2500, lon: -112.7000, state: "AZ", difficulty: "hard", length: 10.0, elevation: 2000 },
  { name: "Sedona Cathedral Rock", lat: 34.8697, lon: -111.7603, state: "AZ", difficulty: "moderate", length: 3.0, elevation: 600 },
  { name: "Antelope Canyon Trail", lat: 36.8667, lon: -111.3833, state: "AZ", difficulty: "easy", length: 1.0, elevation: 50 },
  { name: "Saguaro National Park", lat: 32.1434, lon: -110.7289, state: "AZ", difficulty: "easy", length: 2.5, elevation: 200 },
  { name: "Monument Valley Trail", lat: 36.9989, lon: -110.1103, state: "AZ", difficulty: "moderate", length: 4.0, elevation: 300 },
  { name: "Camelback Mountain", lat: 33.5083, lon: -111.9667, state: "AZ", difficulty: "hard", length: 2.5, elevation: 1200 },
  { name: "Superstition Mountains", lat: 33.4000, lon: -111.1833, state: "AZ", difficulty: "moderate", length: 5.0, elevation: 800 },
  { name: "Petrified Forest Trail", lat: 35.0833, lon: -109.8000, state: "AZ", difficulty: "easy", length: 1.5, elevation: 100 },
  { name: "Chiricahua National Monument", lat: 32.0167, lon: -109.3500, state: "AZ", difficulty: "moderate", length: 3.5, elevation: 500 },

  // Utah
  { name: "Zion Narrows Trail", lat: 37.2982, lon: -112.9473, state: "UT", difficulty: "hard", length: 16.0, elevation: 400 },
  { name: "Bryce Canyon Rim Trail", lat: 37.5930, lon: -112.1871, state: "UT", difficulty: "moderate", length: 5.5, elevation: 800 },
  { name: "Arches National Park", lat: 38.7331, lon: -109.5925, state: "UT", difficulty: "easy", length: 3.0, elevation: 200 },
  { name: "Capitol Reef National Park", lat: 38.3670, lon: -111.2615, state: "UT", difficulty: "moderate", length: 4.0, elevation: 400 },
  { name: "Canyonlands Island in the Sky", lat: 38.4591, lon: -109.8202, state: "UT", difficulty: "moderate", length: 6.0, elevation: 500 },
  { name: "Goblin Valley State Park", lat: 38.5667, lon: -110.7000, state: "UT", difficulty: "easy", length: 2.0, elevation: 100 },
  { name: "Escalante Grand Staircase", lat: 37.3000, lon: -111.2000, state: "UT", difficulty: "hard", length: 8.0, elevation: 1000 },
  { name: "Antelope Island State Park", lat: 41.0500, lon: -112.2167, state: "UT", difficulty: "easy", length: 3.5, elevation: 200 },
  { name: "Timpanogos Cave Trail", lat: 40.4333, lon: -111.6167, state: "UT", difficulty: "moderate", length: 3.0, elevation: 1000 },
  { name: "Dead Horse Point State Park", lat: 38.5167, lon: -109.8167, state: "UT", difficulty: "easy", length: 2.0, elevation: 100 },

  // Montana
  { name: "Glacier National Park Going-to-the-Sun", lat: 48.6967, lon: -113.7181, state: "MT", difficulty: "moderate", length: 12.0, elevation: 2000 },
  { name: "Yellowstone Old Faithful Trail", lat: 44.4605, lon: -110.8281, state: "MT", difficulty: "easy", length: 2.0, elevation: 100 },
  { name: "Beartooth Highway Trail", lat: 45.0167, lon: -109.9000, state: "MT", difficulty: "moderate", length: 5.0, elevation: 800 },
  { name: "Bob Marshall Wilderness", lat: 47.5000, lon: -113.0000, state: "MT", difficulty: "expert", length: 20.0, elevation: 3000 },
  { name: "Lewis and Clark Caverns", lat: 45.8333, lon: -111.8833, state: "MT", difficulty: "easy", length: 1.5, elevation: 200 },
  { name: "Big Sky Resort Trails", lat: 45.2833, lon: -111.4000, state: "MT", difficulty: "moderate", length: 4.0, elevation: 600 },
  { name: "Flathead Lake Trail", lat: 47.9167, lon: -114.0833, state: "MT", difficulty: "easy", length: 3.0, elevation: 150 },
  { name: "Missouri River Breaks", lat: 47.7833, lon: -108.5000, state: "MT", difficulty: "moderate", length: 6.0, elevation: 400 },
  { name: "Pictograph Cave State Park", lat: 45.6667, lon: -108.5000, state: "MT", difficulty: "easy", length: 1.0, elevation: 50 },
  { name: "Makoshika State Park", lat: 46.4167, lon: -104.3333, state: "MT", difficulty: "moderate", length: 3.5, elevation: 300 },

  // Wyoming
  { name: "Grand Teton National Park", lat: 43.7904, lon: -110.6818, state: "WY", difficulty: "hard", length: 8.0, elevation: 2000 },
  { name: "Yellowstone Grand Prismatic", lat: 44.5250, lon: -110.8381, state: "WY", difficulty: "easy", length: 1.5, elevation: 100 },
  { name: "Devils Tower Trail", lat: 44.5903, lon: -104.7153, state: "WY", difficulty: "moderate", length: 2.0, elevation: 400 },
  { name: "Wind River Range", lat: 43.0000, lon: -109.5000, state: "WY", difficulty: "expert", length: 25.0, elevation: 4000 },
  { name: "Bighorn National Forest", lat: 44.5000, lon: -107.5000, state: "WY", difficulty: "moderate", length: 6.0, elevation: 800 },
  { name: "Flaming Gorge Trail", lat: 41.0000, lon: -109.5000, state: "WY", difficulty: "easy", length: 2.5, elevation: 200 },
  { name: "Medicine Bow National Forest", lat: 41.0000, lon: -106.0000, state: "WY", difficulty: "moderate", length: 4.5, elevation: 600 },
  { name: "Curt Gowdy State Park", lat: 41.1667, lon: -105.1667, state: "WY", difficulty: "easy", length: 3.0, elevation: 300 },
  { name: "Sinks Canyon State Park", lat: 42.7500, lon: -108.7500, state: "WY", difficulty: "moderate", length: 2.0, elevation: 400 },
  { name: "Hot Springs State Park", lat: 43.6667, lon: -108.1667, state: "WY", difficulty: "easy", length: 1.0, elevation: 50 },

  // Alaska
  { name: "Denali National Park Trail", lat: 63.1148, lon: -151.1926, state: "AK", difficulty: "expert", length: 30.0, elevation: 5000 },
  { name: "Kenai Fjords National Park", lat: 59.9208, lon: -149.4811, state: "AK", difficulty: "moderate", length: 8.0, elevation: 1000 },
  { name: "Tongass National Forest", lat: 58.3019, lon: -134.4197, state: "AK", difficulty: "hard", length: 12.0, elevation: 1500 },
  { name: "Chugach State Park", lat: 61.1667, lon: -149.6667, state: "AK", difficulty: "moderate", length: 6.0, elevation: 800 },
  { name: "Wrangell-St. Elias National Park", lat: 61.2000, lon: -142.0000, state: "AK", difficulty: "expert", length: 20.0, elevation: 3000 },
  { name: "Kodiak Island Trail", lat: 57.7900, lon: -152.4072, state: "AK", difficulty: "moderate", length: 5.0, elevation: 600 },
  { name: "Sitka National Historical Park", lat: 57.0500, lon: -135.3333, state: "AK", difficulty: "easy", length: 2.0, elevation: 100 },
  { name: "Mendenhall Glacier Trail", lat: 58.4167, lon: -134.5667, state: "AK", difficulty: "moderate", length: 3.5, elevation: 500 },
  { name: "Harding Icefield Trail", lat: 60.0833, lon: -149.4167, state: "AK", difficulty: "hard", length: 8.4, elevation: 1000 },
  { name: "Exit Glacier Trail", lat: 60.1833, lon: -149.6500, state: "AK", difficulty: "easy", length: 2.0, elevation: 200 },

  // Texas
  { name: "Big Bend National Park", lat: 29.1275, lon: -103.2425, state: "TX", difficulty: "moderate", length: 6.0, elevation: 800 },
  { name: "Guadalupe Mountains National Park", lat: 31.9167, lon: -104.8667, state: "TX", difficulty: "hard", length: 8.5, elevation: 2000 },
  { name: "Palo Duro Canyon Trail", lat: 34.9500, lon: -101.6667, state: "TX", difficulty: "moderate", length: 4.0, elevation: 600 },
  { name: "Enchanted Rock State Park", lat: 30.5000, lon: -98.8167, state: "TX", difficulty: "moderate", length: 3.0, elevation: 500 },
  { name: "Pedernales Falls State Park", lat: 30.3167, lon: -98.2500, state: "TX", difficulty: "easy", length: 2.5, elevation: 200 },
  { name: "Lost Maples State Park", lat: 29.8167, lon: -99.5833, state: "TX", difficulty: "moderate", length: 5.0, elevation: 400 },
  { name: "Caprock Canyons State Park", lat: 34.4167, lon: -101.0833, state: "TX", difficulty: "moderate", length: 3.5, elevation: 300 },
  { name: "Brazos Bend State Park", lat: 29.3333, lon: -95.5833, state: "TX", difficulty: "easy", length: 2.0, elevation: 50 },
  { name: "Davis Mountains State Park", lat: 30.5833, lon: -104.0000, state: "TX", difficulty: "moderate", length: 4.5, elevation: 700 },
  { name: "Garner State Park", lat: 29.5833, lon: -99.7500, state: "TX", difficulty: "easy", length: 2.0, elevation: 150 },

  // Florida
  { name: "Everglades National Park", lat: 25.2867, lon: -80.8987, state: "FL", difficulty: "easy", length: 3.0, elevation: 0 },
  { name: "Big Cypress National Preserve", lat: 26.0000, lon: -81.0000, state: "FL", difficulty: "easy", length: 2.5, elevation: 10 },
  { name: "Apalachicola National Forest", lat: 30.0000, lon: -84.5000, state: "FL", difficulty: "moderate", length: 4.0, elevation: 100 },
  { name: "Ocala National Forest", lat: 29.1667, lon: -81.6667, state: "FL", difficulty: "easy", length: 3.5, elevation: 50 },
  { name: "Canaveral National Seashore", lat: 28.7500, lon: -80.7500, state: "FL", difficulty: "easy", length: 2.0, elevation: 0 },
  { name: "Myakka River State Park", lat: 27.2500, lon: -82.2500, state: "FL", difficulty: "easy", length: 2.5, elevation: 25 },
  { name: "Paynes Prairie Preserve", lat: 29.5833, lon: -82.2500, state: "FL", difficulty: "easy", length: 1.5, elevation: 20 },
  { name: "Fakahatchee Strand", lat: 26.0000, lon: -81.4167, state: "FL", difficulty: "moderate", length: 3.0, elevation: 30 },
  { name: "Corkscrew Swamp Sanctuary", lat: 26.2500, lon: -81.5833, state: "FL", difficulty: "easy", length: 2.2, elevation: 15 },
  { name: "Loxahatchee National Wildlife Refuge", lat: 26.5000, lon: -80.3333, state: "FL", difficulty: "easy", length: 1.8, elevation: 5 }
];

// Fake transit stops near major cities
const FAKE_TRANSIT_STOPS = [
  { name: "San Francisco Downtown Transit Center", lat: 37.7749, lon: -122.4194, routes: ["BART", "Muni", "Caltrain"] },
  { name: "Los Angeles Union Station", lat: 34.0560, lon: -118.2340, routes: ["Metro", "Amtrak", "Metrolink"] },
  { name: "Seattle King Street Station", lat: 47.5985, lon: -122.3301, routes: ["Sound Transit", "Amtrak", "Link Light Rail"] },
  { name: "Denver Union Station", lat: 39.7528, lon: -104.9997, routes: ["RTD", "Amtrak", "Light Rail"] },
  { name: "Portland Union Station", lat: 45.5285, lon: -122.6765, routes: ["TriMet", "Amtrak", "MAX Light Rail"] },
  { name: "Phoenix Central Station", lat: 33.4484, lon: -112.0740, routes: ["Valley Metro", "Amtrak", "Light Rail"] },
  { name: "Salt Lake City Intermodal Hub", lat: 40.7608, lon: -111.8910, routes: ["UTA", "Amtrak", "TRAX"] },
  { name: "Billings Transit Center", lat: 45.7833, lon: -108.5000, routes: ["Metro", "Greyhound"] },
  { name: "Jackson Hole Transit Center", lat: 43.4799, lon: -110.7624, routes: ["START", "Greyhound"] },
  { name: "Anchorage Transit Center", lat: 61.2181, lon: -149.9003, routes: ["People Mover", "Greyhound"] },
  { name: "Austin Downtown Station", lat: 30.2672, lon: -97.7431, routes: ["CapMetro", "Amtrak"] },
  { name: "Miami Central Station", lat: 25.7617, lon: -80.1918, routes: ["Metrorail", "Tri-Rail", "Amtrak"] }
];

async function populateDatabase() {
  console.log("🌲 Starting to populate database with fake hiking data...");
  
  const [db, client] = await getDb();
  
  try {
    // Ensure collections exist
    await ensureCollections(db);
    
    // Clear existing data
    console.log("🧹 Clearing existing data...");
    await db.collection("trailheads").deleteMany({});
    await db.collection("trails").deleteMany({});
    await db.collection("transit_stops").deleteMany({});
    
    // Insert trails first (we need their IDs for trailheads)
    console.log("🥾 Inserting trails...");
    const trailDocs = FAKE_HIKING_LOCATIONS.map((location, index) => ({
      _id: new ObjectId(),
      name: `${location.name} Trail`,
      minutes: Math.round(location.length * 20), // Rough estimate: 20 min per mile
      description: `A ${location.difficulty} ${location.length}-mile trail in ${location.state} with ${location.elevation}ft elevation gain.`,
      difficulty: location.difficulty,
      length: location.length * 1609.34, // Convert miles to meters
      elevation_gain: location.elevation,
      surface: location.difficulty === "easy" ? "paved" : "dirt",
      condition: "open" as const,
      last_updated: new Date().toISOString()
    }));
    
    await db.collection("trails").insertMany(trailDocs);
    
    // Insert trailheads (using actual trail ObjectIds)
    console.log("🏔️ Inserting trailheads...");
    const trailheadDocs = FAKE_HIKING_LOCATIONS.map((location, index) => ({
      _id: new ObjectId(),
      name: location.name,
      loc: {
        type: "Point",
        coordinates: [location.lon, location.lat]
      },
      connectingTrailIds: [trailDocs[index]._id.toHexString()],
      parking: Math.random() > 0.3, // 70% have parking
      facilities: Math.random() > 0.5 ? ["restroom", "water"] : ["restroom"],
      accessibility: Math.random() > 0.7 ? ["wheelchair"] : [],
      transit_stops: [],
      trails: [trailDocs[index]._id.toHexString()],
      tags: {
        state: location.state,
        difficulty: location.difficulty,
        elevation_gain: location.elevation.toString()
      }
    }));
    
    await db.collection("trailheads").insertMany(trailheadDocs);
    
    // Insert transit stops
    console.log("🚌 Inserting transit stops...");
    const transitDocs = FAKE_TRANSIT_STOPS.map((stop, index) => ({
      _id: new ObjectId(),
      name: stop.name,
      loc: {
        type: "Point",
        coordinates: [stop.lon, stop.lat]
      },
      routes: stop.routes,
      wheelchair_accessible: Math.random() > 0.2, // 80% accessible
      shelter: Math.random() > 0.4, // 60% have shelter
      real_time_info: Math.random() > 0.3, // 70% have real-time info
      tags: {
        city: stop.name.split(" ")[0] + " " + stop.name.split(" ")[1],
        type: "transit_center"
      }
    }));
    
    await db.collection("transit_stops").insertMany(transitDocs);
    
    // Link some trailheads to nearby transit stops
    console.log("🔗 Linking trailheads to transit stops...");
    for (const trailhead of trailheadDocs) {
      const [lon, lat] = trailhead.loc.coordinates;
      
      // Find nearby transit stops (within ~50 miles)
      const nearbyStops = transitDocs.filter(stop => {
        const [stopLon, stopLat] = stop.loc.coordinates;
        const distance = calculateDistance(lat, lon, stopLat, stopLon);
        return distance < 80467; // ~50 miles in meters
      });
      
      if (nearbyStops.length > 0) {
        const closestStop = nearbyStops[0];
        await db.collection("trailheads").updateOne(
          { _id: trailhead._id },
          { $set: { transit_stops: [closestStop._id.toHexString()] } }
        );
      }
    }
    
    console.log("✅ Database populated successfully!");
    console.log(`📊 Inserted ${trailheadDocs.length} trailheads, ${trailDocs.length} trails, and ${transitDocs.length} transit stops`);
    
  } catch (error) {
    console.error("❌ Error populating database:", error);
    throw error;
  } finally {
    await client.close();
  }
}

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Ensure collections exist
async function ensureCollections(db: Db) {
  const collections = [
    {
      name: "trailheads",
      indexes: [
        { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
        { key: { name: 1 }, name: "name_unique", unique: true }
      ]
    },
    {
      name: "trails", 
      indexes: [
        { key: { name: 1 }, name: "name_idx" },
        { key: { difficulty: 1 }, name: "difficulty_idx" }
      ]
    },
    {
      name: "transit_stops",
      indexes: [
        { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
        { key: { name: 1 }, name: "name_unique", unique: true }
      ]
    }
  ];

  for (const collection of collections) {
    try {
      await db.createCollection(collection.name);
    } catch (error) {
      if (error.code !== 48) { // NamespaceExists error
        console.warn(`Could not create collection ${collection.name}:`, error);
      }
    }

    try {
      await db.collection(collection.name).createIndexes(collection.indexes);
    } catch (error) {
      console.warn(`Could not create indexes for ${collection.name}:`, error);
    }
  }
}

// Export the function for use in other scripts
export { populateDatabase as generateFakeHikingData };

// Run the script
if (import.meta.main) {
  await populateDatabase();
}
