/**
 * Orchestrate Server - Simple LLM-powered route planning
 */

import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";
import { load } from "jsr:@std/dotenv";
import { getDb } from "@utils/database.ts";
import { RoutePlannerOrchestrator } from "./services/RoutePlannerOrchestrator.ts";

// Load environment variables from .env file
await load({ export: true });

// Environment variables
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
const PORT = parseInt(Deno.env.get("PORT") || "8000", 10);

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY environment variable is required");
  Deno.exit(1);
}

if (!GOOGLE_MAPS_API_KEY) {
  console.error("❌ GOOGLE_MAPS_API_KEY environment variable is required");
  Deno.exit(1);
}

// Initialize services
const orchestrator = new RoutePlannerOrchestrator(GEMINI_API_KEY, GOOGLE_MAPS_API_KEY);

async function main() {
  const [db] = await getDb();
  const app = new Hono();

  // Request logging collection
  const requestLogs = db.collection("request_logs");

  // CORS middleware
  app.use("/*", cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:4200"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }));

  // Health check
  app.get("/", (c) => c.json({ 
    status: "ok", 
    message: "Hiking Route Planner API",
    version: "2.0.0"
  }));

  app.get("/api/health", (c) => c.json({ status: "healthy" }));

  // Main route planning endpoint
  app.post("/api/plan-route", async (c) => {
    const startTime = Date.now();
    let requestBody: any = {};
    let response: any = null;
    let error: any = null;

    try {
      requestBody = await c.req.json();
      
      // Validate request
      if (!requestBody.query || !requestBody.userLocation) {
        return c.json({
          error: "Missing required fields: query and userLocation are required"
        }, 400);
      }

      if (!requestBody.userLocation.lat || !requestBody.userLocation.lng) {
        return c.json({
          error: "Invalid userLocation: lat and lng are required"
        }, 400);
      }

      console.log(`\n🚀 New route planning request:`);
      console.log(`   Query: ${requestBody.query}`);
      console.log(`   Location: ${requestBody.userLocation.lat}, ${requestBody.userLocation.lng}`);

      // Plan the route
      response = await orchestrator.planRoute({
        query: requestBody.query,
        userLocation: requestBody.userLocation,
        preferences: requestBody.preferences || {},
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Route planned successfully in ${duration}ms`);
      console.log(`   Route: ${response.route.name}`);
      console.log(`   Total time: ${response.route.metrics.totalMin} minutes`);
      console.log(`   Segments: ${response.route.segments.length}`);

      // Log to database (don't await, fire and forget)
      requestLogs.insertOne({
        timestamp: new Date(),
        duration_ms: duration,
        request: {
          query: requestBody.query,
          userLocation: requestBody.userLocation,
          preferences: requestBody.preferences,
        },
        response: {
          route_id: response.route.route_id,
          name: response.route.name,
          total_minutes: response.route.metrics.totalMin,
          segments_count: response.route.segments.length,
        },
        success: true,
      }).catch((err) => console.error("Failed to log request:", err));

      return c.json(response);

    } catch (err) {
      error = err;
      const duration = Date.now() - startTime;
      
      console.error(`❌ Route planning failed in ${duration}ms:`, err);

      // Log error to database
      requestLogs.insertOne({
        timestamp: new Date(),
        duration_ms: duration,
        request: requestBody,
        error: {
          message: err.message || "Unknown error",
          stack: err.stack,
        },
        success: false,
      }).catch((logErr) => console.error("Failed to log error:", logErr));

      return c.json({
        error: err.message || "Failed to plan route",
      }, 500);
    }
  });

  // Legacy endpoint - redirect to new API
  app.post("/api/orchestrate", async (c) => {
    console.log("⚠️  /api/orchestrate is deprecated, use /api/plan-route instead");
    
    try {
      const body = await c.req.json();
      
      // Try to map old format to new format
      const newRequest = {
        query: body.action || body.query || "Plan a hiking route",
        userLocation: body.state?.user_location || body.userLocation,
        preferences: body.state?.prefs || body.preferences,
      };

      if (!newRequest.userLocation) {
        return c.json({
          error: "Missing userLocation in request"
        }, 400);
      }

      const response = await orchestrator.planRoute(newRequest);
      return c.json(response);

    } catch (err) {
      console.error("Orchestrate error:", err);
      return c.json({
        error: err.message || "Failed to orchestrate route"
      }, 500);
    }
  });

  // Get recent request logs (for debugging)
  app.get("/api/logs", async (c) => {
    try {
      const limit = parseInt(c.req.query("limit") || "10", 10);
      const logs = await requestLogs
        .find({})
        .sort({ timestamp: -1 })
        .limit(Math.min(limit, 100))
        .toArray();

      return c.json({ logs });
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      return c.json({ error: "Failed to fetch logs" }, 500);
    }
  });

  console.log(`\n🌟 Orchestrate Server Starting...`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Gemini: ✓`);
  console.log(`   Google Maps: ✓`);
  console.log(`   MongoDB: ✓`);
  console.log(`\n📍 Main endpoint: POST /api/plan-route`);
  console.log(`   Health check: GET /api/health`);
  console.log(`   Request logs: GET /api/logs\n`);

  Deno.serve({ port: PORT }, app.fetch);
}

// Run the server
main();

