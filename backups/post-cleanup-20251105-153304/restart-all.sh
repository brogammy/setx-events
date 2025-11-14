#!/bin/bash

# SETX Events - Complete System Restart Script
# Restarts all services including n8n workflow

echo "🔄 SETX Events - System Restart"
echo "================================"
echo ""

cd ~/setx-events

# Stop all existing services
echo "🛑 Stopping existing services..."
pkill -f "node api-server.js"
pkill -f "python3 -m http.server"
pkill -f "n8n"
sleep 2
echo "✅ Services stopped"
echo ""

# Start API server
echo "🚀 Starting API server..."
node api-server.js > logs/api-server.log 2>&1 &
API_PID=$!
sleep 3

# Check API health
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ API Server running (PID: $API_PID)"
else
    echo "❌ API Server failed to start - check logs/api-server.log"
    exit 1
fi

# Start frontend
echo "🌐 Starting frontend..."
cd public
for port in 8081 8082 8083; do
    if ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        python3 -m http.server $port > ../logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        FRONTEND_PORT=$port
        echo "✅ Frontend running on port $port (PID: $FRONTEND_PID)"
        break
    fi
done
cd ..

# Start n8n
echo "🤖 Starting n8n..."
nohup n8n start > logs/n8n.log 2>&1 &
N8N_PID=$!
sleep 3
echo "✅ n8n running (PID: $N8N_PID)"

echo ""
echo "================================"
echo "✨ System Status"
echo "================================"
echo ""
echo "📡 API Server:       http://localhost:3001"
echo "🎛️  Admin Dashboard:  http://100.104.226.70:3001/admin"
echo "🌐 Public Site:      http://100.104.226.70:$FRONTEND_PORT"
echo "🤖 n8n Workflows:    http://localhost:5678"
echo ""
echo "📋 Process IDs:"
echo "   API:      $API_PID"
echo "   Frontend: $FRONTEND_PID"
echo "   n8n:      $N8N_PID"
echo ""
echo "📊 Your n8n workflow is active!"
echo "   - Traditional scraper runs daily at 6am"
echo "   - Scrapes: Beaumont CVB, Port Arthur, Orange"
echo ""
echo "🆕 New AI Scrapers available:"
echo "   - Perplexity (venue discovery): node venue-discovery-agent.js"
echo "   - Ollama (daily events):        node ollama-daily-scraper.js"
echo ""
echo "💡 View n8n workflow: http://localhost:5678"
echo "   Your existing workflow: 'SETX Events Daily Scraper'"
echo ""
echo "📝 Logs:"
echo "   tail -f logs/api-server.log"
echo "   tail -f logs/n8n.log"
echo ""
