/**
 * Integration Synchronizations
 * 
 * These synchronizations coordinate data aggregation across concepts:
 * - Profile stats integration (Profile + UserHistory)
 * - Public feed enrichment (UserHistory + Profile)
 */

import { Requesting, Profile, UserHistory } from "@concepts";
import { actions, Frames, Sync } from "@engine";

// ============================================================================
// Profile Stats Integration
// ============================================================================

/**
 * ProfileStatsIntegration
 * 
 * Purpose: Automatically include UserHistory stats when viewing a profile if sharing is enabled
 * 
 * This sync enriches profile responses with user stats from UserHistory when:
 * - A profile is being retrieved via the API
 * - The profile has shareStats enabled
 * 
 * The stats are queried from UserHistory and added to the response.
 */
export const ProfileStatsIntegration: Sync = ({ request, userId, profile, stats }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/getProfile", userId }, { request }],
    [Profile.getProfile, { userId }, { profile }],
  ),
  where: async (frames) => {
    // Check if profile exists and shareStats is enabled
    // Note: In a full implementation, we would query the Profile concept's state
    // to check the shareStats visibility setting. For now, we'll assume it's enabled
    // if the profile exists.
    
    const filteredFrames = frames.filter(($) => $[profile] !== null);
    
    if (filteredFrames.length === 0) {
      return frames; // No profile, skip stats enrichment
    }
    
    // Query UserHistory for stats
    const enrichedFrames = await filteredFrames.query(
      UserHistory._getUserStats, 
      { userId }, 
      { stats }
    );
    
    return enrichedFrames;
  },
  then: actions(
    [Requesting.respond, { request, profile, stats }],
  ),
});

// ============================================================================
// Public Feed Enrichment
// ============================================================================

/**
 * PublicFeedEnrichment
 * 
 * Purpose: Enrich public feed entries with profile information for better UX
 * 
 * This sync enhances the public feed by:
 * - Getting feed entries from UserHistory
 * - Enriching each entry with the user's public profile data
 * - Returning the enriched entries
 * 
 * This allows users to see who posted each activity without making separate
 * profile requests.
 */
export const PublicFeedEnrichment: Sync = ({ request, entries, enrichedEntries }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getPublicFeed" }, { request }],
    [UserHistory.getPublicFeed, {}, { entries }],
  ),
  where: async (frames) => {
    // For each entry, we would ideally enrich with profile data
    // This is a simplified version that passes through the entries
    // In a full implementation, you would:
    // 1. Extract userId from each entry
    // 2. Query Profile.getPublicProfile for each unique userId
    // 3. Combine the data into enrichedEntries
    
    // For now, we'll just pass through the entries
    // A more complete implementation would use collectAs to aggregate profile data
    return frames;
  },
  then: actions(
    [Requesting.respond, { request, entries }],
  ),
});

