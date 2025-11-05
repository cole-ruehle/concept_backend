import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * UserHistory concept
 * 
 * **purpose**: Track and display users' public activity history to enable social discovery, 
 * reputation building, and personalized recommendations
 * 
 * **principle**: As users perform activities (complete hikes, save routes, rate trails), 
 * their actions are recorded; other users can view this history to discover popular routes, 
 * find experienced hikers, and build trust in the community
 */

// Collection prefix
const PREFIX = "UserHistory.";

// Generic types
type User = ID;
type HistoryEntry = ID;

/**
 * GeoJSON Point type
 */
interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

/**
 * Valid activity types
 */
type ActivityType = "hike_completed" | "route_saved" | "route_planned" | "trail_rated" | "poi_visited";

/**
 * Valid visibility levels
 */
type Visibility = "public" | "private" | "friends";

/**
 * a set of HistoryEntries with
 *   userId (reference to User)
 *   activityType String
 *   activityData Object
 *   location GeoJSON
 *   timestamp Date
 *   visibility String ("public" | "private" | "friends")
 *   metadata Object
 */
interface HistoryEntries {
  _id: HistoryEntry;
  userId: User;
  activityType: ActivityType;
  activityData: Record<string, any>;
  location?: GeoJSONPoint;
  timestamp: Date;
  visibility: Visibility;
  metadata?: Record<string, any>;
}

/**
 * a set of ActivityStats with
 *   userId
 *   totalHikes Number
 *   totalDistance Number
 *   totalDuration Number
 *   completionRate Number
 *   favoriteLocations Array<String>
 *   lastActiveAt Date
 */
interface ActivityStats {
  _id: ID;
  userId: User;
  totalHikes: number;
  totalDistance: number;
  totalDuration: number;
  completionRate: number;
  favoriteLocations: string[];
  lastActiveAt: Date;
}

export default class UserHistoryConcept {
  historyEntries: Collection<HistoryEntries>;
  activityStats: Collection<ActivityStats>;

  constructor(private readonly db: Db) {
    this.historyEntries = this.db.collection(PREFIX + "historyEntries");
    this.activityStats = this.db.collection(PREFIX + "activityStats");

    // Create indexes
    this.historyEntries.createIndex({ userId: 1 });
    this.historyEntries.createIndex({ timestamp: -1 });
    this.historyEntries.createIndex({ activityType: 1 });
    this.historyEntries.createIndex({ visibility: 1 });
    this.historyEntries.createIndex({ location: "2dsphere" });
    this.activityStats.createIndex({ userId: 1 }, { unique: true });
  }

  /**
   * recordActivity(userId: String, activityType: String, activityData: Object, location?: GeoJSON, 
   *                visibility?: String): (entryId: String)
   * 
   * **requires** userId exists, activityType is valid ("hike_completed", "route_saved", 
   * "route_planned", "trail_rated", "poi_visited"), visibility is valid (defaults to "public")
   * 
   * **effects** creates new HistoryEntry with timestamp set to current time, updates relevant 
   * ActivityStats, returns entry ID
   */
  async recordActivity({ userId, activityType, activityData, location, visibility }: { 
    userId: string; 
    activityType: string; 
    activityData: Record<string, any>; 
    location?: GeoJSONPoint; 
    visibility?: string 
  }): Promise<{ entryId: string } | { error: string }> {
    // Validate activityType
    const validActivityTypes: ActivityType[] = [
      "hike_completed", 
      "route_saved", 
      "route_planned", 
      "trail_rated", 
      "poi_visited"
    ];
    if (!validActivityTypes.includes(activityType as ActivityType)) {
      return { error: "Invalid activity type" };
    }

    // Validate visibility
    const validVisibilities: Visibility[] = ["public", "private", "friends"];
    const vis = (visibility || "public") as Visibility;
    if (!validVisibilities.includes(vis)) {
      return { error: "Invalid visibility" };
    }

    // Create history entry
    const entryId = freshID();
    const timestamp = new Date();
    await this.historyEntries.insertOne({
      _id: entryId,
      userId: userId as User,
      activityType: activityType as ActivityType,
      activityData,
      location,
      timestamp,
      visibility: vis,
    });

    // Update activity stats
    await this.updateActivityStats(userId as User, activityType as ActivityType, activityData, timestamp);

    return { entryId: entryId as string };
  }

  /**
   * getUserHistory(userId: String, limit?: Number, activityType?: String): 
   *   (entries: Array<HistoryEntry>)
   * 
   * **requires** userId exists, limit > 0 if specified
   * 
   * **effects** returns chronologically ordered array of public HistoryEntries for user, 
   * filtered by activityType if specified, limited to most recent entries
   */
  async getUserHistory({ userId, limit, activityType }: { 
    userId: string; 
    limit?: number; 
    activityType?: string 
  }): Promise<{ 
    entries: Array<{
      entryId: string;
      activityType: string;
      activityData: Record<string, any>;
      location?: GeoJSONPoint;
      timestamp: Date;
      visibility: string;
    }>
  } | { error: string }> {
    if (limit !== undefined && limit <= 0) {
      return { error: "Limit must be greater than 0" };
    }

    const maxLimit = limit || 50;
    const query: any = { userId: userId as User };
    
    if (activityType) {
      const validActivityTypes: ActivityType[] = [
        "hike_completed", 
        "route_saved", 
        "route_planned", 
        "trail_rated", 
        "poi_visited"
      ];
      if (!validActivityTypes.includes(activityType as ActivityType)) {
        return { error: "Invalid activity type" };
      }
      query.activityType = activityType;
    }

    const entries = await this.historyEntries
      .find(query)
      .sort({ timestamp: -1 })
      .limit(maxLimit)
      .toArray();

    return {
      entries: entries.map(e => ({
        entryId: e._id as string,
        activityType: e.activityType,
        activityData: e.activityData,
        location: e.location,
        timestamp: e.timestamp,
        visibility: e.visibility,
      }))
    };
  }

  /**
   * getPublicFeed(location?: GeoJSON, radius?: Number, limit?: Number): 
   *   (entries: Array<HistoryEntry>)
   * 
   * **requires** if location specified, radius must be positive number in meters
   * 
   * **effects** returns recent public HistoryEntries, optionally filtered by geographic proximity 
   * to location, limited to most recent entries (default 50)
   */
  async getPublicFeed({ location, radius, limit }: { 
    location?: GeoJSONPoint; 
    radius?: number; 
    limit?: number 
  }): Promise<{ 
    entries: Array<{
      entryId: string;
      userId: string;
      activityType: string;
      activityData: Record<string, any>;
      location?: GeoJSONPoint;
      timestamp: Date;
    }>
  } | { error: string }> {
    if (location && (!radius || radius <= 0)) {
      return { error: "Radius must be a positive number when location is specified" };
    }

    const maxLimit = limit || 50;
    const query: any = { visibility: "public" };

    // Add location filter if specified
    if (location && radius) {
      query.location = {
        $nearSphere: {
          $geometry: location,
          $maxDistance: radius
        }
      };
    }

    const entries = await this.historyEntries
      .find(query)
      .sort({ timestamp: -1 })
      .limit(maxLimit)
      .toArray();

    return {
      entries: entries.map(e => ({
        entryId: e._id as string,
        userId: e.userId as string,
        activityType: e.activityType,
        activityData: e.activityData,
        location: e.location,
        timestamp: e.timestamp,
      }))
    };
  }

  /**
   * getUserStats(userId: String): (stats: ActivityStats)
   * 
   * **requires** userId exists
   * 
   * **effects** returns aggregated activity statistics for the user
   */
  async getUserStats({ userId }: { 
    userId: string 
  }): Promise<{ 
    stats: {
      totalHikes: number;
      totalDistance: number;
      totalDuration: number;
      completionRate: number;
      favoriteLocations: string[];
      lastActiveAt: Date;
    }
  } | { error: string }> {
    let stats = await this.activityStats.findOne({ userId: userId as User });
    
    // If no stats exist, create default stats
    if (!stats) {
      const statsId = freshID();
      stats = {
        _id: statsId,
        userId: userId as User,
        totalHikes: 0,
        totalDistance: 0,
        totalDuration: 0,
        completionRate: 0,
        favoriteLocations: [],
        lastActiveAt: new Date(),
      };
      await this.activityStats.insertOne(stats);
    }

    return {
      stats: {
        totalHikes: stats.totalHikes,
        totalDistance: stats.totalDistance,
        totalDuration: stats.totalDuration,
        completionRate: stats.completionRate,
        favoriteLocations: stats.favoriteLocations,
        lastActiveAt: stats.lastActiveAt,
      }
    };
  }

  /**
   * updateVisibility(entryId: String, userId: String, newVisibility: String): (success: Boolean)
   * 
   * **requires** entryId exists, userId matches entry owner, newVisibility is valid
   * 
   * **effects** updates visibility field of HistoryEntry, returns true
   */
  async updateVisibility({ entryId, userId, newVisibility }: { 
    entryId: string; 
    userId: string; 
    newVisibility: string 
  }): Promise<{ success: boolean } | { error: string }> {
    const entry = await this.historyEntries.findOne({ _id: entryId as HistoryEntry });
    if (!entry) {
      return { error: "History entry not found" };
    }

    if (entry.userId !== (userId as User)) {
      return { error: "User does not own this entry" };
    }

    const validVisibilities: Visibility[] = ["public", "private", "friends"];
    if (!validVisibilities.includes(newVisibility as Visibility)) {
      return { error: "Invalid visibility" };
    }

    await this.historyEntries.updateOne(
      { _id: entryId as HistoryEntry },
      { $set: { visibility: newVisibility as Visibility } }
    );

    return { success: true };
  }

  /**
   * deleteActivity(entryId: String, userId: String): (success: Boolean)
   * 
   * **requires** entryId exists, userId matches entry owner
   * 
   * **effects** removes HistoryEntry from state, updates relevant ActivityStats, returns true
   */
  async deleteActivity({ entryId, userId }: { 
    entryId: string; 
    userId: string 
  }): Promise<{ success: boolean } | { error: string }> {
    const entry = await this.historyEntries.findOne({ _id: entryId as HistoryEntry });
    if (!entry) {
      return { error: "History entry not found" };
    }

    if (entry.userId !== (userId as User)) {
      return { error: "User does not own this entry" };
    }

    // Delete the entry
    await this.historyEntries.deleteOne({ _id: entryId as HistoryEntry });

    // Update stats (decrement relevant counters)
    if (entry.activityType === "hike_completed") {
      const distance = entry.activityData.distance || 0;
      const duration = entry.activityData.duration || 0;
      
      await this.activityStats.updateOne(
        { userId: userId as User },
        { 
          $inc: { 
            totalHikes: -1,
            totalDistance: -distance,
            totalDuration: -duration
          }
        }
      );
    }

    return { success: true };
  }

  /**
   * getPopularRoutes(timeWindow: String, limit?: Number): 
   *   (routes: Array<{routeId: String, count: Number, avgRating: Number}>)
   * 
   * **requires** timeWindow is valid ("day", "week", "month", "year")
   * 
   * **effects** analyzes HistoryEntries within timeWindow, returns most frequently completed 
   * routes with usage counts and average ratings
   */
  async getPopularRoutes({ timeWindow, limit }: { 
    timeWindow: string; 
    limit?: number 
  }): Promise<{ 
    routes: Array<{
      routeId: string;
      count: number;
      avgRating?: number;
    }>
  } | { error: string }> {
    const validTimeWindows = ["day", "week", "month", "year"];
    if (!validTimeWindows.includes(timeWindow)) {
      return { error: "Invalid time window" };
    }

    const maxLimit = limit || 20;

    // Calculate time threshold
    const now = new Date();
    const timeThresholds: Record<string, number> = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };
    const threshold = new Date(now.getTime() - timeThresholds[timeWindow]);

    // Aggregate hike completions and ratings
    const pipeline = [
      {
        $match: {
          timestamp: { $gte: threshold },
          activityType: { $in: ["hike_completed", "trail_rated"] }
        }
      },
      {
        $group: {
          _id: "$activityData.routeId",
          count: { 
            $sum: { 
              $cond: [{ $eq: ["$activityType", "hike_completed"] }, 1, 0] 
            } 
          },
          ratings: {
            $push: {
              $cond: [
                { $eq: ["$activityType", "trail_rated"] },
                "$activityData.rating",
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          routeId: "$_id",
          count: 1,
          avgRating: { 
            $avg: {
              $filter: {
                input: "$ratings",
                cond: { $ne: ["$$this", null] }
              }
            }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: maxLimit }
    ];

    const results = await this.historyEntries.aggregate(pipeline).toArray();

    return {
      routes: results.map(r => ({
        routeId: r._id || "unknown",
        count: r.count,
        avgRating: r.avgRating || undefined,
      }))
    };
  }

  /**
   * getUserAchievements(userId: String): 
   *   (achievements: Array<{type: String, unlockedAt: Date, details: Object}>)
   * 
   * **requires** userId exists
   * 
   * **effects** calculates achievements based on ActivityStats (e.g., "First Hike", 
   * "10 Hikes Completed", "100km Total Distance"), returns array of unlocked achievements
   */
  async getUserAchievements({ userId }: { 
    userId: string 
  }): Promise<{ 
    achievements: Array<{
      type: string;
      unlockedAt: Date;
      details: Record<string, any>;
    }>
  }> {
    const stats = await this.activityStats.findOne({ userId: userId as User });
    const achievements: Array<{
      type: string;
      unlockedAt: Date;
      details: Record<string, any>;
    }> = [];

    if (!stats) {
      return { achievements: [] };
    }

    // Calculate achievements based on stats
    if (stats.totalHikes >= 1) {
      achievements.push({
        type: "First Hike",
        unlockedAt: stats.lastActiveAt,
        details: { description: "Completed your first hike!" }
      });
    }

    if (stats.totalHikes >= 10) {
      achievements.push({
        type: "10 Hikes Completed",
        unlockedAt: stats.lastActiveAt,
        details: { description: "Completed 10 hikes!", totalHikes: stats.totalHikes }
      });
    }

    if (stats.totalHikes >= 50) {
      achievements.push({
        type: "50 Hikes Completed",
        unlockedAt: stats.lastActiveAt,
        details: { description: "Completed 50 hikes!", totalHikes: stats.totalHikes }
      });
    }

    if (stats.totalHikes >= 100) {
      achievements.push({
        type: "Century Club",
        unlockedAt: stats.lastActiveAt,
        details: { description: "Completed 100 hikes!", totalHikes: stats.totalHikes }
      });
    }

    if (stats.totalDistance >= 100) {
      achievements.push({
        type: "100km Total Distance",
        unlockedAt: stats.lastActiveAt,
        details: { description: "Hiked 100km total!", totalDistance: stats.totalDistance }
      });
    }

    if (stats.totalDistance >= 500) {
      achievements.push({
        type: "500km Total Distance",
        unlockedAt: stats.lastActiveAt,
        details: { description: "Hiked 500km total!", totalDistance: stats.totalDistance }
      });
    }

    if (stats.totalDistance >= 1000) {
      achievements.push({
        type: "1000km Total Distance",
        unlockedAt: stats.lastActiveAt,
        details: { description: "Hiked 1000km total!", totalDistance: stats.totalDistance }
      });
    }

    if (stats.completionRate >= 0.9) {
      achievements.push({
        type: "Reliable Hiker",
        unlockedAt: stats.lastActiveAt,
        details: { description: "90%+ completion rate!", completionRate: stats.completionRate }
      });
    }

    return { achievements };
  }

  // Private helper methods

  private async updateActivityStats(
    userId: User, 
    activityType: ActivityType, 
    activityData: Record<string, any>,
    timestamp: Date
  ): Promise<void> {
    // Initialize stats if they don't exist
    const existingStats = await this.activityStats.findOne({ userId });
    if (!existingStats) {
      const statsId = freshID();
      await this.activityStats.insertOne({
        _id: statsId,
        userId,
        totalHikes: 0,
        totalDistance: 0,
        totalDuration: 0,
        completionRate: 0,
        favoriteLocations: [],
        lastActiveAt: timestamp,
      });
    }

    // Update stats based on activity type
    const updates: any = { lastActiveAt: timestamp };

    if (activityType === "hike_completed") {
      const distance = activityData.distance || 0;
      const duration = activityData.duration || 0;
      
      updates.$inc = {
        totalHikes: 1,
        totalDistance: distance,
        totalDuration: duration,
      };
    }

    // Update favorite locations
    if (activityData.location) {
      updates.$addToSet = { favoriteLocations: activityData.location };
    }

    await this.activityStats.updateOne(
      { userId },
      updates.hasOwnProperty("$inc") ? updates : { $set: updates }
    );

    // Recalculate completion rate
    // This is a simplified calculation - in a real implementation, 
    // you'd track planned vs completed hikes
    const stats = await this.activityStats.findOne({ userId });
    if (stats && stats.totalHikes > 0) {
      const completionRate = Math.min(0.95, 0.7 + (stats.totalHikes * 0.01));
      await this.activityStats.updateOne(
        { userId },
        { $set: { completionRate } }
      );
    }
  }
}

