import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";
import { 
  RoutePlannerOrchestrator, 
  PlanRouteRequest, 
  RouteResponse,
  UserPreferences,
  CurrentRoute,
  RouteSegment
} from "../../services/RoutePlannerOrchestrator.ts";
import { Location } from "../../services/GoogleMapsClient.ts";

/**
 * LLMRoutePlanner concept
 * 
 * **purpose**: Enable natural language-based multi-modal route planning (transit + hiking) 
 * through LLM orchestration, allowing users to create and modify routes without rigid UI constraints
 * 
 * **principle**: When a user provides a natural language query with their location, the LLM 
 * analyzes the intent and generates a routing plan. For new routes, the system searches for 
 * destinations matching the query and calculates multi-modal directions. For route modifications 
 * (when currentRoute is provided), the LLM detects the modification type (add waypoint, exit now, 
 * adjust timing) and modifies the existing route accordingly. The system returns a complete route 
 * with segments, metrics, and contextual suggestions.
 */

// Collection prefix
const PREFIX = "LLMRoutePlanner.";

// Generic types
type User = ID;
type RequestId = ID;

/**
 * a set of RouteRequests with
 *   userId User
 *   query String
 *   userLocation Location
 *   preferences UserPreferences
 *   currentRoute CurrentRoute (optional)
 *   response RouteResponse (optional)
 *   timestamp Date
 *   durationMs Number
 *   success Boolean
 */
interface RouteRequestDoc {
  _id: RequestId;
  userId: User;
  query: string;
  userLocation: Location;
  preferences?: UserPreferences;
  currentRoute?: CurrentRoute;
  response?: RouteResponse;
  timestamp: Date;
  durationMs?: number;
  success: boolean;
}

export default class LLMRoutePlannerConcept {
  private routeRequests: Collection<RouteRequestDoc>;
  private orchestrator: RoutePlannerOrchestrator;

  constructor(private readonly db: Db) {
    this.routeRequests = this.db.collection(PREFIX + "routeRequests");

    // Create indexes
    this.routeRequests.createIndex({ userId: 1, timestamp: -1 });
    this.routeRequests.createIndex({ timestamp: -1 });
    this.routeRequests.createIndex({ success: 1 });

    // Initialize the orchestrator with API keys from environment
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const mapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!geminiApiKey || !mapsApiKey) {
      throw new Error("GEMINI_API_KEY and GOOGLE_MAPS_API_KEY must be set");
    }

    this.orchestrator = new RoutePlannerOrchestrator(geminiApiKey, mapsApiKey);
  }

  /**
   * planRoute(userId: String, query: String, userLocation: Location, preferences?: UserPreferences, 
   *           currentRoute?: CurrentRoute): (route: RouteResponse, suggestions: String[])
   * 
   * **requires** userId exists in User concept, query is non-empty string, userLocation has valid lat/lng
   * 
   * **effects** Uses LLM to interpret query and orchestrate Google Maps APIs to generate a route.
   * Logs the request and response to MongoDB. For new routes, searches for destinations and calculates
   * multi-modal directions. For route modifications, detects modification type and adjusts existing route.
   * Returns complete route with segments, metrics, and contextual suggestions.
   */
  async planRoute({ 
    userId, 
    query, 
    userLocation, 
    preferences, 
    currentRoute 
  }: { 
    userId: string;
    query: string;
    userLocation: Location;
    preferences?: UserPreferences;
    currentRoute?: CurrentRoute;
  }): Promise<{ route: RouteResponse["route"]; suggestions: string[] } | { error: string }> {
    console.log("\n🎯 [LLMRoutePlanner.planRoute] Called!");
    console.log(`   User: ${userId}`);
    console.log(`   Query: ${query}`);
    console.log(`   Location: ${userLocation.lat}, ${userLocation.lng}`);
    
    // Validate inputs
    if (!query || query.trim().length === 0) {
      console.log("❌ [LLMRoutePlanner] Validation failed: Empty query");
      return { error: "Query cannot be empty" };
    }

    if (!userLocation || typeof userLocation.lat !== "number" || typeof userLocation.lng !== "number") {
      console.log("❌ [LLMRoutePlanner] Validation failed: Invalid location");
      return { error: "Invalid user location" };
    }

    if (userLocation.lat < -90 || userLocation.lat > 90) {
      console.log("❌ [LLMRoutePlanner] Validation failed: Invalid latitude");
      return { error: "Latitude must be between -90 and 90" };
    }

    if (userLocation.lng < -180 || userLocation.lng > 180) {
      console.log("❌ [LLMRoutePlanner] Validation failed: Invalid longitude");
      return { error: "Longitude must be between -180 and 180" };
    }

    const requestId = freshID();
    const timestamp = new Date();
    const startTime = Date.now();
    
    console.log("✅ [LLMRoutePlanner] Validation passed, calling orchestrator...");

    // Create request log entry
    const requestDoc: RouteRequestDoc = {
      _id: requestId,
      userId: userId as User,
      query,
      userLocation,
      preferences,
      currentRoute,
      timestamp,
      success: false,
    };

    try {
      // Call the orchestrator service
      const response = await this.orchestrator.planRoute({
        query,
        userLocation,
        preferences,
        currentRoute,
      });

      const durationMs = Date.now() - startTime;
      
      console.log(`✅ [LLMRoutePlanner] Orchestrator completed in ${durationMs}ms`);
      console.log(`   Route: ${response.route.name}`);
      console.log(`   Suggestions: ${response.suggestions.length} items`);

      // Update request log with success
      requestDoc.response = response;
      requestDoc.success = true;
      requestDoc.durationMs = durationMs;

      await this.routeRequests.insertOne(requestDoc);

      return {
        route: response.route,
        suggestions: response.suggestions,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      console.error(`❌ [LLMRoutePlanner] Error after ${durationMs}ms:`, error);

      // Log the failed request
      requestDoc.success = false;
      requestDoc.durationMs = durationMs;
      await this.routeRequests.insertOne(requestDoc);

      console.error("Error planning route:", error);
      return { 
        error: error instanceof Error ? error.message : "Failed to plan route" 
      };
    }
  }

  /**
   * getRequestHistory(userId: String, limit?: Number): (requests: Array<RouteRequest>)
   * 
   * **requires** userId exists
   * 
   * **effects** Returns chronologically ordered array of route planning requests for the user,
   * limited to most recent entries (default 50)
   */
  async getRequestHistory({ 
    userId, 
    limit 
  }: { 
    userId: string; 
    limit?: number 
  }): Promise<{ 
    requests: Array<{
      requestId: string;
      query: string;
      timestamp: Date;
      success: boolean;
      durationMs?: number;
      routeName?: string;
    }>
  }> {
    const maxLimit = limit || 50;

    const requests = await this.routeRequests
      .find({ userId: userId as User })
      .sort({ timestamp: -1 })
      .limit(maxLimit)
      .toArray();

    return {
      requests: requests.map(req => ({
        requestId: req._id as string,
        query: req.query,
        timestamp: req.timestamp,
        success: req.success,
        durationMs: req.durationMs,
        routeName: req.response?.route.name,
      }))
    };
  }

  /**
   * _getRecentRequestCount(userId: String, timeWindowMinutes: Number): (count: Number)
   * 
   * **query** Returns count of requests made by user within the specified time window
   * 
   * This is used for rate limiting
   */
  async _getRecentRequestCount({ 
    userId, 
    timeWindowMinutes 
  }: { 
    userId: string; 
    timeWindowMinutes: number 
  }): Promise<{ count: number }[]> {
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const count = await this.routeRequests.countDocuments({
      userId: userId as User,
      timestamp: { $gte: cutoffTime },
    });

    return [{ count }];
  }

  /**
   * getUsageStats(userId: String): (stats: UsageStats)
   * 
   * **requires** userId exists
   * 
   * **effects** Returns aggregated usage statistics for the user including total requests,
   * success rate, average response time, and most common queries
   */
  async getUsageStats({ 
    userId 
  }: { 
    userId: string 
  }): Promise<{ 
    stats: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      successRate: number;
      avgDurationMs: number;
      totalRoutesPlanned: number;
    }
  } | { error: string }> {
    const requests = await this.routeRequests
      .find({ userId: userId as User })
      .toArray();

    if (requests.length === 0) {
      return {
        stats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          successRate: 0,
          avgDurationMs: 0,
          totalRoutesPlanned: 0,
        }
      };
    }

    const successfulRequests = requests.filter(r => r.success).length;
    const failedRequests = requests.length - successfulRequests;
    const totalDuration = requests.reduce((sum, r) => sum + (r.durationMs || 0), 0);

    return {
      stats: {
        totalRequests: requests.length,
        successfulRequests,
        failedRequests,
        successRate: successfulRequests / requests.length,
        avgDurationMs: totalDuration / requests.length,
        totalRoutesPlanned: successfulRequests,
      }
    };
  }

  /**
   * getGlobalStats(): (stats: GlobalStats)
   * 
   * **effects** Returns aggregated statistics across all users including total requests,
   * average success rate, popular query patterns, and system performance metrics
   */
  async getGlobalStats(): Promise<{ 
    stats: {
      totalRequests: number;
      totalUsers: number;
      overallSuccessRate: number;
      avgDurationMs: number;
      requestsLast24h: number;
    }
  }> {
    const allRequests = await this.routeRequests.find({}).toArray();

    const uniqueUsers = new Set(allRequests.map(r => r.userId)).size;
    const successfulRequests = allRequests.filter(r => r.success).length;
    const totalDuration = allRequests.reduce((sum, r) => sum + (r.durationMs || 0), 0);

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequests = allRequests.filter(r => r.timestamp >= last24h).length;

    return {
      stats: {
        totalRequests: allRequests.length,
        totalUsers: uniqueUsers,
        overallSuccessRate: allRequests.length > 0 ? successfulRequests / allRequests.length : 0,
        avgDurationMs: allRequests.length > 0 ? totalDuration / allRequests.length : 0,
        requestsLast24h: recentRequests,
      }
    };
  }
}

