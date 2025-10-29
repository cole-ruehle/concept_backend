
import {
  MongoClient,
  Db,
  Collection,
  ObjectId,
} from "npm:mongodb";

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

// --- LLM Adapter (Optional) ---
export interface TransitRoutePlannerLLM {
  classifyScenic(trailName: string, trailDescription?: string): Promise<boolean>;
}

export function makeGeminiLLM(
  apiKey: string,
  model = "gemini-1.5-flash",
): TransitRoutePlannerLLM {
  const API_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  return {
    async classifyScenic(
      trailName: string,
      trailDescription?: string,
    ): Promise<boolean> {
      const prompt =
        `Is the following hiking trail likely to be scenic? Answer only "true" or "false".\n\nTrail Name: ${trailName}\nDescription: ${
          trailDescription || "No description provided."
        }`;

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 5,
            },
          }),
        });

        if (!response.ok) {
          console.error("Gemini API request failed:", await response.text());
          return false; // Default to not scenic on API failure
        }

        const data = await response.json();
        const text =
          data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() ||
          "";
        return text === "true";
      } catch (error) {
        console.error("Error calling Gemini API:", error);
        return false;
      }
    },
  };
}

// --- Constants & Database Setup ---
export const TRANSIT_STOPS_COLLECTION = "transit_stops";
export const TRAILHEADS_COLLECTION = "trailheads";
export const TRAILS_COLLECTION = "trails";
export const PLANNED_ROUTES_COLLECTION = "planned_routes";

/**
 * Connects to MongoDB and returns a Db instance.
 */
export async function connectMongo(
  url: string,
  dbName: string,
): Promise<Db> {
  const client = new MongoClient(url);
  await client.connect();
  return client.db(dbName);
}

/**
 * Ensures that the required collections and indexes exist in the database.
 * This function is idempotent.
 */
export async function ensureCollections(db: Db): Promise<void> {
  await Promise.all([
    db.command({
      createIndexes: TRANSIT_STOPS_COLLECTION,
      indexes: [
        { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
        { key: { name: 1 }, name: "name_unique", unique: true },
      ],
    }),
    db.command({
      createIndexes: TRAILHEADS_COLLECTION,
      indexes: [
        { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
        { key: { name: 1 }, name: "name_unique", unique: true },
      ],
    }),
    db.command({
      createIndexes: PLANNED_ROUTES_COLLECTION,
      indexes: [
        { key: { destinationTrailheadId: 1 }, name: "destinationTrailheadId_idx" },
        { key: { criteria: 1 }, name: "criteria_idx" },
      ],
    }),
    // The 'trails' collection can have a simple default index on _id
    db.createCollection(TRAILS_COLLECTION).catch((err: any) => {
      if (err.codeName !== 'NamespaceExists') throw err;
    })
  ]);
}

// --- Internal Types (for clarity inside the class) ---
type GeoPoint = { type: "Point"; coordinates: [number, number] }; // [lon, lat]

interface TransitStop {
  _id: ObjectId;
  name: string;
  loc: GeoPoint;
  routes: string[];
}

interface Trailhead {
  _id: ObjectId;
  name: string;
  loc: GeoPoint;
  connectingTrailIds: string[];
}

interface Trail {
  _id: ObjectId;
  name: string;
  minutes: number;
  description?: string;
}

interface PlannedRoute {
  _id: ObjectId;
  origin: { lat: number; lon: number };
  destinationTrailheadId: string;
  transitSegments: { fromStopId: string; toStopId: string; minutes: number }[];
  hikingSegments: { trailId: string; minutes: number }[];
  totalMinutes: number;
  transitMinutes: number;
  hikingMinutes: number;
  criteria: "default" | "faster" | "shorter" | "scenic";
  constraints: {
    maxTravelMinutes: number;
    preferredDepartureIso?: string;
    accessibility?: string[];
  };
}

// --- Main Class ---
export class TransitRoutePlannerConcept {
  private transitStops: Collection<TransitStop>;
  private trailheads: Collection<Trailhead>;
  private trails: Collection<Trail>;
  private plannedRoutes: Collection<PlannedRoute>;

  private static AVG_SPEED_KMH_DEFAULT = 30;
  private static AVG_SPEED_KMH_FASTER = 50;
  private static EARTH_RADIUS_KM = 6371;

  constructor(private db: Db, private llm?: TransitRoutePlannerLLM) {
    this.transitStops = db.collection<TransitStop>(TRANSIT_STOPS_COLLECTION);
    this.trailheads = db.collection<Trailhead>(TRAILHEADS_COLLECTION);
    this.trails = db.collection<Trail>(TRAILS_COLLECTION);
    this.plannedRoutes = db.collection<PlannedRoute>(PLANNED_ROUTES_COLLECTION);
  }

  // --- Public API Methods ---

  async planRoute(
    originLat: number,
    originLon: number,
    destinationTrailheadId: string,
    maxTravelMinutes: number,
    preferredDepartureIso?: string,
    accessibility?: string[],
  ): Promise<string> {
    const plannedRoute = await this._planRouteInternal(
      { lat: originLat, lon: originLon },
      destinationTrailheadId,
      { maxTravelMinutes, preferredDepartureIso, accessibility },
      "default",
    );
    const result = await this.plannedRoutes.insertOne(plannedRoute);
    return result.insertedId.toHexString();
  }

  async getAlternativeRoutes(
    plannedRouteId: string,
    criteria: "faster" | "shorter" | "scenic",
  ): Promise<string[]> {
    if (!["faster", "shorter", "scenic"].includes(criteria)) {
      throw new ValidationError(`Invalid criteria: ${criteria}`);
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(plannedRouteId)) {
      throw new ValidationError(`Invalid route ID format: ${plannedRouteId}`);
    }

    const originalRoute = await this.plannedRoutes.findOne({
      _id: new ObjectId(plannedRouteId),
    });
    if (!originalRoute) {
      throw new NotFoundError(`Planned route with id ${plannedRouteId} not found.`);
    }

    try {
      const alternativeRoute = await this._planRouteInternal(
        originalRoute.origin,
        originalRoute.destinationTrailheadId,
        originalRoute.constraints,
        criteria,
      );
      
      // Ensure the alternative is actually different
      if (alternativeRoute.hikingMinutes === originalRoute.hikingMinutes && alternativeRoute.transitMinutes === originalRoute.transitMinutes) {
          return []; // No different alternative found
      }
      
      const result = await this.plannedRoutes.insertOne(alternativeRoute);
      return [result.insertedId.toHexString()];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        // It's possible an alternative cannot be planned (e.g., no shorter hike exists)
        return [];
      }
      throw error;
    }
  }

  async updateRouteConstraints(
    plannedRouteId: string,
    maxTravelMinutes: number,
    preferredDepartureIso?: string,
    accessibility?: string[],
  ): Promise<string | null> {
    const originalRoute = await this.plannedRoutes.findOne({
      _id: new ObjectId(plannedRouteId),
    });
    if (!originalRoute) {
      throw new NotFoundError(`Planned route with id ${plannedRouteId} not found.`);
    }

    const newConstraints = { maxTravelMinutes, preferredDepartureIso, accessibility };

    try {
      const updatedRoute = await this._planRouteInternal(
        originalRoute.origin,
        originalRoute.destinationTrailheadId,
        newConstraints,
        originalRoute.criteria as any, // Recalculate with original criteria
      );
      const result = await this.plannedRoutes.insertOne(updatedRoute);
      return result.insertedId.toHexString();
    } catch (error) {
      if (error instanceof ValidationError) {
        return null; // No valid route exists with new constraints
      }
      throw error;
    }
  }

  // --- Query Helpers ---

  async getPlannedRouteSummary(
    plannedRouteId: string,
  ): Promise<{ id: string; totalMinutes: number; transitMinutes: number; hikingMinutes: number; segmentsCount: number }> {
    const route = await this.plannedRoutes.findOne({
      _id: new ObjectId(plannedRouteId),
    });
    if (!route) {
      throw new NotFoundError(`Planned route with id ${plannedRouteId} not found.`);
    }
    return {
      id: route._id.toHexString(),
      totalMinutes: route.totalMinutes,
      transitMinutes: route.transitMinutes,
      hikingMinutes: route.hikingMinutes,
      segmentsCount: route.transitSegments.length + route.hikingSegments.length,
    };
  }

  async getTrailheadCoords(trailheadId: string): Promise<{ lat: number; lon: number }> {
    const trailhead = await this.trailheads.findOne({ _id: new ObjectId(trailheadId) });
    if (!trailhead) {
        throw new NotFoundError(`Trailhead with id ${trailheadId} not found.`);
    }
    return { lat: trailhead.loc.coordinates[1], lon: trailhead.loc.coordinates[0] };
  }

  // --- Private Helper Methods ---

  private async _planRouteInternal(
    origin: { lat: number, lon: number },
    destinationTrailheadId: string,
    constraints: { maxTravelMinutes: number, preferredDepartureIso?: string, accessibility?: string[] },
    criteria: "default" | "faster" | "shorter" | "scenic",
  ): Promise<Omit<PlannedRoute, "_id">> {
    // 1. Validation
    this._validateCoordinates(origin.lat, origin.lon);
    if (constraints.maxTravelMinutes <= 0) {
      throw new ValidationError("maxTravelMinutes must be positive.");
    }
    if (!ObjectId.isValid(destinationTrailheadId)) {
        throw new ValidationError(`Invalid destinationTrailheadId: ${destinationTrailheadId}`);
    }

    // 2. Find nearest stops and trailhead
    const originCoords: [number, number] = [origin.lon, origin.lat];
    const originStop = await this._findNearestStop(originCoords);

    const destinationTrailhead = await this.trailheads.findOne({ _id: new ObjectId(destinationTrailheadId) });
    if (!destinationTrailhead) {
      throw new NotFoundError(`Trailhead with id ${destinationTrailheadId} not found.`);
    }
    const destinationStop = await this._findNearestStop(destinationTrailhead.loc.coordinates);

    // 3. Compute transit time (round trip)
    const oneWayTransitMinutes = this._calculateTransitMinutes(
      originStop.loc.coordinates,
      destinationStop.loc.coordinates,
      criteria,
    );
    const totalTransitMinutes = Math.round(oneWayTransitMinutes * 2);

    // 4. Calculate available hiking time
    const availableHikingMinutes = constraints.maxTravelMinutes - totalTransitMinutes;
    if (availableHikingMinutes <= 0) {
      throw new ValidationError("Insufficient time for hiking after accounting for transit.");
    }

    // 5. Find the best hiking path based on criteria
    const hikingPath = await this._findBestHikingPath(
      destinationTrailhead,
      availableHikingMinutes,
      criteria,
    );
    const totalHikingMinutes = hikingPath.reduce((sum, seg) => sum + seg.minutes, 0);

    if (totalHikingMinutes === 0) {
        throw new ValidationError("No suitable hiking trails found within the available time.");
    }

    // 6. Assemble the route document
    const plannedRoute: Omit<PlannedRoute, "_id"> = {
      origin,
      destinationTrailheadId,
      transitSegments: [
        { fromStopId: originStop._id.toHexString(), toStopId: destinationStop._id.toHexString(), minutes: oneWayTransitMinutes },
        { fromStopId: destinationStop._id.toHexString(), toStopId: originStop._id.toHexString(), minutes: oneWayTransitMinutes },
      ],
      hikingSegments: hikingPath.map(p => ({ trailId: p.id, minutes: p.minutes })),
      totalMinutes: totalTransitMinutes + totalHikingMinutes,
      transitMinutes: totalTransitMinutes,
      hikingMinutes: totalHikingMinutes,
      criteria,
      constraints,
    };

    return plannedRoute;
  }

  private _validateCoordinates(lat: number, lon: number) {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new ValidationError(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
  }

  private async _findNearestStop(coordinates: [number, number]): Promise<TransitStop> {
    const stop = await this.transitStops.findOne({
      loc: { $near: { $geometry: { type: "Point", coordinates } } },
    });
    if (!stop) {
      throw new NotFoundError("No transit stops found in the database.");
    }
    return stop;
  }

  private _calculateTransitMinutes(
    fromCoords: [number, number],
    toCoords: [number, number],
    criteria: "default" | "faster" | "shorter" | "scenic",
  ): number {
    const [lon1, lat1] = fromCoords;
    const [lon2, lat2] = toCoords;

    const toRad = (deg: number) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = TransitRoutePlannerConcept.EARTH_RADIUS_KM * c;

    const speed = criteria === "faster"
      ? TransitRoutePlannerConcept.AVG_SPEED_KMH_FASTER
      : TransitRoutePlannerConcept.AVG_SPEED_KMH_DEFAULT;
    
    return (distanceKm / speed) * 60; // Convert hours to minutes
  }

  private async _findBestHikingPath(
    trailhead: Trailhead,
    availableMinutes: number,
    criteria: "default" | "faster" | "shorter" | "scenic",
  ): Promise<{ id: string; minutes: number; name: string; description?: string }[]> {
    if (!trailhead.connectingTrailIds || trailhead.connectingTrailIds.length === 0) {
      return [];
    }

    const trailObjectIds = trailhead.connectingTrailIds.map(id => new ObjectId(id));
    const availableTrails = await this.trails.find({
        _id: { $in: trailObjectIds },
        minutes: { $lte: availableMinutes },
    }).toArray();

    if (availableTrails.length === 0) return [];
    
    // Sort for deterministic behavior
    const trails = availableTrails.map((t: any) => ({
      id: t._id.toHexString(),
      minutes: t.minutes,
      name: t.name,
      description: t.description,
    })).sort((a: any, b: any) => a.name.localeCompare(b.name));

    switch (criteria) {
      case "shorter":
        return [trails.sort((a: any, b: any) => a.minutes - b.minutes)[0]];
      
      case "scenic":
        if (this.llm) {
            const scenicScores = await Promise.all(
                trails.map((t: any) => this.llm!.classifyScenic(t.name, t.description))
            );
            const scenicTrails = trails.filter((_: any, i: any) => scenicScores[i]);
            if (scenicTrails.length > 0) {
                // Pick longest among the scenic trails that fits
                return [scenicTrails.sort((a: any, b: any) => b.minutes - a.minutes)[0]];
            }
        }
        // Fallback for "scenic" is the longest trail (proxy for more to see)
        return [trails.sort((a: any, b: any) => b.minutes - a.minutes)[0]];

      case "default":
      case "faster": // "faster" criteria affects transit, for hiking it's same as default
      default:
        // Greedy approach: pick the longest trail that fits. For simplicity, we only pick one.
        return [trails.sort((a: any, b: any) => b.minutes - a.minutes)[0]];
    }
  }
}

export default TransitRoutePlannerConcept;