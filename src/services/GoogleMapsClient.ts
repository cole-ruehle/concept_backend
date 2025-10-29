/**
 * Google Maps API Client
 * Provides unified access to Places, Directions, and Geocoding APIs
 */

export interface Location {
  lat: number;
  lng: number;
}

export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  location: Location;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  opening_hours?: {
    open_now?: boolean;
  };
}

export interface DirectionsLeg {
  start_location: Location;
  end_location: Location;
  start_address: string;
  end_address: string;
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  steps: DirectionsStep[];
}

export interface DirectionsStep {
  html_instructions: string;
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  travel_mode: string;
  start_location: Location;
  end_location: Location;
  polyline?: {
    points: string;
  };
}

export interface DirectionsRoute {
  summary: string;
  legs: DirectionsLeg[];
  overview_polyline: {
    points: string;
  };
  bounds: {
    northeast: Location;
    southwest: Location;
  };
  warnings?: string[];
}

export interface DirectionsResult {
  routes: DirectionsRoute[];
  status: string;
}

export class GoogleMapsClient {
  private apiKey: string;
  private baseUrl = "https://maps.googleapis.com/maps/api";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Geocode an address to coordinates
   */
  async geocode(address: string): Promise<Location | null> {
    const url = new URL(`${this.baseUrl}/geocode/json`);
    url.searchParams.set("address", address);
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].geometry.location;
    }

    return null;
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(location: Location): Promise<string | null> {
    const url = new URL(`${this.baseUrl}/geocode/json`);
    url.searchParams.set("latlng", `${location.lat},${location.lng}`);
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].formatted_address;
    }

    return null;
  }

  /**
   * Search for places using text query
   */
  async textSearch(query: string, location?: Location, radius?: number): Promise<PlaceResult[]> {
    const url = new URL(`${this.baseUrl}/place/textsearch/json`);
    url.searchParams.set("query", query);
    url.searchParams.set("key", this.apiKey);

    if (location) {
      url.searchParams.set("location", `${location.lat},${location.lng}`);
    }
    if (radius) {
      url.searchParams.set("radius", radius.toString());
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      return (data.results || []).map((result: any) => ({
        place_id: result.place_id,
        name: result.name,
        formatted_address: result.formatted_address,
        location: result.geometry.location,
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        types: result.types,
        opening_hours: result.opening_hours,
      }));
    }

    throw new Error(`Places API error: ${data.status}`);
  }

  /**
   * Search for nearby places
   */
  async nearbySearch(
    location: Location,
    radius: number,
    type?: string,
    keyword?: string
  ): Promise<PlaceResult[]> {
    const url = new URL(`${this.baseUrl}/place/nearbysearch/json`);
    url.searchParams.set("location", `${location.lat},${location.lng}`);
    url.searchParams.set("radius", radius.toString());
    url.searchParams.set("key", this.apiKey);

    if (type) {
      url.searchParams.set("type", type);
    }
    if (keyword) {
      url.searchParams.set("keyword", keyword);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      return (data.results || []).map((result: any) => ({
        place_id: result.place_id,
        name: result.name,
        formatted_address: result.vicinity,
        location: result.geometry.location,
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        types: result.types,
        opening_hours: result.opening_hours,
      }));
    }

    throw new Error(`Nearby search error: ${data.status}`);
  }

  /**
   * Get place details by place_id
   */
  async placeDetails(placeId: string): Promise<PlaceResult | null> {
    const url = new URL(`${this.baseUrl}/place/details/json`);
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK") {
      const result = data.result;
      return {
        place_id: result.place_id,
        name: result.name,
        formatted_address: result.formatted_address,
        location: result.geometry.location,
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        types: result.types,
        opening_hours: result.opening_hours,
      };
    }

    return null;
  }

  /**
   * Get directions between points
   */
  async directions(
    origin: Location | string,
    destination: Location | string,
    options?: {
      mode?: "driving" | "walking" | "bicycling" | "transit";
      waypoints?: (Location | string)[];
      avoid?: ("tolls" | "highways" | "ferries")[];
      transit_mode?: ("bus" | "subway" | "train" | "tram" | "rail")[];
      departure_time?: number; // Unix timestamp
      arrival_time?: number; // Unix timestamp
      alternatives?: boolean;
    }
  ): Promise<DirectionsResult> {
    const url = new URL(`${this.baseUrl}/directions/json`);

    // Format origin/destination
    const formatLocation = (loc: Location | string) =>
      typeof loc === "string" ? loc : `${loc.lat},${loc.lng}`;

    url.searchParams.set("origin", formatLocation(origin));
    url.searchParams.set("destination", formatLocation(destination));
    url.searchParams.set("key", this.apiKey);

    if (options?.mode) {
      url.searchParams.set("mode", options.mode);
    }

    if (options?.waypoints && options.waypoints.length > 0) {
      const waypoints = options.waypoints.map(formatLocation).join("|");
      url.searchParams.set("waypoints", waypoints);
    }

    if (options?.avoid && options.avoid.length > 0) {
      url.searchParams.set("avoid", options.avoid.join("|"));
    }

    if (options?.transit_mode && options.transit_mode.length > 0) {
      url.searchParams.set("transit_mode", options.transit_mode.join("|"));
    }

    if (options?.departure_time) {
      url.searchParams.set("departure_time", options.departure_time.toString());
    }

    if (options?.arrival_time) {
      url.searchParams.set("arrival_time", options.arrival_time.toString());
    }

    if (options?.alternatives) {
      url.searchParams.set("alternatives", "true");
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    return {
      routes: data.routes || [],
      status: data.status,
    };
  }

  /**
   * Calculate distance matrix between multiple origins and destinations
   */
  async distanceMatrix(
    origins: (Location | string)[],
    destinations: (Location | string)[],
    mode?: "driving" | "walking" | "bicycling" | "transit"
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}/distancematrix/json`);

    const formatLocation = (loc: Location | string) =>
      typeof loc === "string" ? loc : `${loc.lat},${loc.lng}`;

    const originsStr = origins.map(formatLocation).join("|");
    const destinationsStr = destinations.map(formatLocation).join("|");

    url.searchParams.set("origins", originsStr);
    url.searchParams.set("destinations", destinationsStr);
    url.searchParams.set("key", this.apiKey);

    if (mode) {
      url.searchParams.set("mode", mode);
    }

    const response = await fetch(url.toString());
    return await response.json();
  }
}

