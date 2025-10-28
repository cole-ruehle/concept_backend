import { getDb } from "./src/utils/database.ts";

const [db, client] = await getDb();

// Check trailheads with transit stops
const trailheadsWithTransit = await db.collection("trailheads").find({
  transit_stops: { $exists: true, $ne: [] }
}).toArray();

console.log("Trailheads with transit stops:", trailheadsWithTransit.length);
trailheadsWithTransit.forEach((th, i) => {
  console.log(`${i + 1}. ${th.name} - Transit stops: ${th.transit_stops?.length || 0}`);
});

// Check all trailheads
const allTrailheads = await db.collection("trailheads").find({}).limit(5).toArray();
console.log("\nAll trailheads (first 5):");
allTrailheads.forEach((th, i) => {
  console.log(`${i + 1}. ${th.name} - Transit stops: ${th.transit_stops?.length || 0}`);
});

await client.close();

