# SETX Events - Quick Start Guide

## What is This Project?

A **Southeast Texas event aggregation system** that:
- Automatically scrapes events from venue websites daily
- Provides a REST API for event data
- Displays events in a modern web calendar
- Supports multiple AI-powered scraping strategies

## Project Layout

```
setx-events/
├── api-server.js          ← Express API (main backend) - PORT 3001
├── index.js               ← Ollama scraper (local AI)
├── ai-scraper.js          ← Perplexity scraper (cloud AI)
├── public/                ← Frontend SPA
│   └── index.html
├── n8n-workflows/         ← Automated daily scraping
├── database.sqlite        ← All events & venues
└── logs/                  ← Application logs
```

## Quick Start (30 seconds)

### 1. Install Dependencies
```bash
cd /home/sauly/setx-events
npm install
```

### 2. Start Everything
```bash
./restart-all.sh
```

This starts:
- **API Server** → http://localhost:3001
- **Frontend** → http://100.104.226.70:8081
- **n8n Workflows** → http://localhost:5678
- **Admin Dashboard** → http://100.104.226.70:3001/admin

### 3. Access the App
Open browser to: `http://100.104.226.70:8081`

## Core Files Explained

| File | What it does |
|------|-----------|
| **api-server.js** | REST API that stores/retrieves events |
| **index.js** | Ollama scraper (free, local AI) |
| **ai-scraper.js** | Perplexity scraper (paid, cloud AI) |
| **database.sqlite** | All events stored here |
| **n8n-workflows/** | Automated daily scraping config |
| **public/index.html** | The web interface |

## Common Tasks

### View All Events via API
```bash
curl http://localhost:3001/api/events | jq
```

### Filter Events by City
```bash
curl "http://localhost:3001/api/events?city=Beaumont" | jq
```

### Search Events
```bash
curl "http://localhost:3001/api/events?search=jazz" | jq
```

### Check API Health
```bash
curl http://localhost:3001/api/health
```

### View Statistics
```bash
curl http://localhost:3001/api/admin/stats | jq
```

### Run Manual Scraper
```bash
# Option 1: Ollama (free, requires ollama service)
node index.js

# Option 2: Perplexity (paid, requires API key)
PERPLEXITY_API_KEY="your-key" node ai-scraper.js
```

### View Logs
```bash
tail -f logs/api-server.log
tail -f logs/n8n.log
```

### Restart Everything
```bash
./restart-all.sh
```

### Stop Everything
```bash
pkill -f "node api-server.js"
pkill -f "python3 -m http.server"
pkill -f "n8n"
```

## API Endpoints Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/events` | Get all events (filterable) |
| POST | `/api/events` | Create new event |
| GET | `/api/events/:id` | Get single event |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event |
| GET | `/api/venues` | Get all venues |
| GET | `/api/admin/stats` | Get dashboard stats |
| GET | `/api/health` | Health check |

## Database Tables

```sql
events          -- All events
├── id
├── title
├── date
├── time
├── location
├── city
├── category
├── description
└── ...

venues          -- Venue information
├── id
├── name
├── city
├── category
├── website
├── is_active
└── priority

scrape_log      -- Audit trail
├── id
├── source
├── events_found
├── status
└── scraped_at
```

## Scraping Methods

### 1. n8n Workflows (RECOMMENDED)
- **When:** Daily at 6am automatically
- **How:** Scheduled job in n8n
- **Access:** http://localhost:5678
- **Sources:** Beaumont CVB, Port Arthur, Orange websites

### 2. Perplexity AI (SMART)
```bash
PERPLEXITY_API_KEY="your-key" node ai-scraper.js
```
- Web search-based extraction
- Works on any website
- Costs ~$0.001 per venue

### 3. Ollama Local (FREE)
```bash
ollama pull llama3.1
ollama serve
node index.js
```
- Completely free
- No API costs
- Runs locally

## Development Workflow

### Monitor the system
```bash
# Terminal 1: Watch API logs
tail -f logs/api-server.log

# Terminal 2: Watch n8n logs
tail -f logs/n8n.log

# Terminal 3: Test API
while true; do
  curl -s http://localhost:3001/api/health | jq '.'
  sleep 5
done
```

### Test a change
```bash
# Edit api-server.js
nano api-server.js

# Restart API
pkill -f "node api-server.js"
sleep 2
node api-server.js > logs/api-server.log 2>&1 &
```

### Add test event
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Concert",
    "date": "2025-11-15",
    "time": "7:00 PM",
    "location": "Downtown Theater",
    "city": "Beaumont",
    "category": "Music",
    "description": "A test event"
  }'
```

## Troubleshooting

### "Port already in use"
```bash
# Find and kill the process
lsof -i :3001
kill -9 <PID>
```

### API not responding
```bash
curl http://localhost:3001/api/health
# Should return: {"status":"ok","database":"connected"}
```

### Database locked
```bash
# Restart everything
./restart-all.sh
```

### Scrapers not running
```bash
# Check n8n logs
tail -f logs/n8n.log

# Check if n8n is running
ps aux | grep n8n

# Restart
pkill -f n8n
sleep 2
nohup n8n start > logs/n8n.log 2>&1 &
```

## File Paths

| Path | Purpose |
|------|---------|
| `/home/sauly/setx-events/` | Project root |
| `/home/sauly/setx-events/database.sqlite` | Database file |
| `/home/sauly/setx-events/logs/` | Log files |
| `/home/sauly/setx-events/public/` | Frontend files |
| `/home/sauly/setx-events/n8n-workflows/` | Workflow configs |

## Performance Tips

- Events are indexed by: `city`, `date`, `category`
- Queries with these filters are fast
- Search queries use LIKE which is slower
- Pagination: Use offset/limit in API calls
- Caching: Frontend caches API response

## Next Steps

1. Customize venue list in database
2. Add more scraping sources to n8n
3. Configure Perplexity API key for smart scraping
4. Add authentication to prevent unauthorized access
5. Deploy to production server

## Getting Help

Check these files:
- `ARCHITECTURE.md` - Deep dive technical docs
- `AI-SCRAPER-GUIDE.md` - AI scraper setup
- `logs/*.log` - Error messages
- `api-server.js` - API code comments

## Links

- Frontend: `http://100.104.226.70:8081`
- API Docs: `http://100.104.226.70:3001`
- Admin: `http://100.104.226.70:3001/admin`
- n8n: `http://localhost:5678`
