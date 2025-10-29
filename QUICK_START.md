# Quick Start Guide - Hiking App Backend

## 🚀 **Getting Started in 3 Steps**

### **Step 1: Start the Backend Server**
```bash
cd /Users/Cole-School/Desktop/MIT/Classes\ 2025/concept_backend
deno run --allow-net --allow-env --allow-read --allow-sys src/concept_server.ts
```

✅ **You should see:**
```
Server listening on http://localhost:8000
Listening on http://0.0.0.0:8000/ (http://localhost:8000/)
```

### **Step 2: Verify it's Working**
Open another terminal and run:
```bash
deno run --allow-net src/scripts/testCORS.ts
```

✅ **You should see:**
```
✅ CORS preflight request successful!
✅ Request successful!
```

### **Step 3: Connect Your Frontend**
Your frontend can now make requests to:
```
http://localhost:8000/api/HikingApp/[endpoint]
```

## 📋 **What's Available**

### **Backend Features:**
- ✅ **110+ Hiking Locations** across the US
- ✅ **CORS Enabled** for frontend requests
- ✅ **10+ API Endpoints** ready to use
- ✅ **Search History** persistence
- ✅ **Location Autocomplete**
- ✅ **Route Calculation**

### **API Base URL:**
```
http://localhost:8000/api/HikingApp
```

### **Main Endpoints:**
- `POST /searchLocations` - Search for hiking locations
- `POST /getNearbyLocations` - Find nearby trails/trailheads
- `POST /calculateRoute` - Calculate hiking routes
- `POST /getRecentSearches` - Get search history
- `POST /getSearchSuggestions` - Get autocomplete suggestions

## 🧪 **Quick Test from Browser Console**

Open your browser console and paste:

```javascript
fetch('http://localhost:8000/api/HikingApp/getNearbyLocations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    center: { lat: 37.7749, lon: -122.4194 },
    radius: 50000,
    types: ['trailhead', 'trail'],
    limit: 5
  })
})
.then(r => r.json())
.then(data => console.log('✅ Backend is working!', data))
.catch(error => console.error('❌ Error:', error));
```

## 📚 **Documentation**

- **API_SPECIFICATION.md** - Complete API reference
- **FRONTEND_INTEGRATION_GUIDE.md** - Frontend integration examples
- **CORS_FIX.md** - CORS configuration details
- **BACKEND_FIXES_SUMMARY.md** - All implemented features

## ⚙️ **Environment Setup**

Make sure you have a `.env` file with:
```bash
MONGODB_URL=your-mongodb-connection-string
DB_NAME=your-database-name
```

## 🐛 **Troubleshooting**

### **Server won't start?**
- Check MongoDB connection in `.env`
- Make sure port 8000 is not in use

### **CORS errors?**
- Restart the backend server
- Check your frontend is on `localhost:3000`, `5173`, or `4200`

### **No data returned?**
- Run the data generation script:
  ```bash
  deno run --allow-net --allow-env --allow-read --allow-sys src/scripts/runDataGeneration.ts
  ```

## 🎯 **You're Ready!**

Your backend is running and ready for frontend integration. All 110+ hiking locations are loaded and the API is fully functional with CORS enabled! 🏔️🥾


