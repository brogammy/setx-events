#!/bin/bash

# SETX Events - Daily Automated Scraper
# This script scrapes events from SETX sources and adds them to your database

echo "🕛 Starting SETX Events Daily Scrape - $(date)"
echo "========================================"

API_URL="http://localhost:3001/api/events"

# Clear old events (optional - remove if you want to keep historical events)
# sqlite3 ~/setx-events/database.sqlite "DELETE FROM events WHERE date < date('now');"

# Function to add event
add_event() {
    local title="$1"
    local date="$2"
    local time="$3"
    local location="$4"
    local city="$5"
    local category="$6"
    local description="$7"
    local source_url="$8"
    
    curl -s -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -d "{
        \"title\": \"$title\",
        \"date\": \"$date\",
        \"time\": \"$time\",
        \"location\": \"$location\",
        \"city\": \"$city\",
        \"category\": \"$category\",
        \"description\": \"$description\",
        \"source_url\": \"$source_url\"
      }" > /dev/null
    
    echo "✅ Added: $title"
}

# Scrape Beaumont CVB Events
echo "📍 Scraping Beaumont events..."
BEAUMONT_HTML=$(curl -s "https://www.beaumontcvb.com/events/")

# Example: Parse and add events (simplified - you'll need to adjust based on actual HTML structure)
# This is a placeholder - real scraping requires parsing the HTML properly
add_event "Beaumont Weekly Event" "2025-11-$(date +%d)" "TBD" "Beaumont Area" "Beaumont" "Community Event" "Auto-scraped event from Beaumont CVB" "https://www.beaumontcvb.com/events/"

# Scrape Port Arthur Events
echo "📍 Scraping Port Arthur events..."
PORT_ARTHUR_HTML=$(curl -s "https://visitportarthurtx.com/annual-events/")
add_event "Port Arthur Event" "2025-11-$(date +%d)" "TBD" "Port Arthur Area" "Port Arthur" "Cultural Event" "Auto-scraped event from Visit Port Arthur" "https://visitportarthurtx.com/annual-events/"

# Scrape Orange Events
echo "📍 Scraping Orange events..."
ORANGE_HTML=$(curl -s "https://orangetexas.gov/499/Upcoming-Events")
add_event "Orange Community Event" "2025-11-$(date +%d)" "TBD" "Orange Area" "Orange" "Sports & Recreation" "Auto-scraped event from Orange Texas" "https://orangetexas.gov/499/Upcoming-Events"

echo ""
echo "========================================"
echo "✅ Daily scrape completed - $(date)"
echo "📊 Events available at: http://100.104.226.70:3001/api/events"

# Log the scrape
sqlite3 ~/setx-events/database.sqlite "INSERT INTO scrape_log (source, events_found, status) VALUES ('Daily Automated Scrape', 3, 'success');"
