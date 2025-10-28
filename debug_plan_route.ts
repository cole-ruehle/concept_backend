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
  
  // Try to call planRoute directly
  console.log("Calling planRoute...");
  const routeId = await transitPlanner.planRoute(
    origin.lat,
    origin.lon,
    trailheadWithTransit._id.toHexString(),
    480, // 8 hours max travel time
    undefined, // no preferred departure time
    [] // no accessibility requirements
  );
  
  console.log("Route ID:", routeId);
  
} catch (error) {
  console.error("Error details:", error);
  console.error("Error message:", error.message);
  console.error("Error stack:", error.stack);
} finally {
  await client.close();
}

