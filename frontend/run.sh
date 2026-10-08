#!/bin/bash

# Phoenix Scientific Platform - Frontend Setup Script
# This script sets up and runs the React frontend

echo "================================================"
echo "🚀 Phoenix Scientific Platform - Frontend Setup"
echo "================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo "✓ npm found: $(npm --version)"
echo ""

# Navigate to frontend directory
cd "$(dirname "$0")"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating default .env file..."
    cat > .env << 'EOF'
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_MEDIA_URL=http://127.0.0.1:8000/media/
VITE_ENV=development
EOF
    echo "✓ Created .env file with default settings"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

echo "================================================"
echo "✅ Frontend setup complete!"
echo "================================================"
echo ""
echo "🌐 Starting development server..."
echo "   Frontend: http://localhost:5173"
echo ""
echo "⚠️  Make sure backend is running on http://127.0.0.1:8000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the development server
npm run dev
