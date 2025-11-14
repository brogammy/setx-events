# SETX Events - System Architecture Diagrams

## 1. HIGH-LEVEL SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SETX EVENTS SYSTEM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    USERS/BROWSERS                            │   │
│  │  (Access via http://100.104.226.70:8081)                    │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
│                           │                                           │
│         ┌─────────────────┼─────────────────┐                        │
│         │                 │                 │                        │
│  ┌──────▼──────┐   ┌─────▼──────┐   ┌──────▼───────┐                │
│  │   Frontend  │   │  API Server│   │   n8n Admin  │                │
│  │  (SPA HTML) │   │ (3001:REST)│   │   (5678)     │                │
│  │  (Port 8081)│   │            │   │              │                │
│  └─────────────┘   └─────┬──────┘   └──────────────┘                │
│                          │                                            │
│         ┌────────────────┼──────────────────┐                        │
│         │                │                  │                        │
│  ┌──────▼──────┐  ┌──────▼─────┐  ┌────────▼────────┐               │
│  │  GET events │  │  POST/PUT  │  │  GET stats      │               │
│  │  GET venues │  │  DELETE    │  │  GET admin      │               │
│  └─────────────┘  └────────────┘  └─────────────────┘               │
│         │                │                  │                        │
│         └────────────────┼──────────────────┘                        │
│                          │                                            │
│                          │ SQL Queries                                │
│                   ┌──────▼──────┐                                    │
│                   │   SQLite    │                                    │
│                   │  Database   │                                    │
│                   │             │                                    │
│                   │ - events    │                                    │
│                   │ - venues    │                                    │
│                   │ - sources   │                                    │
│                   │ - logs      │                                    │
│                   └─────────────┘                                    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           AUTOMATED DATA COLLECTION (Nightly)              │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │   │
│  │  │  n8n Job │  │Perplexity│  │ Ollama   │  │  Manual    │ │   │
│  │  │(6am cron)│  │AI Scraper│  │ Scraper  │  │   Run      │ │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬─────┘ │   │
│  │       │              │              │               │         │   │
│  │  ┌────▼─────────────▼──────────────▼───────────────▼────┐   │   │
│  │  │      Extract Events from Multiple Sources          │   │   │
│  │  │                                                     │   │   │
│  │  │  - Beaumont CVB events page                        │   │   │
│  │  │  - Port Arthur tourism website                     │   │   │
│  │  │  - Orange city events                              │   │   │
│  │  │  - Web search via Perplexity                       │   │   │
│  │  │  - AI generation via Ollama                        │   │   │
│  │  └────┬──────────────────────────────────────────────┘   │   │
│  │       │                                                     │   │
│  │  ┌────▼──────────────────────────────────────────┐        │   │
│  │  │  Validate & Parse Event Data                 │        │   │
│  │  │  - Check for duplicates                      │        │   │
│  │  │  - Validate dates (future events only)       │        │   │
│  │  │  - Extract title, date, time, location       │        │   │
│  │  └────┬─────────────────────────────────────────┘        │   │
│  │       │                                                     │   │
│  │  ┌────▼──────────────────────────────────────────┐        │   │
│  │  │  POST to API /api/events                      │        │   │
│  │  │  (Create new event in database)               │        │   │
│  │  └────────────────────────────────────────────────┘        │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. DATA FLOW - USER EVENT SEARCH

```
User in Browser
   │
   │ "Show me Jazz events in Beaumont"
   │
   ├─→ Select City Dropdown: "Beaumont"
   ├─→ Select Category Dropdown: "Music"
   └─→ Type in Search: "Jazz"
   │
   ▼
Frontend JavaScript
   │
   ├─→ Fetch /api/events?city=Beaumont&category=Music&search=Jazz
   │
   ▼
Express API Server
   │
   ├─→ Route: GET /api/events
   │
   ├─→ Build Dynamic SQL:
   │   SELECT * FROM events
   │   WHERE 1=1
   │     AND city = ?
   │     AND category = ?
   │     AND (title LIKE ? OR description LIKE ?)
   │   ORDER BY date ASC
   │
   ├─→ Bind Parameters: ["Beaumont", "Music", "%Jazz%", "%Jazz%", "%Jazz%"]
   │
   ▼
SQLite Database
   │
   ├─→ Execute Query
   │   Index on: events(city) ✓ FAST
   │
   ├─→ Return Matching Events:
   │   [
   │     {
   │       "id": 42,
   │       "title": "Jazz Night at The Logon",
   │       "date": "2025-11-08",
   │       "time": "8:00 PM",
   │       "location": "The Logon Cafe",
   │       "city": "Beaumont",
   │       "category": "Music Venue",
   │       "description": "Live jazz performance",
   │       "source_url": "..."
   │     },
   │     { ... more events ... }
   │   ]
   │
   ▼
Express API
   │
   ├─→ Convert to JSON
   ├─→ Add CORS headers
   └─→ Send Response (200 OK)
   │
   ▼
Frontend JavaScript
   │
   ├─→ Parse JSON Response
   ├─→ Filter locally if needed (already filtered)
   ├─→ Render Event Cards in Grid
   │   ┌────────────────────┐
   │   │ Jazz Night         │ ← Clicking opens details
   │   │ Nov 8 @ 8:00 PM    │
   │   │ The Logon Cafe     │
   │   │ Beaumont           │
   │   └────────────────────┘
   │
   ▼
User Sees Results on Screen
```

---

## 3. DATA FLOW - AUTOMATED SCRAPING (Daily 6am)

```
┌─────────────────────────────────────────────────────────────────┐
│                 DAILY SCHEDULED EVENT (6am)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                  n8n Workflow Trigger
                  (cron: 0 6 * * *)
                           │
                ┌──────────┬──────────┬──────────┐
                │          │          │          │
                ▼          ▼          ▼          ▼
          ┌──────────┐┌──────────┐┌──────────┐┌──────────┐
          │ HTTP GET ││ HTTP GET ││ HTTP GET ││Parse All │
          │Beaumont ││ Port Art ││ Orange   ││Results   │
          │CVB HTML  ││Events    ││Events    ││(Merge)   │
          └──────────┘└──────────┘└──────────┘└──────────┘
                │          │          │          │
                └──────────┴──────────┴──────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Parse HTML  │ (JavaScript code in n8n)
                    │ Extract     │
                    │ Events      │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Merge All  │
                    │  Events     │
                    │  (3 sources)│
                    └──────┬──────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ For Each     │
                    │ Event {      │
                    │  title       │
                    │  date        │
                    │  location    │
                    │  city        │
                    │  category    │
                    │}             │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ HTTP POST    │
                    │ to /api/     │
                    │ events       │
                    └──────┬───────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Express API     │
                  │                 │
                  │ POST /api/events│
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Check for       │
                  │ Duplicate       │
                  │                 │
                  │ SELECT id FROM  │
                  │ events WHERE    │
                  │ title=? AND     │
                  │ date=? AND      │
                  │ city=?          │
                  └────────┬────────┘
                           │
                    ┌──────┴───────┐
                    │ No  │ Yes    │
                    │     │ Dup?   │
                    │     │        │
      ┌─────────────▼┐    │    ┌──▼──────────┐
      │ INSERT INTO  │    │    │ SKIP        │
      │ events       │    │    │ (Already    │
      │ (New event)  │    │    │  have it)   │
      └──────┬───────┘    │    └──────┬──────┘
             │            │           │
             └────────────┬───────────┘
                          │
                          ▼
                  ┌─────────────────┐
                  │ Log in          │
                  │ scrape_log      │
                  │ (Audit trail)   │
                  └─────────────────┘
                          │
                          ▼
                ┌───────────────────┐
                │ Workflow Complete │
                │ (Events now in DB)│
                └───────────────────┘
                          │
                          ▼
        User loads app and sees new events!
```

---

## 4. COMPONENT INTERACTIONS

```
┌──────────────┐
│  Browser     │ ◄──HTML/CSS/JS──► ┌──────────────┐
│  (8081)      │                   │ Frontend     │
│              │                   │ (index.html) │
└──────┬───────┘                   └──────────────┘
       │
       │ (HTTP REST calls)
       │
       ▼
┌──────────────────────────────────────────────┐
│         Express API Server (3001)            │
├──────────────────────────────────────────────┤
│                                              │
│  Route Handlers:                             │
│  ├─ GET /api/events                          │
│  ├─ POST /api/events                         │
│  ├─ PUT /api/events/:id                      │
│  ├─ DELETE /api/events/:id                   │
│  ├─ GET /api/venues                          │
│  ├─ GET /api/admin/stats                     │
│  └─ GET /admin (HTML dashboard)              │
│                                              │
│  Middleware:                                 │
│  ├─ CORS headers                             │
│  ├─ JSON parser                              │
│  └─ URLencoded parser                        │
│                                              │
└──────────────┬───────────────────────────────┘
               │ (SQL queries)
               │
               ▼
         ┌──────────────┐
         │   SQLite     │
         │  Database    │
         │              │
         │ Tables:      │
         │ ├─ events    │
         │ ├─ venues    │
         │ ├─ sources   │
         │ └─ logs      │
         └──────────────┘
               ▲
               │ (SQL queries)
               │
         ┌─────┴──────┬──────────┬──────────┐
         │            │          │          │
         ▼            ▼          ▼          ▼
    ┌────────┐  ┌──────────┐┌────────┐┌──────────┐
    │  n8n   │  │Perplexity││ Ollama ││ Manual   │
    │Workflow│  │AI        ││        ││ Scripts  │
    │        │  │Scraper   ││Scraper ││          │
    └────────┘  └──────────┘└────────┘└──────────┘
       (6am)         (Any)       (Any)    (Any)
       auto         time        time      time
```

---

## 5. DATABASE SCHEMA RELATIONSHIPS

```
┌──────────────────────────────────┐
│         VENUES TABLE             │
├──────────────────────────────────┤
│ id (PK)                          │
│ name                             │
│ city         ◄──── INDEX ────┐   │
│ category                      │   │
│ website                       │   │
│ facebook_url                  │   │
│ is_active                     │   │
│ priority                      │   │
└──────────────────────────────────┘
         │
         │ 1:Many
         │ (venue has many events)
         │
         ▼
┌──────────────────────────────────┐
│         EVENTS TABLE             │
├──────────────────────────────────┤
│ id (PK)                          │
│ title                            │
│ date          ◄──── INDEX ────┐  │
│ time                           │  │
│ location                       │  │
│ city          ◄──── INDEX ────┐  │
│ category      ◄──── INDEX ────┐  │
│ description                    │  │
│ source_url                     │  │
│ featured                       │  │
│ venue_id (FK to venues.id)     │  │
│ created_at                     │  │
└──────────────────────────────────┘

Queries Use These Indexes:
  - WHERE city = ?        ✓ Fast
  - WHERE date >= ?       ✓ Fast
  - WHERE category = ?    ✓ Fast
  - WHERE title LIKE ?    ✗ Slow (full table scan)

Composite Index (future optimization):
  - (city, date, category)
```

---

## 6. DEPLOYMENT & RUNNING SERVICES

```
┌────────────────────────────────────────────────────────┐
│           Linux Server (Single Machine)                │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Process 1: API Server                                │
│  ┌─────────────────────────────────────┐              │
│  │ node /home/sauly/setx-events/       │              │
│  │      api-server.js                  │              │
│  │                                     │              │
│  │ Listen: 0.0.0.0:3001                │              │
│  │ DB: /home/sauly/setx-events/        │              │
│  │     database.sqlite                 │              │
│  └─────────────────────────────────────┘              │
│                                                        │
│  Process 2: Frontend Server                           │
│  ┌─────────────────────────────────────┐              │
│  │ python3 -m http.server 8081         │              │
│  │                                     │              │
│  │ Serve: /home/sauly/setx-events/     │              │
│  │        public/                      │              │
│  │ Listen: 0.0.0.0:8081                │              │
│  └─────────────────────────────────────┘              │
│                                                        │
│  Process 3: n8n Automation                            │
│  ┌─────────────────────────────────────┐              │
│  │ nohup n8n start                     │              │
│  │                                     │              │
│  │ Listen: http://localhost:5678       │              │
│  │ Workflows stored in:                │              │
│  │ ~/.n8n/nodes/                       │              │
│  └─────────────────────────────────────┘              │
│                                                        │
│  Cron Jobs (Optional)                                 │
│  ┌─────────────────────────────────────┐              │
│  │ 0 0 * * * node index.js             │              │
│  │           >> logs/daily.log         │              │
│  │                                     │              │
│  │ 0 0 * * * PERPLEXITY_API_KEY=...   │              │
│  │           node ai-scraper.js        │              │
│  │           >> logs/ai.log            │              │
│  └─────────────────────────────────────┘              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 7. REQUEST/RESPONSE CYCLE

```
CLIENT REQUEST
     │
     ▼
GET /api/events?city=Beaumont
     │
     ▼ HTTP Network
     │
┌────────────────────────┐
│  Express Middleware    │
├────────────────────────┤
│ 1. Parse URL           │
│ 2. Extract Query Params│
│    city = "Beaumont"   │
│ 3. CORS Headers        │
│ 4. JSON Parser         │
└────────┬───────────────┘
         │
         ▼
     ┌─────────────────────┐
     │ Route Handler       │
     │ app.get('/api/...')│
     └────────┬────────────┘
              │
              ▼
     ┌──────────────────────┐
     │ Build SQL Query      │
     │                      │
     │ query = "SELECT *    │
     │ FROM events          │
     │ WHERE 1=1"           │
     │                      │
     │ if (city) {          │
     │   query += " AND     │
     │   city = ?"          │
     │   params = ["..."]   │
     │ }                    │
     └────────┬─────────────┘
              │
              ▼
     ┌──────────────────────┐
     │ Execute Query        │
     │ db.all(query,        │
     │   params, callback)  │
     └────────┬─────────────┘
              │
              ▼
          Database
          (SQLite)
          Returns rows
              │
              ▼
     ┌──────────────────────┐
     │ Callback with        │
     │ Results              │
     │ [                    │
     │   { id: 1, ... },    │
     │   { id: 2, ... }     │
     │ ]                    │
     └────────┬─────────────┘
              │
              ▼
     ┌──────────────────────┐
     │ JSON Response        │
     │ res.json(rows)       │
     │                      │
     │ Headers:             │
     │ Content-Type: json   │
     │ Access-Control-*     │
     └────────┬─────────────┘
              │
              ▼ HTTP Network
              │
         ┌────▼──────┐
         │ 200 OK    │
         │ [...]     │
         └────┬──────┘
              │
              ▼
        Frontend JS
        Receives data
        Renders to DOM
              │
              ▼
        User Sees Results
```

---

## 8. TYPICAL DEVELOPMENT DAY

```
Morning
  │
  ├─ Developer starts work
  │
  ├─ Run: ./restart-all.sh
  │    │
  │    ├─ Stops old services
  │    ├─ Starts API (3001)
  │    ├─ Starts Frontend (8081)
  │    └─ Starts n8n (5678)
  │
  ├─ Opens logs in terminals
  │    ├─ tail -f logs/api-server.log
  │    ├─ tail -f logs/n8n.log
  │    └─ tail -f logs/frontend.log
  │
  └─ Makes code changes
       │
       ├─ Edit api-server.js
       │
       ├─ Restart API:
       │  └─ pkill -f "node api-server.js"
       │  └─ node api-server.js > logs/api-server.log 2>&1 &
       │
       ├─ Test with curl
       │  └─ curl http://localhost:3001/api/events
       │
       └─ Check logs for errors

Noon
  │
  ├─ Run tests/manual scraping
  │    │
  │    ├─ node ai-scraper.js
  │    │ or
  │    └─ node index.js
  │
  ├─ Monitor events being added
  │    └─ curl http://localhost:3001/api/admin/stats
  │
  └─ Check frontend in browser
       └─ http://100.104.226.70:8081

Afternoon
  │
  ├─ Update database schema if needed
  │    └─ Edit database.sqlite directly or via SQL
  │
  ├─ Add new scraping sources
  │    └─ Edit n8n workflows (http://localhost:5678)
  │
  └─ Test full system
       │
       ├─ Manually trigger scraper
       ├─ Verify events appear in DB
       ├─ Check frontend shows them
       └─ View admin stats

End of Day
  │
  ├─ Check logs for errors
  │    └─ grep -i "error" logs/*.log
  │
  ├─ Verify services still running
  │    └─ curl http://localhost:3001/api/health
  │
  └─ Clean shutdown (optional)
       └─ ./restart-all.sh (will stop then start again)
```

---

## Summary

This system is designed as:
- **Modular**: Each component (API, Frontend, Scrapers) can run independently
- **Automated**: Daily scraping runs without manual intervention
- **Scalable**: Can add more venues and scraping sources
- **Reliable**: Duplicate detection, audit logging, error handling
- **Observable**: Comprehensive logging and health checks

