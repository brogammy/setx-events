#!/bin/bash

# SETX Events - ONE-COMMAND COMPLETE INSTALLATION
# This replaces ALL files with clean, working versions

echo "🚀 SETX Events - Complete Clean Installation"
echo "=============================================="
echo ""

cd ~/setx-events

# CREATE DIRECTORIES FIRST
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p public
mkdir -p backup
echo "✅ Directories created"

# Stop all services
echo "🛑 Stopping all services..."
pkill -f "node api-server.js"
pkill -f "python3 -m http.server"
sleep 2

# Backup existing files
echo "💾 Creating backups..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -f api-server.js ] && cp api-server.js "$BACKUP_DIR/"
[ -f database.sqlite ] && cp database.sqlite "$BACKUP_DIR/"
echo "✅ Backups saved to $BACKUP_DIR"

# Replace api-server.js with complete working version
echo ""
echo "📝 Installing complete API server..."
if [ -f api-server-complete.js ]; then
    cp api-server-complete.js api-server.js
    echo "✅ API server file copied"
else
    echo "❌ api-server-complete.js not found!"
    exit 1
fi

# Copy admin dashboard
echo "📝 Installing admin dashboard..."
if [ -f admin-dashboard.html ]; then
    cp admin-dashboard.html admin.html
    echo "✅ Admin dashboard copied"
else
    echo "⚠️  admin-dashboard.html not found"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing Node.js dependencies..."
    npm install express sqlite3 cors
fi

# Restart services
echo ""
echo "🚀 Starting services..."

# Start API server
node api-server.js > logs/api-server.log 2>&1 &
API_PID=$!
echo "✅ API Server started (PID: $API_PID)"
sleep 3

# Check if API is running
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ API Server is responding"
else
    echo "❌ API Server failed to start"
    echo "📋 Error log:"
    cat logs/api-server.log
    exit 1
fi

# Start frontend
cd public
FRONTEND_PORT=""
for port in 8081 8082 8083; do
    if ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        python3 -m http.server $port > ../logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        FRONTEND_PORT=$port
        echo "✅ Frontend started on port $port (PID: $FRONTEND_PID)"
        break
    fi
done

cd ..

echo ""
echo "=============================================="
echo "✨ INSTALLATION COMPLETE!"
echo "=============================================="
echo ""
echo "📊 Your SETX Events System:"
echo ""
echo "  🌐 Public Site:"
echo "     http://100.104.226.70:$FRONTEND_PORT"
echo ""
echo "  🎛️  Admin Dashboard:"
echo "     http://100.104.226.70:3001/admin"
echo ""
echo "  📡 API Endpoints:"
echo "     http://100.104.226.70:3001/api/events"
echo "     http://100.104.226.70:3001/api/health"
echo ""
echo "📋 Quick Commands:"
echo ""
echo "  # Check API"
echo "  curl http://localhost
