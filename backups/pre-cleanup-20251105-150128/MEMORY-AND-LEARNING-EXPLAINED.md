# Memory and Learning Explained

## The Core Concept

**Memory** = Recording what worked and what didn't
**Learning** = Using that memory to make better decisions

For AI agents/models:
- **Local models** can learn BY CHANGING (fine-tuning)
- **Cloud models** can learn BY REMEMBERING (prompt injection)

---

## How Memory Works with Different Models

### Local Models (Ollama, Mistral, Phi)
```
Day 1: Validate event
  ↓ Success recorded in memory
  ↓ Download updated weights locally
Day 2: Validate event
  ↓ Model has changed internally from Day 1 learning
  ↓ Permanent improvement
```

**Pros:** Permanent learning, cost-effective long-term
**Cons:** Slow (hours/days to fine-tune), needs GPU

### Cloud Models (Perplexity, GPT, Claude)
```
Day 1: Validate event
  ↓ Success recorded in memory
Day 2: Validate event
  ↓ Load Day 1 success from memory
  ↓ INCLUDE IT IN THE PROMPT: "Here's an example of good validation..."
  ↓ Model sees example and applies similar logic
  ↓ But model itself hasn't changed
```

**Pros:** Instant, no GPU needed, no waiting
**Cons:** Learning lost after request ends (must reload memory each time)

---

## The Memory System Architecture

### 8 JSON Files (The Brain)

1. **successful-extractions.json**
   - What: Past successful event extractions
   - Used by: Cloud validator to build few-shot examples
   - Grows with: Each successful validation

2. **error-log.json**
   - What: Past failures and spam patterns
   - Used by: Cloud validator to add guard rails
   - Grows with: Each rejected event

3. **venue-profiles.json**
   - What: Learned characteristics of each venue
   - Used by: Future scraping to tailor extraction
   - Example: "Julie Rogers Theatre always has detailed event descriptions"

4. **extraction-patterns.json**
   - What: Common patterns in successful extractions
   - Used by: To suggest data fields
   - Example: "Music events usually have time as '7:30 PM', price as '$15-25'"

5. **successful-prompts.json**
   - What: Prompts that worked well (for Perplexity)
   - Used by: Reusing effective prompt structures
   - Grows with: Each successful Perplexity call

6. **scraping-decisions.json**
   - What: Decision log (which agent, what decision, outcome)
   - Used by: Analyzing agent performance
   - Example: "Perplexity decided to extract images from venue website → Success"

7. **agent-performance.json**
   - What: Success rates and metrics for each agent
   - Used by: Comparing Perplexity vs Ollama performance
   - Shows: "Perplexity: 87% success, Ollama: (not trained yet)"

8. **learning-insights.json**
   - What: Generated insights from all other memory
   - Used by: Decision-making for future runs
   - Examples: "Top venues for learning: Julie Rogers (95% success rate)"

---

## How Cloud Models Use Memory

### Step-by-Step Process

#### 1. Load Memory Examples
```javascript
const memories = loadMemory('successful-extractions.json');
// Result: [
//   { title: "Jazz Night...", date: "2025-11-15", ... },
//   { title: "Art Festival...", date: "2025-11-20", ... },
//   { title: "Food Truck...", date: "2025-11-08", ... }
// ]
```

#### 2. Build Prompt with Examples
```javascript
const prompt = `
You are an event validator.

SUCCESSFUL EXAMPLES (follow this pattern):
1. ${memories[0]}
2. ${memories[1]}
3. ${memories[2]}

PATTERNS TO AVOID (from past failures):
- Generic titles like "event"
- Past dates
- Spam indicators

EVENT TO VALIDATE:
${currentEvent}

Validate and respond with JSON...
`;
```

#### 3. Send to Perplexity
```javascript
const response = await perplexity.complete({
  model: 'sonar',
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.2  // Low temperature for consistency
});
```

#### 4. Perplexity Sees Pattern
Perplexity doesn't change internally, but it:
- Sees 3 successful examples in your prompt
- Understands the pattern (quality, required fields, format)
- Applies that pattern to validate the current event
- Returns validated/enriched event

#### 5. Record Success
```javascript
if (validated.valid) {
  recordToMemory(validated);
  // Next time, this becomes one of the 3 examples shown to Perplexity
}
```

---

## Practical Example: Day 1 vs Day 30

### Day 1 (No Memory Yet)
Prompt:
```
You are an event validator.

SUCCESSFUL EXAMPLES:
(none available)

PATTERNS TO AVOID:
(none available)

EVENT: "Jazz Night at Julie Rogers"
Validate...
```

Result: Perplexity uses generic rules, might miss details.

---

### Day 30 (With 30 Days of Memory)
Prompt:
```
You are an event validator.

SUCCESSFUL EXAMPLES (from 30 days of real events):
1. {
  "title": "Beaumont Jazz Festival",
  "date": "2025-11-15",
  "time": "7:30 PM",
  "price": "$15-25",
  "age_restriction": "All ages",
  "description": "Annual festival featuring local and regional jazz artists",
  "venue": "Julie Rogers Theatre"
}
2. {
  "title": "Art Exhibit - Contemporary Masters",
  "date": "2025-11-22",
  "time": "10:00 AM",
  "price": "$10",
  "age_restriction": "All ages",
  "description": "Modern art exhibition featuring works from 12 artists",
  "venue": "Beaumont Art Museum"
}
3. {
  "title": "Food Truck Festival",
  "date": "2025-12-01",
  "price": "Free",
  "description": "Street food vendors from across Southeast Texas",
  "venue": "Crockett Street"
}

PATTERNS TO AVOID (from 30 days of spam):
- Generic titles: "Community Event", "Weekly Event"
- Past dates (before today)
- Spam keywords: "limited time", "buy now", "make money"
- Missing city or date
- Events from non-SETX areas

EVENT: "Jazz Night at Julie Rogers"
Validate...
```

Result: Perplexity sees 30 real examples, recognizes the pattern, validates with high accuracy.

---

## Key Insight: Steady Directives

The validator doesn't fine-tune the model. Instead, it provides **steady directives** (rules that always apply):

```
STEADY DIRECTIVES (your rules):
- Age restriction defaults to "All ages" if not specified
- Time defaults to "TBD" if not specified
- Price defaults to "Free" if not specified or $0
- City must be in SETX area
- Date must be future (not past)
- Title must be 5+ characters
```

These directives:
- ✅ Don't change the model
- ✅ Can be updated anytime
- ✅ Are instantly applied next request
- ✅ Guarantee consistent behavior

---

## Comparison: Memory Approaches

| Aspect | Local Model (Ollama) | Cloud Model (Perplexity) |
|--------|----------------------|--------------------------|
| **Learns by** | Fine-tuning weights | Including examples in prompt |
| **Time to learn** | Hours/days | Per-request (instant) |
| **GPU needed** | Yes | No |
| **Cost to train** | Low (local) | High (API calls) |
| **Cost per use** | None (local) | $0.003/request |
| **Improvement over time** | Permanent (weights change) | Temporary (memory reloads each time) |
| **When it forgets** | Never (saved weights) | Each request (must reload memory) |
| **Setup complexity** | Complex (ML infrastructure) | Simple (just load JSON) |

**Hybrid Approach (Recommended):**
1. Use Perplexity now (fast, no setup)
2. Save memory (successful examples)
3. Later, use that memory to fine-tune Ollama once
4. Run Ollama locally (zero cost, all learning is permanent)

---

## Memory Growth Over Time

```
Day 1:   1 successful extraction in memory
Day 2:   2 successful extractions
Day 3:   3 successful extractions
...
Day 30:  30 successful extractions (if no errors)
Day 30:  Cloud model sees 3 examples from 30 days
         = Much smarter validation
```

Each day:
- ✅ New events validated (more examples)
- ✅ New patterns recorded (what works)
- ✅ New guard rails added (what doesn't)
- ✅ Model's "knowledge" expands (though model itself doesn't change)

---

## Security & Privacy

Memory files contain:
- ✅ Event titles, dates, times, locations
- ✅ Venue names
- ✅ What validation rules work

They don't contain:
- ❌ Personal user data
- ❌ Passwords
- ❌ API keys
- ❌ Sensitive information

**Safe to backup, version control, or share.**

---

## Controlling Memory

### Add to Memory
```javascript
// Successful validation → automatically recorded
recordSuccessfulExtraction(event, venue);

// Decision log → automatically recorded
recordScrapingDecision({
  agent: 'perplexity',
  decision: 'extract_and_save',
  outcome: 'success'
});
```

### View Memory
```bash
# See what Perplexity will use next time
curl http://localhost:3003/api/memory-status

# Result:
# {
#   "successful_examples": 27,
#   "guard_rails": 12,
#   "recent_examples": [...]
# }
```

### Clear Memory (if needed)
```bash
# Remove old entries (keep last 50)
rm memory-system/successful-extractions.json
# Validator will recreate with fresh data
```

---

## The Virtuous Cycle

```
Day 1: Scrape venues
  ↓ Get raw events
  ↓ Validate (generic rules)
  ↓ Record successes in memory
  ↓ Success rate: 70%

Day 2: Scrape venues
  ↓ Load memory from Day 1 (1 good example)
  ↓ Validate (generic rules + 1 example)
  ↓ Record new successes
  ↓ Success rate: 75% (improved!)

Day 30: Scrape venues
  ↓ Load memory from Days 1-29 (30 good examples)
  ↓ Validate (generic rules + 30 examples)
  ↓ Record new successes
  ↓ Success rate: 95% (much improved!)
```

---

## Your Current System

### What's Working Now
- ✅ Perplexity scraper (ai-scraper-memory-enabled.js)
- ✅ Memory system (8 JSON files)
- ✅ 69 events with 87%+ success rate

### What's Enabled
- ✅ Cloud model (Perplexity) with memory examples
- ✅ Guard rails (spam/invalid detection)
- ✅ Data enrichment (filling missing fields)
- ✅ Recording successes (building memory)

### What Happens Daily at Midnight
1. n8n triggers
2. Scrapes all 53 venues (Perplexity)
3. Validates events (Cloud Validator with memory)
4. Removes spam/invalid
5. Fills missing data
6. Saves to database
7. Records successes in memory

### Result
Memory grows → Cloud model sees more examples → Better validation → Better data

---

## Next Evolution: Local Model

When ready, you can:
1. Use accumulated memory (30+ days)
2. Fine-tune Ollama once on successful examples
3. Replace Perplexity with local Ollama
4. Zero cost, permanent improvement

But for now, **Perplexity + Memory is perfect** because:
- Fast (no training)
- Smart (learns from memory)
- Cost-effective ($5/month)
- Simple (no GPU needed)

---

**TL;DR:** Cloud models learn from memory in the prompt, not by changing themselves. Each day, more examples are added to memory, making the model smarter per-request without waiting for fine-tuning.
