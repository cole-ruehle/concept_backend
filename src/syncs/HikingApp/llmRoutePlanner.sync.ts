/**
 * LLMRoutePlanner Concept Synchronizations
 * 
 * These synchronizations handle:
 * 1. Authentication gates (protect expensive LLM/Maps API calls)
 * 2. Rate limiting (prevent abuse)
 * 3. Request/response patterns
 * 4. Activity recording (track route planning in user history)
 * 5. Usage stats
 */

import { Requesting, User, LLMRoutePlanner, UserHistory } from "@concepts";
import { actions, Frames, Sync } from "@engine";

// ============================================================================
// Authentication Gate + Request
// ============================================================================

/**
 * LLMRoutePlannerAuthenticatedRequest
 * 
 * Purpose: Authenticate user before allowing expensive LLM route planning
 * 
 * This is critical because:
 * - LLM API calls cost money (Gemini)
 * - Google Maps API calls have quotas and costs
 * - Prevents abuse and spam
 * - Enables per-user tracking and rate limiting
 */
export const LLMRoutePlannerAuthenticatedRequest: Sync = ({ 
  request, 
  sessionToken, 
  userId,
  query,
  userLocation,
  preferences,
  currentRoute
}) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/planRoute", sessionToken, query, userLocation, preferences, currentRoute }, { request }],
    [User.authenticate, { sessionToken }, { userId }],
  ),
  then: actions([
    LLMRoutePlanner.planRoute, { 
      userId, 
      query, 
      userLocation, 
      preferences, 
      currentRoute 
    }
  ]),
});

/**
 * LLMRoutePlannerAuthenticationError
 * 
 * Purpose: Handle authentication failures
 */
export const LLMRoutePlannerAuthenticationError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/planRoute" }, { request }],
    [User.authenticate, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Rate Limiting Gate
// ============================================================================

/**
 * LLMRoutePlannerRateLimit
 * 
 * Purpose: Prevent abuse of expensive API calls
 * 
 * Limits: 10 requests per hour per user
 * This can be adjusted based on usage patterns and cost analysis
 */
export const LLMRoutePlannerRateLimit: Sync = ({ 
  request, 
  userId, 
  recentRequestCount 
}) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/planRoute" }, { request }],
    [User.authenticate, {}, { userId }],
  ),
  where: async (frames) => {
    // Query how many requests this user made in last hour
    const rateLimitFrames = await frames.query(
      LLMRoutePlanner._getRecentRequestCount,
      { userId, timeWindowMinutes: 60 },
      { recentRequestCount }
    );
    
    // Check if over limit (10 requests/hour)
    const overLimitFrames = rateLimitFrames.filter(
      ($) => $[recentRequestCount] >= 10
    );
    
    if (overLimitFrames.length > 0) {
      await Requesting.respond({ 
        request, 
        error: "Rate limit exceeded. You can make 10 route planning requests per hour. Please try again later." 
      });
      return new Frames(); // Stop processing
    }
    
    return frames;
  },
  then: actions([
    // Continue with route planning - no action needed, just passes through
  ]),
});

// ============================================================================
// Success Response
// ============================================================================

export const LLMRoutePlannerPlanRouteResponse: Sync = ({ 
  request, 
  route, 
  suggestions 
}) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/planRoute" }, { request }],
    [LLMRoutePlanner.planRoute, {}, { route, suggestions }],
  ),
  then: actions([Requesting.respond, { request, route, suggestions }]),
});

// ============================================================================
// Error Response
// ============================================================================

export const LLMRoutePlannerPlanRouteError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/planRoute" }, { request }],
    [LLMRoutePlanner.planRoute, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Activity Recording
// ============================================================================

/**
 * LLMRoutePlanningActivityRecording
 * 
 * Purpose: Track when users plan routes for:
 * - Personalized route recommendations
 * - Popular destination tracking
 * - User engagement metrics
 * - Achievement unlocking
 * 
 * Note: LLM queries are marked as private by default since they might contain
 * personal information about where users want to go
 */
export const LLMRoutePlanningActivityRecording: Sync = ({ 
  userId, 
  query, 
  route 
}) => ({
  when: actions(
    [LLMRoutePlanner.planRoute, { userId, query }, { route }],
  ),
  then: actions(
    [UserHistory.recordActivity, {
      userId,
      activityType: "route_planned",
      activityData: {
        routeId: route.route_id,
        routeName: route.name,
        query,
        method: "llm",
        origin: route.origin,
        destination: route.destination,
        totalMinutes: route.metrics.totalMin,
        segmentCount: route.segments.length
      },
      location: route.destination,
      visibility: "private" // LLM queries are private by default
    }],
  ),
});

// ============================================================================
// Request History - Get Request History
// ============================================================================

export const LLMRoutePlannerGetRequestHistoryRequest: Sync = ({ 
  request, 
  sessionToken,
  userId,
  limit 
}) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/getRequestHistory", sessionToken, limit }, { request }],
    [User.authenticate, { sessionToken }, { userId }],
  ),
  then: actions([LLMRoutePlanner.getRequestHistory, { userId, limit }]),
});

export const LLMRoutePlannerGetRequestHistoryAuthError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/getRequestHistory" }, { request }],
    [User.authenticate, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

export const LLMRoutePlannerGetRequestHistoryResponse: Sync = ({ 
  request, 
  requests 
}) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/getRequestHistory" }, { request }],
    [LLMRoutePlanner.getRequestHistory, {}, { requests }],
  ),
  then: actions([Requesting.respond, { request, requests }]),
});

// ============================================================================
// Usage Stats - Get User Usage Stats
// ============================================================================

export const LLMRoutePlannerGetUsageStatsRequest: Sync = ({ 
  request, 
  sessionToken,
  userId 
}) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/getUsageStats", sessionToken }, { request }],
    [User.authenticate, { sessionToken }, { userId }],
  ),
  then: actions([LLMRoutePlanner.getUsageStats, { userId }]),
});

export const LLMRoutePlannerGetUsageStatsAuthError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/getUsageStats" }, { request }],
    [User.authenticate, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

export const LLMRoutePlannerGetUsageStatsResponse: Sync = ({ 
  request, 
  stats 
}) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/getUsageStats" }, { request }],
    [LLMRoutePlanner.getUsageStats, {}, { stats }],
  ),
  then: actions([Requesting.respond, { request, stats }]),
});

export const LLMRoutePlannerGetUsageStatsError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/getUsageStats" }, { request }],
    [LLMRoutePlanner.getUsageStats, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Global Stats - Admin/Public Statistics
// ============================================================================

/**
 * Global stats don't require authentication since they're aggregate statistics
 * that don't expose individual user data
 */
export const LLMRoutePlannerGetGlobalStatsRequest: Sync = ({ request }) => ({
  when: actions([
    Requesting.request,
    { path: "/llmRoutePlanner/getGlobalStats" },
    { request },
  ]),
  then: actions([LLMRoutePlanner.getGlobalStats, {}]),
});

export const LLMRoutePlannerGetGlobalStatsResponse: Sync = ({ 
  request, 
  stats 
}) => ({
  when: actions(
    [Requesting.request, { path: "/llmRoutePlanner/getGlobalStats" }, { request }],
    [LLMRoutePlanner.getGlobalStats, {}, { stats }],
  ),
  then: actions([Requesting.respond, { request, stats }]),
});

