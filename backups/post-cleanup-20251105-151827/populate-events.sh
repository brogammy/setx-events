#!/bin/bash

# SETX Events - Populate Database with Sample Events

echo "📊 Populating SETX Events Database..."
echo "========================================"

cd ~/setx-events

# Add sample events using the API
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Beaumont Farmers Market",
    "date": "2025-11-08",
    "time": "8:00 AM - 12:00 PM",
    "location": "Crockett Street Entertainment District",
    "city": "Beaumont",
    "category": "Food & Drink",
    "description": "Weekly farmers market featuring local vendors, fresh produce, handmade goods, and live music.",
    "source_url": "https://www.beaumontcvb.com/events/"
  }'

echo ""

curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Port Arthur Mardi Gras",
    "date": "2025-11-15",
    "time": "6:00 PM",
    "location": "Downtown Port Arthur",
    "city": "Port Arthur",
    "category": "Festival",
    "description": "Annual Mardi Gras celebration with parades, live music, food vendors, and family activities.",
    "source_url": "https://visitportarthurtx.com/annual-events/",
    "featured": 1
  }'

echo ""

curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Orange County Fair",
    "date": "2025-11-22",
    "time": "10:00 AM - 8:00 PM",
    "location": "Orange County Expo Center",
    "city": "Orange",
    "category": "Festival",
    "description": "County fair with carnival rides, livestock shows, arts & crafts, and local food vendors.",
    "source_url": "https://orangetexas.gov/499/Upcoming-Events"
  }'

echo ""

curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Spindletop Gladys City Boomtown Tour",
    "date": "2025-11-10",
    "time": "10:00 AM - 5:00 PM",
    "location": "Spindletop-Gladys City Boomtown Museum",
    "city": "Beaumont",
    "category": "Cultural Event",
    "description": "Historical tour of the recreated oil boomtown featuring original buildings and artifacts.",
    "source_url": "https://www.beaumontcvb.com/events/"
  }'

echo ""

curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Port Arthur Seafood Festival",
    "date": "2025-11-29",
    "time": "11:00 AM - 9:00 PM",
    "location": "Port Arthur Waterfront",
    "city": "Port Arthur",
    "category": "Food & Drink",
    "description": "Celebrate the Gulf Coast with fresh seafood, live entertainment, and family-friendly activities.",
    "source_url": "https://visitportarthurtx.com/annual-events/",
    "featured": 1
  }'

echo ""

curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Orange Recreation Center Holiday Bazaar",
    "date": "2025-12-07",
    "time": "9:00 AM - 3:00 PM",
    "location": "Orange Recreation Center",
    "city": "Orange",
    "category": "Arts & Crafts",
    "description": "Holiday shopping bazaar featuring local artisans, crafts, gifts, and baked goods.",
    "source_url": "https://orangetexas.gov/499/Upcoming-Events"
  }'

echo ""

curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Julie Rogers Theatre Performance",
    "date": "2025-11-17",
    "time": "7:30 PM",
    "location": "Julie Rogers Theatre",
    "city": "Beaumont",
    "category": "Arts & Entertainment",
    "description": "Live theatrical performance at the historic Julie Rogers Theatre in downtown Beaumont.",
    "source_url": "https://www.beaumontcvb.com/events/"
  }'

echo ""

curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nederland Heritage Festival",
    "date": "2025-11-12",
    "time": "10:00 AM - 6:00 PM",
    "location": "Downtown Nederland",
    "city": "Nederland",
    "category": "Cultural Event",
    "description": "Celebrate Dutch heritage with traditional food, music, dancing, and cultural exhibits.",
    "source_url": "https://www.beaumontcvb.com/events/"
  }'

echo ""

curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Beaumont Botanical Gardens Tour",
    "date": "2025-11-14",
    "time": "9:00 AM - 5:00 PM",
    "location": "Beaumont Botanical Gardens",
    "city": "Beaumont",
    "category": "Nature & Outdoors",
    "description": "Guided tour through beautiful gardens featuring native Texas plants and seasonal displays.",
    "source_url": "https://www.beaumontcvb.com/events/"
  }'

echo ""

curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Live Music at The Logon Cafe",
    "date": "2025-11-16",
    "time": "7:00 PM - 10:00 PM",
    "location": "The Logon Cafe",
    "city": "Beaumont",
    "category": "Music",
    "description": "Live local music performance with food and drinks available.",
    "source_url": "https://www.beaumontcvb.com/events/"
  }'

echo ""
echo "========================================"
echo "✅ Sample events added to database!"
echo ""
echo "View them at:"
echo "  http://100.104.226.70:3001/api/events"
echo ""
echo "Or visit your website to see them displayed!"

