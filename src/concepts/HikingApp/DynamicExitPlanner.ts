import {
  Db,
  MongoClient,
  Collection,
  Filter,
} from "npm:mongodb";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { UserProfileConcept, UserProfile, UserFeedback } from "./UserProfile.ts";

// --- Custom Errors ---
class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
export class ValidationError extends BaseError {}
export class NotFoundError extends BaseError {}
export class ConflictError extends BaseError {}
export class StateError extends BaseError {}

// --- Database Connection & Setup ---
let mongoClient: MongoClient | null = null;

export async function connectMongo(): Promise<Db> {
  if (mongoClient && mongoClient.connected) {
    const dbName = Deno.env.get("DB_NAME");
    if (!dbName) throw new Error("DB_NAME environment variable not set.");
    return mongoClient.db(dbName);
  }
  await load({ export: true });
  const mongoUrl = Deno.env.get("MONGODB_URL");
  const dbName = Deno.env.get("DB_NAME");

  if (!mongoUrl || !dbName) {
    throw new Error("MONGODB_URL and DB_NAME environment variables must be set.");
  }

  mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();
  console.log("MongoDB connected.");
  return mongoClient.db(dbName);
}

// --- Collection Constants ---
export const ACTIVE_HIKES = "active_hikes";
export const EXIT_POINTS = "exit_points";
export const EXIT_STRATEGIES = "exit_strategies";
export const COMPLETED_HIKES = "completed_hikes";

// --- Collection Schemas (for type safety) ---
interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

interface ActiveHike {
  _id: string;
  userId: string;
  plannedRouteId: string;
  loc: GeoJsonPoint;
  startedAtIso: string;
  lastUpdateIso?: string;
  status: "active" | "ended";
}

interface ExitPoint {
  _id: string;
  name: string;
  loc: GeoJsonPoint;
  accessibility: string[];
  transitStopIds: string[];
}

interface ExitStrategy {
  _id: string;
  activeHikeId: string;
  exitPointId: string;
  criteria: "fastest" | "fewest_transfers" | "safest";
  onFootMinutes: number;
  transitMinutes: number;
  etaMinutes: number;
  scoring?: number;
  computedAtIso: string;
}

interface CompletedHike {
  _id: string;
  activeHikeId: string;
  userId: string;
  plannedRouteId: string;
  endedAtIso: string;
  exitPointId: string;
  durationMinutes: number;
}


export async function ensureCollections(db: Db): Promise<void> {
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c: any) => c.name);

    if (!collectionNames.includes(ACTIVE_HIKES)) {
        await db.createCollection(ACTIVE_HIKES);
        await db.collection(ACTIVE_HIKES).createIndexes([
            { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
            {
                key: { userId: 1, status: 1 },
                name: "userId_status_unique_active",
                unique: true,
                partialFilterExpression: { status: "active" },
            },
        ]);
    }

    if (!collectionNames.includes(EXIT_POINTS)) {
        await db.createCollection(EXIT_POINTS);
        await db.collection(EXIT_POINTS).createIndexes([
            { key: { loc: "2dsphere" }, name: "loc_2dsphere" },
            { key: { name: 1 }, name: "name_unique", unique: true },
        ]);
    }

    if (!collectionNames.includes(EXIT_STRATEGIES)) {
        await db.createCollection(EXIT_STRATEGIES);
        await db.collection(EXIT_STRATEGIES).createIndexes([
            { key: { activeHikeId: 1 }, name: "activeHikeId_idx" },
            { key: { exitPointId: 1 }, name: "exitPointId_idx" },
        ]);
    }

    if (!collectionNames.includes(COMPLETED_HIKES)) {
        await db.createCollection(COMPLETED_HIKES);
        await db.collection(COMPLETED_HIKES).createIndexes([
            { key: { userId: 1 }, name: "userId_idx" },
            { key: { endedAtIso: 1 }, name: "endedAtIso_idx" },
        ]);
    }
}


// --- LLM Adapter (Optional) ---
export interface DynamicExitPlannerLLM {
  scoreExit(input: string): Promise<number>;
}

export function makeGeminiLLM(apiKey: string, model = "gemini-1.5-flash-latest"): DynamicExitPlannerLLM {
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  return {
    async scoreExit(input: string): Promise<number> {
      try {
        const prompt = `Based on the following scenario, provide a safety and convenience score from 1 to 100. Higher is better. Return ONLY the number. Scenario: ${input}`;
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 5,
            }
          }),
        });

        if (!response.ok) {
          console.error("Gemini API Error:", await response.text());
          return 50; // Default score on error
        }

        const data = await response.json();
        const text = data.candidates[0]?.content.parts[0]?.text.trim();
        const score = parseInt(text, 10);

        return isNaN(score) ? 50 : Math.max(1, Math.min(100, score));
      } catch (error) {
        console.error("Failed to call Gemini API:", error);
        return 50; // Default score on fetch failure
      }
    },
  };
}

// --- Core Logic Class ---

const WALKING_SPEED_KMH = 4.5;
const TRANSIT_WAIT_PENALTY_MINUTES = 10;
const MAX_EXIT_POINT_SEARCH_RADIUS_METERS = 20000; // 20km

export class DynamicExitPlannerConcept {
  private db: Db;
  private llm?: DynamicExitPlannerLLM;
  private activeHikes: Collection<ActiveHike>;
  private exitPoints: Collection<ExitPoint>;
  private exitStrategies: Collection<ExitStrategy>;
  private completedHikes: Collection<CompletedHike>;

  constructor(db: Db, llm?: DynamicExitPlannerLLM) {
    this.db = db;
    this.llm = llm;
    this.activeHikes = db.collection<ActiveHike>(ACTIVE_HIKES);
    this.exitPoints = db.collection<ExitPoint>(EXIT_POINTS);
    this.exitStrategies = db.collection<ExitStrategy>(EXIT_STRATEGIES);
    this.completedHikes = db.collection<CompletedHike>(COMPLETED_HIKES);
  }

  // --- Private Helpers ---

  private _validateLatLon(lat: number, lon: number) {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new ValidationError(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
  }

  private _haversineMinutes(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    return (distanceKm / WALKING_SPEED_KMH) * 60;
  }
  
  private async _recomputeStrategies(hike: ActiveHike, currentLat: number, currentLon: number): Promise<void> {
    // 1. Delete old strategies for this hike
    await this.exitStrategies.deleteMany({ activeHikeId: hike._id });

    // 2. Find nearby exit points
    const nearbyExitPoints = await this.exitPoints.find({
      loc: {
        $near: {
          $geometry: { type: "Point", coordinates: [currentLon, currentLat] },
          $maxDistance: MAX_EXIT_POINT_SEARCH_RADIUS_METERS,
        },
      },
    }).limit(10).toArray();

    if (nearbyExitPoints.length === 0) {
        return; // No points nearby, no strategies to create
    }

    // 3. Create new strategies
    const nowIso = new Date().toISOString();
    const strategiesToInsert: ExitStrategy[] = [];

    for (const point of nearbyExitPoints) {
      const onFootMinutes = Math.round(this._haversineMinutes(currentLat, currentLon, point.loc.coordinates[1], point.loc.coordinates[0]));
      const transitMinutes = point.transitStopIds.length > 0 ? TRANSIT_WAIT_PENALTY_MINUTES : 0;
      const etaMinutes = onFootMinutes + transitMinutes;
      
      let scoring: number | undefined = undefined;
      if(this.llm) {
        const llmInput = `Hiker is at (${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}). Proposed exit is '${point.name}' which is a ${onFootMinutes} minute walk. Accessibility: ${point.accessibility.join(', ') || 'none'}.`;
        scoring = await this.llm.scoreExit(llmInput);
      }

      strategiesToInsert.push({
        _id: crypto.randomUUID(),
        activeHikeId: hike._id,
        exitPointId: point._id,
        criteria: "fastest", // Simple default for now
        onFootMinutes,
        transitMinutes,
        etaMinutes,
        scoring,
        computedAtIso: nowIso,
      });
    }

    if (strategiesToInsert.length > 0) {
      await this.exitStrategies.insertMany(strategiesToInsert);
    }
  }


  // --- Public API Methods ---

  async startHike(plannedRouteId: string, userId: string, startLat: number, startLon: number, startIso?: string): Promise<string> {
    if (!plannedRouteId || !userId) {
      throw new ValidationError("plannedRouteId and userId are required.");
    }
    this._validateLatLon(startLat, startLon);

    const existingHike = await this.activeHikes.findOne({ userId, status: "active" });
    if (existingHike) {
      throw new ConflictError(`User ${userId} already has an active hike.`);
    }

    const activeHikeId = crypto.randomUUID();
    const newHike: ActiveHike = {
      _id: activeHikeId,
      userId,
      plannedRouteId,
      loc: { type: "Point", coordinates: [startLon, startLat] },
      startedAtIso: startIso || new Date().toISOString(),
      status: "active",
    };

    await this.activeHikes.insertOne(newHike);
    return activeHikeId;
  }

  async updateLocation(activeHikeId: string, lat: number, lon: number, atIso?: string): Promise<void> {
    this._validateLatLon(lat, lon);
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });

    if (!hike) {
      throw new NotFoundError(`Active hike with id ${activeHikeId} not found.`);
    }
    if (hike.status !== "active") {
      throw new StateError(`Hike ${activeHikeId} is not active.`);
    }

    // Recompute strategies first
    await this._recomputeStrategies(hike, lat, lon);

    // Then update the hike's location
    await this.activeHikes.updateOne(
      { _id: activeHikeId },
      {
        $set: {
          loc: { type: "Point", coordinates: [lon, lat] },
          lastUpdateIso: atIso || new Date().toISOString(),
        },
      }
    );
  }

  async getExitStrategies(activeHikeId: string): Promise<string[]> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId, status: "active" });
    if (!hike) {
      throw new NotFoundError(`Active hike with id ${activeHikeId} not found or is not active.`);
    }

    const strategies = await this.exitStrategies.find({ activeHikeId })
      .sort({ scoring: -1, etaMinutes: 1 }) // Prioritize score, then ETA
      .toArray();

    return strategies.map((s: any) => s._id);
  }

  async endHike(activeHikeId: string, exitPointId: string, endIso?: string): Promise<string> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });
    if (!hike) {
      throw new NotFoundError(`Active hike with id ${activeHikeId} not found.`);
    }
    if (hike.status !== "active") {
      throw new StateError(`Hike ${activeHikeId} has already ended.`);
    }

    const exitPoint = await this.exitPoints.findOne({ _id: exitPointId });
    if (!exitPoint) {
        throw new NotFoundError(`Exit point with id ${exitPointId} not found.`);
    }

    const endedAt = new Date(endIso || new Date().toISOString());
    const startedAt = new Date(hike.startedAtIso);
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60));

    const completedHikeId = crypto.randomUUID();
    const completedHike: CompletedHike = {
      _id: completedHikeId,
      activeHikeId,
      userId: hike.userId,
      plannedRouteId: hike.plannedRouteId,
      endedAtIso: endedAt.toISOString(),
      exitPointId,
      durationMinutes,
    };

    await this.completedHikes.insertOne(completedHike);
    await this.activeHikes.updateOne({ _id: activeHikeId }, { $set: { status: "ended" } });

    return completedHikeId;
  }

  // --- Query Helpers ---

  async getActiveHikeSummary(activeHikeId: string): Promise<{ id: string; userId: string; lat: number; lon: number; startedAtIso: string; strategiesCount: number }> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });
    if (!hike) {
      throw new NotFoundError(`Hike with id ${activeHikeId} not found.`);
    }

    const strategiesCount = await this.exitStrategies.countDocuments({ activeHikeId });

    return {
      id: hike._id,
      userId: hike.userId,
      lat: hike.loc.coordinates[1],
      lon: hike.loc.coordinates[0],
      startedAtIso: hike.startedAtIso,
      strategiesCount,
    };
  }

  async getExitStrategyDetail(exitStrategyId: string): Promise<{ id: string; exitPointId: string; etaMinutes: number; transitMinutes: number; onFootMinutes: number; scoring?: number }> {
    const strategy = await this.exitStrategies.findOne({ _id: exitStrategyId });
    if (!strategy) {
      throw new NotFoundError(`Exit strategy with id ${exitStrategyId} not found.`);
    }

    return {
      id: strategy._id,
      exitPointId: strategy.exitPointId,
      etaMinutes: strategy.etaMinutes,
      transitMinutes: strategy.transitMinutes,
      onFootMinutes: strategy.onFootMinutes,
      scoring: strategy.scoring,
    };
  }

  // AI-Enhanced Methods

  /**
   * Get personalized exit strategies based on user profile
   */
  async getPersonalizedExitStrategies(
    activeHikeId: string,
    userId: string
  ): Promise<{
    strategies: any[];
    personalizedRecommendations: string[];
    riskAssessment: string;
  }> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });
    if (!hike) {
      throw new NotFoundError(`ActiveHike with id ${activeHikeId} not found.`);
    }

    // Get user profile for personalization
    const userProfileManager = new UserProfileConcept(this.db);
    const userProfile = await userProfileManager.getProfile(userId);
    
    // Get basic exit strategies
    const strategies = await this.getExitStrategies(activeHikeId);
    
    // Personalize based on user profile
    const personalizedRecommendations: string[] = [];
    const riskAssessment = userProfile ? this.assessPersonalizedRisk(userProfile, hike) : 'medium';

    if (userProfile) {
      if (userProfile.riskTolerance === 'conservative') {
        personalizedRecommendations.push("Consider taking the safest, most accessible exit route");
        personalizedRecommendations.push("Avoid challenging terrain if weather conditions are poor");
      } else if (userProfile.riskTolerance === 'adventurous') {
        personalizedRecommendations.push("You can handle more challenging exit routes");
        personalizedRecommendations.push("Consider scenic exit options if time permits");
      }

      if (userProfile.weatherSensitivity === 'high') {
        personalizedRecommendations.push("Monitor weather conditions closely");
        personalizedRecommendations.push("Have a backup exit plan ready");
      }

      if (userProfile.hikingExperience === 'beginner') {
        personalizedRecommendations.push("Choose well-marked exit routes");
        personalizedRecommendations.push("Consider shorter exit distances");
      }
    }

    return {
      strategies,
      personalizedRecommendations,
      riskAssessment
    };
  }

  /**
   * Submit feedback about exit strategy effectiveness
   */
  async submitExitStrategyFeedback(
    activeHikeId: string,
    exitStrategyId: string,
    feedback: {
      satisfaction: number;
      accuracy: number;
      helpfulness: number;
      comments: string;
    }
  ): Promise<string> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });
    if (!hike) {
      throw new NotFoundError(`ActiveHike with id ${activeHikeId} not found.`);
    }

    const userProfileManager = new UserProfileConcept(this.db);
    const feedbackData: Omit<UserFeedback, 'id' | 'createdAt'> = {
      hikeId: activeHikeId,
      exitStrategyId,
      satisfaction: feedback.satisfaction,
      accuracy: feedback.accuracy,
      helpfulness: feedback.helpfulness,
      comments: feedback.comments
    };

    return await userProfileManager.submitFeedback(feedbackData);
  }

  /**
   * Get contextual guidance based on current hike state
   */
  async getContextualGuidance(
    activeHikeId: string,
    userQuery: string
  ): Promise<{
    guidance: string;
    recommendations: string[];
    safetyTips: string[];
  }> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });
    if (!hike) {
      throw new NotFoundError(`ActiveHike with id ${activeHikeId} not found.`);
    }

    const userProfileManager = new UserProfileConcept(this.db);
    const userProfile = await userProfileManager.getProfile(hike.userId);

    // Generate contextual guidance based on hike state and user profile
    const guidance = this.generateContextualGuidance(hike, userQuery, userProfile);
    const recommendations = this.generateRecommendations(hike, userProfile);
    const safetyTips = this.generateSafetyTips(hike, userProfile);

    return {
      guidance,
      recommendations,
      safetyTips
    };
  }

  /**
   * Analyze user state during hike
   */
  async analyzeUserState(
    activeHikeId: string,
    sensorData: {
      heartRate?: number;
      pace?: number;
      energyLevel?: number;
      perceivedExertion?: number;
    }
  ): Promise<{
    physicalState: {
      fatigue: number;
      energy: number;
      pace: number;
    };
    mentalState: {
      confidence: number;
      stress: number;
      motivation: number;
    };
    recommendations: string[];
  }> {
    const hike = await this.activeHikes.findOne({ _id: activeHikeId });
    if (!hike) {
      throw new NotFoundError(`ActiveHike with id ${activeHikeId} not found.`);
    }

    const userProfileManager = new UserProfileConcept(this.db);
    const userProfile = await userProfileManager.getProfile(hike.userId);

    // Analyze physical state
    const physicalState = {
      fatigue: this.calculateFatigue(hike, sensorData),
      energy: sensorData.energyLevel || 7,
      pace: sensorData.pace || 2.5
    };

    // Analyze mental state
    const mentalState = {
      confidence: this.calculateConfidence(hike, userProfile),
      stress: this.calculateStress(hike, sensorData),
      motivation: this.calculateMotivation(hike, userProfile)
    };

    // Generate recommendations
    const recommendations = this.generateStateBasedRecommendations(
      physicalState,
      mentalState,
      userProfile
    );

    return {
      physicalState,
      mentalState,
      recommendations
    };
  }

  // Helper methods for AI features
  private assessPersonalizedRisk(userProfile: UserProfile, hike: any): string {
    let riskLevel = 'medium';

    if (userProfile.riskTolerance === 'conservative') {
      riskLevel = 'low';
    } else if (userProfile.riskTolerance === 'adventurous') {
      riskLevel = 'high';
    }

    // Adjust based on hiking experience
    if (userProfile.hikingExperience === 'beginner') {
      if (riskLevel === 'high') riskLevel = 'medium';
    } else if (userProfile.hikingExperience === 'expert') {
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    return riskLevel;
  }

  private generateContextualGuidance(hike: any, userQuery: string, userProfile: UserProfile | null): string {
    const elapsedTime = (Date.now() - new Date(hike.startedAtIso).getTime()) / (1000 * 60 * 60);
    
    let guidance = `Based on your ${elapsedTime.toFixed(1)} hour hike, `;
    
    if (userQuery.toLowerCase().includes('tired') || userQuery.toLowerCase().includes('fatigue')) {
      guidance += "consider taking a break and choosing a shorter exit route. ";
    } else if (userQuery.toLowerCase().includes('weather')) {
      guidance += "monitor weather conditions and have a backup plan ready. ";
    } else if (userQuery.toLowerCase().includes('lost') || userQuery.toLowerCase().includes('direction')) {
      guidance += "stay calm and use your exit strategies to find the nearest safe point. ";
    } else {
      guidance += "you're doing well! Continue monitoring your energy levels. ";
    }

    if (userProfile?.riskTolerance === 'conservative') {
      guidance += "As a conservative hiker, prioritize safety over distance.";
    }

    return guidance;
  }

  private generateRecommendations(hike: any, userProfile: UserProfile | null): string[] {
    const recommendations: string[] = [];
    const elapsedTime = (Date.now() - new Date(hike.startedAtIso).getTime()) / (1000 * 60 * 60);

    if (elapsedTime > 4) {
      recommendations.push("Consider taking a break if you're feeling fatigued");
    }

    if (userProfile?.weatherSensitivity === 'high') {
      recommendations.push("Check weather forecast for the next few hours");
    }

    if (userProfile?.hikingExperience === 'beginner') {
      recommendations.push("Choose well-marked exit routes");
    }

    return recommendations;
  }

  private generateSafetyTips(hike: any, userProfile: UserProfile | null): string[] {
    const tips: string[] = [
      "Stay hydrated and take breaks as needed",
      "Let someone know your planned exit route",
      "Carry a map and compass as backup"
    ];

    if (userProfile?.riskTolerance === 'adventurous') {
      tips.push("Even experienced hikers should have backup plans");
    }

    return tips;
  }

  private calculateFatigue(hike: any, sensorData: any): number {
    const elapsedTime = (Date.now() - new Date(hike.startedAtIso).getTime()) / (1000 * 60 * 60);
    let fatigue = Math.min(elapsedTime / 6, 1) * 10; // Scale 0-10

    if (sensorData.perceivedExertion) {
      fatigue = Math.max(fatigue, sensorData.perceivedExertion);
    }

    return Math.round(fatigue);
  }

  private calculateConfidence(hike: any, userProfile: UserProfile | null): number {
    let confidence = 7; // Base confidence

    if (userProfile?.hikingExperience === 'expert') {
      confidence = 9;
    } else if (userProfile?.hikingExperience === 'advanced') {
      confidence = 8;
    } else if (userProfile?.hikingExperience === 'beginner') {
      confidence = 5;
    }

    return confidence;
  }

  private calculateStress(hike: any, sensorData: any): number {
    let stress = 3; // Base stress level

    if (sensorData.heartRate && sensorData.heartRate > 120) {
      stress += 2;
    }

    return Math.min(stress, 10);
  }

  private calculateMotivation(hike: any, userProfile: UserProfile | null): number {
    let motivation = 8; // Base motivation

    if (userProfile?.riskTolerance === 'adventurous') {
      motivation = 9;
    } else if (userProfile?.riskTolerance === 'conservative') {
      motivation = 7;
    }

    return motivation;
  }

  private generateStateBasedRecommendations(
    physicalState: any,
    mentalState: any,
    userProfile: UserProfile | null
  ): string[] {
    const recommendations: string[] = [];

    if (physicalState.fatigue > 7) {
      recommendations.push("Consider taking a longer break or choosing a shorter exit route");
    }

    if (mentalState.stress > 6) {
      recommendations.push("Take deep breaths and focus on your breathing");
    }

    if (mentalState.confidence < 5) {
      recommendations.push("Choose the safest, most straightforward exit route");
    }

    if (userProfile?.weatherSensitivity === 'high') {
      recommendations.push("Monitor weather conditions closely");
    }

    return recommendations;
  }
}

export default DynamicExitPlannerConcept;