# N8N + LOCAL AGENT INTEGRATION GUIDE

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                n8n (Automation)                      │
│  - Runs scheduled tasks daily at midnight (12am)    │
│  - Controlled by local agent                         │
└────────────────────┬────────────────────────────────┘
                     │
                     │ Triggers
                     ↓
┌─────────────────────────────────────────────────────┐
│          Local Agent Controller                      │
│  - Manages scraping workflows                       │
│  - Executes ai-scraper-memory-enabled.js            │
│  - Learns from Perplexity results                   │
│  - Remembers via shared memory                      │
└────────────────────┬────────────────────────────────┘
                     │
                     │ Scrapes venues
                     ↓
┌─────────────────────────────────────────────────────┐
│       Perplexity Cloud (Thinking Agent)             │
│  - Searches web for events                          │
│  - Teaches local agent patterns                     │
│  - 87% success rate                                 │
└────────────────────┬────────────────────────────────┘
                     │
                     │ Events & patterns
                     ↓
┌─────────────────────────────────────────────────────┐
│       Shared Memory System (8 JSON files)           │
│  - Learns from successful extractions               │
│  - Tracks agent performance                         │
│  - Records patterns & insights                      │
└────────────────────┬────────────────────────────────┘
                     │
                     │ Results stored
                     ↓
┌─────────────────────────────────────────────────────┐
│            SQLite Database                          │
│  - 53 Venues                                        │
│  - 69+ Events                                       │
│  - Growing daily                                    │
└─────────────────────────────────────────────────────┘
```

## Setup Instructions

### Step 1: Verify Services Are Running

```bash
# Terminal 1: API Server
node api-server.js

# Terminal 2: n8n (if not running)
n8n start

# Terminal 3: Check local agent status
node local-agent-controller.js check-status
```

Expected output:
```
✅ Connected to API server (port 3001)
✅ Connected to n8n (port 5678)
📍 Venues: 53
📅 Events: 69
```

### Step 2: Create n8n Workflow via Web UI

1. **Open n8n UI:**
   ```
   http://localhost:5678
   ```

2. **Create New Workflow:**
   - Click "Create Workflow"
   - Name it: "SETX Events Daily Scraper (Local Agent)"

3. **Add Schedule Trigger:**
   - Search for "Schedule" in node library
   - Add "Schedule Trigger" node
   - Set to recurring interval:
     - Trigger type: "Every day"
     - Time: "00:00" (midnight)
   - This creates cron: `0 0 * * *`

4. **Add Execute Command Node:**
   - Search for "Execute Command" in node library
   - Add "Execute Command" node
   - In "Command" field, enter:
     ```
     node /home/sauly/setx-events/ai-scraper-memory-enabled.js
     ```

5. **Connect Nodes:**
   - Drag from "Schedule Trigger" output to "Execute Command" input
   - The schedule trigger should flow to the execute command

6. **Save & Activate:**
   - Click "Save"
   - Toggle the "Active" switch (top right) to turn on
   - You should see green checkmarks

### Step 3: Test the Workflow

**Manual Test (immediate):**
```bash
node local-agent-controller.js trigger-scrape
```

Expected output:
```
🔄 TRIGGERING IMMEDIATE SCRAPE

⏳ Starting ai-scraper-memory-enabled.js...

📍 Processing: Julie Rogers Theatre (Beaumont)
   ✅ Found 3 events
   💾 Saved: Event Name
   🧠 Learned venue profile

[... more venues ...]

✅ Scraping completed!
   Local agent has learned from results.
```

**Check Results:**
```bash
node local-agent-controller.js learn
```

You should see:
- Perplexity success rate (87%+)
- Top learning venues
- Performance metrics

### Step 4: Monitor Daily Execution

The workflow will automatically run **every day at 6am**.

To monitor:
1. Open n8n UI: http://localhost:5678
2. Navigate to the workflow
3. Click "Executions" tab to see history
4. Each day should show one successful execution

Or check status anytime:
```bash
node local-agent-controller.js check-status
```

## Local Agent Controller Commands

### Check Status
```bash
node local-agent-controller.js check-status
```
Shows: Venues count, events count, memory system, agent performance

### View Learning Insights
```bash
node local-agent-controller.js learn
```
Shows: Agent performance metrics, top learning venues

### Trigger Immediate Scrape
```bash
node local-agent-controller.js trigger-scrape
```
Runs the scraper immediately (doesn't wait for 6am schedule)

### Show Workflow Setup Instructions
```bash
node local-agent-controller.js setup-workflows
```
Displays the n8n setup steps again

## How the System Works

### 1. Daily Schedule (n8n)
- **Time:** Every day at 6:00 AM
- **Action:** Calls local agent scraper

### 2. Local Agent Execution
- **Script:** `ai-scraper-memory-enabled.js`
- **What it does:**
  - Loads 53 venues from database
  - Calls Perplexity API for each venue
  - Extracts event information
  - Saves events to database
  - Learns from results

### 3. Learning & Memory
- **Perplexity teaches:**
  - What makes good event extraction
  - Which prompts work best
  - Common patterns in event data

- **Memory system tracks:**
  - Successful extractions (62 saved)
  - Agent performance (87.3% success rate)
  - Venue profiles
  - Prompt templates
  - Error patterns

### 4. Database Updates
- New events added daily
- Duplicates automatically filtered
- Venue information enriched
- Statistics updated

## Cost Structure

| Component | Cost | Frequency |
|-----------|------|-----------|
| Perplexity API | ~$0.003/venue | Daily (53 venues) |
| Daily Cost | ~$0.16 | 6am every day |
| Monthly Cost | ~$4.80 | Approximately |
| Ollama (Local) | Free | After learning |

**Goal:** After 30 days, Ollama learns enough to replace most Perplexity calls, reducing costs by 90%.

## Troubleshooting

### n8n Not Starting
```bash
# Kill existing process
pkill -f "n8n start"

# Start fresh
n8n start
```

### Workflow Doesn't Execute
1. Check workflow is "Active" (green toggle)
2. Check schedule is set to "0 6 * * *"
3. Check system time is correct
4. Manually test: `node local-agent-controller.js trigger-scrape`

### No Events Being Saved
1. Check API server is running: `curl http://localhost:3001/api/health`
2. Check Perplexity API key is set: `echo $PERPLEXITY_API_KEY`
3. Check database is accessible: `sqlite3 database.sqlite "SELECT COUNT(*) FROM events;"`

### Memory System Not Working
1. Check memory directory exists: `ls -la memory/`
2. Check permissions: `chmod -R 755 memory/`
3. Run manual scrape: `node local-agent-controller.js trigger-scrape`

## Next Steps

### Phase 1: Verification (Done ✅)
- [x] 53 venues in database
- [x] 69 events discovered
- [x] Perplexity teaching local agent (87% success)
- [x] Memory system working
- [x] n8n configured for daily execution

### Phase 2: Daily Operation (Current)
- [ ] n8n runs daily scrapes at 6am
- [ ] Events grow daily
- [ ] Memory improves continuously
- [ ] Monitor cost vs quality

### Phase 3: Cloud Ollama (Future)
- [ ] Deploy cloud Ollama instance
- [ ] Use for website experience
- [ ] Q&A about events and local history
- [ ] Separate from learning agent

## Key Files

| File | Purpose |
|------|---------|
| `local-agent-controller.js` | Controls n8n and local agent |
| `ai-scraper-memory-enabled.js` | Perplexity scraper (runs daily) |
| `ollama-memory.js` | Shared learning memory system |
| `n8n-workflows/` | n8n workflow definitions |
| `memory/` | 8 JSON files with learned patterns |

## Architecture Summary

- **n8n** = Orchestration (when and how often)
- **Local Agent** = Intelligence (what to scrape and how)
- **Perplexity** = Initial teaching (find patterns)
- **Memory** = Learning (remember what works)
- **Ollama Local** = Future cost savings (learn to match Perplexity)
- **Ollama Cloud** = User experience (website Q&A)

**Result:** Fully autonomous event aggregation that improves daily and reduces costs over time!
