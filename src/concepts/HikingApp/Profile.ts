import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * Profile concept
 * 
 * **purpose**: Provide public-facing identity and discoverability for users while 
 * controlling what information is shared with the community
 * 
 * **principle**: After a user creates a profile with display information and privacy 
 * settings, other users can discover them through search or proximity queries, but only 
 * see information the user has chosen to make visible; updating visibility settings 
 * immediately changes what others can see
 */

// Collection prefix
const PREFIX = "Profile.";

// Generic types
type User = ID;
type Profile = ID;

/**
 * GeoJSON Point type
 */
interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

/**
 * a set of Profiles with
 *   userId (reference to User)
 *   displayName String
 *   bio String
 *   avatarUrl String
 *   homeLocation GeoJSON
 *   experienceLevel String ("beginner" | "intermediate" | "advanced" | "expert")
 *   createdAt Date
 */
interface Profiles {
  _id: Profile;
  userId: User;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  homeLocation?: GeoJSONPoint;
  experienceLevel: "beginner" | "intermediate" | "advanced" | "expert";
  createdAt: Date;
}

/**
 * a set of VisibilitySettings with
 *   userId (reference to User)
 *   showLiveLocation Boolean
 *   profileVisibility String ("public" | "hikers-only" | "private")
 *   shareStats Boolean
 *   shareHomeLocation Boolean
 */
interface VisibilitySettings {
  _id: ID;
  userId: User;
  showLiveLocation: boolean;
  profileVisibility: "public" | "hikers-only" | "private";
  shareStats: boolean;
  shareHomeLocation: boolean;
}

export default class ProfileConcept {
  profiles: Collection<Profiles>;
  visibilitySettings: Collection<VisibilitySettings>;

  constructor(private readonly db: Db) {
    this.profiles = this.db.collection(PREFIX + "profiles");
    this.visibilitySettings = this.db.collection(PREFIX + "visibilitySettings");

    // Create indexes
    this.profiles.createIndex({ userId: 1 }, { unique: true });
    this.profiles.createIndex({ displayName: 1 });
    this.profiles.createIndex({ homeLocation: "2dsphere" });
    this.visibilitySettings.createIndex({ userId: 1 }, { unique: true });
  }

  /**
   * createProfile(userId: String, displayName: String, bio?: String, experienceLevel?: String): (profileId: String)
   * 
   * **requires** userId exists in User concept, displayName length >= 2 and <= 50, 
   * userId does not already have a profile
   * 
   * **effects** creates new Profile with default VisibilitySettings (showLiveLocation: false, 
   * profileVisibility: "public", shareStats: true, shareHomeLocation: false), returns profileId
   */
  async createProfile({ userId, displayName, bio, experienceLevel }: { 
    userId: string; 
    displayName: string; 
    bio?: string; 
    experienceLevel?: string 
  }): Promise<{ profileId: string } | { error: string }> {
    // Validate inputs
    if (!displayName || displayName.length < 2 || displayName.length > 50) {
      return { error: "Display name must be between 2 and 50 characters" };
    }

    const validExperienceLevels = ["beginner", "intermediate", "advanced", "expert"];
    const level = (experienceLevel || "intermediate") as "beginner" | "intermediate" | "advanced" | "expert";
    if (!validExperienceLevels.includes(level)) {
      return { error: "Invalid experience level" };
    }

    // Check if profile already exists
    const existingProfile = await this.profiles.findOne({ userId: userId as User });
    if (existingProfile) {
      return { error: "User already has a profile" };
    }

    // Create profile
    const profileId = freshID();
    await this.profiles.insertOne({
      _id: profileId,
      userId: userId as User,
      displayName,
      bio,
      experienceLevel: level,
      createdAt: new Date(),
    });

    // Create default visibility settings
    await this.visibilitySettings.insertOne({
      _id: freshID(),
      userId: userId as User,
      showLiveLocation: false,
      profileVisibility: "public",
      shareStats: true,
      shareHomeLocation: false,
    });

    return { profileId: profileId as string };
  }

  /**
   * updateProfile(userId: String, displayName?: String, bio?: String, avatarUrl?: String, 
   *               homeLocation?: GeoJSON, experienceLevel?: String): (success: Boolean)
   * 
   * **requires** userId has an existing profile, if provided: displayName length >= 2 and <= 50, 
   * bio length <= 500, experienceLevel is valid
   * 
   * **effects** updates specified Profile fields for userId, returns true
   */
  async updateProfile({ userId, displayName, bio, avatarUrl, homeLocation, experienceLevel }: { 
    userId: string; 
    displayName?: string; 
    bio?: string; 
    avatarUrl?: string; 
    homeLocation?: GeoJSONPoint; 
    experienceLevel?: string 
  }): Promise<{ success: boolean } | { error: string }> {
    const profile = await this.profiles.findOne({ userId: userId as User });
    if (!profile) {
      return { error: "Profile not found" };
    }

    // Validate inputs
    if (displayName !== undefined && (displayName.length < 2 || displayName.length > 50)) {
      return { error: "Display name must be between 2 and 50 characters" };
    }
    if (bio !== undefined && bio.length > 500) {
      return { error: "Bio must be 500 characters or less" };
    }
    if (experienceLevel !== undefined) {
      const validLevels = ["beginner", "intermediate", "advanced", "expert"];
      if (!validLevels.includes(experienceLevel)) {
        return { error: "Invalid experience level" };
      }
    }

    // Build update object
    const updateFields: Partial<Profiles> = {};
    if (displayName !== undefined) updateFields.displayName = displayName;
    if (bio !== undefined) updateFields.bio = bio;
    if (avatarUrl !== undefined) updateFields.avatarUrl = avatarUrl;
    if (homeLocation !== undefined) updateFields.homeLocation = homeLocation;
    if (experienceLevel !== undefined) {
      updateFields.experienceLevel = experienceLevel as "beginner" | "intermediate" | "advanced" | "expert";
    }

    if (Object.keys(updateFields).length > 0) {
      await this.profiles.updateOne(
        { userId: userId as User },
        { $set: updateFields }
      );
    }

    return { success: true };
  }

  /**
   * setVisibility(userId: String, showLiveLocation?: Boolean, profileVisibility?: String, 
   *               shareStats?: Boolean, shareHomeLocation?: Boolean): (success: Boolean)
   * 
   * **requires** userId has an existing profile, if profileVisibility provided it must be 
   * valid ("public" | "hikers-only" | "private")
   * 
   * **effects** updates VisibilitySettings for userId, returns true
   */
  async setVisibility({ userId, showLiveLocation, profileVisibility, shareStats, shareHomeLocation }: { 
    userId: string; 
    showLiveLocation?: boolean; 
    profileVisibility?: string; 
    shareStats?: boolean; 
    shareHomeLocation?: boolean 
  }): Promise<{ success: boolean } | { error: string }> {
    const profile = await this.profiles.findOne({ userId: userId as User });
    if (!profile) {
      return { error: "Profile not found" };
    }

    // Validate profileVisibility
    if (profileVisibility !== undefined) {
      const validVisibilities = ["public", "hikers-only", "private"];
      if (!validVisibilities.includes(profileVisibility)) {
        return { error: "Invalid profile visibility" };
      }
    }

    // Build update object
    const updateFields: Partial<VisibilitySettings> = {};
    if (showLiveLocation !== undefined) updateFields.showLiveLocation = showLiveLocation;
    if (profileVisibility !== undefined) {
      updateFields.profileVisibility = profileVisibility as "public" | "hikers-only" | "private";
    }
    if (shareStats !== undefined) updateFields.shareStats = shareStats;
    if (shareHomeLocation !== undefined) updateFields.shareHomeLocation = shareHomeLocation;

    if (Object.keys(updateFields).length > 0) {
      await this.visibilitySettings.updateOne(
        { userId: userId as User },
        { $set: updateFields }
      );
    }

    return { success: true };
  }

  /**
   * getProfile(userId: String, viewerUserId?: String): 
   *   (profile: {displayName, bio, avatarUrl, experienceLevel, stats?, homeLocation?})
   * 
   * **requires** userId has an existing profile
   * 
   * **effects** returns public profile information filtered by visibility settings; 
   * if profileVisibility is "private" returns null unless viewerUserId == userId; 
   * includes stats if shareStats is true; includes homeLocation if shareHomeLocation is true
   */
  async getProfile({ userId, viewerUserId }: { 
    userId: string; 
    viewerUserId?: string 
  }): Promise<{ 
    profile: {
      displayName: string;
      bio?: string;
      avatarUrl?: string;
      experienceLevel: string;
      homeLocation?: GeoJSONPoint;
    } | null
  }> {
    const profile = await this.profiles.findOne({ userId: userId as User });
    if (!profile) {
      return { profile: null };
    }

    const visibility = await this.visibilitySettings.findOne({ userId: userId as User });
    if (!visibility) {
      return { profile: null };
    }

    // Check privacy settings
    if (visibility.profileVisibility === "private" && viewerUserId !== userId) {
      return { profile: null };
    }

    // Build response based on visibility settings
    const profileData: {
      displayName: string;
      bio?: string;
      avatarUrl?: string;
      experienceLevel: string;
      homeLocation?: GeoJSONPoint;
    } = {
      displayName: profile.displayName,
      experienceLevel: profile.experienceLevel,
    };

    if (profile.bio) profileData.bio = profile.bio;
    if (profile.avatarUrl) profileData.avatarUrl = profile.avatarUrl;
    if (visibility.shareHomeLocation && profile.homeLocation) {
      profileData.homeLocation = profile.homeLocation;
    }

    return { profile: profileData };
  }

  /**
   * searchProfiles(query?: String, location?: GeoJSON, radius?: Number, experienceLevel?: String, 
   *                limit?: Number): (profiles: Array<{userId, displayName, bio, experienceLevel, distance?}>)
   * 
   * **requires** if location provided, radius must be positive number in meters; 
   * if experienceLevel provided, must be valid
   * 
   * **effects** returns profiles matching search criteria where profileVisibility is not "private"; 
   * if location provided, only returns profiles with shareHomeLocation true, sorted by distance; 
   * filters by query matching displayName or bio; limited to most relevant results (default 50)
   */
  async searchProfiles({ query, location, radius, experienceLevel, limit }: { 
    query?: string; 
    location?: GeoJSONPoint; 
    radius?: number; 
    experienceLevel?: string; 
    limit?: number 
  }): Promise<{ 
    profiles: Array<{
      userId: string;
      displayName: string;
      bio?: string;
      experienceLevel: string;
      distance?: number;
    }>
  }> {
    // Validate inputs
    if (location && (!radius || radius <= 0)) {
      return { profiles: [] };
    }
    if (experienceLevel) {
      const validLevels = ["beginner", "intermediate", "advanced", "expert"];
      if (!validLevels.includes(experienceLevel)) {
        return { profiles: [] };
      }
    }

    const maxLimit = limit || 50;

    // Build query
    const matchQuery: any = {};

    // Get non-private profiles
    const nonPrivateUsers = await this.visibilitySettings.find({
      profileVisibility: { $ne: "private" }
    }).toArray();
    const nonPrivateUserIds = nonPrivateUsers.map(v => v.userId);

    matchQuery.userId = { $in: nonPrivateUserIds };

    // Filter by experience level
    if (experienceLevel) {
      matchQuery.experienceLevel = experienceLevel;
    }

    // Text search on displayName or bio
    if (query) {
      matchQuery.$or = [
        { displayName: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ];
    }

    // Location-based search
    if (location && radius) {
      // Only include profiles with shareHomeLocation true
      const shareLocationUsers = await this.visibilitySettings.find({
        shareHomeLocation: true,
        userId: { $in: nonPrivateUserIds }
      }).toArray();
      const shareLocationUserIds = shareLocationUsers.map(v => v.userId);

      matchQuery.userId = { $in: shareLocationUserIds };
      matchQuery.homeLocation = {
        $nearSphere: {
          $geometry: location,
          $maxDistance: radius
        }
      };
    }

    const profiles = await this.profiles.find(matchQuery).limit(maxLimit).toArray();

    return {
      profiles: profiles.map(p => ({
        userId: p.userId as string,
        displayName: p.displayName,
        bio: p.bio,
        experienceLevel: p.experienceLevel,
      }))
    };
  }

  /**
   * getNearbyActiveHikers(location: GeoJSON, radius: Number, limit?: Number): 
   *   (hikers: Array<{userId, displayName, currentLocation, routeId?}>)
   * 
   * **requires** location is valid GeoJSON point, radius is positive number in meters
   * 
   * **effects** returns profiles where showLiveLocation is true AND user currently has an active hike 
   * (queries DynamicExitPlanner), filtered by proximity to location within radius, includes approximate 
   * current location and route information, limited to nearest hikers (default 20)
   * 
   * Note: This implementation returns profiles with showLiveLocation enabled. 
   * Integration with DynamicExitPlanner would be done via synchronization.
   */
  async getNearbyActiveHikers({ location, radius, limit }: { 
    location: GeoJSONPoint; 
    radius: number; 
    limit?: number 
  }): Promise<{ 
    hikers: Array<{
      userId: string;
      displayName: string;
      currentLocation?: GeoJSONPoint;
      routeId?: string;
    }>
  } | { error: string }> {
    if (radius <= 0) {
      return { error: "Radius must be a positive number" };
    }

    const maxLimit = limit || 20;

    // Find users with showLiveLocation enabled
    const visibleUsers = await this.visibilitySettings.find({
      showLiveLocation: true
    }).toArray();
    const visibleUserIds = visibleUsers.map(v => v.userId);

    // Find profiles near the location
    const nearbyProfiles = await this.profiles.find({
      userId: { $in: visibleUserIds },
      homeLocation: {
        $nearSphere: {
          $geometry: location,
          $maxDistance: radius
        }
      }
    }).limit(maxLimit).toArray();

    return {
      hikers: nearbyProfiles.map(p => ({
        userId: p.userId as string,
        displayName: p.displayName,
        currentLocation: p.homeLocation,
      }))
    };
  }

  /**
   * getPublicProfile(userId: String): (profile: {displayName, experienceLevel, memberSince} | null)
   * 
   * **requires** userId exists
   * 
   * **effects** returns minimal public profile information (displayName, experienceLevel, 
   * account creation date) if profileVisibility is not "private", otherwise returns null; 
   * this is a lightweight version that doesn't require authentication
   */
  async getPublicProfile({ userId }: { 
    userId: string 
  }): Promise<{ 
    profile: {
      displayName: string;
      experienceLevel: string;
      memberSince: Date;
    } | null
  }> {
    const profile = await this.profiles.findOne({ userId: userId as User });
    if (!profile) {
      return { profile: null };
    }

    const visibility = await this.visibilitySettings.findOne({ userId: userId as User });
    if (!visibility || visibility.profileVisibility === "private") {
      return { profile: null };
    }

    return {
      profile: {
        displayName: profile.displayName,
        experienceLevel: profile.experienceLevel,
        memberSince: profile.createdAt,
      }
    };
  }

  /**
   * deleteProfile(userId: String): (success: Boolean)
   * 
   * **requires** userId has an existing profile
   * 
   * **effects** removes Profile and VisibilitySettings for userId, returns true
   */
  async deleteProfile({ userId }: { 
    userId: string 
  }): Promise<{ success: boolean } | { error: string }> {
    const profile = await this.profiles.findOne({ userId: userId as User });
    if (!profile) {
      return { error: "Profile not found" };
    }

    await this.profiles.deleteOne({ userId: userId as User });
    await this.visibilitySettings.deleteOne({ userId: userId as User });

    return { success: true };
  }
}

