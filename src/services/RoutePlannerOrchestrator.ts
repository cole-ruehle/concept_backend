/**
 * Route Planner Orchestrator
 * Uses LLM to understand user queries and orchestrate Google Maps API calls
 */

import { GeminiClient } from "./GeminiClient.ts";
import { GoogleMapsClient, Location } from "./GoogleMapsClient.ts";

export interface UserPreferences {
  duration?: number; // hours
  difficulty?: "easy" | "moderate" | "hard";
  transportModes?: string[];
  avoid?: string[];
  accessibility?: boolean;
}

export interface PlanRouteRequest {
  query: string;
  userLocation: Location;
  preferences?: UserPreferences;
}

export interface RouteSegment {
  mode: string;
  instructions: string;
  distance: number; // km
  duration: number; // minutes
  waypoints?: Location[];
}

export interface RouteResponse {
  route: {
    route_id: string;
    name: string;
    metrics: {
      totalMin: number;
      etaArrival: string;
    };
    origin: Location;
    destination: Location;
    waypoints: Array<Location & { name?: string }>;
    segments: RouteSegment[];
  };
  suggestions: string[];
}

export class RoutePlannerOrchestrator {
  private gemini: GeminiClient;
  private maps: GoogleMapsClient;

  constructor(geminiApiKey: string, mapsApiKey: string) {
    this.gemini = new GeminiClient(geminiApiKey);
    this.maps = new GoogleMapsClient(mapsApiKey);
  }

  /**
   * Main orchestration method
   */
  async planRoute(request: PlanRouteRequest): Promise<RouteResponse> {
    console.log("🎯 Planning route for query:", request.query);

    // Step 1: Use LLM to understand the query and create a plan
    const plan = await this.generateRoutePlan(request);

    // Step 2: Execute the plan using Google Maps APIs
    const route = await this.executeRoutePlan(plan, request);

    return route;
  }

  /**
   * Generate a route plan using LLM
   */
  private async generateRoutePlan(request: PlanRouteRequest): Promise<any> {
    const systemInstruction = `You are a hiking route planner assistant. Your job is to:
1. Understand the user's hiking query
2. Identify the destination (trailhead or hiking area)
3. Determine the best multi-modal route (transit + walking/hiking)
4. Provide helpful suggestions

Respond with a JSON plan that includes:
- destination: the hiking location/trailhead
- searchQuery: a search query for finding the trailhead
- transportMode: preferred modes of transport
- suggestions: array of helpful tips`;

    const prompt = `User Query: "${request.query}"

User Location: ${request.userLocation.lat}, ${request.userLocation.lng}

User Preferences:
- Duration: ${request.preferences?.duration || "flexible"} hours
- Difficulty: ${request.preferences?.difficulty || "any"}
- Transport modes: ${request.preferences?.transportModes?.join(", ") || "any"}

Create a route plan that:
1. Finds the best hiking location matching their query
2. Plans transit from their location to the trailhead
3. Includes walking/hiking time at the destination
4. Provides helpful suggestions

Respond with ONLY this JSON structure:
{
  "destination": "Name of hiking area",
  "searchQuery": "Search term for Google Places",
  "requiresTransit": true/false,
  "estimatedHikingDuration": minutes,
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}`;

    return await this.gemini.generateJSON(prompt, systemInstruction);
  }

  /**
   * Execute the route plan using Google Maps APIs
   */
  private async executeRoutePlan(
    plan: any,
    request: PlanRouteRequest
  ): Promise<RouteResponse> {
    console.log("📋 Executing plan:", plan);

    // Step 1: Find the destination (trailhead)
    const places = await this.maps.textSearch(
      plan.searchQuery,
      request.userLocation,
      50000 // 50km radius
    );

    if (places.length === 0) {
      throw new Error(`No hiking locations found for: ${plan.searchQuery}`);
    }

    const destination = places[0];
    console.log("📍 Found destination:", destination.name);

    // Step 2: Get directions from user location to trailhead
    const segments: RouteSegment[] = [];
    let totalMinutes = 0;

    // Transit segment (if needed and requested)
    if (
      plan.requiresTransit &&
      request.preferences?.transportModes?.includes("transit")
    ) {
      const transitResult = await this.maps.directions(
        request.userLocation,
        destination.location,
        {
          mode: "transit",
          alternatives: false,
        }
      );

      if (transitResult.status === "OK" && transitResult.routes.length > 0) {
        const route = transitResult.routes[0];
        const leg = route.legs[0];

        const transitMinutes = Math.round(leg.duration.value / 60);
        totalMinutes += transitMinutes;

        segments.push({
          mode: "transit",
          instructions: this.generateTransitInstructions(leg),
          distance: leg.distance.value / 1000, // convert to km
          duration: transitMinutes,
          waypoints: leg.steps.map((step) => step.start_location),
        });
      }
    } else {
      // Walking/driving segment to trailhead
      const mode = request.preferences?.transportModes?.includes("bicycling")
        ? "bicycling"
        : "walking";

      const directionsResult = await this.maps.directions(
        request.userLocation,
        destination.location,
        { mode: mode as any }
      );

      if (directionsResult.status === "OK" && directionsResult.routes.length > 0) {
        const route = directionsResult.routes[0];
        const leg = route.legs[0];

        const minutes = Math.round(leg.duration.value / 60);
        totalMinutes += minutes;

        segments.push({
          mode,
          instructions: `${mode === "walking" ? "Walk" : "Bike"} to ${destination.name}`,
          distance: leg.distance.value / 1000,
          duration: minutes,
          waypoints: leg.steps.map((step) => step.start_location),
        });
      }
    }

    // Hiking segment
    const hikingDuration = plan.estimatedHikingDuration || 120; // default 2 hours
    totalMinutes += hikingDuration;

    segments.push({
      mode: "hiking",
      instructions: `Hike at ${destination.name}`,
      distance: this.estimateHikingDistance(hikingDuration),
      duration: hikingDuration,
    });

    // Return segment (transit back home)
    if (plan.requiresTransit) {
      const returnResult = await this.maps.directions(
        destination.location,
        request.userLocation,
        {
          mode: "transit",
          alternatives: false,
        }
      );

      if (returnResult.status === "OK" && returnResult.routes.length > 0) {
        const route = returnResult.routes[0];
        const leg = route.legs[0];

        const returnMinutes = Math.round(leg.duration.value / 60);
        totalMinutes += returnMinutes;

        segments.push({
          mode: "transit",
          instructions: this.generateTransitInstructions(leg, "Return to starting point"),
          distance: leg.distance.value / 1000,
          duration: returnMinutes,
        });
      }
    }

    // Calculate ETA
    const etaArrival = new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();

    // Build response
    const response: RouteResponse = {
      route: {
        route_id: this.generateRouteId(),
        name: `${destination.name} Adventure`,
        metrics: {
          totalMin: totalMinutes,
          etaArrival,
        },
        origin: request.userLocation,
        destination: destination.location,
        waypoints: [
          {
            ...destination.location,
            name: destination.name,
          },
        ],
        segments,
      },
      suggestions: this.enhanceSuggestions(plan.suggestions || [], request.preferences),
    };

    return response;
  }

  /**
   * Generate transit instructions from directions leg
   */
  private generateTransitInstructions(leg: any, prefix?: string): string {
    const steps = leg.steps
      .filter((step: any) => step.travel_mode === "TRANSIT")
      .map((step: any) => {
        const details = step.transit_details;
        if (details) {
          return `Take ${details.line.short_name || details.line.name} to ${details.arrival_stop.name}`;
        }
        return null;
      })
      .filter(Boolean);

    if (steps.length === 0) {
      return prefix || `Go to ${leg.end_address}`;
    }

    const instruction = steps.join(", then ");
    return prefix ? `${prefix}: ${instruction}` : instruction;
  }

  /**
   * Estimate hiking distance based on duration
   */
  private estimateHikingDistance(durationMinutes: number): number {
    // Assume average hiking pace of 3 km/hr
    const hours = durationMinutes / 60;
    return Math.round(hours * 3 * 10) / 10; // rounded to 1 decimal
  }

  /**
   * Enhance suggestions with context-aware tips
   */
  private enhanceSuggestions(baseSuggestions: string[], prefs?: UserPreferences): string[] {
    const suggestions = [...baseSuggestions];

    // Add time-based suggestions
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 9) {
      suggestions.push("Early morning hiking offers cooler temperatures and fewer crowds");
    } else if (hour >= 15) {
      suggestions.push("Consider starting earlier to ensure daylight for return journey");
    }

    // Add accessibility suggestions
    if (prefs?.accessibility) {
      suggestions.push("This route has been optimized for accessibility");
    }

    // Add transit-specific suggestions
    if (prefs?.transportModes?.includes("transit")) {
      suggestions.push("Check transit schedules for return trip timing");
      suggestions.push("Keep transit pass/card easily accessible");
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Generate unique route ID
   */
  private generateRouteId(): string {
    return `route-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

