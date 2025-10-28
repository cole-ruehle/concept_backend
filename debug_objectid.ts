import { getDb } from "./src/utils/database.ts";
import { ObjectId } from "npm:mongodb";

const [db, client] = await getDb();
const trailhead = await db.collection("trailheads").findOne({});

console.log("Trailhead _id type:", typeof trailhead._id);
console.log("Trailhead _id value:", trailhead._id);
console.log("Trailhead _id toString():", trailhead._id.toString());
console.log("Trailhead _id toHexString():", trailhead._id.toHexString());
console.log("ObjectId.isValid(trailhead._id):", ObjectId.isValid(trailhead._id));
console.log("ObjectId.isValid(trailhead._id.toString()):", ObjectId.isValid(trailhead._id.toString()));
console.log("ObjectId.isValid(trailhead._id.toHexString()):", ObjectId.isValid(trailhead._id.toHexString()));

await client.close();

