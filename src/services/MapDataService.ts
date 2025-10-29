import { Db } from "npm:mongodb";
import { GeoPoint, BoundingBox, MapTileInfo, MapTileDoc } from "../utils/mappingTypes.ts";
import { getMappingCollections } from "../utils/database.ts";

/**
 * Map data service for handling map tiles and visualization data
 * Integrates with MapTiler (free tier) and provides caching
 */
export class MapDataService {
  private readonly MAPTILER_API_URL = "https://api.maptiler.com/maps";
  private readonly MAPTILER_TILES_URL = "https://api.maptiler.com/tiles";
  private readonly OPENSTREETMAP_TILES_URL = "https://tile.openstreetmap.org";
  
  private mapTiles: any;
  private cache = new Map<string, { data: any; expires: number }>();

  constructor(private db: Db) {
    const collections = getMappingCollections(db);
    this.mapTiles = collections.mapTiles;
  }

  /**
   * Get map tile data (cached)
   */
  async getMapTile(
    z: number, 
    x: number, 
    y: number, 
    style: string = "streets"
  ): Promise<MapTileInfo | null> {
    // Check cache first
    const cacheKey = `tile:${z}:${x}:${y}:${style}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // Check database cache
    const dbCached = await this.mapTiles.findOne({ z, x, y, style });
    if (dbCached && dbCached.expires_at > new Date()) {
      const tileInfo: MapTileInfo = {
        z: dbCached.z,
        x: dbCached.x,
        y: dbCached.y,
        data: dbCached.data,
        format: dbCached.format,
        cached_at: dbCached.cached_at.toISOString(),
        expires_at: dbCached.expires_at.toISOString()
      };
      
      // Update memory cache
      this.cache.set(cacheKey, {
        data: tileInfo,
        expires: dbCached.expires_at.getTime()
      });
      
      return tileInfo;
    }

    // Fetch from external service
    try {
      const tileData = await this.fetchMapTile(z, x, y, style);
      
      const tileInfo: MapTileInfo = {
        z,
        x,
        y,
        data: tileData.data,
        format: tileData.format,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      // Store in database
      const tileDoc: Omit<MapTileDoc, '_id'> = {
        z,
        x,
        y,
        data: tileData.data,
        format: tileData.format,
        cached_at: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      await this.mapTiles.replaceOne(
        { z, x, y, style },
        { ...tileDoc, style },
        { upsert: true }
      );

      // Update memory cache
      this.cache.set(cacheKey, {
        data: tileInfo,
        expires: tileDoc.expires_at.getTime()
      });

      return tileInfo;
    } catch (error) {
      console.error(`Failed to fetch map tile ${z}/${x}/${y}:`, error);
      return null;
    }
  }

  /**
   * Get multiple map tiles for a bounding box
   */
  async getMapTilesForBounds(
    bounds: BoundingBox,
    zoom: number,
    style: string = "streets"
  ): Promise<MapTileInfo[]> {
    const tiles = this.calculateTilesForBounds(bounds, zoom);
    const tilePromises = tiles.map(tile => 
      this.getMapTile(tile.z, tile.x, tile.y, style)
    );
    
    const results = await Promise.all(tilePromises);
    return results.filter(tile => tile !== null) as MapTileInfo[];
  }

  /**
   * Get map style configuration
   */
  getMapStyle(style: string = "streets"): any {
    const styles = {
      streets: {
        version: 8,
        name: "Streets",
        sources: {
          "maptiler": {
            type: "raster",
            tiles: [`${this.MAPTILER_TILES_URL}/streets/{z}/{x}/{y}.png?key=${this.getMapTilerKey()}`],
            tileSize: 256
          }
        },
        layers: [
          {
            id: "background",
            type: "raster",
            source: "maptiler"
          }
        ]
      },
      satellite: {
        version: 8,
        name: "Satellite",
        sources: {
          "maptiler": {
            type: "raster",
            tiles: [`${this.MAPTILER_TILES_URL}/satellite/{z}/{x}/{y}.jpg?key=${this.getMapTilerKey()}`],
            tileSize: 256
          }
        },
        layers: [
          {
            id: "background",
            type: "raster",
            source: "maptiler"
          }
        ]
      },
      terrain: {
        version: 8,
        name: "Terrain",
        sources: {
          "maptiler": {
            type: "raster",
            tiles: [`${this.MAPTILER_TILES_URL}/terrain/{z}/{x}/{y}.png?key=${this.getMapTilerKey()}`],
            tileSize: 256
          }
        },
        layers: [
          {
            id: "background",
            type: "raster",
            source: "maptiler"
          }
        ]
      },
      openstreetmap: {
        version: 8,
        name: "OpenStreetMap",
        sources: {
          "osm": {
            type: "raster",
            tiles: [`${this.OPENSTREETMAP_TILES_URL}/{z}/{x}/{y}.png`],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors"
          }
        },
        layers: [
          {
            id: "background",
            type: "raster",
            source: "osm"
          }
        ]
      }
    };

    return styles[style as keyof typeof styles] || styles.streets;
  }

  /**
   * Get available map styles
   */
  getAvailableStyles(): string[] {
    return ["streets", "satellite", "terrain", "openstreetmap"];
  }

  /**
   * Calculate bounding box from center point and radius
   */
  calculateBounds(center: GeoPoint, radiusKm: number): BoundingBox {
    const latDelta = radiusKm / 111; // Approximate degrees per km
    const lonDelta = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));

    return {
      north: center.lat + latDelta,
      south: center.lat - latDelta,
      east: center.lon + lonDelta,
      west: center.lon - lonDelta
    };
  }

  /**
   * Calculate optimal zoom level for bounding box
   */
  calculateOptimalZoom(bounds: BoundingBox, maxTiles: number = 16): number {
    const latDiff = bounds.north - bounds.south;
    const lonDiff = bounds.east - bounds.west;
    const maxDiff = Math.max(latDiff, lonDiff);
    
    // Calculate zoom level based on the larger dimension
    let zoom = Math.floor(Math.log2(360 / maxDiff));
    
    // Ensure we don't exceed max tiles
    const tilesAtZoom = Math.pow(2, zoom) * Math.pow(2, zoom);
    if (tilesAtZoom > maxTiles) {
      zoom = Math.floor(Math.log2(Math.sqrt(maxTiles)));
    }
    
    return Math.max(0, Math.min(18, zoom));
  }

  /**
   * Clean up expired tiles
   */
  async cleanupExpiredTiles(): Promise<number> {
    const result = await this.mapTiles.deleteMany({
      expires_at: { $lt: new Date() }
    });
    
    return result.deletedCount || 0;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalTiles: number;
    expiredTiles: number;
    memoryCacheSize: number;
    averageTileSize: number;
  }> {
    const totalTiles = await this.mapTiles.countDocuments();
    const expiredTiles = await this.mapTiles.countDocuments({
      expires_at: { $lt: new Date() }
    });
    
    const memoryCacheSize = this.cache.size;
    
    // Calculate average tile size
    const sampleTiles = await this.mapTiles.find({}).limit(100).toArray();
    const averageTileSize = sampleTiles.length > 0 
      ? sampleTiles.reduce((sum, tile) => sum + tile.data.length, 0) / sampleTiles.length
      : 0;

    return {
      totalTiles,
      expiredTiles,
      memoryCacheSize,
      averageTileSize: Math.round(averageTileSize)
    };
  }

  // Private helper methods

  private async fetchMapTile(
    z: number, 
    x: number, 
    y: number, 
    style: string
  ): Promise<{ data: Uint8Array; format: string }> {
    let url: string;
    let format: string;

    if (style === "openstreetmap") {
      url = `${this.OPENSTREETMAP_TILES_URL}/${z}/${x}/${y}.png`;
      format = "png";
    } else {
      const mapTilerKey = this.getMapTilerKey();
      if (!mapTilerKey) {
        throw new Error("MapTiler API key not configured");
      }
      
      url = `${this.MAPTILER_TILES_URL}/${style}/${z}/${x}/${y}.${style === 'satellite' ? 'jpg' : 'png'}?key=${mapTilerKey}`;
      format = style === 'satellite' ? 'jpg' : 'png';
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TrailLink-HikingApp/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tile: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      data: new Uint8Array(arrayBuffer),
      format
    };
  }

  private calculateTilesForBounds(bounds: BoundingBox, zoom: number): Array<{z: number, x: number, y: number}> {
    const tiles: Array<{z: number, x: number, y: number}> = [];
    
    const minX = this.lonToTileX(bounds.west, zoom);
    const maxX = this.lonToTileX(bounds.east, zoom);
    const minY = this.latToTileY(bounds.north, zoom);
    const maxY = this.latToTileY(bounds.south, zoom);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ z: zoom, x, y });
      }
    }
    
    return tiles;
  }

  private lonToTileX(lon: number, zoom: number): number {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  }

  private latToTileY(lat: number, zoom: number): number {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  }

  private getMapTilerKey(): string | null {
    return Deno.env.get("MAPTILER_API_KEY") || null;
  }
}

export default MapDataService;




