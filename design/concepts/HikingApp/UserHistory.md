purpose Track and display users' public activity history to enable social discovery, reputation building, and personalized recommendations
principle As users perform activities (complete hikes, save routes, rate trails), their actions are recorded; other users can view this history to discover popular routes, find experienced hikers, and build trust in the community
state
A set of Users (external reference)
A set of HistoryEntries with ObjectId, userId (reference to User), activityType String, activityData Object, location GeoJSON, timestamp Date, visibility String ("public" | "private" | "friends"), and metadata Object
A set of ActivityStats with userId, totalHikes Number, totalDistance Number, totalDuration Number, completionRate Number, favoriteLocations Array<String>, and lastActiveAt Date
actions
recordActivity(userId: String, activityType: String, activityData: Object, location?: GeoJSON, visibility?: String): (entryId: String)
requires userId exists, activityType is valid ("hike_completed", "route_saved", "route_planned", "trail_rated", "poi_visited"), visibility is valid (defaults to "public")
effects creates new HistoryEntry with timestamp set to current time, updates relevant ActivityStats, returns entry ID
getUserHistory(userId: String, limit?: Number, activityType?: String): (entries: Array<HistoryEntry>)
requires userId exists, limit > 0 if specified
effects returns chronologically ordered array of public HistoryEntries for user, filtered by activityType if specified, limited to most recent entries
getPublicFeed(location?: GeoJSON, radius?: Number, limit?: Number): (entries: Array<HistoryEntry>)
requires if location specified, radius must be positive number in meters
effects returns recent public HistoryEntries, optionally filtered by geographic proximity to location, limited to most recent entries (default 50)
getUserStats(userId: String): (stats: ActivityStats)
requires userId exists
effects returns aggregated activity statistics for the user
updateVisibility(entryId: String, userId: String, newVisibility: String): (success: Boolean)
requires entryId exists, userId matches entry owner, newVisibility is valid
effects updates visibility field of HistoryEntry, returns true
deleteActivity(entryId: String, userId: String): (success: Boolean)
requires entryId exists, userId matches entry owner
effects removes HistoryEntry from state, updates relevant ActivityStats, returns true
getPopularRoutes(timeWindow: String, limit?: Number): (routes: Array<{routeId: String, count: Number, avgRating: Number}>)
requires timeWindow is valid ("day", "week", "month", "year")
effects analyzes HistoryEntries within timeWindow, returns most frequently completed routes with usage counts and average ratings
getUserAchievements(userId: String): (achievements: Array<{type: String, unlockedAt: Date, details: Object}>)
requires userId exists
effects calculates achievements based on ActivityStats (e.g., "First Hike", "10 Hikes Completed", "100km Total Distance"), returns array of unlocked achievements
implementation notes
Use MongoDB with indexes on userId, timestamp, and location (2dsphere) for efficient queries
ActivityStats denormalized for performance; update incrementally on recordActivity
Consider privacy: default to public but allow users to control visibility
activityData is flexible Object to support different activity types:
hike_completed: {routeId, duration, distance, exitPoint, conditions}
route_saved: {routeId, origin, destination, mode}
trail_rated: {trailId, rating, comment}
location field optional but enables geographic discovery features
Implement pagination for large result sets
Consider caching popular routes and public feed for performance
Achievement system can be expanded based on community feedback