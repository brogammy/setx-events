# OLLAMA LEARNING SYSTEM - QUICK START

Get the Ollama learning system running in 5 minutes.

---

## 1. Install (One-time Setup)

```bash
cd /home/sauly/setx-events

# Check you have all required files:
ls -la ollama-memory.js
ls -la ollama-agent-learner.js
ls -la ai-scraper-memory-enabled.js

# Create memory directory (automatically done by scripts, but ensures it exists)
mkdir -p memory
```

---

## 2. First Run - Feed Perplexity Data to Ollama

### Step 2a: Run Perplexity (Teaches Ollama)

```bash
export PERPLEXITY_API_KEY="your-api-key-here"
node ai-scraper-memory-enabled.js
```

**What you'll see:**
```
🤖 PERPLEXITY SCRAPER - MEMORY-ENABLED (Teaching Ollama)

📍 Processing: Beaumont Theater (Beaumont)
   ✅ Found 3 events
   💾 Saved: Fall Production
   [More venues...]

🧠 TEACHING OLLAMA:
   Agent Comparison:
     perplexity: 87.5% success rate
   Top venues for learning: Beaumont Theater, Port Arthur Museum

✅ Ollama local agent will use this data on next run!
```

**What happened:**
- Perplexity scraped venues
- Saved events to database
- **Created `/memory/` folder with learned data**
- Recorded venue profiles, successful extractions, performance metrics

### Step 2b: Verify Memory Was Created

```bash
# Check memory files exist
ls -la memory/

# Should show:
# -rw-r--r-- agent-performance.json
# -rw-r--r-- error-log.json
# -rw-r--r-- extraction-patterns.json
# -rw-r--r-- learning-insights.json
# -rw-r--r-- prompt-templates.json
# -rw-r--r-- scraping-decisions.json
# -rw-r--r-- successful-extractions.json
# -rw-r--r-- venue-profiles.json

# Check venue profiles were learned
jq 'keys' memory/venue-profiles.json

# Should show venue IDs like: ["1", "2", "3", ...]
```

---

## 3. Second Run - Ollama Learns and Scrapes

### Step 3a: Ensure Ollama is Running

```bash
# In another terminal, start Ollama
ollama serve

# Or check if it's already running
curl http://localhost:11434/api/tags

# Should return list of available models
```

### Step 3b: Run Ollama Local Agent

```bash
node ollama-agent-learner.js
```

**What you'll see:**
```
🤖 OLLAMA AGENT LEARNER - Starting Intelligent Scraping

📚 LEARNING INSIGHTS FROM PREVIOUS RUNS:
   Top venues for learning: Beaumont Theater, Port Arthur Museum
   Common errors to avoid: invalid_json

📍 Beaumont Theater (Beaumont)
   📚 Using 3 learned examples
   ✅ Found 3 events
   💾 Saved: Fall Production

📊 PERFORMANCE METRICS:
   Events scraped: 23
   Duplicates detected: 5
   Errors: 1
   Success rate: 79.3%

✅ Metrics recorded and memory synchronized
🧠 Memory system will improve future scraping runs
```

**What happened:**
- Ollama loaded learned venue profiles from memory
- For each venue, it used learned patterns and examples
- Built intelligent prompts with in-context learning
- Saved events and updated memory
- **Success rate should be 70-80% on first run, improving each day**

---

## 4. Monitor Learning Progress

### Check Success Rate Over Time

```bash
cat memory/agent-performance.json | jq '.[] | {agent: .name, runs: (.runs | length), avgSuccess: .averageSuccessRate}'
```

**Example Output:**
```json
{
  "agent": "perplexity",
  "runs": 3,
  "avgSuccess": 0.88
}
{
  "agent": "ollama-local",
  "runs": 2,
  "avgSuccess": 0.76
}
```

### See What Ollama Has Learned

```bash
# View top venues for learning
jq '.topVenuesForLearning' memory/learning-insights.json | tail -1

# View agent performance comparison
jq '.agentComparison' memory/learning-insights.json | tail -1
```

### Check Specific Venue Profile

```bash
# List all venues with learning
jq 'to_entries[] | {id: .key, name: .value.name, learns: .value.successfulScrapesCount, from: .value.lastLearningFrom}' memory/venue-profiles.json
```

---

## 5. Daily/Weekly Automation

### Option A: Manual Scheduling

**Tuesday, Thursday, Saturday** (3x per week at 6 AM):
```bash
# Terminal 1: Start Ollama (keep running)
ollama serve

# Terminal 2: Run Perplexity at 6 AM (teaches Ollama)
export PERPLEXITY_API_KEY="your-key"
node ai-scraper-memory-enabled.js

# Terminal 2: Run Ollama local after Perplexity finishes
node ollama-agent-learner.js
```

### Option B: Automated Scheduling (cron)

```bash
# Edit crontab
crontab -e

# Add these lines:

# Perplexity teaching run - Tuesday, Thursday, Saturday @ 6 AM
0 6 * * 2,4,6 cd /home/sauly/setx-events && export PERPLEXITY_API_KEY="your-key" && node ai-scraper-memory-enabled.js >> logs/perplexity-memory.log 2>&1

# Ollama learning run - Every day @ 8 AM
0 8 * * * cd /home/sauly/setx-events && node ollama-agent-learner.js >> logs/ollama-memory.log 2>&1

# Memory sync to database - Once per week
0 22 * * 0 cd /home/sauly/setx-events && node -e "const OMS = require('./ollama-memory'); new OMS().syncMemoryToDatabase().then(process.exit)"
```

### Option C: Keep Running Services

```bash
# Terminal 1: Ollama server
ollama serve

# Terminal 2: API server
cd /home/sauly/setx-events && node api-server.js

# Terminal 3: Automatic runner
cat > run-agents.sh << 'EOF'
#!/bin/bash
cd /home/sauly/setx-events

while true; do
  # Run at 6 AM
  CURRENT_HOUR=$(date +%H)
  if [ "$CURRENT_HOUR" = "06" ]; then
    echo "Running Perplexity scraper..."
    PERPLEXITY_API_KEY="your-key" node ai-scraper-memory-enabled.js
    sleep 3600  # Wait an hour so it doesn't run multiple times
  fi

  # Run at 8 AM
  if [ "$CURRENT_HOUR" = "08" ]; then
    echo "Running Ollama learner..."
    node ollama-agent-learner.js
    sleep 3600
  fi

  sleep 300  # Check every 5 minutes
done
EOF

chmod +x run-agents.sh
./run-agents.sh
```

---

## 6. Understanding Output

### Perplexity Output

```
✅ Found 3 events              ← Perplexity found events
💾 Saved: Fall Production      ← Event saved to database
⏭️  Skipping duplicate         ← Already in database
❌ Error: Network timeout      ← API error
```

### Ollama Output

```
📚 Using 3 learned examples    ← Found learned patterns for venue
✅ Found 3 events              ← Ollama extracted events
💾 Saved: Fall Production      ← Event saved to database
⏭️  Duplicate: Fall Production ← Already in database
❌ Error: Invalid JSON         ← Ollama failed to parse
```

### Memory System Output

```
🧠 Learned venue profile       ← New venue learned
Agent Comparison:
  perplexity: 88% success      ← Perplexity is 88% accurate
  ollama-local: 82% success    ← Ollama is 82% accurate
✅ Metrics recorded            ← Performance saved for analysis
🧠 Memory system will improve  ← Ollama will improve next run
```

---

## 7. Verify Everything Works

### Test 1: Memory System Creates Files

```bash
# Run Perplexity briefly
timeout 5 PERPLEXITY_API_KEY="test" node ai-scraper-memory-enabled.js || true

# Check files created
ls memory/ | wc -l  # Should be 8 files
```

### Test 2: Ollama Can Load Learned Data

```bash
# Should print venue profiles
node -e "const OMS = require('./ollama-memory'); const m = new OMS(); console.log(JSON.stringify(m.getAllVenueProfiles(), null, 2))"
```

### Test 3: Compare Agents

```bash
# Show performance comparison
node -e "const OMS = require('./ollama-memory'); const m = new OMS(); console.log(JSON.stringify(m.getAgentComparison(), null, 2))"
```

---

## 8. Common Issues

### "Memory directory not created"
```bash
mkdir -p /home/sauly/setx-events/memory
ls -la /home/sauly/setx-events/memory/
```

### "No events found"
Make sure:
1. API server is running: `ps aux | grep api-server`
2. Database has venues: `sqlite3 database.sqlite "SELECT COUNT(*) FROM venues;"`
3. Venues have active status: `sqlite3 database.sqlite "SELECT COUNT(*) FROM venues WHERE is_active=1;"`

### "Ollama connection refused"
```bash
# Start Ollama in another terminal
ollama serve

# Or test connection
curl http://localhost:11434/api/tags
```

### "Perplexity API key error"
```bash
export PERPLEXITY_API_KEY="your-actual-key-here"
echo $PERPLEXITY_API_KEY  # Verify it's set
```

---

## 9. What's Actually Happening

### Memory System Files

```
/home/sauly/setx-events/memory/
├── venue-profiles.json        ← "What events does venue X host?"
├── successful-extractions.json ← "Here are 5 successful examples"
├── prompt-templates.json      ← "This prompt worked for venue X"
├── agent-performance.json     ← "Perplexity: 88%, Ollama: 82%"
├── scraping-decisions.json    ← "Decision history for analysis"
├── error-log.json             ← "Common errors and how to fix them"
├── learning-insights.json     ← "System insights from all data"
└── extraction-patterns.json   ← "HTML patterns that worked"
```

### Data Flow

```
DAY 1:
Perplexity writes to memory → Ollama reads from memory → Both scrape

DAY 2:
Perplexity writes to memory → Ollama reads MORE → Ollama is smarter

DAY 3-30:
Perplexity refines → Ollama becomes nearly as good as Perplexity

DAY 31+:
Ollama = Perplexity quality but FREE (no API costs)
```

---

## 10. Next Steps

1. **Run once:** `PERPLEXITY_API_KEY="key" node ai-scraper-memory-enabled.js`
2. **Check memory:** `ls memory/` (should have 8 files)
3. **Run Ollama:** `node ollama-agent-learner.js`
4. **Monitor:** `jq '.' memory/agent-performance.json`
5. **Repeat daily** for continuous improvement

---

## For More Information

- See `OLLAMA-LEARNING-SYSTEM.md` for full documentation
- See `AGENTS.md` for infrastructure validation
- See `CLAUDE.md` for development guidance
