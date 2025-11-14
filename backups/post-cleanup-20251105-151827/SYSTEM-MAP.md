# SETX Events - Complete System Map

## Visual System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   USER FACING COMPONENTS                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────┐     ┌─────────────────────────────┐                       │
│  │        BROWSER              │     │      ADMIN DASHBOARD        │                       │
│  │  http://100.104.226.70:8081 │◄───►│  http://100.104.226.70:3001 │                       │
│  │                             │     │        /admin               │                       │
│  │  ┌──────────────────────┐   │     │                             │                       │
│  │  │  PUBLIC FRONTEND     │   │     │  ┌──────────────────────┐   │                       │
│  │  │  (index.html)        │   │     │  │  ADMIN INTERFACE     │   │                       │
│  │  │  - Event Display     │   │     │  │  - Stats Dashboard   │   │                       │
│  │  │  - City/Category     │   │     │  │  - Data Management   │   │                       │
│  │  │    Filters           │   │     │  │  - Monitoring        │   │                       │
│  │  │  - Search            │   │     │  │  - Diagnostics       │   │                       │
│  │  │  - Responsive Design │   │     │  └──────────────────────┘   │                       │
│  │  └──────────────────────┘   │     └─────────────────────────────┘                       │
│  └─────────────────────────────┘                                                             │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                        │         │
                                        ▼         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CORE SERVICES                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                    API SERVER                                         │   │
│  │                              (api-server.js:3001)                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                            EXPRESS ROUTES                                       │   │   │
│  │  │                                                                                 │   │   │
│  │  │  GET /api/events        ◄──┐ Fetch events with filtering                       │   │   │
│  │  │  POST /api/events        ──┤ Create new events                                 │   │   │
│  │  │  DELETE /api/events/:id  ──┤ Delete events                                     │   │   │
│  │  │  GET /api/venues         ──┤ Get venues data                                   │   │   │
│  │  │  GET /api/admin/stats    ──┤ System statistics                                 │   │   │
│  │  │  GET /api/health         ──┤ Health check endpoint                             │   │   │
│  │  │  GET /                   ──┤ API documentation                                 │   │   │
│  │  │  GET /admin              ──┤ Admin dashboard                                   │   │   │
│  │  │  GET /venues             ──┤ Venues interface                                  │   │   │
│  │  │                                                                                 │   │   │
│  │  └─────────────────────────┬─────────────────────────────────────────────────────────┘   │   │
│  │                            │                                                             │   │
│  │                            ▼                                                             │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                         DATABASE                                                    │   │   │
│  │  │                   (database.sqlite)                                                 │   │   │
│  │  │  ┌─────────────────────────────────────────────────────────────────────────────┐   │   │   │
│  │  │  │ TABLES:                                                                     │   │   │   │
│  │  │  │  events           - Event data (title, date, location, etc.)              │   │   │   │
│  │  │  │  venues           - Venue information (name, website, priority)           │   │   │   │
│  │  │  │  event_sources    - Source tracking for deduplication                     │   │   │   │
│  │  │  │  scrape_log       - Audit trail of scraping operations                    │   │   │   │
│  │  │  └─────────────────────────────────────────────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                AUTOMATED DATA COLLECTION                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  LOCAL AGENTS (Doing Work)                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                       n8n WORKFLOW ORCHESTRATOR                                      │   │
│  │                    (Workflow: setx-events-workflow.json)                             │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                              SCHEDULER                                          │   │   │
│  │  │                            Daily at 6am                                          │   │   │
│  │  │                                                                                 │   │   │
│  │  │  HTTP Requests → Parse HTML → Merge Results → POST to API                       │   │   │
│  │  │                                                                                 │   │   │
│  │  │  ┌───────────────────┐   ┌───────────────────┐   ┌────────────────────┐         │   │   │
│  │  │  │  Beaumont CVB     │   │ Port Arthur Events│   │  Orange Events     │         │   │   │
│  │  │  │  (HTML Scraping)  │   │  (HTML Scraping)  │   │  (HTML Scraping)   │         │   │   │
│  │  │  └─────────┬─────────┘   └─────────┬─────────┘   └──────────┬─────────┘         │   │   │
│  │  │            │                       │                        │                   │   │   │
│  │  │            ▼                       ▼                        ▼                   │   │   │
│  │  │  ┌───────────────────┐   ┌───────────────────┐   ┌────────────────────┐         │   │   │
│  │  │  │  Parse Events     │   │ Parse Events      │   │  Parse Events      │         │   │   │
│  │  │  └─────────┬─────────┘   └─────────┬─────────┘   └──────────┬─────────┘         │   │   │
│  │  │            │                       │                        │                   │   │   │
│  │  │            └───────────────────────┼────────────────────────┘                   │   │   │
│  │  │                                    ▼                                            │   │   │
│  │  │  ┌─────────────────────────────────────────────────────────────────────────────┐ │   │   │
│  │  │  │                          MERGE EVENTS                                       │ │   │   │
│  │  │  └─────────────────────────────────┬───────────────────────────────────────────┘ │   │   │
│  │  │                                    ▼                                             │   │   │
│  │  │  ┌─────────────────────────────────────────────────────────────────────────────┐ │   │   │
│  │  │  │                     SAVE TO DATABASE                                        │ │   │   │
│  │  │  │                   POST /api/events                                          │ │   │   │
│  │  │  └─────────────────────────────────────────────────────────────────────────────┘ │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  LOCAL AGENTS (Free Alternative)                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                   OLLAMA LOCAL SCRAPING AGENT                                        │   │
│  │                          (index.js)                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                         ON-DEMAND SCRAPER                                       │   │   │
│  │  │                                                                                 │   │   │
│  │  │  - Free (no API costs)                                                          │   │   │
│  │  │  - Uses local LLM                                                               │   │   │
│  │  │  - Limited intelligence                                                         │   │   │
│  │  │  - Can be triggered manually                                                    │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  CLOUD AGENTS (Thinking Work)                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                 PERPLEXITY AI VALIDATION AGENT                                       │   │
│  │                        (ai-scraper.js + event-validator.js)                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                         INTELLIGENT VALIDATION                                  │   │   │
│  │  │                                                                                 │   │   │
│  │  │  - Event validation and enrichment                                              │   │   │
│  │  │  - Spam detection                                                               │   │   │
│  │  │  - Price estimation                                                             │   │   │
│  │  │  - Age restriction assignment                                                   │   │   │
│  │  │  - Image URL generation                                                         │   │   │
│  │  │  - Description enhancement                                                      │   │   │
│  │  │  - Low cost ($0.003/venue)                                                      │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              VENUE DISCOVERY AGENTS                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  LOCAL AGENTS                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                 SMART VENUE DISCOVERY AGENT                                          │   │
│  │                     (smart-venue-discovery.js)                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                         VENUE EXPANSION                                         │   │   │
│  │  │                                                                                 │   │   │
│  │  │  - Research new venues in SETX region                                           │   │   │
│  │  │  - Discover event sources for venues                                            │   │   │
│  │  │  - Minimal reliance on aggregators                                              │   │   │
│  │  │  - Local processing                                                             │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  CLOUD AGENTS                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                 PERPLEXITY VENUE DISCOVERY                                           │   │
│  │             (perplexity-venue-discovery.js)                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                         INTELLIGENT VENUE RESEARCH                              │   │   │
│  │  │                                                                                 │   │   │
│  │  │  - Web search for new venues                                                    │   │   │
│  │  │  - Discover event sources                                                       │   │   │
│  │  │  - Validate venue legitimacy                                                    │   │   │
│  │  │  - Find venue websites/social media                                             │   │   │
│  │  │  - Research venue details                                                       │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                DATA FLOW SUMMARY                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  1. DATA COLLECTION PIPELINE                                                                │
│     │                                                                                        │
│     ├── n8n (Daily @ 6am) → HTML Scraping → Event Extraction → API                         │
│     ├── Ollama (Manual) → Local LLM Processing → API                                       │
│     └── Perplexity (Validation) → Event Enrichment → API                                   │
│                                                                                             │
│  2. DATA ENRICHMENT FLOW                                                                    │
│     │                                                                                        │
│     └── Raw Events → Perplexity Validator → Enriched Events → Database                     │
│                                                                                             │
│  3. VENUE DISCOVERY FLOW                                                                    │
│     │                                                                                        │
│     ├── Smart Search (Local) → New Venues Found → Database                                 │
│     └── Perplexity Research (Cloud) → New Venues → Database                                │
│                                                                                             │
│  4. USER ACCESS                                                                              │
│     │                                                                                        │
│     ├── Public Website ← Database                                                          │
│     └── Admin Dashboard ← Database                                                         │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT RESPONSIBILITIES                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  LOCAL AGENTS (Doing Work - n8n, Ollama)                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Actions:                                                                            │   │
│  │  - Scrape venue websites                                                             │   │
│  │  - Parse HTML to extract raw events                                                  │   │
│  │  - Orchestrate scraping workflows                                                    │   │
│  │  - POST events to API for storage                                                    │   │
│  │  - Update venue last_scraped timestamps                                              │   │
│  │  - Handle errors and retries                                                         │   │
│  │  - Schedule daily operations                                                         │   │
│  │  - Archive old events                                                                │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  CLOUD AGENTS (Thinking Work - Perplexity)                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Actions:                                                                            │   │
│  │  - Validate raw events                                                               │   │
│  │  - Detect spam/invalid events                                                        │   │
│  │  - Estimate missing prices                                                           │   │
│  │  - Assign age restrictions                                                           │   │
│  │  - Find event images                                                                 │   │
│  │  - Enhance descriptions                                                              │   │
│  │  - Learn from memory examples                                                        │   │
│  │  - Venue discovery and research                                                      │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  USER AGENTS (Monitoring & Management)                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Actions:                                                                            │   │
│  │  - Monitor dashboard for system health                                               │   │
│  │  - View analytics and statistics                                                     │   │
│  │  - Manage event data (delete, update)                                                │   │
│  │  - Trigger manual scraping runs                                                      │   │
│  │  - View API data directly                                                            │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Agent Activation Timeline

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                             DAILY OPERATION SCHEDULE                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Midnight (00:00)                                                                           │
│  │                                                                                          │
│  │  Ollama Scraper - Optional manual run (index.js)                                         │
│  │  └── Triggered by admin for specific venue research                                      │
│                                                                                             │
│  6:00 AM (06:00)                                                                            │
│  │                                                                                          │
│  │  n8n Workflow - Automatic daily scrape                                                   │
│  │  ├── Scrape Beaumont CVB website                                                         │
│  │  ├── Scrape Port Arthur events                                                           │
│  │  ├── Scrape Orange events                                                                │
│  │  ├── Parse all HTML and extract events                                                   │
│  │  ├── Merge all extracted events                                                          │
│  │  └── POST to API server                                                                  │
│  │      └── Perplexity Validator enriches events before storage                              │
│                                                                                             │
│  Throughout Day                                                                             │
│  │                                                                                          │
│  │  User Access                                                                             │
│  │  ├── Public website visitors viewing events                                             │
│  │  └── Admin dashboard monitoring and management                                          │
│                                                                                             │
│  On Demand                                                                                  │
│  │                                                                                          │
│  │  Venue Discovery Agents                                                                  │
│  │  ├── Smart Venue Discovery (local research)                                             │
│  │  └── Perplexity Venue Discovery (cloud research)                                        │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                               DATA ENRICHMENT PIPELINE                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  [VENUE DISCOVERY] → [VENUE DATABASE] → [SCRAPING AGENTS] → [RAW EVENTS] → [CLOUD VALIDATOR]│
│                            │                                    │               │           │
│                            │                                    │               ▼           │
│                            │                                    │        [ENRICHED EVENTS]  │
│                            │                                    │               │           │
│                            │                                    └───────────────┼───────────┘
│                            │                                                    │           │
│                            ▼                                                    ▼           │
│                 [VENUE UPDATES/ADDITIONS]                             [EVENT STORAGE]        │
│                                                                                             │
│                                                                                             │
│  [USER ACCESS] ←──────────────────── [DATABASE] ────────────────────→ [ADMIN SYSTEM]        │
│       │                                   │                                 │               │
│       ▼                                   ▼                                 ▼               │
│  [PUBLIC WEBSITE]                   [EVENT DATA]                   [DASHBOARD]             │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Cost & Performance Matrix

| Agent Type | Cost | Performance | Reliability | Use Case |
|------------|------|-------------|-------------|----------|
| n8n (Local) | $0 | High | High | Daily scraping orchestration |
| Ollama (Local) | $0 | Medium | Medium | Manual scraping, limited AI |
| Perplexity (Cloud) | ~$5/month | Very High | High | Event validation, enrichment |
| User Agents | $0 | Varies | High | Monitoring, management |

## Future Expansion Opportunities

1. **Local AI Transition**: Train Ollama on Perplexity's validated examples to replace cloud costs
2. **Neural Network Integration**: For pattern recognition in event data and venue discovery
3. **Enhanced Venue Discovery**: Automated research agents using multiple search sources
4. **Advanced Analytics**: Machine learning for event trend prediction and recommendations
5. **Scalable Architecture**: Horizontal scaling for additional regions and venues

This system map shows the complete ecosystem of agents, their responsibilities, and how they interact to create a comprehensive event aggregation platform with minimal reliance on external aggregators.