// Mapping and OSM-related type definitions

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface OSMNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OSMWay {
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

export interface OSMRelation {
  id: number;
  members: Array<{
    type: 'node' | 'way' | 'relation';
    ref: number;
    role: string;
  }>;
  tags?: Record<string, string>;
}

export interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: Array<{
    type: 'node' | 'way' | 'relation';
    ref: number;
    role: string;
  }>;
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: OSMElement[];
}

export interface TrailInfo {
  id: string;
  name: string;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  surface: string;
  length: number; // in meters
  elevation_gain: number; // in meters
  coordinates: GeoPoint[];
  tags: Record<string, string>;
  condition: 'open' | 'closed' | 'maintenance';
  last_updated: string;
}

export interface TrailheadInfo {
  id: string;
  name: string;
  location: GeoPoint;
  parking: boolean;
  facilities: string[];
  accessibility: string[];
  transit_stops: string[];
  trails: string[];
  tags: Record<string, string>;
}

export interface TransitStopInfo {
  id: string;
  name: string;
  location: GeoPoint;
  routes: string[];
  wheelchair_accessible: boolean;
  shelter: boolean;
  real_time_info: boolean;
  tags: Record<string, string>;
}

export interface POIInfo {
  id: string;
  name: string;
  type: 'trail' | 'trailhead' | 'transit_stop' | 'parking' | 'restroom' | 'water' | 'shelter';
  location: GeoPoint;
  description?: string;
  tags: Record<string, string>;
  distance?: number; // in meters from search point
}

export interface RouteSegment {
  from: GeoPoint;
  to: GeoPoint;
  distance: number; // in meters
  duration: number; // in seconds
  instructions: string[];
  surface: string;
  difficulty: string;
  elevation_gain: number;
  waypoints: GeoPoint[];
}

export interface MapTileInfo {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
  format: 'png' | 'jpg' | 'webp';
  cached_at: string;
  expires_at: string;
}

export interface GeocodingResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export interface ReverseGeocodingResult {
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  lat: string;
  lon: string;
}

export interface OverpassQuery {
  query: string;
  bbox?: BoundingBox;
  timeout?: number;
  maxsize?: number;
}

export interface CachedData<T> {
  data: T;
  cached_at: string;
  expires_at: string;
  source: string;
  query_hash: string;
}

// Database document types
export interface MapTileDoc {
  _id: string;
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
  format: string;
  cached_at: Date;
  expires_at: Date;
}

export interface POICacheDoc {
  _id: string;
  query_hash: string;
  data: POIInfo[];
  cached_at: Date;
  expires_at: Date;
  bbox: BoundingBox;
}

export interface TrailCacheDoc {
  _id: string;
  trail_id: string;
  data: TrailInfo;
  cached_at: Date;
  expires_at: Date;
  bbox: BoundingBox;
}

export interface GeocodingCacheDoc {
  _id: string;
  query_hash: string;
  data: GeocodingResult[] | ReverseGeocodingResult[];
  cached_at: Date;
  expires_at: Date;
  query_type: 'geocoding' | 'reverse_geocoding';
}

export interface RouteCacheDoc {
  _id: string;
  route_hash: string;
  data: RouteSegment[];
  cached_at: Date;
  expires_at: Date;
  origin: GeoPoint;
  destination: GeoPoint;
  mode: string;
}


