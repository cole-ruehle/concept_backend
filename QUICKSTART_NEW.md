# ⚡ Quick Start - New Orchestrate Server

Get your LLM-powered hiking route planner running in 3 minutes!

## 1️⃣ Set Your API Keys

Create a `.env` file (it's gitignored, so it won't be committed):

```bash
# Copy the template
cp env.template .env

# Then edit .env with your actual keys
nano .env  # or use your favorite editor
```

Your `.env` should look like:
```bash
GEMINI_API_KEY=your_actual_gemini_key
GOOGLE_MAPS_API_KEY=your_actual_google_maps_key
```

**Where to get keys:**
- Gemini: https://makersuite.google.com/app/apikey
- Google Maps: https://console.cloud.google.com/google/maps-apis
  - Enable: Places API, Directions API, Geocoding API

## 2️⃣ Start the Server

```bash
deno task start
```

You should see:
```
🌟 Orchestrate Server Starting...
   Port: 8000
   Gemini: ✓
   Google Maps: ✓
   MongoDB: ✓

📍 Main endpoint: POST /api/plan-route
```

## 3️⃣ Test It!

### Option A: Run Automated Tests
```bash
# In a new terminal
deno task test
```

### Option B: Manual Test
```bash
curl -X POST http://localhost:8000/api/plan-route \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Find me hiking trails accessible by public transit",
    "userLocation": {
      "lat": 42.3601,
      "lng": -71.0589
    },
    "preferences": {
      "duration": 3,
      "transportModes": ["transit", "walking"]
    }
  }'
```

## 🎉 That's It!

Your backend is now running and ready to plan intelligent hiking routes!

## 📖 Next Steps

- **Full documentation**: See `ORCHESTRATE_SETUP.md`
- **Migration details**: See `MIGRATION_SUMMARY.md`
- **View logs**: `curl http://localhost:8000/api/logs?limit=5`
- **Health check**: `curl http://localhost:8000/api/health`

## 🔧 Development Mode

For auto-reload during development:
```bash
deno task dev
```

## 📱 Frontend Integration

Your frontend should POST to:
```
http://localhost:8000/api/plan-route
```

With this payload:
```typescript
{
  query: string;              // Natural language query
  userLocation: {
    lat: number;
    lng: number;
  };
  preferences?: {
    duration?: number;        // Hours
    difficulty?: string;      // "easy" | "moderate" | "hard"
    transportModes?: string[]; // ["transit", "walking", "bicycling"]
  };
}
```

## 🆘 Troubleshooting

**Server won't start?**
- Check API keys are set: `echo $GEMINI_API_KEY`
- Check MongoDB is running: `mongosh`

**No routes returned?**
- Check Gemini API quota
- Check Google Maps APIs are enabled
- View logs: `curl http://localhost:8000/api/logs`

**Need help?**
- See full docs in `ORCHESTRATE_SETUP.md`
- Check the test script: `src/scripts/testOrchestrate.ts`

