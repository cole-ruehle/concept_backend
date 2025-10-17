---
timestamp: 'Thu Oct 16 2025 20:34:43 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_203443.79df4263.md]]'
content_id: 861bf5caac7a084594ee60187fb5c82e3376e1ca2b81ad09bc57fd630d0a0794
---

# response:

Answering prompt 1: Implementation of `ConstraintMonitor.ts`.

```typescript
// /src/concepts/ConstraintMonitor.ts

/**
 * @module ConstraintMonitorConcept
 *
 * @description
 * Monitors and integrates real-time constraints (transit, weather, trails, daylight)
 * that affect route feasibility and safety.
 *
 * @requires Deno runtime
 * @requires Environment Variables:
 *   - MONGODB_URL: Connection string for MongoDB Atlas.
 *   - DB_NAME: The name of the database to use.
 *   - GEMINI_API_KEY (optional): API key for Google Gemini, used for LLM-based alert analysis.
 *
 * @features
 * - Persistence: Uses MongoDB to store state for schedules, conditions, and alerts.
 * - Provider Pattern: External data sources (transit, weather, trails) are abstracted via
 *   injectable provider interfaces, with default fetch-based implementations. This allows
*   for easy testing and swapping of data sources.
 * - Normalized API: All public methods adhere to a strict "IDs and primitives" contract,
 *   avoiding complex objects in the API surface for better decoupling.
 * - Optional LLM Integration: Can leverage a Gemini LLM to score alert severity, but
 *   core functionality is deterministic and rule-based.
 *
 * @collections
 * - `transit_schedules`: Stores bus/train departure times for specific routes and stops.
 * - `weather_conditions`: Stores snapshots of weather conditions for geographic points.
 * - `trail_conditions`: Stores the status and difficulty of hiking/biking trails.
 * - `constraint_alerts`: Stores generated alerts for planned routes that violate constraints.
 *
 * @indexes
 * - `transit_schedules`: { routeId: 1, stopId: 1 }, { fetchedAtIso: 1 }
 * - `weather_conditions`: { loc: "2dsphere" }, { atIso: 1 }
 * - `trail_conditions`: { trailId: 1 }, { checkedAtIso: 1 }
 * - `constraint_alerts`: { plannedRouteId: 1 }, { createdAtIso: 1 }, { severity: 1 }
 * - `planned_routes` (assumed): { _id: 1 } for lookups in `generateAlerts`.
 */

import {
  Db,
  MongoClient,
  ObjectId,
  Collection,
  MongoBulkWriteError,
} from "npm:mongodb@6.7.0";

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

// --- Provider Interfaces & Defaults ---

export interface TransitProvider {
  fetchSchedules(
    source?: string,
  ): Promise<Array<{ routeId: string; stopId: string; departuresIso: string[] }>>;
}

export interface WeatherProvider {
  fetch(
    lat: number,
    lon: number,
  ): Promise<{ atIso: string; tempC: number; precipProb: number; windKph: number }>;
}

export interface TrailProvider {
  fetch(
    trailId: string,
  ): Promise<{ trailId: string; status: "open" | "closed"; difficulty: number; issues?: string[] }>;
}

const defaultTransitProvider: TransitProvider = {
  async fetchSchedules(_source?: string): Promise<Array<{ routeId: string; stopId: string; departuresIso: string[] }>> {
    // In a real implementation, this would fetch from a GTFS-realtime feed or similar API.
    // This is a stub for demonstration.
    console.warn("Using stubbed DefaultTransitProvider. No real data is being fetched.");
    const now = new Date();
    return [
      {
        routeId: "route-blue",
        stopId: "stop-central",
        departuresIso: [
          new Date(now.getTime() + 5 * 60000).toISOString(),
          new Date(now.getTime() + 20 * 60000).toISOString(),
          new Date(now.getTime() + 35 * 60000).toISOString(),
        ],
      },
    ];
  },
};

const defaultWeatherProvider: WeatherProvider = {
  async fetch(lat: number, lon: number): Promise<{ atIso: string; tempC: number; precipProb: number; windKph: number }> {
    // This would call a real weather API like OpenWeatherMap or Weather.gov.
    console.warn("Using stubbed DefaultWeatherProvider. No real data is being fetched.");
    return {
      atIso: new Date().toISOString(),
      tempC: 18 + Math.random() * 5, // plausible temp
      precipProb: Math.random() * 0.3, // low chance of rain
      windKph: 5 + Math.random() * 10, // light breeze
    };
  },
};

const defaultTrailProvider: TrailProvider = {
  async fetch(trailId: string): Promise<{ trailId: string; status: "open" | "closed"; difficulty: number; issues?: string[] }> {
    console.warn("Using stubbed DefaultTrailProvider. No real data is being fetched.");
    return {
      trailId,
      status: "open",
      difficulty: 3,
      issues: ["Slightly muddy in lower sections."],
    };
  },
};

// --- Optional LLM Adapter ---

export interface ConstraintMonitorLLM {
  summarize?(text: string): Promise<string>;
  scoreSeverity?(text: string): Promise<number>;
}

export function makeGeminiLLM(apiKey: string, model = "gemini-1.5-flash"): ConstraintMonitorLLM {
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  return {
    async summarize(text: string): Promise<string> {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Summarize these route alerts concisely for a hiker: ${text}` }] }],
        }),
      });
      if (!res.ok) throw new Error(`Gemini API error: ${res.statusText}`);
      const data = await res.json();
      return data.candidates[0]?.content.parts[0]?.text?.trim() ?? "Could not summarize.";
    },
    async scoreSeverity(text: string): Promise<number> {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `On a scale of 0 to 100, how severe are these hiking route safety alerts? Respond with only a single number. Alerts: ${text}`,
            }],
          }],
        }),
      });
      if (!res.ok) throw new Error(`Gemini API error: ${res.statusText}`);
      const data = await res.json();
      const scoreText = data.candidates[0]?.content.parts[0]?.text?.trim() ?? "50";
      const score = parseInt(scoreText, 10);
      return isNaN(score) ? 50 : Math.max(0, Math.min(100, score));
    },
  };
}


// --- Persistence ---

export const TRANSIT_SCHEDULES_COLLECTION = "transit_schedules";
export const WEATHER_CONDITIONS_COLLECTION = "weather_conditions";
export const TRAIL_CONDITIONS_COLLECTION = "trail_conditions";
export const CONSTRAINT_ALERTS_COLLECTION = "constraint_alerts";
/**
 * NOTE: This concept assumes the existence of a 'planned_routes' collection
 * managed by another concept (e.g., RoutePlanner). It reads from this
 * collection in `generateAlerts`.
 */
export const PLANNED_ROUTES_COLLECTION = "planned_routes";


export async function ensureCollections(db: Db) {
  const collections = await db.listCollections({ name: { $in: Object.values(COLLECTION_NAMES) } }).toArray();
  const existingNames = collections.map(c => c.name);

  const createIfNotExists = async (name: string, createCall: () => Promise<unknown>) => {
    if (!existingNames.includes(name)) {
      await createCall();
    }
  };

  await createIfNotExists(TRANSIT_SCHEDULES_COLLECTION, () =>
    db.createCollection(TRANSIT_SCHEDULES_COLLECTION)
  );
  const transitSchedules = db.collection(TRANSIT_SCHEDULES_COLLECTION);
  await transitSchedules.createIndexes([
    { key: { routeId: 1, stopId: 1 }, name: "routeId_stopId_idx", unique: true },
    { key: { fetchedAtIso: 1 }, name: "fetchedAtIso_idx" },
  ]);

  await createIfNotExists(WEATHER_CONDITIONS_COLLECTION, () =>
    db.createCollection(WEATHER_CONDITIONS_COLLECTION)
  );
  const weatherConditions = db.collection(WEATHER_CONDITIONS_COLLECTION);
  await weatherConditions.createIndexes([
    { key: { loc: "2dsphere" }, name: "loc_2dsphere_idx" },
    { key: { atIso: 1 }, name: "atIso_idx" },
  ]);

  await createIfNotExists(TRAIL_CONDITIONS_COLLECTION, () =>
    db.createCollection(TRAIL_CONDITIONS_COLLECTION)
  );
  const trailConditions = db.collection(TRAIL_CONDITIONS_COLLECTION);
  await trailConditions.createIndexes([
    { key: { trailId: 1 }, name: "trailId_idx" },
    { key: { checkedAtIso: 1 }, name: "checkedAtIso_idx" },
  ]);

  await createIfNotExists(CONSTRAINT_ALERTS_COLLECTION, () =>
    db.createCollection(CONSTRAINT_ALERTS_COLLECTION)
  );
  const constraintAlerts = db.collection(CONSTRAINT_ALERTS_COLLECTION);
  await constraintAlerts.createIndexes([
    { key: { plannedRouteId: 1 }, name: "plannedRouteId_idx" },
    { key: { createdAtIso: 1 }, name: "createdAtIso_idx" },
    { key: { severity: 1 }, name: "severity_idx" },
  ]);
}

const COLLECTION_NAMES = {
  TRANSIT_SCHEDULES_COLLECTION,
  WEATHER_CONDITIONS_COLLECTION,
  TRAIL_CONDITIONS_COLLECTION,
  CONSTRAINT_ALERTS_COLLECTION,
  PLANNED_ROUTES_COLLECTION,
};

// --- Helper Types ---
type TransitScheduleDoc = {
    _id: ObjectId;
    routeId: string;
    stopId: string;
    departuresIso: string[];
    source?: string;
    fetchedAtIso: string;
};

type WeatherConditionsDoc = {
    _id: ObjectId;
    loc: { type: "Point"; coordinates: [number, number] }; // [lon, lat]
    atIso: string;
    tempC: number;
    precipProb: number;
    windKph: number;
};

type TrailConditionsDoc = {
    _id: ObjectId;
    trailId: string;
    status: "open" | "closed";
    difficulty: number;
    issues?: string[];
    checkedAtIso: string;
};

type ConstraintAlertDoc = {
    _id: ObjectId;
    plannedRouteId: string;
    createdAtIso: string;
    kinds: string[];
    severity: number;
    message: string;
};

// Shape of document this concept expects from `planned_routes` collection.
type PlannedRouteDoc = {
    _id: ObjectId;
    startLocation: { type: "Point", coordinates: [number, number] };
    trailIds: string[];
    transitLegs: Array<{ startStopId: string; endStopId: string }>;
    expectedStartIso: string;
    expectedEndIso: string;
};


// --- Main Class ---

export class ConstraintMonitorConcept {
  #db: Db;
  #transitProvider: TransitProvider;
  #weatherProvider: WeatherProvider;
  #trailProvider: TrailProvider;
  #llm?: ConstraintMonitorLLM;

  #transitSchedules: Collection<TransitScheduleDoc>;
  #weatherConditions: Collection<WeatherConditionsDoc>;
  #trailConditions: Collection<TrailConditionsDoc>;
  #constraintAlerts: Collection<ConstraintAlertDoc>;
  #plannedRoutes: Collection<PlannedRouteDoc>; // For reading only

  constructor(
    db: Db,
    providers?: {
      transit?: TransitProvider;
      weather?: WeatherProvider;
      trail?: TrailProvider;
    },
    llm?: ConstraintMonitorLLM
  ) {
    this.#db = db;
    this.#transitProvider = providers?.transit ?? defaultTransitProvider;
    this.#weatherProvider = providers?.weather ?? defaultWeatherProvider;
    this.#trailProvider = providers?.trail ?? defaultTrailProvider;
    this.#llm = llm;

    this.#transitSchedules = db.collection(TRANSIT_SCHEDULES_COLLECTION);
    this.#weatherConditions = db.collection(WEATHER_CONDITIONS_COLLECTION);
    this.#trailConditions = db.collection(TRAIL_CONDITIONS_COLLECTION);
    this.#constraintAlerts = db.collection(CONSTRAINT_ALERTS_COLLECTION);
    this.#plannedRoutes = db.collection(PLANNED_ROUTES_COLLECTION);
  }

  // --- Public API Methods ---

  /**
   * Fetches latest transit schedule data and updates the database.
   * @param source Optional identifier for the data source.
   * @returns A promise that resolves to an array of updated/inserted schedule document IDs.
   */
  async updateTransitSchedules(source?: string): Promise<string[]> {
    const schedules = await this.#transitProvider.fetchSchedules(source);
    if (schedules.length === 0) {
      return [];
    }

    const nowIso = new Date().toISOString();
    const operations = schedules.map((s) => ({
      updateOne: {
        filter: { routeId: s.routeId, stopId: s.stopId },
        update: {
          $set: {
            departuresIso: s.departuresIso,
            fetchedAtIso: nowIso,
            ...(source && { source }),
          },
        },
        upsert: true,
      },
    }));

    try {
      const result = await this.#transitSchedules.bulkWrite(operations, { ordered: false });
      const upsertedIds = Object.values(result.upsertedIds).map(id => id.toHexString());
      // Note: This only returns IDs for *newly created* schedules.
      // A full implementation might query for all matching filters to return updated IDs as well.
      // For this spec, returning upserted IDs is sufficient.
      return upsertedIds;
    } catch (e) {
      if (e instanceof MongoBulkWriteError && e.code === 11000) {
        throw new ConflictError(`Transit schedule uniqueness constraint failed: ${e.message}`);
      }
      throw new Error(`Failed to update transit schedules: ${e.message}`);
    }
  }

  /**
   * Fetches and stores weather conditions for a specific location.
   * @param lat Latitude.
   * @param lon Longitude.
   * @returns A promise that resolves to the ID of the new weather conditions document.
   */
  async checkWeatherConditions(lat: number, lon: number): Promise<string> {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new ValidationError("Invalid latitude or longitude.");
    }

    const conditions = await this.#weatherProvider.fetch(lat, lon);
    const doc: Omit<WeatherConditionsDoc, '_id'> = {
        loc: { type: "Point", coordinates: [lon, lat] },
        ...conditions
    };

    const result = await this.#weatherConditions.insertOne(doc as WeatherConditionsDoc);
    return result.insertedId.toHexString();
  }

  /**
   * Fetches and stores the current conditions for a specific trail.
   * @param trailId The unique identifier for the trail.
   * @returns A promise that resolves to the ID of the new trail conditions document.
   */
  async getTrailConditions(trailId: string): Promise<string> {
    if (!trailId || typeof trailId !== 'string') {
        throw new ValidationError("Invalid trailId provided.");
    }
    const conditions = await this.#trailProvider.fetch(trailId);
    const doc: Omit<TrailConditionsDoc, '_id'> = {
        checkedAtIso: new Date().toISOString(),
        ...conditions
    };

    const result = await this.#trailConditions.insertOne(doc as TrailConditionsDoc);
    return result.insertedId.toHexString();
  }

  /**
   * Analyzes a planned route against all current constraints and generates alerts.
   * @param plannedRouteId The ID of the planned route to analyze.
   * @returns A promise that resolves to an array of generated alert document IDs.
   */
  async generateAlerts(plannedRouteId: string): Promise<string[]> {
    const route = await this.#plannedRoutes.findOne({ _id: this.#toObjectId(plannedRouteId) });
    if (!route) {
        throw new NotFoundError(`PlannedRoute with id '${plannedRouteId}' not found.`);
    }

    const issues: { kind: string; message: string; severity: number }[] = [];
    
    // 1. Check Weather
    const weather = await this.#getNearestWeather(route.startLocation.coordinates);
    if (weather) {
        if (weather.precipProb > 0.6) issues.push({ kind: "weather", message: `High probability of precipitation (${(weather.precipProb * 100).toFixed(0)}%).`, severity: 60 });
        if (weather.windKph > 40) issues.push({ kind: "weather", message: `Strong winds forecast (${weather.windKph} kph).`, severity: 75 });
        if (weather.tempC < 0) issues.push({ kind: "weather", message: `Freezing temperatures (${weather.tempC}°C).`, severity: 70 });
    }

    // 2. Check Transit
    for (const leg of route.transitLegs || []) {
        // Simple check: just look at the starting stop of a leg
        const headway = await this.getTransitScheduleHeadway(leg.startStopId, leg.startStopId, route.expectedStartIso);
        if (headway > 45) { // Headway > 45 minutes
            issues.push({ kind: "transit", message: `Infrequent service at stop ${leg.startStopId} (headway > 45 min).`, severity: 40 });
        }
    }

    // 3. Check Trails
    for (const trailId of route.trailIds) {
        const condition = await this.#trailConditions.findOne({ trailId }, { sort: { checkedAtIso: -1 } });
        if (condition?.status === 'closed') {
            issues.push({ kind: "trail", message: `Trail ${trailId} is reported as closed.`, severity: 95 });
        }
    }

    // 4. Check Daylight
    if (this.#isAfterSunset(route.expectedEndIso)) {
        issues.push({ kind: "daylight", message: `Route is expected to end after sunset.`, severity: 50 });
    }
    
    if (issues.length === 0) {
        return [];
    }
    
    // Consolidate into one alert
    const kinds = [...new Set(issues.map(i => i.kind))];
    const message = issues.map(i => i.message).join(" ");
    let severity = Math.max(...issues.map(i => i.severity));

    if (this.#llm?.scoreSeverity) {
        try {
            severity = await this.#llm.scoreSeverity(message);
        } catch (e) {
            console.error("LLM severity scoring failed:", e.message);
        }
    }

    const alertDoc: Omit<ConstraintAlertDoc, '_id'> = {
        plannedRouteId,
        createdAtIso: new Date().toISOString(),
        kinds,
        message,
        severity
    };
    
    const result = await this.#constraintAlerts.insertOne(alertDoc as ConstraintAlertDoc);
    return [result.insertedId.toHexString()];
  }

  // --- Query Helpers ---

  async getWeatherSummary(id: string): Promise<{ id: string; atIso: string; tempC: number; precipProb: number; windKph: number }> {
    const doc = await this.#weatherConditions.findOne({ _id: this.#toObjectId(id) });
    if (!doc) throw new NotFoundError(`WeatherConditions with id '${id}' not found.`);
    return {
      id: doc._id.toHexString(),
      atIso: doc.atIso,
      tempC: doc.tempC,
      precipProb: doc.precipProb,
      windKph: doc.windKph,
    };
  }

  async getTrailConditionSummary(id: string): Promise<{ id: string; trailId: string; status: "open" | "closed"; difficulty: number }> {
    const doc = await this.#trailConditions.findOne({ _id: this.#toObjectId(id) });
    if (!doc) throw new NotFoundError(`TrailConditions with id '${id}' not found.`);
    return {
      id: doc._id.toHexString(),
      trailId: doc.trailId,
      status: doc.status,
      difficulty: doc.difficulty,
    };
  }
  
  async getTransitScheduleHeadway(routeId: string, stopId: string, atIso?: string): Promise<number> {
    const schedule = await this.#transitSchedules.findOne({ routeId, stopId });
    if (!schedule || schedule.departuresIso.length < 2) {
      return Infinity; // No service or single departure
    }
    
    const referenceTime = atIso ? new Date(atIso) : new Date();
    const upcomingDepartures = schedule.departuresIso
        .map(iso => new Date(iso))
        .filter(date => date > referenceTime)
        .sort((a, b) => a.getTime() - b.getTime());

    if (upcomingDepartures.length < 2) {
        return Infinity; // Not enough future departures to calculate headway
    }

    const headwayMillis = upcomingDepartures[1].getTime() - upcomingDepartures[0].getTime();
    return Math.round(headwayMillis / 60000); // convert to minutes
  }

  async getAlertSummary(id: string): Promise<{ id: string; routeId: string; severity: number; message: string }> {
    const doc = await this.#constraintAlerts.findOne({ _id: this.#toObjectId(id) });
    if (!doc) throw new NotFoundError(`ConstraintAlert with id '${id}' not found.`);
    return {
      id: doc._id.toHexString(),
      routeId: doc.plannedRouteId,
      severity: doc.severity,
      message: doc.message,
    };
  }

  // --- Private Helpers ---

  #toObjectId(id: string): ObjectId {
    try {
      return new ObjectId(id);
    } catch (e) {
      throw new ValidationError(`Invalid ObjectId string: '${id}'`);
    }
  }
  
  async #getNearestWeather(coords: [number, number]): Promise<WeatherConditionsDoc | null> {
    return await this.#weatherConditions.findOne(
        { loc: { $near: { $geometry: { type: "Point", coordinates: coords } } } },
        { sort: { atIso: -1 } }
    );
  }

  #isAfterSunset(isoDateTime: string): boolean {
    const date = new Date(isoDateTime);
    // Simple stub: assume sunset is at 8 PM UTC for the purpose of this example.
    // A real implementation would use a library for solar calculations based on date and location.
    const sunsetHourUTC = 20;
    return date.getUTCHours() >= sunsetHourUTC;
  }
}
```
