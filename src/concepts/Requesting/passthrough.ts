/**
 * The Requesting concept exposes passthrough routes by default,
 * which allow POSTs to the route:
 *
 * /{REQUESTING_BASE_URL}/{Concept name}/{action or query}
 *
 * to passthrough directly to the concept action or query.
 * This is a convenient and natural way to expose concepts to
 * the world, but should only be done intentionally for public
 * actions and queries.
 *
 * This file allows you to explicitly set inclusions and exclusions
 * for passthrough routes:
 * - inclusions: those that you can justify their inclusion
 * - exclusions: those to exclude, using Requesting routes instead
 */

/**
 * INCLUSIONS
 *
 * Each inclusion must include a justification for why you think
 * the passthrough is appropriate (e.g. public query).
 *
 * inclusions = {"route": "justification"}
 */

export const inclusions: Record<string, string> = {
  // ============================================================================
  // Support Concepts - Public Queries (No Authentication Needed)
  // ============================================================================
  
  // POISearch - Public point of interest searches
  "/api/POISearch/searchPOIs": "public POI search - no sensitive data",
  "/api/POISearch/findTrails": "public trail search - no authentication needed",
  "/api/POISearch/findTrailheads": "public trailhead search - no authentication needed",
  "/api/POISearch/findTransitStops": "public transit stop search - no authentication needed",
  "/api/POISearch/findAmenities": "public amenity search - no authentication needed",
  "/api/POISearch/searchPOIsByName": "public POI name search - no authentication needed",
  "/api/POISearch/getPOIDetails": "public POI details - no authentication needed",
  "/api/POISearch/getPopularPOITypes": "public POI types list - read-only",
  "/api/POISearch/getPOITypeDescriptions": "public POI descriptions - read-only",
  
  // LocationSearch - Public geocoding
  "/api/LocationSearch/geocodeAddress": "public geocoding - no authentication needed",
  "/api/LocationSearch/reverseGeocode": "public reverse geocoding - no authentication needed",
  "/api/LocationSearch/getNearbyLocations": "public location search - no authentication needed",
  "/api/LocationSearch/getLocationDetails": "public location details - no authentication needed",
  
  // MapVisualization - Public map tiles
  "/api/MapVisualization/getMapTile": "public map tiles - standard web service",
  "/api/MapVisualization/getMapTilesForBounds": "public map tiles batch - standard web service",
  "/api/MapVisualization/getMapStyle": "public map style config - read-only",
  "/api/MapVisualization/getAvailableStyles": "public styles list - read-only",
  
  // UnifiedRouting - Public search interface
  "/api/UnifiedRouting/searchLocations": "public location search - no authentication needed",
  
  // UserHistory - Public feed only (no user-specific data)
  "/api/UserHistory/getPublicFeed": "public activity feed - aggregated public data only",
  "/api/UserHistory/getPopularRoutes": "public popular routes - aggregated anonymous data",
  
  // LLMRoutePlanner - Public stats only
  "/api/LLMRoutePlanner/getGlobalStats": "public aggregate statistics - no user-specific data",
};

/**
 * EXCLUSIONS
 *
 * Excluded routes fall back to the Requesting concept, and will
 * instead trigger the normal Requesting.request action. As this
 * is the intended behavior, no justification is necessary.
 *
 * exclusions = ["route"]
 */

export const exclusions: Array<string> = [
  // ============================================================================
  // User Concept - ALL require authentication
  // ============================================================================
  "/api/User/register",          // Goes through sync for lifecycle (Profile creation)
  "/api/User/login",              // Goes through sync for session creation
  "/api/User/authenticate",       // Protected authentication check
  "/api/User/logout",             // Requires valid session
  "/api/User/updatePassword",     // Requires authentication
  "/api/User/getUserProfile",     // Requires authentication (user-specific data)
  "/api/User/expireSessions",     // System action, not user-facing
  
  // ============================================================================
  // Profile Concept - ALL require authentication
  // ============================================================================
  "/api/Profile/createProfile",          // Requires userId authentication
  "/api/Profile/updateProfile",          // Requires userId authentication
  "/api/Profile/setVisibility",          // Requires userId authentication
  "/api/Profile/getProfile",             // May need auth for stats integration
  "/api/Profile/searchProfiles",         // Consider: could be public if no sensitive data
  "/api/Profile/getNearbyActiveHikers",  // Privacy-sensitive location data
  "/api/Profile/getPublicProfile",       // Consider: could be passthrough if truly public
  "/api/Profile/deleteProfile",          // Requires userId authentication
  
  // ============================================================================
  // UserHistory Concept - User-specific actions require authentication
  // ============================================================================
  "/api/UserHistory/recordActivity",      // Requires userId authentication
  "/api/UserHistory/getUserHistory",      // User-specific data
  "/api/UserHistory/getUserStats",        // User-specific data
  "/api/UserHistory/updateVisibility",    // Requires userId authentication
  "/api/UserHistory/deleteActivity",      // Requires userId authentication
  "/api/UserHistory/getUserAchievements", // User-specific data
  // Note: getPublicFeed and getPopularRoutes are in inclusions (public data)
  
  // ============================================================================
  // LLMRoutePlanner Concept - ALL require authentication (expensive API calls)
  // ============================================================================
  "/api/LLMRoutePlanner/planRoute",           // CRITICAL: Expensive LLM + Maps API calls
  "/api/LLMRoutePlanner/getRequestHistory",   // User-specific data
  "/api/LLMRoutePlanner/getUsageStats",       // User-specific data
  // Note: getGlobalStats is in inclusions (aggregate public data)
];
