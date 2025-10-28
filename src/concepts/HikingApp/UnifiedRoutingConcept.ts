import { Db } from "npm:mongodb";
import { TransitRoutePlannerConcept } from "./TransitRoutePlanner.ts";
import { ExternalRoutingEngineConcept } from "./ExternalRoutingEngine.ts";
import { DynamicExitPlannerConcept } from "./DynamicExitPlanner.ts";
import { ConstraintMonitorConcept } from "./ConstraintMonitor.ts";
import { POISearchConcept } from "./POISearchConcept.ts";

export interface RouteRequest {
  origin: {
    lat: number;
    lon: number;
    address?: string;
  };
  destination: {
    lat: number;
    lon: number;
    address?: string;
  };
  mode: "hiking" | "transit" | "driving" | "walking" | "cycling" | "multimodal";
  preferences?: {
    maxDistance?: number;
    maxDuration?: number; // in minutes
    difficulty?: "easy" | "moderate" | "hard" | "expert";
    avoidHighways?: boolean;
    preferTrails?: boolean;
    accessibility?: string[];
  };
  alternatives?: number; // number of alternative routes to return
}

export interface RouteResponse {
  id: string;
  mode: string;
  totalDistance: number; // in meters
  totalDuration: number; // in seconds
  totalDistanceFormatted: string; // e.g., "4.5 km"
  totalDurationFormatted: string; // e.g., "53m" or "1h 6m"
  segments: RouteSegment[];
  summary: {
    transitTime: number; // in seconds
    hikingTime: number; // in seconds
    walkingTime: number; // in seconds
    drivingTime: number; // in seconds
  };
  polyline?: string;
  geojson?: any;
  instructions: string[];
  difficulty: string;
  elevationGain: number; // in meters
  createdAt: string;
}

export interface RouteSegment {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  distance: number; // in meters
  duration: number; // in seconds
  distanceFormatted: string;
  durationFormatted: string;
  instructions: string[];
  surface: string;
  difficulty: string;
  elevationGain: number;
  waypoints: { lat: number; lon: number }[];
  mode: "transit" | "hiking" | "walking" | "driving";
}

export interface SearchHistoryEntry {
  id: string;
  origin: { lat: number; lon: number; address?: string };
  destination: { lat: number; lon: number; address?: string };
  mode: string;
  searchedAt: string;
  resultCount: number;
}

export class UnifiedRoutingConcept {
  private transitRoutePlanner: TransitRoutePlannerConcept;
  private externalRoutingEngine: ExternalRoutingEngineConcept;
  private dynamicExitPlanner: DynamicExitPlannerConcept;
  private constraintMonitor: ConstraintMonitorConcept;
  private poiSearch: POISearchConcept;
  private searchHistory: any;

  constructor(private db: Db) {
    this.transitRoutePlanner = new TransitRoutePlannerConcept(db);
    this.externalRoutingEngine = new ExternalRoutingEngineConcept(db);
    this.dynamicExitPlanner = new DynamicExitPlannerConcept(db);
    this.constraintMonitor = new ConstraintMonitorConcept(db);
    this.poiSearch = new POISearchConcept(db);
    this.searchHistory = db.collection("search_history");
  }

  /**
   * Main route calculation method - consolidates all routing logic
   */
  async calculateRoute(request: RouteRequest): Promise<RouteResponse> {
    const { origin, destination, mode, preferences = {}, alternatives = 1 } = request;

    // Validate inputs
    this.validateRouteRequest(request);

    // Calculate route based on mode
    let routeData: any;
    let routeId: string;

    switch (mode) {
      case "hiking":
        routeData = await this.calculateHikingRoute(origin, destination, preferences);
        routeId = this.generateRouteId();
        break;
      
      case "transit":
        routeId = await this.transitRoutePlanner.planRoute(
          origin.lat,
          origin.lon,
          await this.findNearestTrailhead(destination),
          (preferences.maxDuration || 480) * 60, // convert to seconds
          undefined,
          preferences.accessibility
        );
        routeData = await this.transitRoutePlanner.getPlannedRouteSummary(routeId);
        break;
      
      case "multimodal":
        routeData = await this.externalRoutingEngine.calculateMultiModalRoute(
          origin,
          destination,
          {
            maxTransitTime: preferences.maxDuration,
            preferDirectRoutes: !preferences.avoidHighways
          }
        );
        routeId = this.generateRouteId();
        break;
      
      default:
        routeId = await this.externalRoutingEngine.calculateRoute(
          origin,
          destination,
          mode,
          preferences
        );
        routeData = await this.externalRoutingEngine.getRoutingSummary(routeId);
    }

    // Format the response
    const response = await this.formatRouteResponse(routeId, routeData, mode, preferences);
    
    // Save to search history
    await this.saveSearchHistory(request, response);

    return response;
  }

  /**
   * Get alternative routes for a given route
   */
  async getAlternativeRoutes(routeId: string, criteria: "faster" | "shorter" | "scenic" | "easier"): Promise<RouteResponse[]> {
    // This would implement alternative route calculation
    // For now, return empty array
    return [];
  }

  /**
   * Search for locations with autocomplete
   */
  async searchLocations(query: string, limit: number = 10): Promise<{
    id: string;
    name: string;
    address: string;
    location: { lat: number; lon: number };
    type: "trailhead" | "trail" | "transit_stop" | "poi";
  }[]> {
    // Use a reasonable radius for search
    const results = await this.poiSearch.searchPOIs({ lat: 0, lon: 0 }, ["trailhead", "trail", "transit_stop", "poi"], 100, limit);
    
    // Filter results by query
    const filteredResults = results.filter(poi => 
      poi.name.toLowerCase().includes(query.toLowerCase()) ||
      (poi.tags.address && poi.tags.address.toLowerCase().includes(query.toLowerCase()))
    );
    
    return filteredResults.map(poi => ({
      id: poi.id,
      name: poi.name,
      address: poi.tags.address || "",
      location: poi.location,
      type: poi.type as any
    }));
  }

  /**
   * Get recent searches for a user
   */
  async getRecentSearches(userId?: string, limit: number = 10): Promise<SearchHistoryEntry[]> {
    const query = userId ? { userId } : {};
    const searches = await this.searchHistory
      .find(query)
      .sort({ searchedAt: -1 })
      .limit(limit)
      .toArray();
    
    return searches.map(search => ({
      id: search._id.toString(),
      origin: search.origin,
      destination: search.destination,
      mode: search.mode,
      searchedAt: search.searchedAt,
      resultCount: search.resultCount
    }));
  }

  /**
   * Get route details by ID
   */
  async getRouteDetails(routeId: string): Promise<RouteResponse | null> {
    // This would retrieve route details from cache or database
    return null;
  }

  // Private helper methods

  private validateRouteRequest(request: RouteRequest): void {
    if (!request.origin || !request.destination) {
      throw new Error("Origin and destination are required");
    }
    
    if (!request.origin.lat || !request.origin.lon || !request.destination.lat || !request.destination.lon) {
      throw new Error("Valid coordinates are required for origin and destination");
    }
    
    if (!request.mode) {
      throw new Error("Mode is required");
    }
  }

  private async calculateHikingRoute(origin: any, destination: any, preferences: any) {
    return await this.externalRoutingEngine.calculateHikingRoute(origin, destination, preferences);
  }

  private async findNearestTrailhead(destination: any): Promise<string> {
    // Find the nearest trailhead to the destination
    const trailheads = await this.db.collection("trailheads").find({
      loc: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [destination.lon, destination.lat]
          }
        }
      }
    }).limit(1).toArray();
    
    if (trailheads.length === 0) {
      throw new Error("No trailheads found near destination");
    }
    
    return trailheads[0]._id.toHexString();
  }

  private async formatRouteResponse(routeId: string, routeData: any, mode: string, preferences: any): Promise<RouteResponse> {
    // Calculate totals
    const totalDistance = this.calculateTotalDistance(routeData);
    const totalDuration = this.calculateTotalDuration(routeData);
    
    // Format segments
    const segments = this.formatRouteSegments(routeData);
    
    // Create response
    return {
      id: routeId,
      mode,
      totalDistance,
      totalDuration,
      totalDistanceFormatted: this.formatDistance(totalDistance),
      totalDurationFormatted: this.formatDuration(totalDuration),
      segments,
      summary: {
        transitTime: this.getTransitTime(routeData),
        hikingTime: this.getHikingTime(routeData),
        walkingTime: this.getWalkingTime(routeData),
        drivingTime: this.getDrivingTime(routeData)
      },
      polyline: routeData.polyline,
      geojson: routeData.geojson,
      instructions: this.getInstructions(routeData),
      difficulty: this.getDifficulty(routeData, preferences),
      elevationGain: this.getElevationGain(routeData),
      createdAt: new Date().toISOString()
    };
  }

  private calculateTotalDistance(routeData: any): number {
    if (routeData.segments) {
      return routeData.segments.reduce((sum: number, seg: any) => sum + (seg.distance || 0), 0);
    }
    return routeData.distanceMeters || 0;
  }

  private calculateTotalDuration(routeData: any): number {
    if (routeData.segments) {
      return routeData.segments.reduce((sum: number, seg: any) => sum + (seg.duration || 0), 0);
    }
    return routeData.durationSeconds || 0;
  }

  private formatRouteSegments(routeData: any): RouteSegment[] {
    if (routeData.segments) {
      return routeData.segments.map((seg: any) => ({
        from: seg.from,
        to: seg.to,
        distance: seg.distance || 0,
        duration: seg.duration || 0,
        distanceFormatted: this.formatDistance(seg.distance || 0),
        durationFormatted: this.formatDuration(seg.duration || 0),
        instructions: seg.instructions || [],
        surface: seg.surface || "unknown",
        difficulty: seg.difficulty || "moderate",
        elevationGain: seg.elevation_gain || 0,
        waypoints: seg.waypoints || [],
        mode: seg.mode || "hiking"
      }));
    }
    return [];
  }

  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  private getTransitTime(routeData: any): number {
    return routeData.transitMinutes ? routeData.transitMinutes * 60 : 0;
  }

  private getHikingTime(routeData: any): number {
    return routeData.hikingMinutes ? routeData.hikingMinutes * 60 : 0;
  }

  private getWalkingTime(routeData: any): number {
    return routeData.walkingMinutes ? routeData.walkingMinutes * 60 : 0;
  }

  private getDrivingTime(routeData: any): number {
    return routeData.drivingMinutes ? routeData.drivingMinutes * 60 : 0;
  }

  private getInstructions(routeData: any): string[] {
    if (routeData.instructions) {
      return routeData.instructions;
    }
    if (routeData.segments) {
      return routeData.segments.flatMap((seg: any) => seg.instructions || []);
    }
    return [];
  }

  private getDifficulty(routeData: any, preferences: any): string {
    if (preferences.difficulty) {
      return preferences.difficulty;
    }
    if (routeData.difficulty) {
      return routeData.difficulty;
    }
    return "moderate";
  }

  private getElevationGain(routeData: any): number {
    if (routeData.elevationGain) {
      return routeData.elevationGain;
    }
    if (routeData.segments) {
      return routeData.segments.reduce((sum: number, seg: any) => sum + (seg.elevation_gain || 0), 0);
    }
    return 0;
  }

  private async saveSearchHistory(request: RouteRequest, response: RouteResponse): Promise<void> {
    await this.searchHistory.insertOne({
      origin: request.origin,
      destination: request.destination,
      mode: request.mode,
      searchedAt: new Date().toISOString(),
      resultCount: 1,
      routeId: response.id
    });
  }

  private generateRouteId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default UnifiedRoutingConcept;
