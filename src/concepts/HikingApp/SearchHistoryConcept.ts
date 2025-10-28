import { Db, Collection, ObjectId } from "npm:mongodb";

export interface SearchHistoryEntry {
  _id?: ObjectId;
  userId?: string;
  sessionId?: string;
  origin: {
    lat: number;
    lon: number;
    address?: string;
    name?: string;
  };
  destination: {
    lat: number;
    lon: number;
    address?: string;
    name?: string;
  };
  mode: string;
  searchedAt: Date;
  resultCount: number;
  routeId?: string;
  tags?: string[];
}

export interface SearchStats {
  totalSearches: number;
  popularDestinations: Array<{
    location: { lat: number; lon: number; name: string };
    count: number;
  }>;
  popularModes: Array<{
    mode: string;
    count: number;
  }>;
  recentSearches: SearchHistoryEntry[];
}

export class SearchHistoryConcept {
  private searchHistory: Collection<SearchHistoryEntry>;

  constructor(private db: Db) {
    this.searchHistory = db.collection("search_history");
    this.ensureIndexes();
  }

  /**
   * Save a search to history
   */
  async saveSearch(entry: Omit<SearchHistoryEntry, "_id" | "searchedAt">): Promise<string> {
    const searchEntry: Omit<SearchHistoryEntry, "_id"> = {
      ...entry,
      searchedAt: new Date()
    };

    const result = await this.searchHistory.insertOne(searchEntry as SearchHistoryEntry);
    return result.insertedId.toHexString();
  }

  /**
   * Get recent searches for a user or session
   */
  async getRecentSearches(
    userId?: string, 
    sessionId?: string, 
    limit: number = 10
  ): Promise<SearchHistoryEntry[]> {
    const query: any = {};
    
    if (userId) {
      query.userId = userId;
    } else if (sessionId) {
      query.sessionId = sessionId;
    }

    const searches = await this.searchHistory
      .find(query)
      .sort({ searchedAt: -1 })
      .limit(limit)
      .toArray();

    return searches;
  }

  /**
   * Get search statistics
   */
  async getSearchStats(userId?: string, days: number = 30): Promise<SearchStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query: any = { searchedAt: { $gte: startDate } };
    if (userId) {
      query.userId = userId;
    }

    const searches = await this.searchHistory.find(query).toArray();

    // Calculate popular destinations
    const destinationCounts = new Map<string, { location: any; count: number }>();
    searches.forEach(search => {
      const key = `${search.destination.lat},${search.destination.lon}`;
      const existing = destinationCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        destinationCounts.set(key, {
          location: {
            lat: search.destination.lat,
            lon: search.destination.lon,
            name: search.destination.name || search.destination.address || "Unknown"
          },
          count: 1
        });
      }
    });

    // Calculate popular modes
    const modeCounts = new Map<string, number>();
    searches.forEach(search => {
      const count = modeCounts.get(search.mode) || 0;
      modeCounts.set(search.mode, count + 1);
    });

    return {
      totalSearches: searches.length,
      popularDestinations: Array.from(destinationCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      popularModes: Array.from(modeCounts.entries())
        .map(([mode, count]) => ({ mode, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      recentSearches: searches.slice(0, 10)
    };
  }

  /**
   * Clear search history for a user or session
   */
  async clearHistory(userId?: string, sessionId?: string): Promise<number> {
    const query: any = {};
    
    if (userId) {
      query.userId = userId;
    } else if (sessionId) {
      query.sessionId = sessionId;
    } else {
      throw new Error("Either userId or sessionId must be provided");
    }

    const result = await this.searchHistory.deleteMany(query);
    return result.deletedCount;
  }

  /**
   * Delete a specific search entry
   */
  async deleteSearch(searchId: string): Promise<boolean> {
    const result = await this.searchHistory.deleteOne({ _id: new ObjectId(searchId) });
    return result.deletedCount > 0;
  }

  /**
   * Search history by location or mode
   */
  async searchHistory(
    query: string,
    userId?: string,
    limit: number = 20
  ): Promise<SearchHistoryEntry[]> {
    const searchQuery: any = {
      $or: [
        { "origin.name": { $regex: query, $options: "i" } },
        { "origin.address": { $regex: query, $options: "i" } },
        { "destination.name": { $regex: query, $options: "i" } },
        { "destination.address": { $regex: query, $options: "i" } },
        { mode: { $regex: query, $options: "i" } },
        { tags: { $in: [new RegExp(query, "i")] } }
      ]
    };

    if (userId) {
      searchQuery.userId = userId;
    }

    const searches = await this.searchHistory
      .find(searchQuery)
      .sort({ searchedAt: -1 })
      .limit(limit)
      .toArray();

    return searches;
  }

  /**
   * Get search suggestions based on history
   */
  async getSearchSuggestions(
    partialQuery: string,
    userId?: string,
    limit: number = 5
  ): Promise<Array<{
    text: string;
    type: "origin" | "destination" | "mode";
    location?: { lat: number; lon: number };
  }>> {
    // Validate input
    if (!partialQuery || typeof partialQuery !== 'string') {
      return [];
    }

    const suggestions: Array<{
      text: string;
      type: "origin" | "destination" | "mode";
      location?: { lat: number; lon: number };
    }> = [];

    // Search in recent searches
    const recentSearches = await this.getRecentSearches(userId, undefined, 50);
    
    // Add origin suggestions
    recentSearches.forEach(search => {
      if (search.origin.name && search.origin.name.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.push({
          text: search.origin.name,
          type: "origin",
          location: { lat: search.origin.lat, lon: search.origin.lon }
        });
      }
      if (search.origin.address && search.origin.address.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.push({
          text: search.origin.address,
          type: "origin",
          location: { lat: search.origin.lat, lon: search.origin.lon }
        });
      }
    });

    // Add destination suggestions
    recentSearches.forEach(search => {
      if (search.destination.name && search.destination.name.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.push({
          text: search.destination.name,
          type: "destination",
          location: { lat: search.destination.lat, lon: search.destination.lon }
        });
      }
      if (search.destination.address && search.destination.address.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.push({
          text: search.destination.address,
          type: "destination",
          location: { lat: search.destination.lat, lon: search.destination.lon }
        });
      }
    });

    // Add mode suggestions
    const modes = ["hiking", "transit", "driving", "walking", "cycling", "multimodal"];
    modes.forEach(mode => {
      if (mode.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.push({
          text: mode,
          type: "mode"
        });
      }
    });

    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.text === suggestion.text && s.type === suggestion.type)
    );

    return uniqueSuggestions.slice(0, limit);
  }

  private async ensureIndexes(): Promise<void> {
    try {
      await this.searchHistory.createIndexes([
        { key: { userId: 1, searchedAt: -1 }, name: "userId_searchedAt" },
        { key: { sessionId: 1, searchedAt: -1 }, name: "sessionId_searchedAt" },
        { key: { searchedAt: -1 }, name: "searchedAt" },
        { key: { "origin.lat": 1, "origin.lon": 1 }, name: "origin_location" },
        { key: { "destination.lat": 1, "destination.lon": 1 }, name: "destination_location" },
        { key: { mode: 1 }, name: "mode" },
        { key: { tags: 1 }, name: "tags" }
      ]);
    } catch (error) {
      console.warn("Could not create search history indexes:", error);
    }
  }
}

export default SearchHistoryConcept;

