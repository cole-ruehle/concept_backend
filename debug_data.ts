import { getDb } from "./src/utils/database.ts";

const [db, client] = await getDb();
const trailhead = await db.collection("trailheads").findOne({});
console.log("Sample trailhead:", JSON.stringify(trailhead, null, 2));
await client.close();

