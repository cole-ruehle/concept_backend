# Hiking Data Generation Scripts

This directory contains scripts for populating the hiking app database with fake data for testing and development.

## Scripts

### `generateFakeHikingData.ts`
Generates 100 fake hiking locations across the United States including:
- **Trailheads**: Starting points for hikes with parking, facilities, and accessibility info
- **Trails**: Individual trail segments with difficulty, length, and elevation data
- **Transit Stops**: Public transportation access points near major cities

### `runDataGeneration.ts`
Simple runner script that executes the data generation.

### `testRoutingWithFakeData.ts`
Tests the routing functionality with the generated fake data:
- Lists available trailheads and transit stops
- Tests transit route planning
- Tests external routing engine
- Tests nearby trail search

## Usage

1. **Generate fake data:**
   ```bash
   deno run --allow-net --allow-env --allow-read src/scripts/runDataGeneration.ts
   ```

2. **Test routing with fake data:**
   ```bash
   deno run --allow-net --allow-env --allow-read src/scripts/testRoutingWithFakeData.ts
   ```

## Data Coverage

The fake data includes hiking locations in:
- **California**: Yosemite, Big Sur, Joshua Tree, Death Valley, etc.
- **Colorado**: Rocky Mountain National Park, Maroon Bells, Pikes Peak, etc.
- **Washington**: Mount Rainier, Olympic National Park, North Cascades, etc.
- **Oregon**: Crater Lake, Mount Hood, Columbia River Gorge, etc.
- **Arizona**: Grand Canyon, Sedona, Antelope Canyon, etc.
- **Utah**: Zion, Bryce Canyon, Arches, Canyonlands, etc.
- **Montana**: Glacier National Park, Yellowstone, Bob Marshall Wilderness, etc.
- **Wyoming**: Grand Teton, Wind River Range, Devils Tower, etc.
- **Alaska**: Denali, Kenai Fjords, Wrangell-St. Elias, etc.
- **Texas**: Big Bend, Guadalupe Mountains, Palo Duro Canyon, etc.
- **Florida**: Everglades, Big Cypress, Ocala National Forest, etc.

Each location includes realistic difficulty levels, trail lengths, elevation gains, and connects to nearby transit infrastructure where available.

