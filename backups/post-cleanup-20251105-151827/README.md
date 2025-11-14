# SETX Events - Southeast Texas Event Aggregation Platform

A full-stack Node.js application that automatically discovers, aggregates, and displays events from multiple sources across Southeast Texas (Beaumont, Port Arthur, Orange).

## What This Does

- Automatically scrapes events from venue websites daily
- Provides a REST API for querying events by city, category, or search term
- Displays events in a modern, responsive web calendar
- Supports multiple AI-powered scraping strategies (Perplexity API, Ollama, n8n workflows)
- Stores all data in SQLite with duplicate detection

## Quick Start (30 seconds)

```bash
cd /home/sauly/setx-events
npm install
./restart-all.sh
```

Then open:
- **Web App:** http://100.104.226.70:8081
- **API Docs:** http://100.104.226.70:3001
- **Admin Dashboard:** http://100.104.226.70:3001/admin
- **Workflows:** http://localhost:5678

## Project Structure

```
setx-events/
├── api-server.js           # Express REST API (port 3001)
├── index.js                # Ollama scraper (free local AI)
├── ai-scraper.js           # Perplexity scraper (cloud AI)
├── public/index.html       # Frontend web application
├── n8n-workflows/          # Automated daily scraping
├── database.sqlite         # SQLite event database
├── logs/                   # Application logs
└── *.sh                    # Management scripts
```

## Key Technologies

| Layer | Technology |
|-------|-----------|
| **Backend API** | Express.js 5.1, Node.js |
| **Database** | SQLite 3 with indexing |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Automation** | n8n workflows, Bash scripts |
| **Data Source** | Web scraping (HTML parsing + AI) |
| **AI Options** | Perplexity API, Ollama (local), n8n |

## Architecture Overview

```
[Browser] ←→ [Frontend SPA] ←→ [Express API] ←→ [SQLite DB]
                                    ↑
                    [Automated Scrapers - n8n / AI]
```

**Data Sources:** Beaumont CVB, Port Arthur Events, Orange City
**Scraping:** Daily at 6am UTC via n8n, plus manual via Perplexity/Ollama

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/events` | Get all events (filterable) |
| POST | `/api/events` | Create new event |
| GET | `/api/events/:id` | Get single event |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event |
| GET | `/api/venues` | Get all venues |
| GET | `/api/admin/stats` | Get dashboard statistics |
| GET | `/api/health` | Health check |

**Filters:** `?city=Beaumont`, `?category=Music`, `?search=jazz`

## Database Schema

**Events Table:** 18 columns including title, date, time, location, city, category, description, source_url, featured status, and timestamps

**Venues Table:** 10+ columns for venue info (name, city, website, Facebook, Instagram, priority, active status)

**Supporting Tables:** event_sources (URL tracking), scrape_log (audit trail)

## Scraping Methods

### 1. n8n Workflows (Recommended)
- Automatic daily scraping at 6am
- Scrapes: Beaumont CVB, Port Arthur, Orange websites
- Web interface: http://localhost:5678
- No additional setup needed

### 2. Perplexity AI (Smart)
```bash
PERPLEXITY_API_KEY="your-key" node ai-scraper.js
```
- Web search-based extraction
- Works on any website
- Cost: ~$0.001 per venue

### 3. Ollama (Free, Local)
```bash
ollama pull llama3.1
ollama serve
node index.js
```
- Completely free
- No API costs
- Runs locally

## Features

- **Automatic Scraping:** Daily scheduled job via n8n
- **Duplicate Detection:** Prevents duplicate events (by title + date + city)
- **Filtering:** By city, category, or search term
- **API:** Full REST API with JSON responses
- **Admin Dashboard:** View statistics and manage events
- **Audit Logging:** Track all scraping operations
- **Responsive Design:** Works on desktop, tablet, mobile

## Development

### Start Services
```bash
./restart-all.sh          # Starts API, Frontend, n8n
```

### Run Scrapers
```bash
node index.js             # Ollama scraper
PERPLEXITY_API_KEY="..." node ai-scraper.js  # Perplexity
```

### Monitor Logs
```bash
tail -f logs/api-server.log
tail -f logs/n8n.log
```

### Test API
```bash
curl http://localhost:3001/api/events?city=Beaumont
curl http://localhost:3001/api/admin/stats
```

## Configuration

- **API Port:** 3001 (configurable in api-server.js)
- **Frontend Port:** 8081-8083 (dynamic)
- **n8n Port:** 5678
- **Database:** `./database.sqlite`
- **AI Keys:** Environment variables
  - `PERPLEXITY_API_KEY` - Perplexity API
  - `OLLAMA_URL` - Ollama server URL (default: localhost:11434)

## Deployment

### Single Machine Setup
```bash
# All services run on one Linux server
Node.js API + SQLite DB + n8n + Frontend
```

### Services
1. **API Server** - Express.js (node api-server.js)
2. **Frontend** - Python HTTP server (python3 -m http.server)
3. **n8n** - Workflow engine (nohup n8n start)
4. **Optional:** Ollama - Local AI (ollama serve)

### Monitoring
- API Health: `curl http://localhost:3001/api/health`
- Admin Stats: `curl http://localhost:3001/api/admin/stats`
- Logs: `/home/sauly/setx-events/logs/`

## Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Get running in 30 seconds
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete technical reference
- **[SYSTEM_DIAGRAM.md](./SYSTEM_DIAGRAM.md)** - Visual diagrams
- **[AI-SCRAPER-GUIDE.md](./AI-SCRAPER-GUIDE.md)** - AI setup guide
- **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - Full documentation index

## Common Tasks

### View all events
```bash
curl http://localhost:3001/api/events | jq
```

### Filter by city
```bash
curl "http://localhost:3001/api/events?city=Beaumont" | jq
```

### Search events
```bash
curl "http://localhost:3001/api/events?search=jazz" | jq
```

### Add event manually
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Concert",
    "date": "2025-11-15",
    "time": "8:00 PM",
    "location": "Downtown",
    "city": "Beaumont",
    "category": "Music"
  }'
```

### Check system status
```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/admin/stats
```

## Troubleshooting

**API not responding?**
```bash
curl http://localhost:3001/api/health
ps aux | grep "node api-server"
./restart-all.sh
```

**Port already in use?**
```bash
lsof -i :3001
kill -9 <PID>
```

**Database locked?**
```bash
./restart-all.sh
```

**Scrapers not running?**
```bash
tail -f logs/n8n.log
ps aux | grep n8n
```

See **[QUICK_START.md](./QUICK_START.md)** for more troubleshooting.

## Project Statistics

- **Total Files:** 6 JavaScript files, 4+ documentation files
- **Lines of Code:** 2,333
- **Database Tables:** 4
- **API Endpoints:** 10+
- **Dependencies:** 4 direct (axios, cors, express, sqlite3)
- **Automation Scripts:** 7 shell scripts
- **Workflows:** 3 n8n configurations

## Technology Stack Summary

- **Runtime:** Node.js
- **API:** Express.js 5.1
- **Database:** SQLite 3
- **Frontend:** HTML5 + CSS3 + JavaScript
- **HTTP Client:** Axios
- **Automation:** n8n
- **AI Integration:** Perplexity API, Ollama
- **Scripting:** Bash, JavaScript
- **Server:** Python HTTP server (frontend), Express (API)

## Security Notes

Current implementation:
- CORS enabled (allows all origins)
- Parameterized SQL queries (SQL injection protected)
- No authentication required
- Public read, unrestricted write

For production:
- Add API authentication
- Implement rate limiting
- Add input validation
- Use HTTPS
- Add admin authentication

## License & Credits

Built for Southeast Texas event discovery and promotion.

## Getting Help

1. Check **[QUICK_START.md](./QUICK_START.md)** for common issues
2. Review **[ARCHITECTURE.md](./ARCHITECTURE.md)** for technical details
3. Check logs: `tail -f logs/*.log`
4. Run health check: `curl http://localhost:3001/api/health`

## Next Steps

1. Customize venue list in database
2. Add more scraping sources to n8n
3. Configure Perplexity API key for smart scraping
4. Set up Ollama for free local AI
5. Deploy to production with HTTPS
6. Add authentication for admin access

---

**Start with [QUICK_START.md](./QUICK_START.md) for setup instructions.**
