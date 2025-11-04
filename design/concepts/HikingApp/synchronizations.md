# HikingApp Synchronizations

This document outlines the synchronizations needed to coordinate the User, Profile, UserHistory, and other HikingApp concepts into a cohesive application.

## Methodology for Finding Synchronizations

### 1. **Concept Action Analysis**
For each concept action, ask:
- Does this action need to trigger actions in other concepts?
- Does this action need data from other concepts to complete?
- Should this action's result be recorded or tracked elsewhere?

### 2. **Request-Response Pattern**
Every user-facing action needs THREE synchronizations:
1. **Request sync**: Match the HTTP request, trigger the concept action
2. **Response sync**: Match the concept action success, respond with result
3. **Error sync**: Match the concept action error, respond with error

### 3. **Cross-Concept Dependencies**
Identify natural dependencies:
- User registration → Profile creation → UserHistory initialization
- Hike completion → UserHistory recording
- Profile viewing → Stats integration from UserHistory
- User deletion → Cascade to Profile and UserHistory

### 4. **Data Aggregation Syncs**
When one concept needs to display data from multiple concepts:
- Profile stats display needs UserHistory data
- Public feed needs Profile + UserHistory data
- User dashboard needs data from all three concepts

### 5. **Business Logic Syncs**
Enforce business rules across concepts:
- Profile privacy affects UserHistory visibility
- User authentication required for protected actions
- Activity recording triggers achievement calculations

## Organization Strategy

### File Structure
```
src/syncs/
  HikingApp/
    user.sync.ts          - User concept request/response syncs
    profile.sync.ts       - Profile concept request/response syncs
    userHistory.sync.ts   - UserHistory concept request/response syncs
    lifecycle.sync.ts     - Cross-concept lifecycle syncs (registration flow, deletion cascade)
    integration.sync.ts   - Data integration syncs (stats display, feed aggregation)
    activity.sync.ts      - Activity recording syncs (hike completion tracking)
```

### Naming Convention
- Request syncs: `{ConceptName}{ActionName}Request`
- Response syncs: `{ConceptName}{ActionName}Response`
- Error syncs: `{ConceptName}{ActionName}Error`
- Cross-concept syncs: Descriptive names like `RegisterUserLifecycle`, `DeleteUserCascade`

---

## Required Synchronizations by Category

### Category 1: User Concept - Basic Request/Response

#### User.register
1. **UserRegisterRequest** - Match HTTP request, call User.register
2. **UserRegisterResponse** - Match User.register success, respond with userId
3. **UserRegisterError** - Match User.register error, respond with error
4. **UserRegistrationLifecycle** - When User.register succeeds, create Profile and initialize UserHistory

#### User.login
1. **UserLoginRequest** - Match HTTP request, call User.login
2. **UserLoginResponse** - Match User.login success, respond with sessionToken and userId
3. **UserLoginError** - Match User.login error, respond with error

#### User.authenticate
1. **UserAuthenticateRequest** - Match HTTP request, call User.authenticate
2. **UserAuthenticateResponse** - Match User.authenticate success, respond with userId
3. **UserAuthenticateError** - Match User.authenticate error, respond with error

#### User.logout
1. **UserLogoutRequest** - Match HTTP request, call User.logout
2. **UserLogoutResponse** - Match User.logout success, respond with success
3. **UserLogoutError** - Match User.logout error, respond with error

#### User.updatePassword
1. **UserUpdatePasswordRequest** - Match HTTP request, call User.updatePassword
2. **UserUpdatePasswordResponse** - Match User.updatePassword success, respond with success
3. **UserUpdatePasswordError** - Match User.updatePassword error, respond with error

#### User.getUserProfile
1. **UserGetUserProfileRequest** - Match HTTP request, call User.getUserProfile
2. **UserGetUserProfileResponse** - Match User.getUserProfile success, respond with profile data
3. **UserGetUserProfileError** - Match User.getUserProfile error, respond with error

---

### Category 2: Profile Concept - Basic Request/Response

#### Profile.createProfile
1. **ProfileCreateProfileRequest** - Match HTTP request, call Profile.createProfile
2. **ProfileCreateProfileResponse** - Match Profile.createProfile success, respond with profileId
3. **ProfileCreateProfileError** - Match Profile.createProfile error, respond with error

#### Profile.updateProfile
1. **ProfileUpdateProfileRequest** - Match HTTP request, call Profile.updateProfile
2. **ProfileUpdateProfileResponse** - Match Profile.updateProfile success, respond with success
3. **ProfileUpdateProfileError** - Match Profile.updateProfile error, respond with error

#### Profile.setVisibility
1. **ProfileSetVisibilityRequest** - Match HTTP request, call Profile.setVisibility
2. **ProfileSetVisibilityResponse** - Match Profile.setVisibility success, respond with success
3. **ProfileSetVisibilityError** - Match Profile.setVisibility error, respond with error

#### Profile.getProfile
1. **ProfileGetProfileRequest** - Match HTTP request, call Profile.getProfile
2. **ProfileGetProfileWithStats** - When Profile.getProfile succeeds AND shareStats is true, query UserHistory.getUserStats
3. **ProfileGetProfileResponse** - Respond with profile data (including stats if retrieved)
4. **ProfileGetProfileError** - Match Profile.getProfile error, respond with error

#### Profile.searchProfiles
1. **ProfileSearchProfilesRequest** - Match HTTP request, call Profile.searchProfiles
2. **ProfileSearchProfilesResponse** - Match Profile.searchProfiles success, respond with profiles
3. **ProfileSearchProfilesError** - Match Profile.searchProfiles error, respond with error

#### Profile.getNearbyActiveHikers
1. **ProfileGetNearbyActiveHikersRequest** - Match HTTP request, call Profile.getNearbyActiveHikers
2. **ProfileGetNearbyActiveHikersResponse** - Match Profile.getNearbyActiveHikers success, respond with hikers
3. **ProfileGetNearbyActiveHikersError** - Match Profile.getNearbyActiveHikers error, respond with error

#### Profile.getPublicProfile
1. **ProfileGetPublicProfileRequest** - Match HTTP request, call Profile.getPublicProfile
2. **ProfileGetPublicProfileResponse** - Match Profile.getPublicProfile success, respond with public profile
3. **ProfileGetPublicProfileError** - Match Profile.getPublicProfile error, respond with error

#### Profile.deleteProfile
1. **ProfileDeleteProfileRequest** - Match HTTP request, call Profile.deleteProfile
2. **ProfileDeleteProfileResponse** - Match Profile.deleteProfile success, respond with success
3. **ProfileDeleteProfileError** - Match Profile.deleteProfile error, respond with error

---

### Category 3: UserHistory Concept - Basic Request/Response

#### UserHistory.recordActivity
1. **UserHistoryRecordActivityRequest** - Match HTTP request, call UserHistory.recordActivity
2. **UserHistoryRecordActivityResponse** - Match UserHistory.recordActivity success, respond with entryId
3. **UserHistoryRecordActivityError** - Match UserHistory.recordActivity error, respond with error

#### UserHistory.getUserHistory
1. **UserHistoryGetUserHistoryRequest** - Match HTTP request, call UserHistory.getUserHistory
2. **UserHistoryGetUserHistoryResponse** - Match UserHistory.getUserHistory success, respond with entries
3. **UserHistoryGetUserHistoryError** - Match UserHistory.getUserHistory error, respond with error

#### UserHistory.getPublicFeed
1. **UserHistoryGetPublicFeedRequest** - Match HTTP request, call UserHistory.getPublicFeed
2. **UserHistoryGetPublicFeedWithProfiles** - When UserHistory.getPublicFeed succeeds, enrich with Profile data for each user
3. **UserHistoryGetPublicFeedResponse** - Respond with feed entries (with profile data)
4. **UserHistoryGetPublicFeedError** - Match UserHistory.getPublicFeed error, respond with error

#### UserHistory.getUserStats
1. **UserHistoryGetUserStatsRequest** - Match HTTP request, call UserHistory.getUserStats
2. **UserHistoryGetUserStatsResponse** - Match UserHistory.getUserStats success, respond with stats
3. **UserHistoryGetUserStatsError** - Match UserHistory.getUserStats error, respond with error

#### UserHistory.updateVisibility
1. **UserHistoryUpdateVisibilityRequest** - Match HTTP request, call UserHistory.updateVisibility
2. **UserHistoryUpdateVisibilityResponse** - Match UserHistory.updateVisibility success, respond with success
3. **UserHistoryUpdateVisibilityError** - Match UserHistory.updateVisibility error, respond with error

#### UserHistory.deleteActivity
1. **UserHistoryDeleteActivityRequest** - Match HTTP request, call UserHistory.deleteActivity
2. **UserHistoryDeleteActivityResponse** - Match UserHistory.deleteActivity success, respond with success
3. **UserHistoryDeleteActivityError** - Match UserHistory.deleteActivity error, respond with error

#### UserHistory.getPopularRoutes
1. **UserHistoryGetPopularRoutesRequest** - Match HTTP request, call UserHistory.getPopularRoutes
2. **UserHistoryGetPopularRoutesResponse** - Match UserHistory.getPopularRoutes success, respond with routes
3. **UserHistoryGetPopularRoutesError** - Match UserHistory.getPopularRoutes error, respond with error

#### UserHistory.getUserAchievements
1. **UserHistoryGetUserAchievementsRequest** - Match HTTP request, call UserHistory.getUserAchievements
2. **UserHistoryGetUserAchievementsResponse** - Match UserHistory.getUserAchievements success, respond with achievements
3. **UserHistoryGetUserAchievementsError** - Match UserHistory.getUserAchievements error, respond with error

---

### Category 4: Cross-Concept Lifecycle Synchronizations

#### Registration Flow
```sync
sync UserRegistrationLifecycle
when
  User.register () : (userId)
then
  Profile.createProfile (userId, displayName: username, experienceLevel: "beginner")
  UserHistory.recordActivity (userId, activityType: "account_created", activityData: {}, visibility: "private")
```
**Purpose**: Automatically create profile and initialize history when a new user registers

#### User Deletion Cascade
```sync
sync UserDeletionCascade
when
  User.deleteUser (userId) : (success)
then
  Profile.deleteProfile (userId)
  // UserHistory entries should remain for data integrity, but mark as deleted user
```
**Purpose**: Clean up related data when a user account is deleted

---

### Category 5: Data Integration Synchronizations

#### Profile Stats Integration
```sync
sync ProfileStatsIntegration
when
  Requesting.request (path: "/profile/get") : (request)
  Profile.getProfile (userId, viewerUserId) : (profile)
where
  in Profile: shareStats is true for userId
  in UserHistory: stats = getUserStats(userId)
then
  Requesting.respond (request, profile, stats)
```
**Purpose**: Automatically include UserHistory stats when viewing a profile if sharing is enabled

#### Public Feed with Profiles
```sync
sync PublicFeedEnrichment
when
  Requesting.request (path: "/feed/public") : (request)
  UserHistory.getPublicFeed (location, radius, limit) : (entries)
where
  for each entry:
    in Profile: profile = getPublicProfile(entry.userId)
then
  Requesting.respond (request, enrichedEntries: entries with profile data)
```
**Purpose**: Enrich public feed entries with profile information for better UX

---

### Category 6: Activity Recording Synchronizations

#### Hike Completion Recording
```sync
sync HikeCompletionRecording
when
  DynamicExitPlanner.endHike (hike, exitPoint) : (completedHike)
then
  UserHistory.recordActivity (
    userId: hike.userId,
    activityType: "hike_completed",
    activityData: {
      routeId: hike.routeId,
      distance: hike.totalDistance,
      duration: hike.duration,
      exitPoint: exitPoint
    },
    location: exitPoint.location,
    visibility: "public"
  )
```
**Purpose**: Automatically record completed hikes in user history

#### Route Planning Recording
```sync
sync RoutePlanningRecording
when
  TransitRoutePlanner.planRoute (origin, destination, constraints) : (route)
then
  UserHistory.recordActivity (
    userId: user,
    activityType: "route_planned",
    activityData: {
      routeId: route.id,
      origin: origin,
      destination: destination
    },
    location: destination,
    visibility: "public"
  )
```
**Purpose**: Track when users plan routes for recommendations and statistics

#### Route Saving Recording
```sync
sync RouteSavingRecording
when
  TransitRoutePlanner.saveRoute (userId, routeId) : (success)
then
  UserHistory.recordActivity (
    userId,
    activityType: "route_saved",
    activityData: { routeId },
    visibility: "public"
  )
```
**Purpose**: Record when users save routes for later use

---

## Implementation Checklist

### Before Writing Code

- [ ] Review all concept actions and their signatures
- [ ] Identify which actions are user-facing (need request/response syncs)
- [ ] Identify which actions trigger other concept actions
- [ ] Map out data flow between concepts
- [ ] Check for circular dependencies
- [ ] Ensure all error cases are handled

### Documentation Requirements

For each synchronization, document:
1. **Name**: Clear, descriptive name following naming convention
2. **Purpose**: One-sentence explanation of what this sync does
3. **When clause**: What action(s) trigger this sync
4. **Where clause** (if needed): Any state queries or conditions
5. **Then clause**: What action(s) are executed
6. **Edge cases**: Any special conditions or error handling
7. **Dependencies**: Other syncs or concepts this depends on

### Writing Syncs

1. **Start with simple request/response patterns** - These are straightforward and ensure basic functionality
2. **Then add lifecycle syncs** - Registration flow, deletion cascade, etc.
3. **Add data integration syncs** - Combining data from multiple concepts
4. **Finally add activity recording syncs** - Connect to existing concepts like DynamicExitPlanner

### Testing Strategy

For each sync:
1. Write unit tests that verify the sync fires when expected
2. Test that the sync doesn't fire when it shouldn't
3. Test error handling (what happens if the `then` action fails?)
4. Test with empty/missing data
5. Test integration with actual HTTP requests

---

## Quick Summary: Total Syncs Needed

**User Concept**: 18 syncs (6 actions × 3 syncs each)
**Profile Concept**: 24 syncs (8 actions × 3 syncs each, with some integration syncs)
**UserHistory Concept**: 24 syncs (8 actions × 3 syncs each)
**Lifecycle Syncs**: 2 syncs
**Integration Syncs**: 2 syncs
**Activity Recording Syncs**: 3 syncs

**Total: ~73 synchronizations**

This may seem like a lot, but most follow the same pattern. You can create templates and generate many of them programmatically if needed.

---

## Next Steps

1. **Create sync file structure** in `src/syncs/HikingApp/`
2. **Start with User concept syncs** - These are foundational
3. **Add Profile concept syncs** - Builds on User
4. **Add UserHistory concept syncs** - Tracks user activity
5. **Implement lifecycle syncs** - Connect the registration flow
6. **Add integration syncs** - Make the UI data-rich
7. **Connect to existing concepts** - Activity recording for hikes

## Notes on the Requesting Concept

All request/response syncs follow the same pattern using the `Requesting` concept:

```typescript
// Request sync
export const ActionNameRequest: Sync = ({ request, param1, param2 }) => ({
  when: actions([
    Requesting.request,
    { path: "/concept/action", param1, param2 },
    { request },
  ]),
  then: actions([ConceptName.actionName, { param1, param2 }]),
});

// Response sync (success)
export const ActionNameResponse: Sync = ({ request, result }) => ({
  when: actions(
    [Requesting.request, { path: "/concept/action" }, { request }],
    [ConceptName.actionName, {}, { result }],
  ),
  then: actions([Requesting.respond, { request, result }]),
});

// Response sync (error)
export const ActionNameError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/concept/action" }, { request }],
    [ConceptName.actionName, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});
```

This pattern ensures that HTTP requests are properly routed to concept actions and responses are sent back to clients.

