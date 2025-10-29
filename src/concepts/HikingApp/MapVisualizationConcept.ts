import { Db } from "npm:mongodb";
import { GeoPoint, BoundingBox, MapTileInfo } from "../../utils/mappingTypes.ts";
import { getMappingCollections, ensureMappingCollections } from "../../utils/database.ts";
import MapDataService from "../../services/MapDataService.ts";
import OSMService from "../../services/OSMService.ts";

/**
 * Map visualization concept for serving map tiles and visualization data
 * Provides endpoints for map rendering and route visualization
 */
export class MapVisualizationConcept {
  private mapDataService: MapDataService;
  private osmService: OSMService;
  private mapTiles: any;

  constructor(private db: Db) {
    this.mapDataService = new MapDataService(db);
    this.osmService = new OSMService();
    
    const collections = getMappingCollections(db);
    this.mapTiles = collections.mapTiles;
  }

  /**
   * Get map tile data
   */
  async getMapTile(
    z: number,
    x: number,
    y: number,
    style: string = "streets"
  ): Promise<MapTileInfo | null> {
    if (z < 0 || z > 18) {
      throw new Error("Invalid zoom level. Must be between 0 and 18.");
    }

    if (x < 0 || x >= Math.pow(2, z) || y < 0 || y >= Math.pow(2, z)) {
      throw new Error("Invalid tile coordinates for zoom level.");
    }

    return await this.mapDataService.getMapTile(z, x, y, style);
  }

  /**
   * Get map tiles for a bounding box
   */
  async getMapTilesForBounds(
    bounds: BoundingBox,
    zoom: number,
    style: string = "streets"
  ): Promise<MapTileInfo[]> {
    if (zoom < 0 || zoom > 18) {
      throw new Error("Invalid zoom level. Must be between 0 and 18.");
    }

    return await this.mapDataService.getMapTilesForBounds(bounds, zoom, style);
  }

  /**
   * Get map style configuration
   */
  getMapStyle(style: string = "streets"): any {
    return this.mapDataService.getMapStyle(style);
  }

  /**
   * Get available map styles
   */
  getAvailableStyles(): string[] {
    return this.mapDataService.getAvailableStyles();
  }

  /**
   * Calculate bounding box from center and radius
   */
  calculateBounds(center: GeoPoint, radiusKm: number): BoundingBox {
    return this.mapDataService.calculateBounds(center, radiusKm);
  }

  /**
   * Calculate optimal zoom level for bounds
   */
  calculateOptimalZoom(bounds: BoundingBox, maxTiles: number = 16): number {
    return this.mapDataService.calculateOptimalZoom(bounds, maxTiles);
  }

  /**
   * Get map configuration for client
   */
  getMapConfig(center: GeoPoint, zoom: number = 10): {
    center: GeoPoint;
    zoom: number;
    styles: string[];
    defaultStyle: string;
    bounds: BoundingBox;
  } {
    const bounds = this.calculateBounds(center, 5); // 5km radius
    const optimalZoom = this.calculateOptimalZoom(bounds);
    
    return {
      center,
      zoom: Math.max(zoom, optimalZoom),
      styles: this.getAvailableStyles(),
      defaultStyle: "streets",
      bounds
    };
  }

  /**
   * Get route visualization data
   */
  async getRouteVisualization(
    routeSegments: any[],
    options?: {
      includeWaypoints?: boolean;
      includeElevation?: boolean;
      style?: string;
    }
  ): Promise<{
    route: {
      type: "FeatureCollection";
      features: any[];
    };
    bounds: BoundingBox;
    style: string;
  }> {
    const features: any[] = [];
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    // Create route line feature
    const coordinates: [number, number][] = [];
    
    for (const segment of routeSegments) {
      if (segment.waypoints && segment.waypoints.length > 0) {
        for (const waypoint of segment.waypoints) {
          coordinates.push([waypoint.lon, waypoint.lat]);
          
          // Update bounds
          minLat = Math.min(minLat, waypoint.lat);
          maxLat = Math.max(maxLat, waypoint.lat);
          minLon = Math.min(minLon, waypoint.lon);
          maxLon = Math.max(maxLon, waypoint.lon);
        }
      } else {
        coordinates.push([segment.from.lon, segment.from.lat]);
        coordinates.push([segment.to.lon, segment.to.lat]);
        
        minLat = Math.min(minLat, segment.from.lat, segment.to.lat);
        maxLat = Math.max(maxLat, segment.from.lat, segment.to.lat);
        minLon = Math.min(minLon, segment.from.lon, segment.to.lon);
        maxLon = Math.max(maxLon, segment.from.lon, segment.to.lon);
      }
    }

    if (coordinates.length > 0) {
      features.push({
        type: "Feature",
        properties: {
          type: "route",
          distance: routeSegments.reduce((sum, seg) => sum + (seg.distance || 0), 0),
          duration: routeSegments.reduce((sum, seg) => sum + (seg.duration || 0), 0),
          segments: routeSegments.length
        },
        geometry: {
          type: "LineString",
          coordinates
        }
      });
    }

    // Add waypoint markers if requested
    if (options?.includeWaypoints) {
      for (let i = 0; i < routeSegments.length; i++) {
        const segment = routeSegments[i];
        
        // Start point
        features.push({
          type: "Feature",
          properties: {
            type: "waypoint",
            segmentIndex: i,
            pointType: "start",
            instruction: segment.instructions?.[0] || `Segment ${i + 1} start`
          },
          geometry: {
            type: "Point",
            coordinates: [segment.from.lon, segment.from.lat]
          }
        });

        // End point
        features.push({
          type: "Feature",
          properties: {
            type: "waypoint",
            segmentIndex: i,
            pointType: "end",
            instruction: segment.instructions?.[segment.instructions.length - 1] || `Segment ${i + 1} end`
          },
          geometry: {
            type: "Point",
            coordinates: [segment.to.lon, segment.to.lat]
          }
        });
      }
    }

    const bounds: BoundingBox = {
      north: maxLat,
      south: minLat,
      east: maxLon,
      west: minLon
    };

    return {
      route: {
        type: "FeatureCollection",
        features
      },
      bounds,
      style: options?.style || "streets"
    };
  }

  /**
   * Get POI visualization data
   */
  async getPOIVisualization(
    center: GeoPoint,
    radiusKm: number = 5,
    types: string[] = ['trail', 'trailhead', 'transit_stop']
  ): Promise<{
    pois: {
      type: "FeatureCollection";
      features: any[];
    };
    bounds: BoundingBox;
  }> {
    const pois = await this.osmService.searchPOIs(center, types, radiusKm);
    
    const features = pois.map(poi => ({
      type: "Feature",
      properties: {
        id: poi.id,
        name: poi.name,
        type: poi.type,
        description: poi.description,
        distance: poi.distance,
        tags: poi.tags
      },
      geometry: {
        type: "Point",
        coordinates: [poi.location.lon, poi.location.lat]
      }
    }));

    const bounds = this.calculateBounds(center, radiusKm);

    return {
      pois: {
        type: "FeatureCollection",
        features
      },
      bounds
    };
  }

  /**
   * Clean up expired map tiles
   */
  async cleanupExpiredTiles(): Promise<number> {
    return await this.mapDataService.cleanupExpiredTiles();
  }

  /**
   * Get map service statistics
   */
  async getMapStats(): Promise<{
    totalTiles: number;
    expiredTiles: number;
    memoryCacheSize: number;
    averageTileSize: number;
  }> {
    return await this.mapDataService.getCacheStats();
  }

  /**
   * Initialize mapping collections
   */
  async initialize(): Promise<void> {
    await ensureMappingCollections(this.db);
  }
}

export default MapVisualizationConcept;




