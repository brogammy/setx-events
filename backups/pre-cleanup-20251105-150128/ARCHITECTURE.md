# SETX Events - Codebase Architecture & Structure Analysis

## 1. HIGH-LEVEL ARCHITECTURE & PROJECT TYPE

**Project Type:** Full-stack Node.js Event Aggregation & Calendar Platform

This is a **Southeast Texas (SETX) Events Management System** - a web application that automatically discovers, aggregates, and displays events from multiple sources across Southeast Texas cities (Beaumont, Port Arthur, Orange).

**Architecture Pattern:** Multi-component event scraping and API system with:
- **Backend API** (Express.js REST API)
- **Data Layer** (SQLite database)
- **Frontend** (HTML/CSS/JavaScript single-page application)
- **Automation** (Multiple scraping solutions: traditional, AI-powered, and workflow-based)
- **Workflow Orchestration** (n8n automation engine)

---

## 2. KEY DIRECTORIES & THEIR PURPOSES

```
/home/sauly/setx-events/
├── api-server.js                  # Express REST API (PORT 3001)
├── index.js                       # Daily event scraper entry point
├── ai-scraper.js                  # Perplexity AI-powered scraper (197 lines)
├── venue-scraper.js               # Venue-based scraping logic (462 lines)
├── smart-venue-discovery.js       # Intelligent venue discovery (355 lines)
├── public/                        # Frontend application
│   └── index.html                 # SPA with event display, filters, admin
├── n8n-workflows/                 # n8n automation workflows
│   ├── setx-events-workflow.json  # Primary daily scraper workflow
│   ├── setx-workflow-two-merges.json # Multi-source merge workflow
│   └── setx-events-workflow-backup.json
├── database.sqlite                # SQLite event database
├── logs/                          # Application and scraper logs
├── backup*/                       # Multiple timestamped database backups
├── .sh scripts/                   # Bash automation scripts
│   ├── complete-setup.sh          # Full installation setup
│   ├── restart-all.sh             # System restart with all services
│   ├── daily-scrape.sh            # Daily automated scraping
│   ├── populate-events.sh         # Sample event population
│   ├── integrate-backup.sh        # Backup integration
│   ├── install-everything.sh      # Clean installation
│   └── start-all.sh               # Start all services
├── package.json                   # NPM dependencies
└── AI-SCRAPER-GUIDE.md           # Configuration guide for AI scraper
```

---

## 3. TECHNOLOGY STACK & FRAMEWORKS

### Backend & API
| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | Latest |
| Web Framework | Express.js | ^5.1.0 |
| Database | SQLite 3 | ^5.1.7 |
| HTTP Client | Axios | ^1.13.1 |
| CORS | cors | ^2.8.5 |

### Frontend
- **Vanilla HTML/CSS/JavaScript** (no frameworks)
- Modern CSS Grid and Flexbox
- Responsive design (mobile-friendly)
- Color-coded event categorization

### AI/ML Integration
- **Perplexity API** - Web search-based event extraction
- **Ollama** - Local LLM for free event generation
- **n8n** - Workflow automation engine

### Database Schema
- **events** table - Core event data
- **venues** table - Event venue metadata
- **event_sources** table - Source URL tracking
- **scrape_log** table - Scraping audit trail

### DevOps & Automation
- **Bash scripts** - System startup and management
- **n8n workflows** - Scheduled job orchestration
- **Cron** - Daily automated scraping (midnight)
- **Python HTTP server** - Frontend static hosting

---

## 4. MAIN ENTRY POINTS & APPLICATION FLOW

### Primary Flow Diagram
```
[Daily Trigger (6am n8n)] → [Web Scraping] → [Event Parsing] → [API Server] → [Database]
                     ↓
            [User Browser] ← [Frontend] ← [Event Display]
```

### API Server Entry Point
**File:** `/home/sauly/setx-events/api-server.js` (298 lines)
**Port:** 3001
**Base URL:** `http://100.104.226.70:3001`

```javascript
// Starts Express server on port 3001
app.listen(3001, '0.0.0.0', () => {
    console.log('SETX Events API running');
});
```

### Data Flow

#### 1. **Scraping Flow** (Automated Daily)
```
├─ Daily Trigger (n8n @ 6am)
│  ├─ Scrape Beaumont CVB (https://www.beaumontcvb.com/events/)
│  ├─ Scrape Port Arthur Events (https://visitportarthurtx.com/annual-events/)
│  └─ Scrape Orange Events (https://orangetexas.gov/499/Upcoming-Events)
│
├─ Event Parsing (JavaScript/n8n Code nodes)
│  ├─ Extract HTML patterns
│  ├─ Parse dates, titles, locations
│  └─ Validate data quality
│
├─ API POST /api/events
│  └─ Store in Database
│
└─ Duplicate Detection (by title + date + city)
```

#### 2. **API Flow** (Real-time)
```
Client Request → Express Router → Query Builder → SQLite → Response JSON

Routes:
├─ GET /                    # Documentation page
├─ GET /api/health          # Health check
├─ GET /api/events          # Filtered event list (city, category, search)
├─ GET /api/events/:id      # Single event detail
├─ POST /api/events         # Create new event
├─ PUT /api/events/:id      # Update event
├─ DELETE /api/events/:id   # Delete event
├─ GET /api/venues          # Venue list
├─ GET /api/venues/:id      # Venue with upcoming events
├─ GET /admin               # Admin dashboard HTML
└─ GET /api/admin/stats     # Statistics (events, venues, cities, categories)
```

#### 3. **Frontend Flow**
```
User Browser
    ↓
Loads /public/index.html (SPA)
    ↓
Fetch /api/events → Cache events in memory
    ↓
Display event grid with filters:
    ├─ City dropdown
    ├─ Category dropdown
    └─ Search input
    ↓
User interactions:
    ├─ Filter events → Re-render
    ├─ Search → API query
    └─ Click event card → Show details
```

---

## 5. NOTABLE DESIGN PATTERNS & ARCHITECTURAL DECISIONS

### 1. **Multiple Scraping Strategies** (Strategy Pattern)
The project implements 3 different scraping approaches:

```
Traditional Scraper
├─ n8n Workflow (Primary)
│  ├─ HTTP nodes to fetch HTML
│  ├─ Code nodes to parse patterns
│  └─ Merge nodes to combine results
│  └─ Scheduled daily @ 6am
│
├─ AI Scraper (Perplexity)
│  ├─ Web search via Perplexity API
│  ├─ Smart event extraction
│  └─ No hardcoded selectors
│
└─ Local Scraper (Ollama)
    ├─ Free, offline AI
    ├─ Generates realistic events
    └─ No API costs
```

**Why?** Different data sources need different approaches; n8n handles real websites, AI handles intelligent extraction.

### 2. **Event Deduplication** (Identity Pattern)
Events are deduplicated by composite key:
```javascript
WHERE title = ? AND date = ? AND city = ?
```
Prevents duplicate entries when scrapers run multiple times.

### 3. **Separation of Concerns**
```
├─ API Layer (api-server.js)
│  └─ HTTP routing, request validation
├─ Database Layer (SQLite)
│  └─ Persistence, querying
├─ Scraping Layer (various)
│  └─ Data extraction, transformation
└─ Frontend Layer (index.html)
   └─ UI/UX, client-side filtering
```

### 4. **Configuration Over Code**
- API key injection via environment variables
- Database path configurable
- Multiple deployment scripts for flexibility

### 5. **Logging & Audit Trail**
```sql
CREATE TABLE scrape_log (
    source TEXT,
    events_found INTEGER,
    status TEXT,
    scraped_at DATETIME
);
```
Tracks every scraping operation for monitoring and debugging.

### 6. **Venue Priority System**
```sql
CREATE TABLE venues (
    ...
    priority INTEGER DEFAULT 5,
    is_active INTEGER DEFAULT 1
);
```
Allows selective scraping: only active venues with priority > 0 are scraped.

### 7. **Composite Filtering** (Query Composition)
```javascript
// Dynamic query builder - only applies filters when provided
let query = 'SELECT * FROM events WHERE 1=1';
if (city) query += ' AND city = ?';
if (category) query += ' AND category = ?';
if (search) query += ' AND (title LIKE ? OR description LIKE ?)';
```

---

## 6. BUILD/DEVELOPMENT SETUP INFORMATION

### Dependencies Management
**File:** `package.json` (Minimal, production-focused)

```json
{
  "dependencies": {
    "axios": "^1.13.1",      // HTTP requests
    "cors": "^2.8.5",        // Cross-origin support
    "express": "^5.1.0",     // Web framework
    "sqlite3": "^5.1.7"      // Database driver
  }
}
```

### Installation & Setup

#### Option 1: Complete Automatic Setup
```bash
chmod +x ~/setx-events/complete-setup.sh
~/setx-events/complete-setup.sh
```

#### Option 2: Manual Setup
```bash
cd ~/setx-events
npm install
node api-server.js &              # API on port 3001
cd public && python3 -m http.server 8080 &  # Frontend on port 8080
```

#### Option 3: Full System (with n8n)
```bash
~/setx-events/restart-all.sh
# Starts:
# - API Server (port 3001)
# - Frontend (dynamic port 8081-8083)
# - n8n Workflows (port 5678)
```

### Database Initialization

The database is pre-initialized with schema including:
- **events** table with 18 columns
- **venues** table with venue metadata
- **event_sources** table for URL tracking
- Indexes on city, date, category for performance

### Automated Scraping Setup

#### Via n8n (Recommended)
- **Trigger:** Daily at 6am UTC
- **Nodes:** HTTP requests + Code parsing + Merge operations
- **Sources:** Beaumont CVB, Port Arthur, Orange

#### Via Cron Jobs
```bash
# Add to crontab
0 0 * * * cd ~/setx-events && node index.js >> logs/daily.log 2>&1
0 0 * * * cd ~/setx-events && PERPLEXITY_API_KEY="key" node ai-scraper.js >> logs/ai.log 2>&1
```

#### Via Shell Scripts
```bash
./daily-scrape.sh    # Manual daily scrape
./restart-all.sh     # Full system restart
./populate-events.sh # Seed test data
```

### Environment Configuration

**API Server** (api-server.js):
```javascript
const PORT = 3001;
const dbPath = path.join(__dirname, 'database.sqlite');
```

**AI Scraper** (ai-scraper.js):
```javascript
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'YOUR_API_KEY_HERE';
const API_URL = 'http://localhost:3001/api/events';
```

**Ollama Scraper** (index.js):
```javascript
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
```

### Development Workflow

1. **Start Services:**
   ```bash
   ./restart-all.sh
   ```

2. **Monitor API:**
   ```bash
   curl http://localhost:3001/api/health
   tail -f logs/api-server.log
   ```

3. **Test Scraping:**
   ```bash
   node ai-scraper.js
   node index.js
   ```

4. **Access Admin:**
   ```bash
   http://100.104.226.70:3001/admin
   http://localhost:5678  # n8n workflows
   ```

5. **View Logs:**
   ```bash
   tail -f logs/*.log
   ```

### Configuration Files

| File | Purpose | Edit Method |
|------|---------|------------|
| `package.json` | Dependencies | npm install |
| `database.sqlite` | Data persistence | SQL or API |
| `.env` (implicit) | API keys | Environment variable |
| `n8n-workflows/*.json` | Automation | n8n UI |
| `api-server.js` | API config | Direct edit |
| `ai-scraper.js` | AI config | Environment variable or direct edit |

---

## 7. PROJECT STATISTICS

| Metric | Value |
|--------|-------|
| Total JavaScript Files | 6 |
| Total Lines of Code | 2,333 |
| Database Tables | 4 |
| API Endpoints | 10+ |
| NPM Dependencies | 4 Direct (100+ transitive) |
| Backup Directories | 5 |
| Shell Scripts | 7 |
| n8n Workflows | 3 |

---

## 8. QUICK REFERENCE: KEY COMPONENTS

### API Server (298 lines)
- Express.js HTTP API
- SQLite integration
- CORS-enabled
- RESTful event/venue endpoints
- Admin statistics endpoint

### AI Scraper (197 lines)
- Perplexity API integration
- Intelligent event extraction
- Duplicate detection
- Event validation logic

### Index.js - Ollama Scraper (220 lines)
- Local LLM integration
- Category-aware prompt engineering
- Free event generation
- Date validation (past 90 days)

### Venue Scraper (462 lines)
- Comprehensive venue management
- Web scraping logic
- Priority-based filtering
- Event linking

### Frontend (index.html - 19.3 KB)
- Modern, responsive event calendar
- Filter by city, category, search
- Event card grid layout
- Admin dashboard integration

### n8n Workflows
- Daily scheduled scraping
- Multi-source HTTP requests
- HTML parsing with JavaScript
- Merge operations for combining data

---

## 9. DATA FLOW EXAMPLES

### Example: User Searches for Jazz Events in Beaumont

```
1. User loads http://100.104.226.70:8081
2. Frontend loads index.html
3. JavaScript fetches GET /api/events
4. Express queries: "SELECT * FROM events WHERE 1=1 ORDER BY date ASC"
5. Database returns all events
6. Frontend filters locally by:
   - city = "Beaumont"
   - category = "Music Venue" or similar
   - title LIKE "%Jazz%"
7. Results displayed in event cards with:
   - Title, Date, Time
   - Location, City
   - Description, Category
   - Source URL, Ticket link
```

### Example: Automated Daily Scrape at 6am

```
1. n8n trigger fires at 6:00 UTC
2. Node: HTTP GET https://www.beaumontcvb.com/events/
3. Node: JavaScript parse HTML → extract events → JSON array
4. Repeat for Port Arthur and Orange
5. Node: Merge combine all 3 sources
6. Node: HTTP POST to http://localhost:3001/api/events
7. API route: POST /api/events processes each event
8. Before INSERT: Check if duplicate (title + date + city)
9. If new: INSERT INTO events (...) VALUES (...)
10. Database logs scrape in scrape_log table
11. Response: { id: X, message: 'Event created successfully' }
```

---

## 10. DEPLOYMENT TOPOLOGY

```
                    ┌─────────────────────┐
                    │   User Browser      │
                    │  (8081-8083:HTTP)   │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
         ┌──────▼─────┐  ┌─────▼──────┐  ┌───▼────────┐
         │  Frontend  │  │  API Server│  │ n8n Admin  │
         │  (HTML/JS) │  │ (3001:REST)│  │ (5678)     │
         │ (Port 8081)│  │            │  │            │
         └────────────┘  └─────┬──────┘  └────────────┘
                               │
                               │ SQLite Queries
                               │
                        ┌──────▼──────┐
                        │  SQLite DB  │
                        │database.sqlite
                        └─────────────┘
                        
                  ┌─────────────────────────────┐
                  │  Scheduled Scrapers (6am)   │
                  ├─────────────────────────────┤
                  │  ├─ n8n Workflows           │
                  │  ├─ Cron Jobs               │
                  │  ├─ AI Scrapers (Perplexity)│
                  │  └─ Local Scrapers (Ollama) │
                  └─────────────────────────────┘
                        │
                        │ HTTP POST /api/events
                        │
                        └─► API Server → Database
```

---

## 11. SECURITY CONSIDERATIONS

### Current Implementation
- **CORS enabled** - Allow cross-origin requests
- **No authentication** - Public read, unrestricted write
- **No input validation** - Assumes clean data from trusted sources
- **Database parameterized queries** - Prevents SQL injection

### Recommendations
1. Add API key authentication to POST/DELETE routes
2. Implement rate limiting
3. Add input validation for event fields
4. Use HTTPS in production
5. Add admin authentication for dashboard
6. Implement CSRF protection

---

## 12. MONITORING & MAINTENANCE

### Logs Directory
```bash
logs/
├── api-server.log        # API request logs
├── n8n.log              # Workflow execution logs
├── frontend.log         # Frontend server logs
├── daily.log            # Daily scraper logs
└── ai-scrape.log        # AI scraper logs
```

### Health Checks
```bash
curl http://localhost:3001/api/health
# Response: { status: 'ok', timestamp: '...', database: 'connected' }

curl http://localhost:3001/api/admin/stats
# Response: { totalEvents, upcomingEvents, activeVenues, eventsByCity, ... }
```

### Backup Strategy
5 timestamped backups are automatically created:
```
database.sqlite.before-merge
backup/
backup_20251101_085906/
backup_20251101_090149/
backup_20251101_090359/
backup_20251101_090653/
```

---

## SUMMARY

**SETX Events** is a **production-ready event aggregation platform** with:
- Multi-source intelligent scraping
- RESTful API for data access
- Modern responsive frontend
- Automated workflow orchestration
- Comprehensive database with audit logging
- Easy deployment with shell scripts

The architecture emphasizes **flexibility** (3 scraping strategies), **reliability** (deduplication, logging), and **usability** (web UI, public API, admin dashboard).

Ideal for Southeast Texas event discovery and promotion.
