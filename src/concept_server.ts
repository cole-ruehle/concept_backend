import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";
import { getDb } from "@utils/database.ts";
import { walk } from "jsr:@std/fs";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { toFileUrl } from "jsr:@std/path/to-file-url";
import { startupTest } from "./scripts/startupTest.ts";

// Parse command-line arguments for port and base URL
const flags = parseArgs(Deno.args, {
  string: ["port", "baseUrl"],
  boolean: ["skip-tests"],
  default: {
    port: "8000",
    baseUrl: "",
    "skip-tests": false,
  },
});

const PORT = parseInt(flags.port, 10);
const BASE_URL = flags.baseUrl;
const SKIP_TESTS = flags["skip-tests"];
const CONCEPTS_DIR = "src/concepts";

/**
 * Main server function to initialize DB, load concepts, and start the server.
 */
async function main() {
  // Run startup tests unless explicitly skipped
  if (!SKIP_TESTS) {
    try {
      await startupTest();
    } catch (error) {
      console.error("⚠️  Startup test failed:", error.message);
      console.log("   Server will continue anyway...\n");
    }
  }
  
  const [db] = await getDb();
  const app = new Hono();

  // Add CORS middleware to allow frontend requests
  app.use("/*", cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:4200"], // Common frontend ports
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }));

  app.get("/", (c) => c.text("Concept Server is running."));

  // --- Custom RESTful Routes for Navigation ---
  // These routes provide a RESTful interface for the navigation API
  let hikingAppInstance: any = null;

  // --- Dynamic Concept Loading and Routing ---
  console.log(`Scanning for concepts in ./${CONCEPTS_DIR}...`);

  for await (
    const entry of walk(CONCEPTS_DIR, {
      maxDepth: 1,
      includeDirs: true,
      includeFiles: false,
    })
  ) {
    if (entry.path === CONCEPTS_DIR) continue; // Skip the root directory

    const conceptName = entry.name;
    const conceptFilePath = `${entry.path}/${conceptName}Concept.ts`;

    try {
      const modulePath = toFileUrl(Deno.realPathSync(conceptFilePath)).href;
      const module = await import(modulePath);
      const ConceptClass = module.default;

      if (
        typeof ConceptClass !== "function" ||
        !ConceptClass.name.endsWith("Concept")
      ) {
        console.warn(
          `! No valid concept class found in ${conceptFilePath}. Skipping.`,
        );
        continue;
      }

      const instance = new ConceptClass(db);
      // Convert concept name to match API specification naming convention
      // User -> user, Profile -> profile, UserHistory -> userHistory, LLMRoutePlanner -> llmRoutePlanner
      let conceptApiName = conceptName.charAt(0).toLowerCase() + conceptName.slice(1);
      // Handle acronyms at the start (e.g., LLMRoutePlanner -> llmRoutePlanner)
      if (conceptName.startsWith("LLM")) {
        conceptApiName = "llm" + conceptName.slice(3);
      }
      console.log(
        `- Registering concept: ${conceptName} at ${BASE_URL}/${conceptApiName}`,
      );

      // Save HikingApp instance for custom routes
      if (conceptName === "HikingApp") {
        hikingAppInstance = instance;
      }

      const methodNames = Object.getOwnPropertyNames(
        Object.getPrototypeOf(instance),
      )
        .filter((name) =>
          name !== "constructor" && typeof instance[name] === "function"
        );

      for (const methodName of methodNames) {
        const actionName = methodName;
        const route = `${BASE_URL}/${conceptApiName}/${actionName}`;

        app.post(route, async (c) => {
          try {
            const body = await c.req.json().catch(() => ({})); // Handle empty body
            const result = await instance[methodName](body);
            return c.json(result);
          } catch (e) {
            console.error(`Error in ${conceptName}.${methodName}:`, e);
            return c.json({ error: "An internal server error occurred." }, 500);
          }
        });
        console.log(`  - Endpoint: POST ${route}`);
      }
    } catch (e) {
      console.error(
        `! Error loading concept from ${conceptFilePath}:`,
        e,
      );
    }
  }

  // --- Register Custom RESTful Navigation Routes ---
  if (hikingAppInstance) {
    console.log(`\n- Registering custom navigation routes...`);
    
    // POST /HikingApp/navigation/start
    app.post(`${BASE_URL}/HikingApp/navigation/start`, async (c) => {
      try {
        const body = await c.req.json();
        const result = await hikingAppInstance.startNavigation(body);
        return c.json(result);
      } catch (e) {
        console.error("Error starting navigation:", e);
        return c.json({ error: e.message || "Failed to start navigation" }, 500);
      }
    });
    console.log(`  - Endpoint: POST ${BASE_URL}/HikingApp/navigation/start`);
    
    // POST /HikingApp/navigation/:routeId/status
    app.post(`${BASE_URL}/HikingApp/navigation/:routeId/status`, async (c) => {
      try {
        const routeId = c.req.param("routeId");
        const body = await c.req.json().catch(() => ({}));
        const result = await hikingAppInstance.getNavigationStatus({
          routeId,
          location: body.location
        });
        return c.json(result);
      } catch (e) {
        console.error("Error getting navigation status:", e);
        return c.json({ error: e.message || "Failed to get navigation status" }, 500);
      }
    });
    console.log(`  - Endpoint: POST ${BASE_URL}/HikingApp/navigation/:routeId/status`);
    
    // POST /HikingApp/navigation/:activeHikeId/update
    app.post(`${BASE_URL}/HikingApp/navigation/:activeHikeId/update`, async (c) => {
      try {
        const activeHikeId = c.req.param("activeHikeId");
        const body = await c.req.json();
        const result = await hikingAppInstance.updateNavigationLocation({
          activeHikeId,
          location: body.location
        });
        return c.json(result);
      } catch (e) {
        console.error("Error updating navigation location:", e);
        return c.json({ error: e.message || "Failed to update location" }, 500);
      }
    });
    console.log(`  - Endpoint: POST ${BASE_URL}/HikingApp/navigation/:activeHikeId/update`);
    
    // POST /HikingApp/navigation/:activeHikeId/end
    app.post(`${BASE_URL}/HikingApp/navigation/:activeHikeId/end`, async (c) => {
      try {
        const activeHikeId = c.req.param("activeHikeId");
        const body = await c.req.json();
        const result = await hikingAppInstance.endNavigation({
          activeHikeId,
          exitPointId: body.exitPointId,
          location: body.location
        });
        return c.json(result);
      } catch (e) {
        console.error("Error ending navigation:", e);
        return c.json({ error: e.message || "Failed to end navigation" }, 500);
      }
    });
    console.log(`  - Endpoint: POST ${BASE_URL}/HikingApp/navigation/:activeHikeId/end`);
    
    // GET /HikingApp/status/updates
    app.get(`${BASE_URL}/HikingApp/status/updates`, async (c) => {
      try {
        const userId = c.req.query("userId");
        const activeHikeId = c.req.query("activeHikeId");
        const result = await hikingAppInstance.getStatusUpdates({
          userId,
          activeHikeId
        });
        return c.json(result);
      } catch (e) {
        console.error("Error getting status updates:", e);
        return c.json({ error: e.message || "Failed to get status updates" }, 500);
      }
    });
    console.log(`  - Endpoint: GET ${BASE_URL}/HikingApp/status/updates`);
  }

  console.log(`\nServer listening on http://localhost:${PORT}`);
  Deno.serve({ port: PORT }, app.fetch);
}

// Run the server
main();
