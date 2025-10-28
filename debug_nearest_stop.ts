import { getDb } from "./src/utils/database.ts";

const [db, client] = await getDb();

try {
  const origin = { lat: 37.7749, lon: -122.4194 };
  const originCoords: [number, number] = [origin.lon, origin.lat];
  
  console.log("Searching for nearest stop to:", originCoords);
  
  // Try the exact query from TransitRoutePlanner
  const stop = await db.collection("transit_stops").findOne({
    loc: { $near: { $geometry: { type: "Point", coordinates: originCoords } } }
  });
  
  if (stop) {
    console.log("Found nearest stop:", stop.name);
    console.log("Stop location:", stop.loc);
  } else {
    console.log("No stop found with $near query");
    
    // Try a simpler query
    const allStops = await db.collection("transit_stops").find({}).toArray();
    console.log("All stops:", allStops.map(s => s.name));
    
    // Check if the 2dsphere index exists
    const indexes = await db.collection("transit_stops").listIndexes().toArray();
    console.log("Indexes:", indexes.map(i => i.name));
  }
  
} catch (error) {
  console.error("Error:", error);
} finally {
  await client.close();
}

