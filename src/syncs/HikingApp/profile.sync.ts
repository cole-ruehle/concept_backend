/**
 * Profile Concept Synchronizations
 * 
 * These synchronizations handle request/response patterns for Profile concept actions:
 * - createProfile, updateProfile, setVisibility, getProfile, searchProfiles,
 *   getNearbyActiveHikers, getPublicProfile, deleteProfile
 */

import { Requesting, Profile } from "@concepts";
import { actions, Sync } from "@engine";

// ============================================================================
// Profile.createProfile - Create Profile Request/Response
// ============================================================================

export const ProfileCreateProfileRequest: Sync = ({ request, userId, displayName, bio, experienceLevel }) => ({
  when: actions([
    Requesting.request,
    { path: "/profile/createProfile", userId, displayName, bio, experienceLevel },
    { request },
  ]),
  then: actions([Profile.createProfile, { userId, displayName, bio, experienceLevel }]),
});

export const ProfileCreateProfileResponse: Sync = ({ request, profileId }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/createProfile" }, { request }],
    [Profile.createProfile, {}, { profileId }],
  ),
  then: actions([Requesting.respond, { request, profileId }]),
});

export const ProfileCreateProfileError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/createProfile" }, { request }],
    [Profile.createProfile, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Profile.updateProfile - Update Profile Request/Response
// ============================================================================

export const ProfileUpdateProfileRequest: Sync = ({ request, userId, displayName, bio, avatarUrl, homeLocation, experienceLevel }) => ({
  when: actions([
    Requesting.request,
    { path: "/profile/updateProfile", userId, displayName, bio, avatarUrl, homeLocation, experienceLevel },
    { request },
  ]),
  then: actions([Profile.updateProfile, { userId, displayName, bio, avatarUrl, homeLocation, experienceLevel }]),
});

export const ProfileUpdateProfileResponse: Sync = ({ request, success }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/updateProfile" }, { request }],
    [Profile.updateProfile, {}, { success }],
  ),
  then: actions([Requesting.respond, { request, success }]),
});

export const ProfileUpdateProfileError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/updateProfile" }, { request }],
    [Profile.updateProfile, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Profile.setVisibility - Set Visibility Request/Response
// ============================================================================

// Simple approach: Match on required fields only, action will receive just those
export const ProfileSetVisibilityRequest: Sync = ({ request, userId, showLiveLocation }) => ({
  when: actions([
    Requesting.request,
    { path: "/profile/setVisibility", userId, showLiveLocation },
    { request },
  ]),
  then: actions([Profile.setVisibility, { userId, showLiveLocation }]),
});

export const ProfileSetVisibilityResponse: Sync = ({ request, success }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/setVisibility" }, { request }],
    [Profile.setVisibility, {}, { success }],
  ),
  then: actions([Requesting.respond, { request, success }]),
});

export const ProfileSetVisibilityError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/setVisibility" }, { request }],
    [Profile.setVisibility, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Profile.getProfile - Get Profile Request/Response
// ============================================================================

export const ProfileGetProfileRequest: Sync = ({ request, userId, viewerUserId }) => ({
  when: actions([
    Requesting.request,
    { path: "/profile/getProfile", userId, viewerUserId },
    { request },
  ]),
  then: actions([Profile.getProfile, { userId, viewerUserId }]),
});

export const ProfileGetProfileResponse: Sync = ({ request, profile }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/getProfile" }, { request }],
    [Profile.getProfile, {}, { profile }],
  ),
  then: actions([Requesting.respond, { request, profile }]),
});

export const ProfileGetProfileError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/getProfile" }, { request }],
    [Profile.getProfile, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Profile.searchProfiles - Search Profiles Request/Response
// ============================================================================

export const ProfileSearchProfilesRequest: Sync = ({ request, query, location, radius, experienceLevel, limit }) => ({
  when: actions([
    Requesting.request,
    { path: "/profile/searchProfiles", query, location, radius, experienceLevel, limit },
    { request },
  ]),
  then: actions([Profile.searchProfiles, { query, location, radius, experienceLevel, limit }]),
});

export const ProfileSearchProfilesResponse: Sync = ({ request, profiles }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/searchProfiles" }, { request }],
    [Profile.searchProfiles, {}, { profiles }],
  ),
  then: actions([Requesting.respond, { request, profiles }]),
});

export const ProfileSearchProfilesError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/searchProfiles" }, { request }],
    [Profile.searchProfiles, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Profile.getNearbyActiveHikers - Get Nearby Active Hikers Request/Response
// ============================================================================

export const ProfileGetNearbyActiveHikersRequest: Sync = ({ request, location, radius, limit }) => ({
  when: actions([
    Requesting.request,
    { path: "/profile/getNearbyActiveHikers", location, radius, limit },
    { request },
  ]),
  then: actions([Profile.getNearbyActiveHikers, { location, radius, limit }]),
});

export const ProfileGetNearbyActiveHikersResponse: Sync = ({ request, hikers }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/getNearbyActiveHikers" }, { request }],
    [Profile.getNearbyActiveHikers, {}, { hikers }],
  ),
  then: actions([Requesting.respond, { request, hikers }]),
});

export const ProfileGetNearbyActiveHikersError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/getNearbyActiveHikers" }, { request }],
    [Profile.getNearbyActiveHikers, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Profile.getPublicProfile - Get Public Profile Request/Response
// ============================================================================

export const ProfileGetPublicProfileRequest: Sync = ({ request, userId }) => ({
  when: actions([
    Requesting.request,
    { path: "/profile/getPublicProfile", userId },
    { request },
  ]),
  then: actions([Profile.getPublicProfile, { userId }]),
});

export const ProfileGetPublicProfileResponse: Sync = ({ request, profile }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/getPublicProfile" }, { request }],
    [Profile.getPublicProfile, {}, { profile }],
  ),
  then: actions([Requesting.respond, { request, profile }]),
});

export const ProfileGetPublicProfileError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/getPublicProfile" }, { request }],
    [Profile.getPublicProfile, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// Profile.deleteProfile - Delete Profile Request/Response
// ============================================================================

export const ProfileDeleteProfileRequest: Sync = ({ request, userId }) => ({
  when: actions([
    Requesting.request,
    { path: "/profile/deleteProfile", userId },
    { request },
  ]),
  then: actions([Profile.deleteProfile, { userId }]),
});

export const ProfileDeleteProfileResponse: Sync = ({ request, success }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/deleteProfile" }, { request }],
    [Profile.deleteProfile, {}, { success }],
  ),
  then: actions([Requesting.respond, { request, success }]),
});

export const ProfileDeleteProfileError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/profile/deleteProfile" }, { request }],
    [Profile.deleteProfile, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

