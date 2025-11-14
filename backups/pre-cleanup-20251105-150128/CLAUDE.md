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

## Key Files & Their Purpose

| File | Purpose |
|------|---------|
| `api-server.js` | Express REST API server (port 3001) with event/venue CRUD |
| `index.js` | Ollama-powered daily event scraper (free local AI) |
| `ai-scraper.js` | Perplexity API-powered smart scraper (web search-based) |
| `venue-scraper.js` | HTML/website scraper helper utilities |
| `public/index.html` | Frontend SPA - interactive calendar and event browser |
| `database.sqlite` | SQLite database file |
| `restart-all.sh` | Restarts API, frontend, and n8n services |
| `n8n-workflows/` | Automated n8n workflow definitions |
| `logs/` | Application logs (api-server.log, n8n.log, etc.) |

## Development Commands

### Start All Services
```bash
./restart-all.sh
```
Starts: API (3001), Frontend (8081), n8n (5678)

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

### Testing & Debugging

**Test API endpoints:**
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
```

**Monitor logs:**
```bash
tail -f logs/api-server.log
tail -f logs/n8n.log
```

**Check running processes:**
```bash
ps aux | grep node
ps aux | grep n8n
```

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

**API response pattern:**
```javascript
app.get('/api/route', (req, res) => {
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});
```

**Scraper pattern:**
```javascript
const venues = await getVenues();
for (const venue of venues) {
    const events = await scrapeVenue(venue);
    await postEventsToAPI(events);
}
```
