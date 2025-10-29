# CORS Fix Documentation

## 🔍 **What Was the Problem?**

Your frontend (running on `http://localhost:3000`) was blocked from making requests to your backend (running on `http://localhost:8000`) due to CORS (Cross-Origin Resource Sharing) restrictions.

### **Error You Were Seeing:**
```
Access to fetch at 'http://localhost:8000/api/HikingApp/searchLocations' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## ✅ **What I Fixed**

I added CORS middleware to your backend server to allow cross-origin requests.

### **Changes Made to `src/concept_server.ts`:**

```typescript
// 1. Added CORS import
import { cors } from "jsr:@hono/hono/cors";

// 2. Added CORS middleware
app.use("/*", cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:4200"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
}));
```

## 🚀 **How to Apply the Fix**

### **Step 1: Restart the Backend Server**

Stop your current backend server (Ctrl+C) and restart it:

```bash
cd /Users/Cole-School/Desktop/MIT/Classes\ 2025/concept_backend
deno run --allow-net --allow-env --allow-read --allow-sys src/concept_server.ts
```

You should see the server start normally with all endpoints registered.

### **Step 2: Test CORS is Working**

In a new terminal window, run:

```bash
deno run --allow-net src/scripts/testCORS.ts
```

You should see:
```
✅ CORS preflight request successful!
✅ Request successful!
✅ http://localhost:3000 - Allowed
✅ http://localhost:5173 - Allowed
✅ http://localhost:4200 - Allowed
```

### **Step 3: Test from Frontend**

Now your frontend should work! Try making a request:

```javascript
// This should now work from your frontend
fetch('http://localhost:8000/api/HikingApp/searchLocations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'Yosemite',
    options: { limit: 10 }
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

## 📋 **What the CORS Configuration Does**

### **Allowed Origins:**
- `http://localhost:3000` - React default port
- `http://localhost:5173` - Vite default port
- `http://localhost:4200` - Angular default port

### **Allowed Methods:**
- GET, POST, PUT, DELETE, OPTIONS

### **Allowed Headers:**
- Content-Type
- Authorization

### **Other Settings:**
- `credentials: true` - Allows cookies and authentication headers
- `maxAge: 600` - Caches preflight requests for 10 minutes

## 🔧 **Adding More Origins**

If your frontend runs on a different port, add it to the origins array:

```typescript
app.use("/*", cors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:5173", 
    "http://localhost:4200",
    "http://localhost:YOUR_PORT_HERE"  // Add your port
  ],
  // ... rest of config
}));
```

## 🌐 **For Production**

When deploying to production, update the origins to your actual domain:

```typescript
app.use("/*", cors({
  origin: [
    "https://yourdomain.com",
    "https://www.yourdomain.com"
  ],
  // ... rest of config
}));
```

Or use an environment variable:

```typescript
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:3000";

app.use("/*", cors({
  origin: FRONTEND_URL,
  // ... rest of config
}));
```

## 🧪 **Testing CORS**

### **From Browser Console:**
```javascript
// Test in your browser's console
fetch('http://localhost:8000/api/HikingApp/getRecentSearches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 5 })
})
.then(r => r.json())
.then(console.log)
```

### **From Terminal:**
```bash
# Test with curl
curl -X OPTIONS http://localhost:8000/api/HikingApp/searchLocations \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

You should see CORS headers in the response:
```
< Access-Control-Allow-Origin: http://localhost:3000
< Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
< Access-Control-Allow-Headers: Content-Type, Authorization
```

## ✅ **Verification Checklist**

- [ ] Backend server restarted with CORS middleware
- [ ] OPTIONS preflight requests return CORS headers
- [ ] POST requests include Access-Control-Allow-Origin header
- [ ] Frontend can successfully make API requests
- [ ] No CORS errors in browser console

## 🎉 **You're All Set!**

Your backend now properly handles CORS, and your frontend should be able to make API requests without any issues!

If you still see CORS errors:
1. Make sure you restarted the backend server
2. Check that your frontend is running on one of the allowed origins
3. Clear your browser cache and reload
4. Check the browser console for the exact CORS error message

The hiking app backend is now fully functional and ready for frontend integration! 🏔️🥾


