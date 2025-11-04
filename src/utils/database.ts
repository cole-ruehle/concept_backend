// This import loads the `.env` file as environment variables
import "jsr:@std/dotenv/load";
import { Db, MongoClient } from "npm:mongodb";
import { ID } from "@utils/types.ts";
import { generate } from "jsr:@std/uuid/unstable-v7";
import { 
  MapTileDoc, 
  POICacheDoc, 
  TrailCacheDoc, 
  GeocodingCacheDoc, 
  RouteCacheDoc 
} from "./mappingTypes.ts";

async function initMongoClient() {
  const DB_CONN = Deno.env.get("MONGODB_URL");
  if (DB_CONN === undefined) {
    throw new Error("Could not find environment variable: MONGODB_URL");
  }
  const client = new MongoClient(DB_CONN);
  try {
    await client.connect();
  } catch (e) {
    throw new Error("MongoDB connection failed: " + e);
  }
  return client;
}

async function init() {
  const client = await initMongoClient();
  const DB_NAME = Deno.env.get("DB_NAME");
  if (DB_NAME === undefined) {
    throw new Error("Could not find environment variable: DB_NAME");
  }
  return [client, DB_NAME] as [MongoClient, string];
}

async function dropAllCollections(db: Db): Promise<void> {
  try {
    // Get all collection names
    const collections = await db.listCollections().toArray();

    // Drop each collection
    for (const collection of collections) {
      await db.collection(collection.name).drop();
    }
  } catch (error) {
    console.error("Error dropping collections:", error);
    throw error;
  }
}

/**
 * MongoDB database configured by .env
 * @returns {[Db, MongoClient]} initialized database and client
 */
export async function getDb() {
  const [client, DB_NAME] = await init();
  return [client.db(DB_NAME), client] as [Db, MongoClient];
}

/**
 * Test database initialization
 * @returns {[Db, MongoClient]} initialized test database and client
 */
export async function testDb() {
  const [client, DB_NAME] = await init();
  const test_DB_NAME = `test-${DB_NAME}`;
  const test_Db = client.db(test_DB_NAME);
  await dropAllCollections(test_Db);
  return [test_Db, client] as [Db, MongoClient];
}

/**
 * Creates a fresh ID.
 * @returns {ID} UUID v7 generic ID.
 */
export function freshID() {
  return generate() as ID;
}

/**
 * Ensure mapping-related collections exist with proper indexes
 */
export async function ensureMappingCollections(db: Db): Promise<void> {
  const collections = [
    {
      name: "map_tiles",
      indexes: [
        { key: { z: 1, x: 1, y: 1 }, name: "tile_coords", unique: true },
        { key: { expires_at: 1 }, name: "expires_at" }
      ]
    },
    {
      name: "poi_cache",
      indexes: [
        { key: { query_hash: 1 }, name: "query_hash", unique: true },
        { key: { expires_at: 1 }, name: "expires_at" },
        { key: { "bbox.north": 1, "bbox.south": 1, "bbox.east": 1, "bbox.west": 1 }, name: "bbox_2d" }
      ]
    },
    {
      name: "trail_cache",
      indexes: [
        { key: { trail_id: 1 }, name: "trail_id", unique: true },
        { key: { expires_at: 1 }, name: "expires_at" },
        { key: { "bbox.north": 1, "bbox.south": 1, "bbox.east": 1, "bbox.west": 1 }, name: "bbox_2d" }
      ]
    },
    {
      name: "geocoding_cache",
      indexes: [
        { key: { query_hash: 1 }, name: "query_hash", unique: true },
        { key: { expires_at: 1 }, name: "expires_at" },
        { key: { query_type: 1 }, name: "query_type" }
      ]
    },
    {
      name: "route_cache",
      indexes: [
        { key: { route_hash: 1 }, name: "route_hash", unique: true },
        { key: { expires_at: 1 }, name: "expires_at" },
        { key: { mode: 1 }, name: "mode" },
        { key: { "origin.lat": 1, "origin.lon": 1 }, name: "origin_2d" }
      ]
    }
  ];

  for (const collection of collections) {
    try {
      // Create collection if it doesn't exist
      await db.createCollection(collection.name);
    } catch (error) {
      // Collection might already exist, which is fine
      if (error.code !== 48) { // NamespaceExists error
        console.warn(`Could not create collection ${collection.name}:`, error);
      }
    }

    // Create indexes
    try {
      await db.collection(collection.name).createIndexes(collection.indexes);
    } catch (error) {
      console.warn(`Could not create indexes for ${collection.name}:`, error);
    }
  }
}

/**
 * Get mapping collections with proper typing
 */
export function getMappingCollections(db: Db) {
  return {
    mapTiles: db.collection<MapTileDoc>("map_tiles"),
    poiCache: db.collection<POICacheDoc>("poi_cache"),
    trailCache: db.collection<TrailCacheDoc>("trail_cache"),
    geocodingCache: db.collection<GeocodingCacheDoc>("geocoding_cache"),
    routeCache: db.collection<RouteCacheDoc>("route_cache")
  };
}
