purpose Provide public-facing identity and discoverability for users while controlling what information is shared with the community
principle After a user creates a profile with display information and privacy settings, other users can discover them through search or proximity queries, but only see information the user has chosen to make visible; updating visibility settings immediately changes what others can see
state
A set of Users (external reference to Session concept)
A set of Profiles with ObjectId, userId (reference to User), displayName String, bio String, avatarUrl String, homeLocation GeoJSON, experienceLevel String ("beginner" | "intermediate" | "advanced" | "expert"), and createdAt Date
A set of VisibilitySettings with userId (reference to User), showLiveLocation Boolean, profileVisibility String ("public" | "hikers-only" | "private"), shareStats Boolean, and shareHomeLocation Boolean
actions
createProfile(userId: String, displayName: String, bio?: String, experienceLevel?: String): (profileId: String)
requires userId exists in User concept, displayName length >= 2 and <= 50, userId does not already have a profile
effects creates new Profile with default VisibilitySettings (showLiveLocation: false, profileVisibility: "public", shareStats: true, shareHomeLocation: false), returns profileId
updateProfile(userId: String, displayName?: String, bio?: String, avatarUrl?: String, homeLocation?: GeoJSON, experienceLevel?: String): (success: Boolean)
requires userId has an existing profile, if provided: displayName length >= 2 and <= 50, bio length <= 500, experienceLevel is valid
effects updates specified Profile fields for userId, returns true
setVisibility(userId: String, showLiveLocation?: Boolean, profileVisibility?: String, shareStats?: Boolean, shareHomeLocation?: Boolean): (success: Boolean)
requires userId has an existing profile, if profileVisibility provided it must be valid ("public" | "hikers-only" | "private")
effects updates VisibilitySettings for userId, returns true
getProfile(userId: String, viewerUserId?: String): (profile: {displayName, bio, avatarUrl, experienceLevel, stats?, homeLocation?})
requires userId has an existing profile
effects returns public profile information filtered by visibility settings; if profileVisibility is "private" returns null unless viewerUserId == userId; includes stats if shareStats is true; includes homeLocation if shareHomeLocation is true
searchProfiles(query?: String, location?: GeoJSON, radius?: Number, experienceLevel?: String, limit?: Number): (profiles: Array<{userId, displayName, bio, experienceLevel, distance?}>)
requires if location provided, radius must be positive number in meters; if experienceLevel provided, must be valid
effects returns profiles matching search criteria where profileVisibility is not "private"; if location provided, only returns profiles with shareHomeLocation true, sorted by distance; filters by query matching displayName or bio; limited to most relevant results (default 50)
getNearbyActiveHikers(location: GeoJSON, radius: Number, limit?: Number): (hikers: Array<{userId, displayName, currentLocation, routeId?}>)
requires location is valid GeoJSON point, radius is positive number in meters
effects returns profiles where showLiveLocation is true AND user currently has an active hike (queries DynamicExitPlanner), filtered by proximity to location within radius, includes approximate current location and route information, limited to nearest hikers (default 20)
getPublicProfile(userId: String): (profile: {displayName, experienceLevel, memberSince} | null)
requires userId exists
effects returns minimal public profile information (displayName, experienceLevel, account creation date) if profileVisibility is not "private", otherwise returns null; this is a lightweight version that doesn't require authentication
deleteProfile(userId: String): (success: Boolean)
requires userId has an existing profile
effects removes Profile and VisibilitySettings for userId, returns true