import { getDb } from "./src/utils/database.ts";
import { TransitRoutePlannerConcept } from "./src/concepts/HikingApp/TransitRoutePlanner.ts";

const [db, client] = await getDb();

try {
  const transitPlanner = new TransitRoutePlannerConcept(db);
  
  // Get a trailhead with transit access
  const trailheadWithTransit = await db.collection("trailheads").findOne({
    transit_stops: { $exists: true, $ne: [] }
  });
  
  console.log("Trailhead:", trailheadWithTransit.name);
  console.log("Trailhead ID:", trailheadWithTransit._id.toHexString());
  
  // Test the internal method that finds nearest stop
  const origin = { lat: 37.7749, lon: -122.4194 };
  console.log("Origin:", origin);
  
  // Check if there are any transit stops in the database
  const transitStops = await db.collection("transit_stops").find({}).toArray();
  console.log("Transit stops count:", transitStops.length);
  
  if (transitStops.length > 0) {
    console.log("First transit stop:", transitStops[0].name);
    console.log("First transit stop location:", transitStops[0].loc);
  }
  
} catch (error) {
  console.error("Error:", error);
} finally {
  await client.close();
}

