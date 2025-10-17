---
timestamp: 'Thu Oct 16 2025 20:22:57 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251016_202257.4be8d1b5.md]]'
content_id: 360ea5743cdb0163457992d8cf33b65ab8b8cf07aba35a60c67ead02a76e5bd2
---

# response:

Here is the implementation for `/src/concepts/ConstraintMonitor.ts`.

```typescript
// /src/concepts/ConstraintMonitor.ts
/**
 * @module ConstraintMonitorConcept
 *
 * This module implements the ConstraintMonitor concept for monitoring real-time
 * constraints like weather, transit schedules, and trail conditions.
 *
 * ---
 *
 * ## Environment Variables
 * - MONGODB_URL: Connection string for MongoDB Atlas.
 * - DB_NAME: The name of the database to use.
 * - GEMINI_API_KEY: (Optional) API key for Google Gemini, used for LLM features.
 *
 * ## Collections & Indexes
 * - `transit_schedules`: Stores public transit departure times.
 *   - Indexes: { routeId: 1, stopId: 1 }, { fetchedAtIso: 1 }
 * - `weather_conditions`: Stores weather snapshots for specific locations.
 *   - Indexes: { loc: "2dsphere" }, { atIso: 1 }
 * - `trail_conditions`: Stores the status and difficulty of trails.
 *   - Indexes: { trailId: 1 }, { checkedAtIso: 1 }
 * - `constraint_alerts`: Stores alerts generated for planned routes.
 *   - Indexes: { plannedRouteId: 1 }, { createdAtIso: 1 }, { severity: 1 }
 *
 * ## Provider Pattern
 * The class uses injectable "provider" interfaces (`TransitProvider`, `WeatherProvider`,
 * `TrailProvider`) for fetching external data. This allows for easy testing by
 * injecting stubs, while default `fetch`-based implementations are used in production.
 *
 * ## Optional Gemini Use
 * An optional `ConstraintMonitorLLM` can be injected to use Gemini for summarizing
 * alert messages or scoring their severity, enhancing the generated alerts.
 *
 * ## Normalized API (IDs + Primitives Only)
 * All public methods adhere to a strict API contract, accepting and returning only
 * unique identifiers (strings) and primitive data types. Composite objects are
 * accessed via read-only "summary" helper methods. This simplifies integration
 * and network transport.
 */

import {
  MongoClient,
  Db,
  Collection,
  ObjectId,
  BulkWriteResult,
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

// --- Collection Constants ---
export const TRANSIT_SCHEDULES_COLLECTION = "transit_schedules";
export const WEATHER_CONDITIONS_COLLECTION = "weather_conditions";
export const TRAIL_CONDITIONS_COLLECTION = "trail_conditions";
export const CONSTRAINT_ALERTS_COLLECTION = "constraint_alerts";
/**
 * Note: This implementation assumes the existence of a 'planned_routes'
 * collection managed by another concept. It is queried by `generateAlerts`.
 */
export const PLANNED_ROUTES_COLLECTION = "planned_routes";

// --- Database Setup ---
let mongoClient: MongoClient | null = null;

/** Connects to MongoDB using environment variables. */
export function connectMongo(mongoUrl: string): MongoClient {
  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUrl);
  }
  return mongoClient;
}

/** Ensures collections and indexes exist in the database. Idempotent. */
export async function ensureCollections(db: Db): Promise<void> {
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  const ensureCollection = async (name: string) => {
    if (!collectionNames.includes(name)) {
      await db.createCollection(name);
    }
  };

  await ensureCollection(TRANSIT_SCHEDULES_COLLECTION);
  const transitSchedules = db.collection(TRANSIT_SCHEDULES_COLLECTION);
  await transitSchedules.createIndex({ routeId: 1, stopId: 1 }, { unique: true });
  await transitSchedules.createIndex({ fetchedAtIso: 1 });

  await ensureCollection(WEATHER_CONDITIONS_COLLECTION);
  const weatherConditions = db.collection(WEATHER_CONDITIONS_COLLECTION);
  await weatherConditions.createIndex({ loc: "2dsphere" });
  await weatherConditions.createIndex({ atIso: 1 });

  await ensureCollection(TRAIL_CONDITIONS_COLLECTION);
  const trailConditions = db.collection(TRAIL_CONDITIONS_COLLECTION);
  await trailConditions.createIndex({ trailId: 1 });
  await trailConditions.createIndex({ checkedAtIso: 1 });

  await ensureCollection(CONSTRAINT_ALERTS_COLLECTION);
  const constraintAlerts = db.collection(CONSTRAINT_ALERTS_COLLECTION);
  await constraintAlerts.createIndex({ plannedRouteId: 1 });
  await constraintAlerts.createIndex({ createdAtIso: 1 });
  await constraintAlerts.createIndex({ severity: 1 });
}

// --- Provider Interfaces & Defaults ---

export interface TransitProvider {
  fetchSchedules(source?: string): Promise<Array<{ routeId: string; stopId: string; departuresIso: string[] }>>;
}

export interface WeatherProvider {
  fetch(lat: number, lon: number): Promise<{ atIso: string; tempC: number; precipProb: number; windKph: number }>;
}

export interface TrailProvider {
  fetch(trailId: string): Promise<{ trailId: string; status: "open" | "closed"; difficulty: number; issues?: string[] }>;
}

const defaultTransitProvider: TransitProvider = {
  async fetchSchedules(_source?: string): Promise<Array<{ routeId: string; stopId: string; departuresIso: string[] }>> {
    console.warn("Using stubbed Default TransitProvider. No real data will be fetched.");
    // In a real implementation, this would call a GTFS-RT or similar API.
    const now = new Date();
    const departures = Array.from({ length: 5 }, (_, i) => new Date(now.getTime() + i * 30 * 60 * 1000).toISOString());
    return Promise.resolve([
      { routeId: "ROUTE_A", stopId: "STOP_1", departuresIso: departures },
      { routeId: "ROUTE_A", stopId: "STOP_2", departuresIso: departures },
    ]);
  },
};

const defaultWeatherProvider: WeatherProvider = {
  async fetch(lat: number, lon: number): Promise<{ atIso: string; tempC: number; precipProb: number; windKph: number }> {
    console.warn("Using stubbed Default WeatherProvider. No real data will be fetched.");
    // In a real implementation, this would call a service like OpenWeatherMap.
    return Promise.resolve({
      atIso: new Date().toISOString(),
      tempC: 15,
      precipProb: 0.1,
      windKph: 10,
    });
  },
};

const defaultTrailProvider: TrailProvider = {
  async fetch(trailId: string): Promise<{ trailId: string; status: "open" | "closed"; difficulty: number; issues?: string[] }> {
    console.warn("Using stubbed Default TrailProvider. No real data will be fetched.");
    // In a real implementation, this would call a parks service API.
    return Promise.resolve({
      trailId,
      status: "open",
      difficulty: 3,
      issues: ["Slightly muddy in sections"],
    });
  },
};

// --- LLM Interface & Factory ---

export interface ConstraintMonitorLLM {
  summarize?(text: string): Promise<string>;
  scoreSeverity?(text: string): Promise<number>;
}

export function makeGeminiLLM(apiKey: string, model = "gemini-1.5-flash"): ConstraintMonitorLLM {
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  return {
    async summarize(text: string): Promise<string> {
      const prompt = `Summarize the following trail alert in one short sentence: "${text}"`;
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!response.ok) throw new Error(`Gemini API error: ${response.statusText}`);
      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    },
    async scoreSeverity(text: string): Promise<number> {
      const prompt = `Score the severity of this alert from 0 (informational) to 100 (critical danger). Output only a single integer number. Alert: "${text}"`;
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!response.ok) throw new Error(`Gemini API error: ${response.statusText}`);
      const data = await response.json();
      const scoreText = data.candidates[0].content.parts[0].text.trim();
      return parseInt(scoreText, 10) || 50; // Default to 50 on parsing failure
    },
  };
}

// --- Main Concept Class ---

export class ConstraintMonitorConcept {
  private db: Db;
  private transitProvider: TransitProvider;
  private weatherProvider: WeatherProvider;
  private trailProvider: TrailProvider;
  private llm?: ConstraintMonitorLLM;

  private transitSchedules: Collection;
  private weatherConditions: Collection;
  private trailConditions: Collection;
  private constraintAlerts: Collection;
  private plannedRoutes: Collection; // Assumed collection

  constructor(
    db: Db,
    providers?: {
      transit?: TransitProvider;
      weather?: WeatherProvider;
      trail?: TrailProvider;
    },
    llm?: ConstraintMonitorLLM
  ) {
    this.db = db;
    this.transitProvider = providers?.transit ?? defaultTransitProvider;
    this.weatherProvider = providers?.weather ?? defaultWeatherProvider;
    this.trailProvider = providers?.trail ?? defaultTrailProvider;
    this.llm = llm;

    this.transitSchedules = db.collection(TRANSIT_SCHEDULES_COLLECTION);
    this.weatherConditions = db.collection(WEATHER_CONDITIONS_COLLECTION);
    this.trailConditions = db.collection(TRAIL_CONDITIONS_COLLECTION);
    this.constraintAlerts = db.collection(CONSTRAINT_ALERTS_COLLECTION);
    this.plannedRoutes = db.collection(PLANNED_ROUTES_COLLECTION);
  }

  // --- Private Validation & Helpers ---

  private _validateLatLon(lat: number, lon: number): void {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new ValidationError("Invalid latitude or longitude values.");
    }
  }

  private _validateObjectId(id: string): ObjectId {
    if (!ObjectId.isValid(id)) {
      throw new ValidationError(`Invalid ID format: ${id}`);
    }
    return new ObjectId(id);
  }

  /** A very simple approximation of sunset time. Not astronomically precise. */
  private _getSunsetTime(date: Date, lat: number, lon: number): Date {
    // Stub implementation for deterministic testing.
    // A real implementation would use a proper solar calculation library.
    const sunset = new Date(date);
    sunset.setUTCHours(18, 0, 0, 0); // Assume sunset is at 6 PM UTC for simplicity
    return sunset;
  }

  // --- Public API Methods ---

  public async updateTransitSchedules(source?: string): Promise<string[]> {
    const schedules = await this.transitProvider.fetchSchedules(source);
    if (schedules.length === 0) {
      return [];
    }

    const fetchedAtIso = new Date().toISOString();
    const bulkOps = schedules.map((s) => ({
      updateOne: {
        filter: { routeId: s.routeId, stopId: s.stopId },
        update: {
          $set: {
            departuresIso: s.departuresIso,
            source: source,
            fetchedAtIso: fetchedAtIso,
          },
        },
        upsert: true,
      },
    }));

    const result: BulkWriteResult = await this.transitSchedules.bulkWrite(bulkOps, { ordered: false });

    // To return all updated/inserted IDs, we need to query back
    const filters = schedules.map(s => ({ routeId: s.routeId, stopId: s.stopId }));
    const updatedDocs = await this.transitSchedules.find({ $or: filters }, { projection: { _id: 1 } }).toArray();

    return updatedDocs.map(doc => doc._id.toHexString());
  }

  public async checkWeatherConditions(lat: number, lon: number): Promise<string> {
    this._validateLatLon(lat, lon);
    const conditions = await this.weatherProvider.fetch(lat, lon);

    const doc = {
      loc: { type: "Point", coordinates: [lon, lat] },
      ...conditions,
    };

    const result = await this.weatherConditions.insertOne(doc);
    return result.insertedId.toHexString();
  }

  public async getTrailConditions(trailId: string): Promise<string> {
    if (!trailId) throw new ValidationError("trailId cannot be empty.");
    const conditions = await this.trailProvider.fetch(trailId);

    const doc = {
      ...conditions,
      checkedAtIso: new Date().toISOString(),
    };

    const result = await this.trailConditions.insertOne(doc);
    return result.insertedId.toHexString();
  }

  public async generateAlerts(plannedRouteId: string): Promise<string[]> {
    const routeObjectId = this._validateObjectId(plannedRouteId);
    const route = await this.plannedRoutes.findOne({ _id: routeObjectId });

    if (!route) {
      throw new NotFoundError(`PlannedRoute with id ${plannedRouteId} not found.`);
    }

    const alertsToCreate: any[] = [];
    const now = new Date();

    // 1. Weather Check
    const weather = await this.weatherConditions.findOne(
        { loc: { $near: { $geometry: route.startLocation } } },
        { sort: { atIso: -1 } }
    );
    if (weather) {
      if (weather.precipProb > 0.75) {
        alertsToCreate.push({
          kind: "weather",
          severity: 80,
          message: `High probability of precipitation (${(weather.precipProb * 100).toFixed(0)}%) expected.`,
        });
      }
      if (weather.windKph > 40) {
        alertsToCreate.push({
          kind: "weather",
          severity: 70,
          message: `Strong winds of ${weather.windKph} kph expected.`,
        });
      }
    }
    
    // 2. Trail Conditions Check
    if (route.trailIds && route.trailIds.length > 0) {
        const trailConditions = await this.trailConditions.find(
            { trailId: { $in: route.trailIds } },
            { sort: { checkedAtIso: -1 } }
        ).toArray();

        // Get the most recent condition for each trail
        const latestConditions = new Map();
        for (const tc of trailConditions) {
            if (!latestConditions.has(tc.trailId) || new Date(tc.checkedAtIso) > new Date(latestConditions.get(tc.trailId).checkedAtIso)) {
                latestConditions.set(tc.trailId, tc);
            }
        }
        
        for (const condition of latestConditions.values()) {
            if (condition.status === 'closed') {
                alertsToCreate.push({
                    kind: 'trail',
                    severity: 95,
                    message: `Trail ${condition.trailId} is closed.`
                });
            }
        }
    }

    // 3. Transit Check (simplified)
    if (route.endTransitStop) {
        const headway = await this.getTransitScheduleHeadway(route.endTransitStop.routeId, route.endTransitStop.stopId, route.expectedEndIso);
        if (headway > 60) { // Headway > 1 hour is a potential issue
            alertsToCreate.push({
                kind: 'transit',
                severity: 40,
                message: `Long wait (>60 min) expected for return transit on route ${route.endTransitStop.routeId}.`
            });
        }
    }

    // 4. Daylight Check
    const routeEndDate = new Date(route.expectedEndIso);
    const sunset = this._getSunsetTime(routeEndDate, route.startLocation.coordinates[1], route.startLocation.coordinates[0]);

    if (routeEndDate > sunset) {
        const minutesAfterSunset = Math.round((routeEndDate.getTime() - sunset.getTime()) / 60000);
        alertsToCreate.push({
            kind: 'daylight',
            severity: 65,
            message: `Route is expected to finish ${minutesAfterSunset} minutes after sunset.`
        });
    }

    if (alertsToCreate.length === 0) {
        return [];
    }
    
    // Consolidate alerts into one or more final documents
    const finalAlerts = [];
    const kinds = [...new Set(alertsToCreate.map(a => a.kind))];
    const message = alertsToCreate.map(a => a.message).join(' ');
    let severity = Math.max(...alertsToCreate.map(a => a.severity));

    if (this.llm?.scoreSeverity) {
        try {
            severity = await this.llm.scoreSeverity(message);
        } catch (e) {
            console.error("LLM severity scoring failed:", e.message);
        }
    }

    const alertDoc = {
        plannedRouteId: plannedRouteId,
        createdAtIso: now.toISOString(),
        kinds: kinds,
        severity: severity,
        message: message
    };

    const result = await this.constraintAlerts.insertOne(alertDoc);
    return [result.insertedId.toHexString()];
  }

  // --- Query Helpers (Read-only) ---

  public async getWeatherSummary(id: string): Promise<{ id: string; atIso: string; tempC: number; precipProb: number; windKph: number } | null> {
    const doc = await this.weatherConditions.findOne({ _id: this._validateObjectId(id) });
    if (!doc) return null;
    return {
      id: doc._id.toHexString(),
      atIso: doc.atIso,
      tempC: doc.tempC,
      precipProb: doc.precipProb,
      windKph: doc.windKph,
    };
  }

  public async getTrailConditionSummary(id: string): Promise<{ id: string; trailId: string; status: "open" | "closed"; difficulty: number } | null> {
    const doc = await this.trailConditions.findOne({ _id: this._validateObjectId(id) });
    if (!doc) return null;
    return {
      id: doc._id.toHexString(),
      trailId: doc.trailId,
      status: doc.status,
      difficulty: doc.difficulty,
    };
  }

  public async getAlertSummary(id: string): Promise<{ id: string; routeId: string; severity: number; message: string } | null> {
    const doc = await this.constraintAlerts.findOne({ _id: this._validateObjectId(id) });
    if (!doc) return null;
    return {
      id: doc._id.toHexString(),
      routeId: doc.plannedRouteId,
      severity: doc.severity,
      message: doc.message,
    };
  }

  public async getTransitScheduleHeadway(routeId: string, stopId: string, atIso?: string): Promise<number> {
    const schedule = await this.transitSchedules.findOne({ routeId, stopId });
    if (!schedule || !schedule.departuresIso || schedule.departuresIso.length < 2) {
        // Cannot determine headway with less than 2 departures
        return Infinity;
    }
    
    const atTime = atIso ? new Date(atIso).getTime() : Date.now();
    const departureTimes = schedule.departuresIso.map((iso: string) => new Date(iso).getTime());

    // Find the next departure after 'atTime'
    let nextDepartureIdx = -1;
    for (let i = 0; i < departureTimes.length; i++) {
        if (departureTimes[i] >= atTime) {
            nextDepartureIdx = i;
            break;
        }
    }

    if (nextDepartureIdx < 1) {
        // No next departure or it's the first one, can't calculate previous gap
        // Could calculate next gap instead, but for simplicity we return a large value
        return Infinity;
    }

    const prevDepartureTime = departureTimes[nextDepartureIdx - 1];
    const nextDepartureTime = departureTimes[nextDepartureIdx];
    
    const headwayMillis = nextDepartureTime - prevDepartureTime;
    return Math.round(headwayMillis / (1000 * 60)); // convert to minutes
  }
}
```
