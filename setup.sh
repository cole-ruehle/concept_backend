#!/bin/bash

# Setup script for the orchestrate server

echo "🚀 Setting up Orchestrate Server..."
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled. Keeping existing .env file."
        exit 0
    fi
fi

# Copy template
if [ ! -f "env.template" ]; then
    echo "❌ env.template not found!"
    exit 1
fi

cp env.template .env
echo "✅ Created .env file from template"

# Prompt for API keys
echo ""
echo "📝 Please enter your API keys:"
echo ""

read -p "Gemini API Key: " gemini_key
read -p "Google Maps API Key: " maps_key

# Update .env file
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/GEMINI_API_KEY=.*/GEMINI_API_KEY=$gemini_key/" .env
    sed -i '' "s/GOOGLE_MAPS_API_KEY=.*/GOOGLE_MAPS_API_KEY=$maps_key/" .env
else
    # Linux
    sed -i "s/GEMINI_API_KEY=.*/GEMINI_API_KEY=$gemini_key/" .env
    sed -i "s/GOOGLE_MAPS_API_KEY=.*/GOOGLE_MAPS_API_KEY=$maps_key/" .env
fi

echo ""
echo "✅ API keys saved to .env"
echo ""
echo "🔒 Your .env file is gitignored and will NOT be committed"
echo ""
echo "🎉 Setup complete! You can now start the server with:"
echo "   deno task start"
echo ""

