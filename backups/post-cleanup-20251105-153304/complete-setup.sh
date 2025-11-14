#!/bin/bash

# SETX Events - Complete Setup Script
# This script sets up everything in the correct locations

echo "🚀 SETX Events - Complete Installation"
echo "========================================="
echo ""

# Define base directory
INSTALL_DIR="$HOME/setx-events"

echo "📁 Installation directory: $INSTALL_DIR"
echo ""

# Create directory structure
echo "📂 Creating directory structure..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/public"
mkdir -p "$INSTALL_DIR/logs"

cd "$INSTALL_DIR"

echo "✅ Directory structure created"
echo ""

# Update database schema with venues
echo "🗄️  Updating database schema..."
sqlite3 database.sqlite < schema-venues.sql 2>/dev/null || echo "Schema already up to date"

echo "✅ Database schema updated"
echo ""

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install axios cheerio jsdom sqlite3 express cors

echo "✅ Dependencies installed"
echo ""

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x venue-scraper.js
chmod +x intelligent-scraper.js
chmod +x api-server.js

echo "✅ Scripts are executable"
echo ""

# Copy frontend to public directory
echo "🌐 Setting up frontend..."
# The index.html file should be copied to public/

echo "✅ Frontend ready"
echo ""

echo "========================================="
echo "📋 FILE LOCATIONS:"
echo "========================================="
echo ""
echo "Backend API:"
echo "  $INSTALL_DIR/api-server.js"
echo ""
echo "Database:"
echo "  $INSTALL_DIR/database.sqlite"
echo ""
echo "Scrapers:"
echo "  $INSTALL_DIR/venue-scraper.js (RECOMMENDED - learns venues)"
echo "  $INSTALL_DIR/intelligent-scraper.js (fallback)"
echo ""
echo "Frontend Website:"
echo "  $INSTALL_DIR/public/index.html"
echo ""
echo "Logs:"
echo "  $INSTALL_DIR/logs/scrape.log"
echo "  $INSTALL_DIR/logs/api-server.log"
echo ""
echo "========================================="
echo "🚀 QUICK START:"
echo "========================================="
echo ""
echo "1. Start API Server:"
echo "   cd $INSTALL_DIR && node api-server.js > logs/api-server.log 2>&1 &"
echo ""
echo "2. Test Venue Scraper:"
echo "   cd $INSTALL_DIR && node venue-scraper.js"
echo ""
echo "3. Start Frontend (Python web server):"
echo "   cd $INSTALL_DIR/public && python3 -m http.server 8080 &"
echo ""
echo "4. Access your site:"
echo "   http://100.104.226.70:8080"
echo ""
echo "5. Access API:"
echo "   http://100.104.226.70:3001/api/events"
echo ""
echo "========================================="
echo "⏰ AUTOMATION (runs at midnight daily):"
echo "========================================="
echo ""
echo "Run: crontab -e"
echo "Add: 0 0 * * * cd $INSTALL_DIR && node venue-scraper.js >> logs/scrape.log 2>&1"
echo ""
echo "========================================="
echo ""
echo "✅ Installation complete!"
echo ""
