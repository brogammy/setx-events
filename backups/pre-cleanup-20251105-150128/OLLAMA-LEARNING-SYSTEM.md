# OLLAMA LEARNING SYSTEM

## Overview

This document describes how the Ollama local agent learns from Perplexity and improves over time using a **shared memory system**.

**Key Principle:** Ollama local agent continuously learns from Perplexity's successful scrapes and becomes smarter with each run.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED MEMORY SYSTEM                         │
│                                                                 │
│  /memory/                                                       │
│  ├── venue-profiles.json              ← What works for venues  │
│  ├── prompt-templates.json            ← Best prompts          │
│  ├── extraction-patterns.json         ← HTML patterns         │
│  ├── successful-extractions.json      ← Training examples     │
│  ├── agent-performance.json           ← Metrics              │
│  ├── scraping-decisions.json          ← Decision history     │
│  ├── error-log.json                   ← What went wrong      │
│  └── learning-insights.json           ← Generated insights   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         ▲           ▲                    ▲
         │           │                    │
       Feeds       Feeds               Feeds
    Data In      Data In              Data In
         │           │                    │
         │           │                    │
    ┌────┴────┬──────┴──────┬─────────────┴────┐
    │          │            │                  │
    │          │            │                  │
┌───▼──┐  ┌───▼──┐  ┌──────▼──┐  ┌────────────▼────┐
│       │  │       │  │        │  │                │
│Perplex│  │ Ollama│  │ Ollama │  │  Cloud Agents  │
│ity    │  │ Local │  │ Cloud  │  │  (Future)      │
│API    │  │ Agent │  │ Agent  │  │                │
│       │  │       │  │        │  │                │
└───────┘  └───────┘  └────────┘  └────────────────┘

LEARNS FROM    LEARNS FROM    LEARNS FROM
Perplexity's   All agents'    Other agents'
successes      decisions      experiences
```

---

## How It Works

### 1. Perplexity Scrapes (Teaches Ollama)

When Perplexity scrapes a venue:

```
Perplexity runs ai-scraper-memory-enabled.js
    ↓
1. Calls Perplexity API for events
    ↓
2. Saves successful events to database
    ↓
3. LEARNS OLLAMA:
   - Saves venue profile (what events look like)
   - Records successful prompt
   - Stores extraction examples
   - Logs performance metrics
    ↓
4. Writes to Shared Memory
   /memory/venue-profiles.json
   /memory/successful-extractions.json
   /memory/prompt-templates.json
```

**Example Venue Profile Created:**
```json
{
  "venueId": 5,
  "name": "Beaumont Theater",
  "city": "Beaumont",
  "category": "Performing Arts",
  "learningHistory": [
    {
      "timestamp": "2025-11-01T12:00:00Z",
      "agent": "perplexity",
      "eventsLearned": 3
    }
  ],
  "patterns": {
    "eventTitles": [
      "Fall Production of Romeo and Juliet",
      "Comedy Night with Special Guest",
      "Symphony Orchestra Concert"
    ],
    "eventTimes": [
      "7:00 PM",
      "8:00 PM - 10:00 PM"
    ],
    "eventCategories": [
      "Theater",
      "Performing Arts",
      "Music"
    ]
  },
  "successfulScrapesCount": 1
}
```

### 2. Ollama Local Learns

When Ollama local runs (`ollama-agent-learner.js`):

```
Ollama Local Agent starts
    ↓
1. Loads all venues to scrape
    ↓
2. FOR EACH VENUE:
   a. Check shared memory for venue profile
   b. Load learned patterns
   c. Get extraction examples from past successful scrapes
   d. Build INTELLIGENT PROMPT using learned context
   e. Run Ollama with enhanced prompt
   f. Parse results
   g. SAVE & LEARN:
      - Record successful extractions
      - Update metrics
      - Log decisions
    ↓
3. SHARE FINDINGS:
   - Record what worked
   - Update success rate
   - Generate insights
```

**Example Learned Prompt (vs Generic):**

❌ **WITHOUT LEARNING (Original):**
```
You are an event data extractor for Beaumont Theater.
Generate 1-3 realistic events...
```

✅ **WITH LEARNING (Enhanced):**
```
You are an event data extractor for Beaumont Theater.

LEARNED PATTERNS:
- Successful event titles: Fall Production, Comedy Night, Symphony Orchestra
- Common event times: 7:00 PM, 8:00 PM
- Categories: Theater, Performing Arts, Music
- Previous successful scrapes: 1

SUCCESSFUL EXTRACTION EXAMPLES:
Example 1:
- Title: Fall Production of Romeo and Juliet
- Date: 2025-11-15
- Time: 7:00 PM
- Category: Theater

Use these examples as templates...
```

This **significantly improves** Ollama's output quality.

---

## Shared Memory Files

### 1. venue-profiles.json

Stores everything learned about each venue.

**Structure:**
```json
{
  "5": {
    "venueId": 5,
    "name": "Beaumont Theater",
    "city": "Beaumont",
    "category": "Performing Arts",
    "learningHistory": [...],
    "patterns": {
      "eventTitles": [...],
      "eventTimes": [...],
      "eventCategories": [...]
    },
    "successfulScrapesCount": 5,
    "lastLearningFrom": "perplexity"
  }
}
```

**Used by:** Ollama local agent for context-aware prompting

### 2. prompt-templates.json

Best prompts that worked for each venue.

**Structure:**
```json
{
  "5_perplexity": {
    "venueId": 5,
    "agent": "perplexity",
    "bestPrompt": "Extract upcoming events from Beaumont Theater...",
    "averageQuality": 0.92,
    "prompts": [...]
  }
}
```

**Used by:** Both agents to reuse proven prompts

### 3. successful-extractions.json

Training examples for in-context learning.

**Structure:**
```json
[
  {
    "timestamp": "2025-11-01T12:00:00Z",
    "agent": "perplexity",
    "venueId": 5,
    "venueName": "Beaumont Theater",
    "event": {
      "title": "Fall Production",
      "date": "2025-11-15",
      "time": "7:00 PM",
      "location": "Beaumont Theater",
      "city": "Beaumont",
      "category": "Theater",
      "description": "Professional production of Romeo and Juliet"
    }
  }
]
```

**Used by:** Ollama to provide examples in prompts (few-shot learning)

### 4. scraping-decisions.json

Full history of all scraping decisions.

**Structure:**
```json
[
  {
    "timestamp": "2025-11-01T12:00:00Z",
    "agent": "perplexity",
    "venueId": 5,
    "venueName": "Beaumont Theater",
    "decision": "extract_and_save",
    "reason": "perplexity_found_valid_events",
    "outcome": "success",
    "eventsFound": 3
  }
]
```

**Used by:** Analysis of decision patterns and agent performance

### 5. agent-performance.json

Metrics tracking for each agent.

**Structure:**
```json
{
  "perplexity": {
    "name": "perplexity",
    "runs": [...],
    "totalEventsScraped": 157,
    "totalDuplicatesDetected": 23,
    "totalErrorsHandled": 5,
    "averageSuccessRate": 0.88,
    "costMetrics": {
      "totalCost": 0.25
    }
  },
  "ollama-local": {
    "name": "ollama-local",
    "runs": [...],
    "totalEventsScraped": 89,
    "totalDuplicatesDetected": 12,
    "averageSuccessRate": 0.82
  }
}
```

**Used by:** Comparing agents, identifying learning gaps

### 6. error-log.json

All errors encountered for learning failure patterns.

**Structure:**
```json
[
  {
    "timestamp": "2025-11-01T12:00:00Z",
    "agent": "ollama-local",
    "venueId": 5,
    "venueName": "Beaumont Theater",
    "errorType": "invalid_json",
    "errorMessage": "JSON parsing failed",
    "tried": "extract_from_response",
    "resolution": "used_fallback_pattern"
  }
]
```

**Used by:** Improving error handling

### 7. learning-insights.json

Auto-generated insights from analysis.

**Structure:**
```json
[
  {
    "timestamp": "2025-11-01T12:30:00Z",
    "topVenuesForLearning": [
      { "name": "Beaumont Theater", "learns": 5 },
      { "name": "Port Arthur Museum", "learns": 4 }
    ],
    "agentComparison": {
      "perplexity": { "successRate": 0.88 },
      "ollama-local": { "successRate": 0.82 }
    },
    "commonErrors": {...},
    "recommendedFocusAreas": [...]
  }
]
```

**Used by:** Understanding system performance and improvement areas

---

## Using the Memory System

### Running Perplexity (Teaches Ollama)

```bash
export PERPLEXITY_API_KEY="your-key-here"
node ai-scraper-memory-enabled.js
```

**What happens:**
1. Scrapes venues with Perplexity
2. Saves events
3. **Learns Ollama** - writes to shared memory
4. Records performance metrics
5. Generates insights

**Output:**
```
🤖 PERPLEXITY SCRAPER - MEMORY-ENABLED (Teaching Ollama)

📍 Processing: Beaumont Theater (Beaumont)
   ✅ Found 3 events
   💾 Saved: Fall Production

🧠 TEACHING OLLAMA:
   Agent Comparison:
     perplexity: 88.0% success rate
   Top venues for learning: Beaumont Theater, Port Arthur Museum

✅ Ollama local agent will use this data on next run!
```

### Running Ollama Local (Learns & Improves)

```bash
node ollama-agent-learner.js
```

**What happens:**
1. Loads learned venue profiles
2. For each venue:
   - Gets extraction examples
   - Builds intelligent prompt with learned context
   - Runs Ollama with few-shot learning
   - Saves successful extractions
3. Records metrics
4. Updates memory for next run

**Output:**
```
🤖 OLLAMA AGENT LEARNER - Starting Intelligent Scraping

📚 LEARNING INSIGHTS FROM PREVIOUS RUNS:
   Top venues for learning: Beaumont Theater, Port Arthur Museum
   Common errors to avoid: invalid_json, malformed_response

📍 Beaumont Theater (Beaumont)
   📚 Using 3 learned examples
   ✅ Found 3 events
   💾 Saved: Fall Production

✅ Metrics recorded and memory synchronized
🧠 Memory system will improve future scraping runs
```

---

## Learning Over Time

### Day 1
- Perplexity runs, scrapes 50 events
- Creates venue profiles for 10 venues
- Ollama runs with minimal context
- Success rate: ~70%

### Day 2
- Perplexity runs again, adds to venue profiles
- Ollama now has 1 day of learned patterns
- Uses extraction examples in prompts
- Success rate: ~75% ↑

### Day 3
- Perplexity refines profiles
- Ollama has 2+ days of patterns
- Uses best prompts from memory
- Success rate: ~78% ↑

### Day 7
- Perplexity has deep knowledge of all venues
- Ollama has learned patterns for full week
- Can predict event types accurately
- Success rate: ~82% ↑

### Day 30
- All venues have rich profiles
- Ollama matches Perplexity quality (90%+)
- System is nearly cost-free for daily runs
- Only Perplexity runs when new venue added

---

## Memory File Locations

```
/home/sauly/setx-events/
├── memory/                              # SHARED MEMORY DIR
│   ├── venue-profiles.json              # 🔑 Most important
│   ├── successful-extractions.json      # Training examples
│   ├── prompt-templates.json            # Best prompts
│   ├── agent-performance.json           # Metrics
│   ├── scraping-decisions.json          # Full history
│   ├── error-log.json                   # Failures to learn from
│   └── learning-insights.json           # Auto-generated insights
│
├── ollama-memory.js                     # Memory system (library)
├── ollama-agent-learner.js             # Ollama local (learns & scrapes)
├── ai-scraper-memory-enabled.js        # Perplexity (teaches Ollama)
└── database.sqlite                      # Events database
```

---

## API Reference

### OllamaMemorySystem Class

**Creating instance:**
```javascript
const OllamaMemorySystem = require('./ollama-memory');
const memory = new OllamaMemorySystem();
```

**Teaching Ollama about a venue:**
```javascript
memory.learnVenueProfile(
  venueId,           // venue.id
  venueData,         // { name, city, category, ... }
  successfulEvents,  // [{ title, date, time, ... }]
  'perplexity'       // agent name
);
```

**Getting learned venue profile:**
```javascript
const profile = memory.getVenueProfile(venueId);
// Returns: {
//   patterns: { eventTitles, eventTimes, eventCategories },
//   successfulScrapesCount,
//   lastLearningFrom
// }
```

**Getting extraction examples:**
```javascript
const examples = memory.getExtractionExamples(venueId, limit=5);
// Returns: [{ title, date, time, category, ... }]
```

**Recording successful prompt:**
```javascript
memory.recordSuccessfulPrompt(
  venueId,
  promptText,
  { eventCount: 3 },  // quality metrics
  'perplexity'
);
```

**Recording agent performance:**
```javascript
memory.recordAgentPerformance('ollama-local', {
  eventsScraped: 45,
  duplicates: 5,
  errors: 2,
  successRate: 0.88,
  executionTime: 125000  // milliseconds
});
```

**Recording error for learning:**
```javascript
memory.recordError({
  agent: 'ollama-local',
  venueId: 5,
  venueName: 'Beaumont Theater',
  errorType: 'invalid_json',
  errorMessage: 'JSON parsing failed',
  tried: 'extract_from_response',
  resolution: 'used_fallback_pattern'
});
```

**Getting agent comparison:**
```javascript
const comparison = memory.getAgentComparison();
// Returns: {
//   perplexity: { successRate: 0.88, eventsScraped: 157, ... },
//   ollama-local: { successRate: 0.82, eventsScraped: 89, ... }
// }
```

**Getting learning insights:**
```javascript
const insights = memory.generateLearningInsights();
// Returns: {
//   topVenuesForLearning: [...],
//   agentComparison: {...},
//   commonErrors: {...},
//   recommendedFocusAreas: [...]
// }
```

---

## Workflow Examples

### Example 1: Perplexity Teaching Ollama

```javascript
// Perplexity runs
const scraper = new PerplexityMemoryEnabledScraper();
await scraper.initialize();
await scraper.scrapeAll();

// Inside scrapeAll():
// For each venue that scrapes successfully:
const events = await this.scrapeVenueWithAI(venue);

// Teach Ollama
this.memory.learnVenueProfile(
  venue.id,
  venue,
  events,
  'perplexity'
);

// Record the successful prompt
const usedPrompt = this.buildPrompt(venue);
this.memory.recordSuccessfulPrompt(
  venue.id,
  usedPrompt,
  { eventCount: events.length },
  'perplexity'
);

// Save metrics for comparison
this.memory.recordAgentPerformance('perplexity', {
  eventsScraped: totalEvents,
  duplicates: duplicateCount,
  errors: errorCount,
  successRate: successRate,
  executionTime: executionTime
});
```

### Example 2: Ollama Learning and Using Knowledge

```javascript
// Ollama local runs
const agent = new OllamaAgentLearner();
await agent.initialize();

// For each venue
for (const venue of venues) {
  // Get what Perplexity taught us
  const venueProfile = memory.getVenueProfile(venue.id);
  const extractionExamples = memory.getExtractionExamples(venue.id, 3);

  // Build prompt with learned context
  const prompt = agent.buildIntelligentPrompt(
    venue,
    venueProfile,
    extractionExamples
  );

  // Run Ollama with enhanced prompt
  const events = await agent.scrapeVenueWithLearnedContext(
    venue,
    venueProfile,
    extractionExamples
  );

  // Learn from our success
  for (const event of events) {
    memory.recordSuccessfulExtraction(
      venue.id,
      venue.name,
      event,
      'ollama-local'
    );
  }
}

// Record our performance
memory.recordAgentPerformance('ollama-local', metrics);
```

---

## Monitoring Learning Progress

### Check Top Learning Venues
```bash
sqlite3 database.sqlite \
  "SELECT snapshot_data FROM memory_snapshots
   WHERE snapshot_type='learning_insights'
   ORDER BY timestamp DESC LIMIT 1;" | jq '.topVenuesForLearning'
```

### Compare Agent Performance
```bash
cat memory/agent-performance.json | jq '.[] | {agent: .name, successRate: .averageSuccessRate}'
```

**Example Output:**
```json
{
  "agent": "perplexity",
  "successRate": 0.88
}
{
  "agent": "ollama-local",
  "successRate": 0.82
}
```

### See Recent Learning Events
```bash
cat memory/venue-profiles.json | jq '.[] | select(.successfulScrapesCount > 0) | {name, learns: .successfulScrapesCount, from: .lastLearningFrom}'
```

---

## Best Practices

### For Perplexity (Teaching Agent)
1. Run Perplexity daily at consistent time
2. Check memory files after run (should be updated)
3. Monitor API costs in agent-performance.json
4. Review learning insights for improvement areas

### For Ollama Local (Learning Agent)
1. Run after Perplexity completes (so there's new learning)
2. Check if venue profiles are being loaded correctly
3. Monitor success rate improvements over time
4. Focus on venues with high learning history first

### General Principles
1. **Garbage in, garbage out** - Bad Perplexity data teaches Ollama wrong patterns
2. **Consistent venues** - Pick venues that work well and let Ollama learn deeply
3. **Avoid overfitting** - Ollama learns general patterns, not venue-specific quirks
4. **Regular analysis** - Review insights weekly to see improvement

---

## Troubleshooting

### Ollama Not Learning
**Problem:** Memory files not being created

**Solution:**
```bash
# Check memory directory exists
ls -la /home/sauly/setx-events/memory/

# If missing, create it
mkdir -p /home/sauly/setx-events/memory

# Run Perplexity to teach
PERPLEXITY_API_KEY="..." node ai-scraper-memory-enabled.js

# Check memory was created
ls -la /home/sauly/setx-events/memory/
```

### Ollama Not Using Learned Context
**Problem:** Prompts don't include learned patterns

**Solution:**
```javascript
// Check if venue profile exists
const profile = memory.getVenueProfile(venueId);
console.log(profile); // Should have patterns if learning worked

// If null, Perplexity hasn't taught this venue yet
// Run Perplexity first, then Ollama
```

### Learning Not Improving Success Rate
**Problem:** Ollama success rate not increasing

**Solution:**
1. Check if Perplexity is scraping successfully
2. Review agent-performance.json for trends
3. Check error-log.json for common errors
4. May need more days of learning (compound effect)

---

## Future Enhancements

1. **Fine-tuning Ollama Model** - Use learned data to fine-tune local Ollama
2. **Cloud Agent Learning** - Deploy Ollama Cloud to also learn and share
3. **Collaborative Learning** - Multiple instances share memory via API
4. **Predictive Learning** - Use patterns to predict best scraping time per venue
5. **Transfer Learning** - Knowledge from one venue helps similar venues

---

## Summary

The Ollama Learning System creates a **feedback loop**:

```
Perplexity Scrapes → Learns Venue Profile → Stores in Memory
                                                    ↓
Ollama Local Reads ← Uses Learned Context ← Extracts Examples
                ↓
         Scrapes Events → Records Success → Updates Memory
                            ↓
                   Improves for Next Run
```

**Result:** Over time, Ollama local becomes nearly as good as Perplexity, but **completely free to run**, while Perplexity's intelligence is preserved and shared.

This is continuous, autonomous learning for event scraping.
