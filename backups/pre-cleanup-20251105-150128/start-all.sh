#!/bin/bash
# Start both n8n and API server

# Start API server in background
cd ~/setx-events
node api-server.js &
API_PID=$!
echo "API Server started (PID: $API_PID)"

# Start n8n service
sudo systemctl start setx-events

echo "✅ All services started!"
echo "🌐 n8n: http://localhost:5678"
echo "🔌 API: http://localhost:3000/api/events"
