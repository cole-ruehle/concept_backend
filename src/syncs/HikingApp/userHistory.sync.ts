/**
 * UserHistory Concept Synchronizations
 * 
 * These synchronizations handle request/response patterns for UserHistory concept actions:
 * - recordActivity, getUserHistory, getPublicFeed, getUserStats, updateVisibility,
 *   deleteActivity, getPopularRoutes, getUserAchievements
 */

import { Requesting, UserHistory } from "@concepts";
import { actions, Sync } from "@engine";

// ============================================================================
// UserHistory.recordActivity - Record Activity Request/Response
// ============================================================================

export const UserHistoryRecordActivityRequest: Sync = ({ request, userId, activityType, activityData, location, visibility }) => ({
  when: actions([
    Requesting.request,
    { path: "/userHistory/recordActivity", userId, activityType, activityData, location, visibility },
    { request },
  ]),
  then: actions([UserHistory.recordActivity, { userId, activityType, activityData, location, visibility }]),
});

export const UserHistoryRecordActivityResponse: Sync = ({ request, entryId }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/recordActivity" }, { request }],
    [UserHistory.recordActivity, {}, { entryId }],
  ),
  then: actions([Requesting.respond, { request, entryId }]),
});

export const UserHistoryRecordActivityError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/recordActivity" }, { request }],
    [UserHistory.recordActivity, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// UserHistory.getUserHistory - Get User History Request/Response
// ============================================================================

export const UserHistoryGetUserHistoryRequest: Sync = ({ request, userId, limit, activityType }) => ({
  when: actions([
    Requesting.request,
    { path: "/userHistory/getUserHistory", userId, limit, activityType },
    { request },
  ]),
  then: actions([UserHistory.getUserHistory, { userId, limit, activityType }]),
});

export const UserHistoryGetUserHistoryResponse: Sync = ({ request, entries }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getUserHistory" }, { request }],
    [UserHistory.getUserHistory, {}, { entries }],
  ),
  then: actions([Requesting.respond, { request, entries }]),
});

export const UserHistoryGetUserHistoryError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getUserHistory" }, { request }],
    [UserHistory.getUserHistory, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// UserHistory.getPublicFeed - Get Public Feed Request/Response
// ============================================================================

export const UserHistoryGetPublicFeedRequest: Sync = ({ request, location, radius, limit }) => ({
  when: actions([
    Requesting.request,
    { path: "/userHistory/getPublicFeed", location, radius, limit },
    { request },
  ]),
  then: actions([UserHistory.getPublicFeed, { location, radius, limit }]),
});

export const UserHistoryGetPublicFeedResponse: Sync = ({ request, entries }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getPublicFeed" }, { request }],
    [UserHistory.getPublicFeed, {}, { entries }],
  ),
  then: actions([Requesting.respond, { request, entries }]),
});

export const UserHistoryGetPublicFeedError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getPublicFeed" }, { request }],
    [UserHistory.getPublicFeed, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// UserHistory.getUserStats - Get User Stats Request/Response
// ============================================================================

export const UserHistoryGetUserStatsRequest: Sync = ({ request, userId }) => ({
  when: actions([
    Requesting.request,
    { path: "/userHistory/getUserStats", userId },
    { request },
  ]),
  then: actions([UserHistory.getUserStats, { userId }]),
});

export const UserHistoryGetUserStatsResponse: Sync = ({ request, stats }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getUserStats" }, { request }],
    [UserHistory.getUserStats, {}, { stats }],
  ),
  then: actions([Requesting.respond, { request, stats }]),
});

export const UserHistoryGetUserStatsError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getUserStats" }, { request }],
    [UserHistory.getUserStats, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// UserHistory.updateVisibility - Update Visibility Request/Response
// ============================================================================

export const UserHistoryUpdateVisibilityRequest: Sync = ({ request, entryId, userId, newVisibility }) => ({
  when: actions([
    Requesting.request,
    { path: "/userHistory/updateVisibility", entryId, userId, newVisibility },
    { request },
  ]),
  then: actions([UserHistory.updateVisibility, { entryId, userId, newVisibility }]),
});

export const UserHistoryUpdateVisibilityResponse: Sync = ({ request, success }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/updateVisibility" }, { request }],
    [UserHistory.updateVisibility, {}, { success }],
  ),
  then: actions([Requesting.respond, { request, success }]),
});

export const UserHistoryUpdateVisibilityError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/updateVisibility" }, { request }],
    [UserHistory.updateVisibility, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// UserHistory.deleteActivity - Delete Activity Request/Response
// ============================================================================

export const UserHistoryDeleteActivityRequest: Sync = ({ request, entryId, userId }) => ({
  when: actions([
    Requesting.request,
    { path: "/userHistory/deleteActivity", entryId, userId },
    { request },
  ]),
  then: actions([UserHistory.deleteActivity, { entryId, userId }]),
});

export const UserHistoryDeleteActivityResponse: Sync = ({ request, success }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/deleteActivity" }, { request }],
    [UserHistory.deleteActivity, {}, { success }],
  ),
  then: actions([Requesting.respond, { request, success }]),
});

export const UserHistoryDeleteActivityError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/deleteActivity" }, { request }],
    [UserHistory.deleteActivity, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// UserHistory.getPopularRoutes - Get Popular Routes Request/Response
// ============================================================================

export const UserHistoryGetPopularRoutesRequest: Sync = ({ request, timeWindow, limit }) => ({
  when: actions([
    Requesting.request,
    { path: "/userHistory/getPopularRoutes", timeWindow, limit },
    { request },
  ]),
  then: actions([UserHistory.getPopularRoutes, { timeWindow, limit }]),
});

export const UserHistoryGetPopularRoutesResponse: Sync = ({ request, routes }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getPopularRoutes" }, { request }],
    [UserHistory.getPopularRoutes, {}, { routes }],
  ),
  then: actions([Requesting.respond, { request, routes }]),
});

export const UserHistoryGetPopularRoutesError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getPopularRoutes" }, { request }],
    [UserHistory.getPopularRoutes, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// UserHistory.getUserAchievements - Get User Achievements Request/Response
// ============================================================================

export const UserHistoryGetUserAchievementsRequest: Sync = ({ request, userId }) => ({
  when: actions([
    Requesting.request,
    { path: "/userHistory/getUserAchievements", userId },
    { request },
  ]),
  then: actions([UserHistory.getUserAchievements, { userId }]),
});

export const UserHistoryGetUserAchievementsResponse: Sync = ({ request, achievements }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getUserAchievements" }, { request }],
    [UserHistory.getUserAchievements, {}, { achievements }],
  ),
  then: actions([Requesting.respond, { request, achievements }]),
});

export const UserHistoryGetUserAchievementsError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/userHistory/getUserAchievements" }, { request }],
    [UserHistory.getUserAchievements, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

