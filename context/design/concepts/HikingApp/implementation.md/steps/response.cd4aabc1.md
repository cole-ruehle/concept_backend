---
timestamp: 'Thu Oct 16 2025 19:09:31 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_190931.a6a37bf8.md]]'
content_id: cd4aabc1ef3848eb82053d6d6c651d87a9e7ea18ff7d4d2ceead86eb5ca4566c
---

# response:

Answering the first request for the implementation file `/src/concepts/HikingApp.ts`.

```typescript
// /src/concepts/HikingApp.ts

/**
 * Implements the TransitRoutePlanner concept for the TrailLink application.
 *
 * This module provides the HikingAppConcept class, which is responsible for planning
 * multi-modal routes that combine public transportation with hiking. It is a minimal
 * implementation focusing on the core state and actions specified.
 *
 * Environment Variables:
 * - MONGODB_URL: The connection string for the MongoDB Atlas database.
 * - DB_NAME: The name of the database to use.
 * - GEMINI_API_KEY: (Optional) The API key for Google Gemini to enable LLM features.
 *
 * Collections Used:
 * - `hiking_app_trailheads`: Stores information about trailheads.
 *   - Fields: { _id, name, location }
 *   - Indexes:
 *     - `{ name: 1 }` (unique)
 *     - `{ location: "2dsphere" }`
 * - `hiking_app_planned_routes`: Stores the details of routes planned by users.
 *   - Fields: { _id, origin, trailheadId, constraints, totalDurationMinutes, description, summary, transitSegments, hikingSegments, createdAt }
 *   - Indexes: None.
 *
 * Construction:
 * To create an instance, first connect to MongoDB, then instantiate the class.
 *
 * import { MongoClient } from "npm:mongo";
 * import { HikingAppConcept, ensureCollections, makeGeminiLLM, connectMongo } from "./HikingApp.ts";
 *
 * // Assumes .env file is loaded or env vars are set
 * const db = await connectMongo(Deno.env.get("MONGODB_URL")!, Deno.env.get("DB_NAME")!);
 * await ensureCollections(db);
 *
 * // Without LLM
 * const app = new HikingAppConcept(db);
 *
 * // With LLM
 * const geminiKey = Deno.env.get("GEMINI_API_KEY");
 * const llm = geminiKey ? makeGeminiLLM(geminiKey) : undefined;
 * const appWithLlm = new HikingAppConcept(db, llm);
 *
 */

import {
  Collection,
  Db,
  MongoClient,
  ObjectId,
  MongoError,
} from "npm:mongo";

// --- Custom Errors ---

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

// --- LLM Adapter ---

export interface HikingAppLLM {
  summarize?(input: string): Promise<string>;
  classify?(input: string): Promise<string>;
}

export function makeGeminiLLM(
  apiKey: string,
  model = "gemini-1.5-flash",
): HikingAppLLM {
  const anemicError = (json: any) =>
    new Error(`Gemini API Error: ${JSON.stringify(json)}`);

  return {
    async summarize(input: string): Promise<string> {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{
          parts: [{
            text: `Summarize this route plan in one sentence for a hiker: ${input}`,
          }],
        }],
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Gemini API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw anemicError(data);
      }
      return text.trim();
    },
    async classify(input: string): Promise<string> {
      // A placeholder implementation for the classify function.
      const classifications = ["easy", "moderate", "hard"];
      return classifications[input.length % 3];
    },
  };
}

// --- Persistence ---

let memoizedDb: Db | null = null;
let memoizedClient: MongoClient | null = null;

export async function connectMongo(
  mongoUrl: string,
  dbName: string,
): Promise<Db> {
  if (memoizedDb) {
    return memoizedDb;
  }
  const client = new MongoClient(mongoUrl);
  await client.connect();
  memoizedClient = client;
  memoizedDb = client.db(dbName);
  return memoizedDb;
}

export const HIKING_APP_TRAILHEADS = "hiking_app_trailheads";
export const HIKING_APP_PLANNED_ROUTES = "hiking_app_planned_routes";

// Define schema interfaces for internal use
interface TrailheadSchema {
  _id: ObjectId;
  name: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

interface PlannedRouteSchema {
  _id: ObjectId;
  origin: {
    type: "Point";
    coordinates: [number, number];
  };
  trailheadId: ObjectId;
  constraints: {
    maxTravelTimeMinutes: number;
    preferredDepartureTimeISO?: string;
    accessibilityRequirements?: string[];
  };
  totalDurationMinutes: number;
  description: string;
  summary?: string;
  transitSegments: object[];
  hikingSegments: object[];
  createdAt: Date;
}

export async function ensureCollections(db: Db): Promise<void> {
  const collectionNames = (await db.listCollections().toArray()).map(c => c.name);

  if (!collectionNames.includes(HIKING_APP_TRAILHEADS)) {
      await db.createCollection(HIKING_APP_TRAILHEADS);
      await db.collection(HIKING_APP_TRAILHEADS).createIndexes([
          { key: { name: 1 }, name: "name_unique", unique: true },
          { key: { location: "2dsphere" }, name: "location_geo" },
      ]);
  }
   if (!collectionNames.includes(HIKING_APP_PLANNED_ROUTES)) {
       await db.createCollection(HIKING_APP_PLANNED_ROUTES);
   }
}


// --- Concept Implementation (TransitRoutePlanner) ---

export class HikingAppConcept {
  private trailheads: Collection<TrailheadSchema>;
  private plannedRoutes: Collection<PlannedRouteSchema>;

  constructor(db: Db, private llm?: HikingAppLLM) {
    this.trailheads = db.collection<TrailheadSchema>(HIKING_APP_TRAILHEADS);
    this.plannedRoutes = db.collection<PlannedRouteSchema>(
      HIKING_APP_PLANNED_ROUTES,
    );
  }

  /**
   * Plans a multi-modal route from an origin to a trailhead based on constraints.
   */
  async planRoute(
    origin: { latitude: number; longitude: number },
    trailheadId: string,
    constraints: {
      maxTravelTimeMinutes: number;
      preferredDepartureTimeISO?: string;
      accessibilityRequirements?: string[];
    },
  ): Promise<string> {
    this._validatePlanRouteInput(origin, trailheadId, constraints);
    const trailheadOid = this._toObjectId(trailheadId);

    const trailhead = await this.trailheads.findOne({ _id: trailheadOid });
    if (!trailhead) {
      throw new NotFoundError(`Trailhead with id "${trailheadId}" not found.`);
    }

    const transitTimeMinutes = 60; // Simulation: 30 mins each way
    const hikingTimeMinutes = constraints.maxTravelTimeMinutes - transitTimeMinutes;

    if (hikingTimeMinutes <= 0) {
      throw new ValidationError(
        `maxTravelTimeMinutes (${constraints.maxTravelTimeMinutes}) is not sufficient for a round trip transit time of ${transitTimeMinutes} minutes.`,
      );
    }

    const description =
      `A hike at ${trailhead.name} starting from your location, with a total trip time under ${constraints.maxTravelTimeMinutes} minutes, allowing for approximately ${hikingTimeMinutes} minutes of hiking.`;

    let summary: string | undefined;
    if (this.llm?.summarize) {
      try {
        summary = await this.llm.summarize(description);
      } catch (error) {
        console.warn("LLM summarize call failed:", error.message);
      }
    }

    const newRoute: Omit<PlannedRouteSchema, "_id"> = {
      origin: {
        type: "Point",
        coordinates: [origin.longitude, origin.latitude],
      },
      trailheadId: trailheadOid,
      constraints,
      totalDurationMinutes: constraints.maxTravelTimeMinutes,
      description,
      summary,
      transitSegments: [{ type: "bus", duration: 30 }, {
        type: "bus",
        duration: 30,
      }],
      hikingSegments: [{ type: "loop", duration: hikingTimeMinutes }],
      createdAt: new Date(),
    };

    const insertResult = await this.plannedRoutes.insertOne(
      newRoute as PlannedRouteSchema,
    );
    return insertResult.toString();
  }

  /**
   * Finds alternative routes based on a given route and a simple criterion.
   */
  async getAlternativeRoutes(
    plannedRouteId: string,
    criteria: string,
  ): Promise<string[]> {
    this._validateGetAlternativeRoutesInput(plannedRouteId, criteria);
    const routeOid = this._toObjectId(plannedRouteId);

    const originalRoute = await this.plannedRoutes.findOne({ _id: routeOid });
    if (!originalRoute) {
      throw new NotFoundError(
        `Planned route with id "${plannedRouteId}" not found.`,
      );
    }

    const alternativeRoute = { ...originalRoute };
    delete (alternativeRoute as any)._id;
    alternativeRoute.createdAt = new Date();

    const trailheadName = await this._getTrailheadName(originalRoute.trailheadId);

    switch (criteria) {
      case "faster":
        alternativeRoute.totalDurationMinutes = Math.floor(
          originalRoute.totalDurationMinutes * 0.9,
        );
        alternativeRoute.description =
          `A faster version of your route to ${trailheadName}.`;
        break;
      case "shorter":
        alternativeRoute.totalDurationMinutes = Math.floor(
          originalRoute.totalDurationMinutes * 0.8,
        );
        (alternativeRoute.hikingSegments[0] as any).duration *= 0.7;
        alternativeRoute.description =
          `A shorter hike version of your route to ${trailheadName}.`;
        break;
      case "scenic":
        alternativeRoute.totalDurationMinutes = Math.floor(
          originalRoute.totalDurationMinutes * 1.1,
        );
        alternativeRoute.description =
          `A more scenic (and slightly longer) version of your route to ${trailheadName}.`;
        break;
      default:
        return [];
    }

    const insertResult = await this.plannedRoutes.insertOne(
      alternativeRoute as PlannedRouteSchema,
    );
    return [insertResult.toString()];
  }

  /**
   * Updates the constraints of an existing planned route.
   * Returns the ID of the updated route, or null if the new constraints are impossible.
   */
  async updateRouteConstraints(
    plannedRouteId: string,
    newConstraints: {
      maxTravelTimeMinutes?: number;
      preferredDepartureTimeISO?: string;
    },
  ): Promise<string | null> {
    this._validateUpdateRouteConstraintsInput(plannedRouteId, newConstraints);
    const routeOid = this._toObjectId(plannedRouteId);

    const originalRoute = await this.plannedRoutes.findOne({ _id: routeOid });
    if (!originalRoute) {
      throw new NotFoundError(
        `Planned route with id "${plannedRouteId}" not found.`,
      );
    }

    const updatedConstraints = { ...originalRoute.constraints, ...newConstraints };
    const transitTimeMinutes = 60;
    const newHikingTime = updatedConstraints.maxTravelTimeMinutes - transitTimeMinutes;

    if (newHikingTime <= 0) {
      return null; // New constraints make the hike impossible.
    }

    await this.plannedRoutes.updateOne(
      { _id: routeOid },
      {
        $set: {
          constraints: updatedConstraints,
          totalDurationMinutes: updatedConstraints.maxTravelTimeMinutes,
          "hikingSegments.0.duration": newHikingTime,
        },
      },
    );

    return plannedRouteId;
  }

  // --- Private Helpers ---

  private _toObjectId(id: string): ObjectId {
    if (!ObjectId.isValid(id)) {
      throw new ValidationError(`Invalid ID format: "${id}"`);
    }
    return new ObjectId(id);
  }

  private async _getTrailheadName(id: ObjectId): Promise<string> {
    const trailhead = await this.trailheads.findOne({ _id: id }, {
      projection: { name: 1 },
    });
    return trailhead?.name ?? "an unknown trailhead";
  }

  private _validatePlanRouteInput(
    origin: any,
    trailheadId: any,
    constraints: any,
  ): void {
    if (
      !origin?.latitude || !origin?.longitude ||
      typeof origin.latitude !== "number" ||
      typeof origin.longitude !== "number"
    ) {
      throw new ValidationError(
        "Origin must be an object with numeric latitude and longitude properties.",
      );
    }
    if (typeof trailheadId !== "string" || trailheadId.length === 0) {
      throw new ValidationError("trailheadId must be a non-empty string.");
    }
    if (
      !constraints?.maxTravelTimeMinutes ||
      typeof constraints.maxTravelTimeMinutes !== "number" ||
      constraints.maxTravelTimeMinutes <= 0
    ) {
      throw new ValidationError(
        "constraints.maxTravelTimeMinutes must be a positive number.",
      );
    }
  }

  private _validateGetAlternativeRoutesInput(
    plannedRouteId: any,
    criteria: any,
  ): void {
    if (typeof plannedRouteId !== "string" || plannedRouteId.length === 0) {
      throw new ValidationError("plannedRouteId must be a non-empty string.");
    }
    const validCriteria = ["faster", "shorter", "scenic"];
    if (typeof criteria !== "string" || !validCriteria.includes(criteria)) {
      throw new ValidationError(
        `Criteria must be one of: ${validCriteria.join(", ")}.`,
      );
    }
  }

  private _validateUpdateRouteConstraintsInput(
    plannedRouteId: any,
    newConstraints: any,
  ): void {
    if (typeof plannedRouteId !== "string" || plannedRouteId.length === 0) {
      throw new ValidationError("plannedRouteId must be a non-empty string.");
    }
    if (
      !newConstraints || typeof newConstraints !== "object" ||
      Object.keys(newConstraints).length === 0
    ) {
      throw new ValidationError("newConstraints must be a non-empty object.");
    }
    if (
      newConstraints.maxTravelTimeMinutes !== undefined &&
      (typeof newConstraints.maxTravelTimeMinutes !== "number" ||
        newConstraints.maxTravelTimeMinutes <= 0)
    ) {
      throw new ValidationError(
        "If provided, maxTravelTimeMinutes must be a positive number.",
      );
    }
    if (
      newConstraints.preferredDepartureTimeISO !== undefined &&
      typeof newConstraints.preferredDepartureTimeISO !== "string"
    ) {
      throw new ValidationError(
        "If provided, preferredDepartureTimeISO must be a string.",
      );
    }
  }
}
```
