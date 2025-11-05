User.register { username: 'walk', password: 'walkwalk', email: 'walk@gmail.com' } => { userId: '019a51df-df93-7ecb-bd03-2135c9ac72af' }
Requesting.respond {
  request: '019a51df-de75-7871-8f07-502e8be159db',
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af'
} => { request: '019a51df-de75-7871-8f07-502e8be159db' }
Profile.createProfile {
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af',
  displayName: 'walk',
  experienceLevel: 'beginner'
INFO
} => { profileId: '019a51df-e06a-7d18-8e20-5efe5f2f617f' }
UserHistory.recordActivity {
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af',
  activityType: 'account_created',
  activityData: {},
  visibility: 'private'
} => { error: 'Invalid activity type' }
[Requesting] Received request for path: /user/login
Requesting.request { username: 'walk', password: 'walkwalk', path: '/user/login' } => { request: '019a51df-e20a-77f3-b4e1-b4cbc039d618' }
User.login { username: 'walk', password: 'walkwalk' } => {
  sessionToken: '2b5f37ec6541f2c4e334084ce3253c23742ab32a7a7747192828ab4aef125d16',
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af'
}
Requesting.respond {
  request: '019a51df-e20a-77f3-b4e1-b4cbc039d618',
  sessionToken: '2b5f37ec6541f2c4e334084ce3253c23742ab32a7a7747192828ab4aef125d16',
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af'
} => { request: '019a51df-e20a-77f3-b4e1-b4cbc039d618' }
[Requesting] Received request for path: /user/getUserProfile
Requesting.request {
  sessionToken: '2b5f37ec6541f2c4e334084ce3253c23742ab32a7a7747192828ab4aef125d16',
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af',
  path: '/user/getUserProfile'
} => { request: '019a51df-e436-7a33-8fd3-5dcf8f91b827' }
User.getUserProfile { userId: '019a51df-df93-7ecb-bd03-2135c9ac72af' } => {
  username: 'walk',
  email: 'walk@gmail.com',
  createdAt: 2025-11-05T02:36:57.619Z
}
Requesting.respond {
  request: '019a51df-e436-7a33-8fd3-5dcf8f91b827',
  username: 'walk',
  email: 'walk@gmail.com',
  createdAt: 2025-11-05T02:36:57.619Z
} => { request: '019a51df-e436-7a33-8fd3-5dcf8f91b827' }
[Requesting] Received request for path: /profile/getProfile
Requesting.request {
  sessionToken: '2b5f37ec6541f2c4e334084ce3253c23742ab32a7a7747192828ab4aef125d16',
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af',
  viewerUserId: null,
  path: '/profile/getProfile'
} => { request: '019a51df-e635-7e3c-abcd-49df05eaeb01' }
Profile.getProfile { userId: '019a51df-df93-7ecb-bd03-2135c9ac72af', viewerUserId: null } => { profile: { displayName: 'walk', experienceLevel: 'beginner' } }
Requesting.respond {
  request: '019a51df-e635-7e3c-abcd-49df05eaeb01',
  profile: { displayName: 'walk', experienceLevel: 'beginner' },
  stats: {
    totalHikes: 0,
    totalDistance: 0,
    totalDuration: 0,
    completionRate: 0,
    favoriteLocations: [],
    lastActiveAt: 2025-11-05T02:36:59.653Z
  }
} => { request: '019a51df-e635-7e3c-abcd-49df05eaeb01' }
Requesting.respond {
  request: '019a51df-e635-7e3c-abcd-49df05eaeb01',
  profile: { displayName: 'walk', experienceLevel: 'beginner' }
} => { request: '019a51df-e635-7e3c-abcd-49df05eaeb01' }
[Requesting] Error processing request: Request 019a51dd-3fcd-7698-b7bc-0d4ca4b85fc9 timed out after 180000ms
[Requesting] Error processing request: Request 019a51dd-51ad-7d72-947f-46a7b28a92c8 timed out after 180000ms
[Requesting] Received request for path: /llmRoutePlanner/planRoute
Requesting.request {
  sessionToken: '2b5f37ec6541f2c4e334084ce3253c23742ab32a7a7747192828ab4aef125d16',
  query: 'Plan a hiking route from Boston to blue hills. My home is Cambridge . I prefer using tolls if needed and using highways if needed.  Maximum detour: 15 minutes.',
  userLocation: { lat: 42.3561315865954, lng: -71.09732160068431 },
  preferences: {
    duration: 1,
    transportModes: [ 'transit', 'walking' ],
    avoid: [],
    accessibility: false
  },
  path: '/llmRoutePlanner/planRoute'
} => { request: '019a51e0-3dd2-7f8f-a10c-411d9da5aafa' }
User.authenticate {
  sessionToken: '2b5f37ec6541f2c4e334084ce3253c23742ab32a7a7747192828ab4aef125d16'
} => { userId: '019a51df-df93-7ecb-bd03-2135c9ac72af' }
🎯 [LLMRoutePlanner.planRoute] Called!
   User: 019a51df-df93-7ecb-bd03-2135c9ac72af
   Query: Plan a hiking route from Boston to blue hills. My home is Cambridge . I prefer using tolls if needed and using highways if needed.  Maximum detour: 15 minutes.
   Location: 42.3561315865954, -71.09732160068431
✅ [LLMRoutePlanner] Validation passed, calling orchestrator...
🚀 Planning route for query: Plan a hiking route from Boston to blue hills. My home is Cambridge . I prefer using tolls if needed and using highways if needed.  Maximum detour: 15 minutes.
⏱️  Step 1: Generating plan with LLM...
✅ LLM plan generated in 3940ms
   Plan: {
  "action": "create_new",
  "destination": "Blue Hills Reservation",
  "searchQuery": "Blue Hills Reservation",
  "requiresTransit": true,
  "estimatedHikingDuration": 60,
  "modifyType": "null",
  "keepOriginalDestination": false,
  "suggestions": [
    "Check MBTA schedules for the best transit route to Blue Hills Reservation, likely involving a subway and bus connection.",
    "Wear appropriate hiking shoes as trails can be uneven.",
    "Bring plenty of water and snacks for your hike.",
    "Download or pick up a trail map of Blue Hills Reservation before you start.",
    "Check the weather forecast before heading out."
  ]
}
⏱️  Step 2: Executing plan with Google Maps...
Executing plan: {
  action: "create_new",
  destination: "Blue Hills Reservation",
  searchQuery: "Blue Hills Reservation",
  requiresTransit: true,
  estimatedHikingDuration: 60,
  modifyType: "null",
  keepOriginalDestination: false,
  suggestions: [
    "Check MBTA schedules for the best transit route to Blue Hills Reservation, likely involving a subway and bus connection.",
    "Wear appropriate hiking shoes as trails can be uneven.",
    "Bring plenty of water and snacks for your hike.",
    "Download or pick up a trail map of Blue Hills Reservation before you start.",
    "Check the weather forecast before heading out."
  ]
}
Found destination: Blue Hills Reservation
✅ Maps execution completed in 685ms
🎉 Total route planning time: 4626ms (4.63s)
✅ [LLMRoutePlanner] Orchestrator completed in 4626ms
   Route: Blue Hills Reservation Adventure
   Suggestions: 5 items
LLMRoutePlanner.planRoute {
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af',
  query: 'Plan a hiking route from Boston to blue hills. My home is Cambridge . I prefer using tolls if needed and using highways if needed.  Maximum detour: 15 minutes.',
  userLocation: { lat: 42.3561315865954, lng: -71.09732160068431 },
  preferences: {
    duration: 1,
    transportModes: [ 'transit', 'walking' ],
    avoid: [],
    accessibility: false
  }
} => {
  route: {
    route_id: 'route-1762310246629-mon36t07g',
    name: 'Blue Hills Reservation Adventure',
    metrics: { totalMin: 235, etaArrival: '2025-11-05T06:32:26.629Z' },
    origin: { lat: 42.3561315865954, lng: -71.09732160068431 },
    destination: { lat: 42.2147195, lng: -71.0880794 },
    waypoints: [ [Object] ],
    segments: [ [Object], [Object], [Object] ]
  },
  suggestions: [
    'Check MBTA schedules for the best transit route to Blue Hills Reservation, likely involving a subway and bus connection.',
    'Wear appropriate hiking shoes as trails can be uneven.',
    'Bring plenty of water and snacks for your hike.',
    'Download or pick up a trail map of Blue Hills Reservation before you start.',
    'Check the weather forecast before heading out.'
  ]
}
Requesting.respond {
  request: '019a51e0-3dd2-7f8f-a10c-411d9da5aafa',
  route: {
    route_id: 'route-1762310246629-mon36t07g',
    name: 'Blue Hills Reservation Adventure',
    metrics: { totalMin: 235, etaArrival: '2025-11-05T06:32:26.629Z' },
    origin: { lat: 42.3561315865954, lng: -71.09732160068431 },
    destination: { lat: 42.2147195, lng: -71.0880794 },
    waypoints: [ [Object] ],
    segments: [ [Object], [Object], [Object] ]
  },
  suggestions: [
    'Check MBTA schedules for the best transit route to Blue Hills Reservation, likely involving a subway and bus connection.',
    'Wear appropriate hiking shoes as trails can be uneven.',
    'Bring plenty of water and snacks for your hike.',
    'Download or pick up a trail map of Blue Hills Reservation before you start.',
    'Check the weather forecast before heading out.'
  ]
} => { request: '019a51e0-3dd2-7f8f-a10c-411d9da5aafa' }
UserHistory.recordActivity {
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af',
  activityType: 'route_planned',
  activityData: { query: Symbol(query), method: 'llm', route: Symbol(route) },
  visibility: 'private'
} => { entryId: '019a51e0-516f-7541-980f-a8f86ec6f60b' }
[Requesting] Received request for path: /userHistory/getPopularRoutes
Requesting.request {
  timeWindow: 'week',
  limit: 10,
  path: '/userHistory/getPopularRoutes'
} => { request: '019a51e0-769a-72a6-b9ab-4d39912c7152' }
UserHistory.getPopularRoutes { timeWindow: 'week', limit: 10 } => {
  routes: [
    {
      routeId: 'route_mount_rainier_skyline_trail_284',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_olympic_national_park_hoh_rainforest_990',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_rocky_mountain_national_park_trail_486',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_big_sur_coastal_trail_659',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_sedona_cathedral_rock_819',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_shenandoah_national_park_190',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_acadia_national_park_187',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route-1762310124882-ilm3qx7hm',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_yellowstone_old_faithful_trail_453',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_grand_teton_national_park_196',
      count: 1,
      avgRating: undefined
    }
  ]
}
Requesting.respond {
  request: '019a51e0-769a-72a6-b9ab-4d39912c7152',
  routes: [
    {
      routeId: 'route_mount_rainier_skyline_trail_284',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_olympic_national_park_hoh_rainforest_990',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_rocky_mountain_national_park_trail_486',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_big_sur_coastal_trail_659',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_sedona_cathedral_rock_819',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_shenandoah_national_park_190',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_acadia_national_park_187',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route-1762310124882-ilm3qx7hm',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_yellowstone_old_faithful_trail_453',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_grand_teton_national_park_196',
      count: 1,
      avgRating: undefined
    }
  ]
} => { request: '019a51e0-769a-72a6-b9ab-4d39912c7152' }
[Requesting] Error processing request: Request 019a51dd-c76a-74f6-8691-30b09d4b9481 timed out after 180000ms
[Requesting] Received request for path: /userHistory/getPopularRoutes
Requesting.request {
  timeWindow: 'year',
  limit: 10,
  path: '/userHistory/getPopularRoutes'
} => { request: '019a51e0-8daa-7ed2-8ebb-31a7b547e2e0' }
UserHistory.getPopularRoutes { timeWindow: 'year', limit: 10 } => {
  routes: [
    {
      routeId: 'route_glacier_national_park_going-to-the-sun_953',
      count: 2,
      avgRating: undefined
    },
    {
      routeId: 'route_grand_teton_national_park_428',
      count: 1,
      avgRating: undefined
Requesting.respond {
  request: '019a51e1-60cd-7f42-ae4c-857ff2b36908',
  route: {
    route_id: 'route-1762310320823-eugcvxjq7',
    name: 'Newcomb Farms Restaurant Adventure',
    metrics: { totalMin: 251, etaArrival: '2025-11-05T06:49:40.823Z' },
    origin: { lat: 42.3561315865954, lng: -71.09732160068431 },
    destination: { lat: 42.2291667, lng: -71.0713889 },
    waypoints: [ [Object] ],
    segments: [ [Object], [Object], [Object] ]
  },
  suggestions: [
    "Consider the type of cuisine you're in the mood for.",
    'Check opening hours and make reservations if needed.',
    'Look for places with outdoor seating if the weather is nice.',
    'Factor in travel time to and from the restaurant from your current trail position.',
    'Check transit schedules for return trip timing'
  ]
} => { request: '019a51e1-60cd-7f42-ae4c-857ff2b36908' }
UserHistory.recordActivity {
  userId: '019a51df-df93-7ecb-bd03-2135c9ac72af',
  activityType: 'route_planned',
  activityData: { query: Symbol(query), method: 'llm', route: Symbol(route) },
  visibility: 'private'
} => { entryId: '019a51e1-733f-7a64-9c46-b6c670db95c6' }
[Requesting] Received request for path: /userHistory/getPopularRoutes
Requesting.request { timeWindow: 'day', limit: 10, path: '/userHistory/getPopularRoutes' } => { request: '019a51e1-a8c6-7978-b514-78790bab44d6' }
UserHistory.getPopularRoutes { timeWindow: 'day', limit: 10 } => {
  routes: [
    {
      routeId: 'route_big_sur_coastal_trail_430',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route-1762310124882-ilm3qx7hm',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_bryce_canyon_rim_trail_418',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route-1762310246629-mon36t07g',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_acadia_national_park_187',
      count: 1,
      avgRating: undefined
    }
  ]
}
Requesting.respond {
  request: '019a51e1-a8c6-7978-b514-78790bab44d6',
  routes: [
    {
      routeId: 'route_big_sur_coastal_trail_430',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route-1762310124882-ilm3qx7hm',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_bryce_canyon_rim_trail_418',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route-1762310246629-mon36t07g',
      count: 1,
      avgRating: undefined
    },
    {
      routeId: 'route_acadia_national_park_187',
      count: 1,
      avgRating: undefined
    }
  ]
} => { request: '019a51e1-a8c6-7978-b514-78790bab44d6' }
