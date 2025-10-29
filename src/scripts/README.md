# Scripts Directory

This directory contains utility scripts for testing, data generation, and system validation.

## 🚀 Quick Start

### Run All Tests
```bash
deno run --allow-all src/scripts/testAllEndpoints.ts
```

### Start Server with Tests
```bash
deno run --allow-all src/concept_server.ts
```

### Skip Startup Tests
```bash
deno run --allow-all src/concept_server.ts --skip-tests
```

---

## 📋 Available Scripts

### 🧪 **Core Test Scripts**

#### `testAllEndpoints.ts` ⭐ **NEW**
**Comprehensive endpoint test suite** - Tests ALL endpoints at least once

**What it tests:**
- ✅ Search locations
- ✅ Get nearby locations (with validation)
- ✅ Calculate routes
- ✅ Alternative routes
- ✅ Recent searches
- ✅ Search suggestions
- ✅ Search stats
- ✅ Reverse geocoding
- ✅ Clear search history
- ✅ Batch search tests

**Output:**
- Detailed pass/fail for each endpoint
- Performance metrics
- Success rate percentage
- Failed test summary

**Run it:**
```bash
deno run --allow-all src/scripts/testAllEndpoints.ts
```

#### `startupTest.ts` ⭐ **NEW**
**Startup validation** - Runs automatically when server starts

**What it checks:**
- ✅ Database connection
- ✅ Search functionality
- ✅ Data population (trailheads/trails)
- ✅ Geospatial indexes

**Run manually:**
```bash
deno run --allow-all src/scripts/startupTest.ts
```

---

### 🏔️ **Integration Test Scripts**

#### `testBackendFixes.ts`
Tests backend fixes and improvements with real scenarios

#### `testFullIntegration.ts`
Full system integration tests with multiple locations

#### `testUnifiedAPI.ts`
Tests the unified API endpoints

#### `testRoutingWithFakeData.ts`
Tests routing functionality with generated data

#### `simpleRoutingTest.ts`
Basic routing functionality tests

---

### 🌐 **Specific Feature Tests**

#### `testCORS.ts`
Tests CORS configuration for frontend integration

#### `testFixes.ts`
General fix testing and validation

---

### 📊 **Data Generation**

#### `generateFakeHikingData.ts`
Generates fake hiking location data:
- 110 trailheads across 11 US states
- 110 trails with difficulty, length, elevation
- 12 transit stops near major cities

#### `runDataGeneration.ts`
Wrapper script to run data generation with setup

**Run it:**
```bash
deno run --allow-all src/scripts/runDataGeneration.ts
```

---

## 🎯 **Recommended Testing Workflow**

### 1. First Time Setup
```bash
# Generate test data
deno run --allow-all src/scripts/runDataGeneration.ts

# Run comprehensive tests
deno run --allow-all src/scripts/testAllEndpoints.ts
```

### 2. Development
```bash
# Start server (runs startup test automatically)
deno run --allow-all src/concept_server.ts

# After making changes, test specific functionality
deno run --allow-all src/scripts/testBackendFixes.ts
```

### 3. Before Deployment
```bash
# Run full test suite
deno run --allow-all src/scripts/testAllEndpoints.ts

# Verify integration
deno run --allow-all src/scripts/testFullIntegration.ts
```

---

## 📊 **Test Output Examples**

### Successful Test Run
```
🧪 COMPREHENSIVE ENDPOINT TEST SUITE
============================================================
📍 1. Testing searchLocations endpoint...
   ✅ PASSED - Found 2 locations
============================================================
📊 TEST SUMMARY
Total Tests: 11
Passed: 11 ✅
Failed: 0 ❌
Success Rate: 100.0%
🎉 ALL TESTS PASSED!
```

### Startup Test
```
🔧 STARTUP VALIDATION
==================================================
1. Database connection...
   ✅ Connected to database
2. Search functionality...
   ✅ Search working
3. Database populated...
   ✅ Found 110 trailheads, 110 trails
4. Geospatial indexes...
   ✅ Geospatial indexes configured
==================================================
✅ All startup tests passed - Server ready!
```

---

## 📍 **Data Coverage**

The fake data includes hiking locations in:
- **California**: Yosemite, Big Sur, Joshua Tree, Death Valley, Half Dome, Mount Whitney
- **Colorado**: Rocky Mountain National Park, Maroon Bells, Pikes Peak, Hanging Lake
- **Washington**: Mount Rainier, Olympic National Park, North Cascades, Mount St. Helens
- **Oregon**: Crater Lake, Mount Hood, Columbia River Gorge, Multnomah Falls
- **Arizona**: Grand Canyon, Sedona, Antelope Canyon, Havasu Falls
- **Utah**: Zion, Bryce Canyon, Arches, Canyonlands
- **Montana**: Glacier National Park, Yellowstone, Bob Marshall Wilderness
- **Wyoming**: Grand Teton, Wind River Range, Devils Tower
- **Alaska**: Denali, Kenai Fjords, Wrangell-St. Elias
- **Texas**: Big Bend, Guadalupe Mountains, Palo Duro Canyon
- **Florida**: Everglades, Big Cypress, Ocala National Forest

Each location includes realistic difficulty levels, trail lengths, elevation gains, and connects to nearby transit infrastructure where available.

---

## 🔧 **Common Issues**

### "No data found"
**Solution:** Run data generation
```bash
deno run --allow-all src/scripts/runDataGeneration.ts
```

### "Geospatial index missing"
**Solution:** Recreate indexes by regenerating data
```bash
deno run --allow-all src/scripts/runDataGeneration.ts
```

### "External API errors"
**Note:** Some tests require external APIs (OSM Overpass). These may fail but won't prevent the server from running.

---

## 📝 **Script Permissions**

All scripts require these Deno permissions:
- `--allow-net` - Network access for database and APIs
- `--allow-env` - Environment variable access
- `--allow-read` - File system read access
- `--allow-sys` - System information access

**Shortcut:** Use `--allow-all` for convenience during development
