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

export interface CurrentRoute {
  route_id: string;
  name?: string;
  origin: Location;
  destination: Location;
  waypoints?: Array<Location & { name?: string }>;
  segments?: RouteSegment[];
  metrics?: {
    totalMin: number;
    etaArrival?: string;
  };
}

export interface PlanRouteRequest {
  query: string;
  userLocation: Location;
  preferences?: UserPreferences;
  currentRoute?: CurrentRoute;
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
    console.log("Planning route for query:", request.query);

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
4. Handle modifications to existing routes (add waypoints, change times, exit strategies)
5. Provide helpful suggestions

Respond with a JSON plan that includes:
- action: "create_new" or "modify_existing"
- destination: the hiking location/trailhead
- searchQuery: a search query for finding the trailhead or waypoint
- requiresTransit: true/false
- estimatedHikingDuration: minutes
- modifyType: if modifying, what type ("add_waypoint", "exit_now", "adjust_time", "add_scenic_stop")
- suggestions: array of helpful tips`;

    // Build current route context if available
    let currentRouteContext = "";
    if (request.currentRoute) {
      currentRouteContext = `
Current Route:
- Route ID: ${request.currentRoute.route_id}
- Name: ${request.currentRoute.name || "Unnamed route"}
- Origin: ${request.currentRoute.origin.lat}, ${request.currentRoute.origin.lng}
- Destination: ${request.currentRoute.destination.lat}, ${request.currentRoute.destination.lng}
- Total time: ${request.currentRoute.metrics?.totalMin || "unknown"} minutes
- Waypoints: ${request.currentRoute.waypoints?.length || 0}
- Segments: ${request.currentRoute.segments?.length || 0}

The user wants to MODIFY this existing route based on their query.`;
    }

    const prompt = `User Query: "${request.query}"

User Location: ${request.userLocation.lat}, ${request.userLocation.lng}

User Preferences:
- Duration: ${request.preferences?.duration || "flexible"} hours
- Difficulty: ${request.preferences?.difficulty || "any"}
- Transport modes: ${request.preferences?.transportModes?.join(", ") || "any"}
${currentRouteContext}

Create a route plan that:
${request.currentRoute 
  ? "1. MODIFIES the existing route based on the user's query\n2. Preserves the original destination unless explicitly changed\n3. Adds waypoints, adjusts timing, or handles exit strategies as needed"
  : "1. Finds the best hiking location matching their query\n2. Plans transit from their location to the trailhead\n3. Includes walking/hiking time at the destination"
}
4. Provides helpful suggestions

Respond with ONLY this JSON structure:
{
  "action": "${request.currentRoute ? 'modify_existing' : 'create_new'}",
  "destination": "Name of hiking area",
  "searchQuery": "Search term for Google Places${request.currentRoute ? ' (or waypoint if adding a stop)' : ''}",
  "requiresTransit": true/false,
  "estimatedHikingDuration": minutes,
  "modifyType": "${request.currentRoute ? '"add_waypoint" or "exit_now" or "adjust_time" or "add_scenic_stop"' : 'null'}",
  "keepOriginalDestination": ${request.currentRoute ? 'true/false' : 'false'},
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
    console.log("Executing plan:", plan);

    // Check if we're modifying an existing route
    if (plan.action === "modify_existing" && request.currentRoute) {
      return await this.modifyExistingRoute(plan, request);
    }

    // Otherwise, create a new route
    return await this.createNewRoute(plan, request);
  }

  /**
   * Create a brand new route
   */
  private async createNewRoute(
    plan: any,
    request: PlanRouteRequest
  ): Promise<RouteResponse> {
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
    console.log("Found destination:", destination.name);

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
   * Modify an existing route based on user action
   */
  private async modifyExistingRoute(
    plan: any,
    request: PlanRouteRequest
  ): Promise<RouteResponse> {
    const currentRoute = request.currentRoute!;
    console.log(`Modifying route ${currentRoute.route_id}: ${plan.modifyType}`);

    switch (plan.modifyType) {
      case "add_scenic_stop":
      case "add_waypoint":
        return await this.addWaypointToRoute(plan, request, currentRoute);

      case "exit_now":
        return await this.createExitRoute(plan, request, currentRoute);

      case "adjust_time":
        return await this.adjustRouteTiming(plan, request, currentRoute);

      default:
        // Fallback: create new route with same destination but modified parameters
        console.warn(`Unknown modify type: ${plan.modifyType}, creating new route`);
        return await this.createNewRoute(plan, request);
    }
  }

  /**
   * Add a waypoint (scenic stop) to existing route
   */
  private async addWaypointToRoute(
    plan: any,
    request: PlanRouteRequest,
    currentRoute: CurrentRoute
  ): Promise<RouteResponse> {
    // Search for the waypoint
    const midpoint = {
      lat: (currentRoute.origin.lat + currentRoute.destination.lat) / 2,
      lng: (currentRoute.origin.lng + currentRoute.destination.lng) / 2,
    };

    const places = await this.maps.nearbySearch(
      midpoint,
      10000, // 10km radius
      "tourist_attraction",
      plan.searchQuery
    );

    if (places.length === 0) {
      throw new Error(`No waypoints found for: ${plan.searchQuery}`);
    }

    const waypoint = places[0];
    console.log(`Adding waypoint: ${waypoint.name}`);

    // Get directions with waypoint
    const directionsResult = await this.maps.directions(
      currentRoute.origin,
      currentRoute.destination,
      {
        mode: request.preferences?.transportModes?.includes("transit") ? "transit" : "walking",
        waypoints: [waypoint.location],
      }
    );

    if (directionsResult.status !== "OK" || directionsResult.routes.length === 0) {
      throw new Error("Could not calculate route with waypoint");
    }

    const route = directionsResult.routes[0];
    const segments: RouteSegment[] = [];
    let totalMinutes = 0;

    // Convert legs to segments
    for (const leg of route.legs) {
      const minutes = Math.round(leg.duration.value / 60);
      totalMinutes += minutes;

      segments.push({
        mode: request.preferences?.transportModes?.includes("transit") ? "transit" : "walking",
        instructions: `Go to ${leg.end_address}`,
        distance: leg.distance.value / 1000,
        duration: minutes,
      });
    }

    const etaArrival = new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();

    return {
      route: {
        route_id: currentRoute.route_id, // Keep same route ID
        name: `${currentRoute.name} via ${waypoint.name}`,
        metrics: {
          totalMin: totalMinutes,
          etaArrival,
        },
        origin: currentRoute.origin,
        destination: currentRoute.destination,
        waypoints: [
          ...(currentRoute.waypoints || []),
          { ...waypoint.location, name: waypoint.name },
        ],
        segments,
      },
      suggestions: [
        `Added scenic stop: ${waypoint.name}`,
        ...this.enhanceSuggestions(plan.suggestions || [], request.preferences),
      ],
    };
  }

  /**
   * Create an exit route from current location to home
   */
  private async createExitRoute(
    plan: any,
    request: PlanRouteRequest,
    currentRoute: CurrentRoute
  ): Promise<RouteResponse> {
    console.log("Creating exit route to home");

    // Use current location as origin, current route origin as home
    const homeLocation = currentRoute.origin;

    const directionsResult = await this.maps.directions(
      request.userLocation,
      homeLocation,
      {
        mode: "transit",
        departure_time: Math.floor(Date.now() / 1000), // Now
      }
    );

    if (directionsResult.status !== "OK" || directionsResult.routes.length === 0) {
      throw new Error("Could not calculate exit route");
    }

    const route = directionsResult.routes[0];
    const leg = route.legs[0];
    const totalMinutes = Math.round(leg.duration.value / 60);
    const etaArrival = new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();

    const segments: RouteSegment[] = [
      {
        mode: "transit",
        instructions: this.generateTransitInstructions(leg, "Return home"),
        distance: leg.distance.value / 1000,
        duration: totalMinutes,
      },
    ];

    return {
      route: {
        route_id: `exit-${currentRoute.route_id}`,
        name: "Exit Route to Home",
        metrics: {
          totalMin: totalMinutes,
          etaArrival,
        },
        origin: request.userLocation,
        destination: homeLocation,
        waypoints: [],
        segments,
      },
      suggestions: [
        "Exit route calculated from your current location",
        "Check transit schedules before departing",
        ...this.enhanceSuggestions(plan.suggestions || [], request.preferences),
      ],
    };
  }

  /**
   * Adjust timing of existing route
   */
  private async adjustRouteTiming(
    plan: any,
    request: PlanRouteRequest,
    currentRoute: CurrentRoute
  ): Promise<RouteResponse> {
    console.log("Adjusting route timing");

    // Re-calculate route with updated timing preferences
    // For now, just recalculate the same route
    const directionsResult = await this.maps.directions(
      currentRoute.origin,
      currentRoute.destination,
      {
        mode: request.preferences?.transportModes?.includes("transit") ? "transit" : "walking",
        waypoints: currentRoute.waypoints?.map((wp) => wp as Location),
      }
    );

    if (directionsResult.status !== "OK" || directionsResult.routes.length === 0) {
      throw new Error("Could not recalculate route");
    }

    const route = directionsResult.routes[0];
    const segments: RouteSegment[] = [];
    let totalMinutes = 0;

    for (const leg of route.legs) {
      const minutes = Math.round(leg.duration.value / 60);
      totalMinutes += minutes;

      segments.push({
        mode: request.preferences?.transportModes?.includes("transit") ? "transit" : "walking",
        instructions: `Go to ${leg.end_address}`,
        distance: leg.distance.value / 1000,
        duration: minutes,
      });
    }

    const etaArrival = new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();

    return {
      route: {
        route_id: currentRoute.route_id,
        name: currentRoute.name || "Updated Route",
        metrics: {
          totalMin: totalMinutes,
          etaArrival,
        },
        origin: currentRoute.origin,
        destination: currentRoute.destination,
        waypoints: currentRoute.waypoints || [],
        segments,
      },
      suggestions: [
        "Route timing has been updated",
        ...this.enhanceSuggestions(plan.suggestions || [], request.preferences),
      ],
    };
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

