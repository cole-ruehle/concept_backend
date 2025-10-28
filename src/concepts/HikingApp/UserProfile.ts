import { Db, Collection, ObjectId } from "npm:mongodb";

// Custom Errors
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// Data Types
export interface User {
  id: string;
  name: string;
  email: string;
  preferences?: Map<string, any>;
}

export interface UserProfile {
  id: string;
  userId: string;
  averagePace: number; // mph
  maxDistance: number; // miles
  riskTolerance: 'conservative' | 'moderate' | 'adventurous';
  weatherSensitivity: 'low' | 'medium' | 'high';
  preferredDifficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  hikingExperience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFeedback {
  id: string;
  hikeId: string;
  exitStrategyId?: string;
  satisfaction: number; // 1-5
  accuracy: number; // 1-5
  helpfulness: number; // 1-5
  comments: string;
  createdAt: Date;
}

export interface UserPreferences {
  preferredStartTime: string; // "06:00", "08:00", etc.
  maxTransitTime: number; // minutes
  preferredTransitTypes: string[]; // ["bus", "train", "ferry"]
  avoidCrowds: boolean;
  scenicPreference: 'low' | 'medium' | 'high';
}

// Database Documents
interface UserProfileDoc {
  _id: ObjectId;
  userId: string;
  averagePace: number;
  maxDistance: number;
  riskTolerance: string;
  weatherSensitivity: string;
  preferredDifficulty: string;
  hikingExperience: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

interface UserFeedbackDoc {
  _id: ObjectId;
  hikeId: string;
  exitStrategyId?: string;
  satisfaction: number;
  accuracy: number;
  helpfulness: number;
  comments: string;
  createdAt: Date;
}

export class UserProfileConcept {
  private profiles: Collection<UserProfileDoc>;
  private feedback: Collection<UserFeedbackDoc>;

  constructor(private db: Db) {
    this.profiles = db.collection<UserProfileDoc>("userProfiles");
    this.feedback = db.collection<UserFeedbackDoc>("userFeedback");
  }

  /**
   * Create or update a user profile
   */
  async createOrUpdateProfile(
    userId: string,
    profileData: Partial<UserProfile>
  ): Promise<string> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError("Valid userId is required");
    }

    const now = new Date();
    const updateData = {
      ...profileData,
      userId,
      updatedAt: now,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    const result = await this.profiles.updateOne(
      { userId },
      {
        $set: updateData,
        $setOnInsert: {
          createdAt: now,
          averagePace: 2.5,
          maxDistance: 10,
          riskTolerance: 'moderate',
          weatherSensitivity: 'medium',
          preferredDifficulty: 'moderate',
          hikingExperience: 'intermediate',
          preferences: {
            preferredStartTime: "08:00",
            maxTransitTime: 60,
            preferredTransitTypes: ["bus", "train"],
            avoidCrowds: false,
            scenicPreference: 'medium'
          }
        }
      },
      { upsert: true }
    );

    return result.upsertedId?.toHexString() || userId;
  }

  /**
   * Get user profile by userId
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError("Valid userId is required");
    }

    const doc = await this.profiles.findOne({ userId });
    if (!doc) {
      return null;
    }

    return {
      id: doc._id.toHexString(),
      userId: doc.userId,
      averagePace: doc.averagePace,
      maxDistance: doc.maxDistance,
      riskTolerance: doc.riskTolerance as any,
      weatherSensitivity: doc.weatherSensitivity as any,
      preferredDifficulty: doc.preferredDifficulty as any,
      hikingExperience: doc.hikingExperience as any,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  /**
   * Submit user feedback for learning
   */
  async submitFeedback(feedbackData: Omit<UserFeedback, 'id' | 'createdAt'>): Promise<string> {
    if (!feedbackData.hikeId || !feedbackData.satisfaction) {
      throw new ValidationError("hikeId and satisfaction are required");
    }

    if (feedbackData.satisfaction < 1 || feedbackData.satisfaction > 5) {
      throw new ValidationError("Satisfaction must be between 1 and 5");
    }

    const doc: Omit<UserFeedbackDoc, '_id'> = {
      ...feedbackData,
      createdAt: new Date()
    };

    const result = await this.feedback.insertOne(doc as UserFeedbackDoc);
    return result.insertedId.toHexString();
  }

  /**
   * Get user's feedback history
   */
  async getFeedbackHistory(userId: string, limit = 10): Promise<UserFeedback[]> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError("Valid userId is required");
    }

    // Get user's hike IDs first (this would need to be joined with hikes collection)
    // For now, we'll get all feedback and filter by user context
    const docs = await this.feedback
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return docs.map(doc => ({
      id: doc._id.toHexString(),
      hikeId: doc.hikeId,
      exitStrategyId: doc.exitStrategyId,
      satisfaction: doc.satisfaction,
      accuracy: doc.accuracy,
      helpfulness: doc.helpfulness,
      comments: doc.comments,
      createdAt: doc.createdAt
    }));
  }

  /**
   * Get personalized recommendations based on user profile
   */
  async getPersonalizedRecommendations(
    userId: string,
    context: {
      currentLocation?: { latitude: number; longitude: number };
      timeOfDay?: string;
      weatherConditions?: string;
      availableTime?: number; // hours
    }
  ): Promise<{
    recommendedDifficulty: string;
    recommendedDistance: number;
    recommendedStartTime: string;
    riskAssessment: string;
    personalizedTips: string[];
  }> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new NotFoundError("User profile not found");
    }

    // Simple recommendation logic (could be enhanced with ML)
    const recommendations = {
      recommendedDifficulty: profile.preferredDifficulty,
      recommendedDistance: Math.min(profile.maxDistance, context.availableTime ? context.availableTime * profile.averagePace : profile.maxDistance),
      recommendedStartTime: context.timeOfDay || "08:00",
      riskAssessment: this.assessRisk(profile, context),
      personalizedTips: this.generatePersonalizedTips(profile, context)
    };

    return recommendations;
  }

  /**
   * Learn from user feedback and update profile
   */
  async learnFromFeedback(userId: string): Promise<UserProfile> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new NotFoundError("User profile not found");
    }

    const recentFeedback = await this.getFeedbackHistory(userId, 20);
    
    if (recentFeedback.length === 0) {
      return profile;
    }

    // Simple learning algorithm
    const avgSatisfaction = recentFeedback.reduce((sum, f) => sum + f.satisfaction, 0) / recentFeedback.length;
    const avgAccuracy = recentFeedback.reduce((sum, f) => sum + f.accuracy, 0) / recentFeedback.length;

    // Adjust profile based on feedback
    let updatedProfile = { ...profile };

    if (avgSatisfaction < 3) {
      // User seems unsatisfied, maybe adjust difficulty or distance
      if (profile.preferredDifficulty === 'hard') {
        updatedProfile.preferredDifficulty = 'moderate';
      } else if (profile.preferredDifficulty === 'expert') {
        updatedProfile.preferredDifficulty = 'hard';
      }
    }

    if (avgAccuracy < 3) {
      // Adjust risk tolerance to be more conservative
      if (profile.riskTolerance === 'adventurous') {
        updatedProfile.riskTolerance = 'moderate';
      } else if (profile.riskTolerance === 'moderate') {
        updatedProfile.riskTolerance = 'conservative';
      }
    }

    // Update the profile
    await this.createOrUpdateProfile(userId, updatedProfile);
    return updatedProfile;
  }

  private assessRisk(profile: UserProfile, context: any): string {
    let riskLevel = 'low';
    
    if (profile.riskTolerance === 'conservative') {
      riskLevel = 'low';
    } else if (profile.riskTolerance === 'moderate') {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    // Adjust based on weather
    if (context.weatherConditions?.includes('rain') || context.weatherConditions?.includes('storm')) {
      if (riskLevel === 'high') riskLevel = 'medium';
      else if (riskLevel === 'medium') riskLevel = 'low';
    }

    return riskLevel;
  }

  private generatePersonalizedTips(profile: UserProfile, context: any): string[] {
    const tips: string[] = [];

    if (profile.weatherSensitivity === 'high') {
      tips.push("Check weather conditions carefully before starting your hike");
    }

    if (profile.riskTolerance === 'conservative') {
      tips.push("Consider choosing easier trails and shorter distances");
    }

    if (profile.hikingExperience === 'beginner') {
      tips.push("Start with well-marked trails and bring a map");
    }

    if (context.availableTime && context.availableTime < 2) {
      tips.push("Choose shorter routes to ensure you have enough time");
    }

    return tips;
  }

  // Query helpers
  async getProfileSummary(userId: string): Promise<{
    id: string;
    userId: string;
    averagePace: number;
    maxDistance: number;
    riskTolerance: string;
    hikingExperience: string;
  }> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new NotFoundError("User profile not found");
    }

    return {
      id: profile.id,
      userId: profile.userId,
      averagePace: profile.averagePace,
      maxDistance: profile.maxDistance,
      riskTolerance: profile.riskTolerance,
      hikingExperience: profile.hikingExperience
    };
  }
}

export default UserProfileConcept;
