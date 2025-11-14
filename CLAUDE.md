# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SETX Events** is a full-stack Node.js event aggregation platform for Southeast Texas (Beaumont, Port Arthur, Orange). It automatically discovers, aggregates, and displays events from venue websites using multiple AI-powered scraping strategies.

**Tech Stack:**
- Backend: Express.js 5.1, Node.js
- Database: SQLite 3 with proper indexing
- Frontend: Vanilla HTML5/CSS3/JavaScript (no frameworks)
- Automation: n8n workflows, Bash scripts, Cron jobs
- AI Integration: Perplexity API, Ollama (local LLM), n8n

## High-Level Architecture

```
┌─────────────────┐
│    Browser      │
│  (localhost:    │
│   8081-8083)    │
└────────┬────────┘
         │
┌────────▼────────────────┐
│  Frontend SPA            │
│  (public/index.html)     │
│  Vanilla JS + CSS3       │
└────────┬────────────────┘
         │ HTTP
┌────────▼──────────────────┐
│   Express API             │
│   (localhost:3001)        │
│   - Event CRUD            │
│   - Filtering (city,      │
│     category, search)     │
│   - Admin stats/dashboard │
└────────┬──────────────────┘
         │ SQL
┌────────▼────────────────┐
│   SQLite Database       │
│   (database.sqlite)     │
│   4 tables:             │
│   - events              │
│   - venues              │
│   - event_sources       │
│   - scrape_log          │
└─────────────────────────┘

Scrapers (Feed Data Into API):
- n8n Workflows (daily @6am)
- Perplexity AI (smart web search)
- Ollama (local free LLM)
```

## Database Schema Quick Reference

**events** - 18+ columns: id, title, date, time, location, city, category, description, source_url, featured, created_at, updated_at, source_id, last_scraped_at, etc.

**venues** - 10+ columns: id, name, city, website, facebook_url, instagram_handle, priority (1-5), is_active, last_scraped, notes

**event_sources** - Tracks data source URLs for deduplication

**scrape_log** - Audit trail: scraper_name, scraped_items, duplicates_found, failed_venues, timestamp

**Key Deduplication:** Composite key (title, date, city) prevents duplicate events

## Directory Structure

```
/home/sauly/setx-events/
├── CORE APPLICATION FILES
│   ├── api-server.js              Express REST API server (main backend)
│   ├── index.js                   Ollama daily scraper entry point
│   ├── ai-scraper.js              Perplexity API-powered scraper
│   ├── venue-scraper.js           Intelligent venue-focused scraper
│   ├── event-validator.js         Event data validation utility
│   ├── cleanup-dates.js           Date normalization utility
│   └── delete-past-events.js      Past event cleanup script
│
├── FRONTEND APPLICATION
│   └── public/
│       ├── index.html             Main SPA with event display & filters
│       ├── venues.html            Venue management interface
│       ├── venue.html             Single venue detail page
│       ├── venue-admin.html       Venue administration interface
│       ├── dashboard.html         Event statistics dashboard
│       ├── event.html             Event detail page
│       └── images/                Venue and event image storage
│
├── AUTOMATION & SCRIPTS
│   ├── restart-all.sh             Start all services (recommended)
│   ├── daily-scrape.sh            Daily scraping job for cron
│   ├── setup-cron.sh              Configure cron jobs
│   ├── setup-n8n-workflow.sh      Setup n8n workflows
│   ├── complete-setup.sh          Full installation from scratch
│   └── n8n-workflows/             n8n workflow definitions
│
├── IMAGE PROCESSING
│   ├── add-missing-venue-images.js
│   ├── fast-venue-image-downloader.js
│   ├── create-placeholder-images.js
│   └── verify-venue-images.js
│
├── DATABASE & CONFIGURATION
│   ├── database.sqlite            SQLite database file
│   ├── package.json               NPM dependencies
│   ├── package-lock.json          Dependency lock file
│   └── backups/                   Database backup directory
│
├── LOGS & MONITORING
│   └── logs/                      Application logs (api-server.log, etc.)
│
└── DOCUMENTATION
    ├── README.md                  Project overview
    ├── CLAUDE.md                  This file (Claude Code guidance)
    ├── ARCHITECTURE.md            Detailed technical architecture
    └── SYSTEM-MAP.md              Comprehensive system documentation
```

## Key Files & Their Purpose

| File | Purpose |
|------|---------|
| `api-server.js` | Express REST API server (port 3001) with event/venue CRUD |
| `index.js` | Ollama-powered daily event scraper (free local AI) |
| `ai-scraper.js` | Perplexity API-powered smart scraper (web search-based) |
| `venue-scraper.js` | Intelligent venue-focused scraper (462 lines) |
| `public/index.html` | Main SPA - interactive calendar and event browser |
| `database.sqlite` | SQLite database file (auto-created on first run) |
| `restart-all.sh` | Restarts API, frontend, and n8n services |
| `n8n-workflows/` | Automated n8n workflow definitions |
| `logs/` | Application logs (api-server.log, n8n.log, etc.) |
| `event-validator.js` | Validates event data before insertion |
| `delete-past-events.js` | Cleanup script for expired events |

## Development Commands

### Installation

```bash
# Install all dependencies
npm install

# Then start services
./restart-all.sh
```

### Start All Services

```bash
./restart-all.sh
```

Starts: API (3001), Frontend (8081), n8n (5678). This is the recommended way to start development.

### Start Individual Services

**API Server:**
```bash
node api-server.js
# Listens on http://localhost:3001
```

**Frontend (development):**
```bash
cd public && python3 -m http.server 8081
# Open http://localhost:8081
```

**Ollama Scraper:**
```bash
# First ensure Ollama is running:
ollama serve

# In another terminal:
node index.js
```

**Perplexity Scraper:**
```bash
PERPLEXITY_API_KEY="your-key-here" node ai-scraper.js
```

**Venue Scraper:**
```bash
node venue-scraper.js
```

### Development Setup

For rapid development, run these in separate terminals:

```bash
# Terminal 1: Watch API logs
tail -f logs/api-server.log

# Terminal 2: API Server
node api-server.js

# Terminal 3: Frontend
cd public && python3 -m http.server 8081

# Terminal 4: Test loop (optional)
watch -n 5 'curl -s http://localhost:3001/api/health | jq "."'
```

### Testing & Debugging

**Manual API Testing (No automated test framework):**
```bash
# Get all events
curl http://localhost:3001/api/events

# Filter by city
curl "http://localhost:3001/api/events?city=Beaumont"

# Filter by category
curl "http://localhost:3001/api/events?category=Music"

# Search events
curl "http://localhost:3001/api/events?search=jazz"

# Get venues
curl http://localhost:3001/api/venues

# Get stats
curl http://localhost:3001/api/admin/stats

# Health check
curl http://localhost:3001/api/health

# Create a test event
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Event",
    "date": "2025-12-25",
    "time": "19:00",
    "location": "Test Venue",
    "city": "Beaumont",
    "category": "Music",
    "description": "Test"
  }'
```

**Validate Event Data:**
```bash
node event-validator.js
```

**Cleanup Past Events:**
```bash
node delete-past-events.js
```

**Monitor logs:**
```bash
tail -f logs/api-server.log
tail -f logs/n8n.log
tail -f logs/frontend.log
```

**Check running processes:**
```bash
ps aux | grep node
ps aux | grep n8n
lsof -i :3001    # Check API port
lsof -i :8081    # Check frontend port
```

### Testing Notes

**Current Status:** No automated testing framework (Jest, Mocha) is configured. Testing is manual via:
- cURL for API endpoints
- Browser DevTools for frontend
- Log inspection for debugging
- Event data validation via `event-validator.js`

### Code Quality & Linting

**Current Status:** No automated linting (ESLint, Prettier) configured. Code follows these conventions:
- Parameterized SQL queries (never string concatenation)
- Consistent error handling with `{ error: "message" }` responses
- Log operations to `scrape_log` table
- Use `const` over `var`

## Environment Variables & Configuration

**Optional Environment Variables:**

```bash
# Enable Perplexity API scraper (sign up at perplexity.ai)
PERPLEXITY_API_KEY="pplx-xxxxxxxxxxxx"

# Point to Ollama server (default: http://localhost:11434)
OLLAMA_URL="http://localhost:11434"

# API port (default: 3001)
PORT=3001
```

**External Service Dependencies:**

| Service | URL | Purpose | Required | Notes |
|---------|-----|---------|----------|-------|
| **Ollama** | localhost:11434 | Local LLM for scraping | No | Free, runs locally. Install from ollama.com |
| **n8n** | localhost:5678 | Workflow automation | No | Recommended for daily automated scraping |
| **Perplexity API** | api.perplexity.ai | Cloud AI for scraping | No | Costs ~$0.001 per query. Sign up at perplexity.ai |

## Architecture Patterns

### 1. Strategy Pattern (Scraping)
Three pluggable scrapers with different approaches:
- **n8n**: Workflow-based HTTP scraping (recommended, automatic daily)
- **Perplexity**: Web search-based AI (smart, costs ~$0.001/venue)
- **Ollama**: Local LLM-based (free, no API costs)

All three feed into the same REST API (`POST /api/events`).

### 2. Deduplication
Composite natural key: `(title, date, city)`
- Events table checks this before inserting
- Prevents duplicates when running multiple scrapers
- Configurable via `event_sources` and `scrape_log` tracking

### 3. Separation of Concerns
- **Data Layer:** SQLite with parameterized queries (SQL injection safe)
- **API Layer:** Express with CORS, JSON responses, filtering/search
- **UI Layer:** Vanilla JS frontend with client-side filtering
- **Scraper Layer:** Independent modules that call API to add events

### 4. Configuration-Driven
Environment variables control behavior:
- `PERPLEXITY_API_KEY` - Enables Perplexity scraper
- `OLLAMA_URL` - Points to local Ollama (default: localhost:11434)
- `PORT` - API port (default: 3001)

## Common Development Tasks

### Add a New API Endpoint
1. Add the route handler in `api-server.js` (follows RESTful pattern)
2. Use parameterized queries: `db.all(sql, params, callback)` not string concatenation
3. Return JSON: `res.json({ data })`
4. Test with curl

### Modify Database Schema
1. Update SQL in relevant script (e.g., `api-server.js` for table creation)
2. Note: No migrations framework; this is a small SQLite app
3. Backup `database.sqlite` before changes
4. Re-run initialization if needed

### Add New Scraping Source
1. Create module following pattern of `index.js` or `ai-scraper.js`
2. Fetch venue data from database
3. Extract events
4. POST to `http://localhost:3001/api/events` API
5. Log results to `scrape_log` table

### Update Frontend
1. Edit `public/index.html` (single file SPA)
2. Uses vanilla JS with fetch API for REST calls
3. CSS included in `<style>` tag
4. No build step required
5. Auto-reloads in browser

## Important Implementation Details

### SQL Safety
**✅ DO:** Use parameterized queries
```javascript
db.all('SELECT * FROM events WHERE city = ?', [city], callback)
```

**❌ DON'T:** String concatenation
```javascript
db.all(`SELECT * FROM events WHERE city = '${city}'`, callback) // SQL injection!
```

### Event Creation
When scraper adds events via API:
1. POST to `/api/events` with required fields
2. Server automatically checks deduplication (title, date, city)
3. Validates required fields: title, date, time, location, city, category
4. Logs operation to scrape_log

### Error Handling
- API returns `{ error: "message" }` on failure
- Check database connection before starting scrapers
- Ollama scraper exits if Ollama not running
- Perplexity scraper requires valid API key

## Database Operations

**Backup Database:**
```bash
cp database.sqlite backups/database.sqlite.backup-$(date +%Y%m%d-%H%M%S)
```

**Reset Database (clear all events, keep schema):**
```bash
# Stop API server first
pkill -f "node api-server.js"

# Delete and restart (schema recreated automatically)
rm database.sqlite
node api-server.js
```

**Query Database Directly:**
```bash
# Connect to SQLite
sqlite3 database.sqlite

# List tables
.tables

# Show schema
.schema events

# Query events
SELECT * FROM events LIMIT 5;

# Exit
.quit
```

## API Endpoints Reference

All endpoints served on `http://localhost:3001`:

**Events:**
- `GET /api/events` - List all events (supports filters: city, category, search)
- `POST /api/events` - Create new event
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

**Venues:**
- `GET /api/venues` - List all venues
- `POST /api/venues` - Create new venue
- `GET /api/venues/:id` - Get venue details
- `PUT /api/venues/:id` - Update venue

**Admin:**
- `GET /api/admin/stats` - Event statistics
- `GET /api/admin/dashboard` - Dashboard data
- `GET /api/health` - Health check

For full endpoint documentation, see `api-server.js:100+`.

## When Making Changes

**Do:**
- Test API endpoints with curl before assuming changes work
- Check logs: `tail -f logs/*.log`
- Run health check: `curl http://localhost:3001/api/health`
- Backup database before schema changes
- Use parameterized SQL queries always

**Don't:**
- String concatenate SQL queries
- Assume ports are free (check with `lsof -i :<port>`)
- Leave database locked (restart services if stuck)
- Add dependencies without updating package.json

## Deployment Notes

The app runs on a single Linux server with:
- Node.js runtime
- SQLite database
- n8n for workflow automation
- Optional: Ollama for local LLM
- Optional: Python HTTP server for frontend

All services managed by systemd/shell scripts. Database is file-based (no external DB needed).

## Documentation Structure

- **README.md** - Project overview and quick start
- **This file (CLAUDE.md)** - Developer guidance for Claude Code
- **API Endpoints** - All defined in `api-server.js:80+`
- **Database** - Schema initialization in `api-server.js:200+`

## Useful Patterns in the Codebase

**Database connection pattern:**
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbPath);
```

**API response pattern - Always use parameterized queries:**
```javascript
app.get('/api/route', (req, res) => {
    const sql = 'SELECT * FROM events WHERE city = ?';
    db.all(sql, [req.query.city], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});
```

**Error handling pattern - Return consistent JSON errors:**
```javascript
if (!requiredField) {
    return res.status(400).json({ error: 'Missing required field' });
}
```

**Scraper pattern - Log results to scrape_log:**
```javascript
const venues = await getVenues();
for (const venue of venues) {
    const events = await scrapeVenue(venue);
    await postEventsToAPI(events);
}
// Log operation to scrape_log table
```

**Frontend fetch pattern - Use the SPA approach:**
```javascript
fetch('/api/events?city=Beaumont')
    .then(res => res.json())
    .then(data => updateUI(data.data))
    .catch(err => console.error('API error:', err));
```

## Common Development Tasks

### Add a New API Endpoint
1. Add route handler in `api-server.js` (follows RESTful pattern)
2. Use parameterized queries: `db.all(sql, params, callback)` - never string concatenation
3. Return JSON: `res.json({ data })` or `res.status(500).json({ error })`
4. Test with curl before committing

### Modify Database Schema
1. Update SQL in `api-server.js` (look for CREATE TABLE statements around line 200+)
2. No migrations framework - this is a small SQLite app
3. Backup `database.sqlite` before making schema changes
4. If database already exists, delete it and restart to recreate schema: `rm database.sqlite && node api-server.js`

### Add New Scraping Source
1. Create module following pattern of `index.js` (Ollama) or `ai-scraper.js` (Perplexity)
2. Fetch venue data: `const venues = await fetch('http://localhost:3001/api/venues')`
3. Extract events from venue websites
4. POST events to API: `POST http://localhost:3001/api/events` with required fields
5. Log results to `scrape_log` table via API

### Update Frontend
1. Edit files in `public/` directory (HTML/CSS/JavaScript single files)
2. Use vanilla JS with fetch API for REST calls
3. CSS embedded in `<style>` tags
4. No build step required - refresh browser to see changes
5. All pages are static HTML that communicate with REST API

### Debug API Issues
1. Start API with logging: `node api-server.js`
2. Test endpoint: `curl http://localhost:3001/api/health`
3. Check logs: `tail -f logs/api-server.log`
4. Verify database: `sqlite3 database.sqlite ".tables"`
5. Check ports: `lsof -i :3001`

### Debug Frontend Issues
1. Open browser DevTools (F12)
2. Check Console tab for JavaScript errors
3. Check Network tab to see API requests
4. Verify API server is running: `curl http://localhost:3001/api/health`
5. Clear browser cache: `Ctrl+Shift+Delete`

## Production Deployment Notes

**Security considerations (currently not all implemented):**
- CORS currently allows all origins - restrict in production
- No authentication/authorization - add before production
- No rate limiting - add to prevent abuse
- Use HTTPS with reverse proxy (nginx, Apache)
- Set environment variables securely
- Regular database backups

**Service Management:**
- Use systemd units or supervisord to manage Node.js processes
- Monitor processes: `ps aux | grep node`
- View logs: `tail -f logs/api-server.log`
- Restart services: `./restart-all.sh`

**Database:**
- SQLite is file-based and suitable for this scale
- Regular backups to `backups/` directory
- Use `database.sqlite.before-merge` as reference backup
- Monitor disk space for database growth
