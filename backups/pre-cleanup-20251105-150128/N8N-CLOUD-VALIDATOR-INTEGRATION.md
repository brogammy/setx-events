# N8N + Cloud Validator Integration Guide

## Architecture Overview

**The Complete Pipeline:**

```
n8n Workflow (Scraping)
    ↓
    └─→ Scrapes venue websites → Raw events
         ↓
         └─→ POST to Cloud Validator (localhost:3003)
              ↓
              ├─ Perplexity validates with memory examples
              ├─ Removes spam/invalid events
              ├─ Fills missing data
              ├─ Records successes in memory
              ↓
              └─→ Returns cleaned events
                  ↓
                  └─→ POST to API Server (localhost:3001/api/events)
                       ↓
                       └─→ Events appear on website
```

---

## How Memory Works with Cloud Models

### The Problem
Cloud models (Perplexity, GPT, Claude) **cannot be fine-tuned per request**. They don't learn from your data permanently.

### The Solution: Few-Shot Learning via Prompts
Instead of fine-tuning, we include **successful examples** in every prompt as "steady directives":

```javascript
// Prompt sent to Perplexity:

"You are an event validator. Follow these STEADY DIRECTIVES:

SUCCESSFUL EXAMPLES (learn from these):
Example 1:
{
  "title": "Jazz Festival 2025",
  "date": "2025-11-15",
  "time": "7:30 PM",
  "price": "$15-25",
  "category": "Music"
}

PATTERNS TO AVOID (from past failures):
1. Events with generic titles like 'Community Event'
2. Events with past dates
3. Spam indicators (viagra, crypto, etc)

NOW VALIDATE: {{ event_data }}"
```

This gives cloud models **instant access to your memory** without delays or fine-tuning.

---

## Services

### 1. **Cloud Validator** (localhost:3003)
Provided by: `event-validator-cloud.js`

Uses Perplexity API to validate and enrich events with memory-based guidance.

**Endpoints:**
- `POST /api/validate` - Single event validation
- `POST /api/validate-batch` - Batch validation (for n8n)
- `GET /api/health` - Health check
- `GET /api/memory-status` - View memory examples available

**Memory Files Used:**
- `memory-system/successful-extractions.json` - Past successes
- `memory-system/error-log.json` - Past failures

### 2. **Main API** (localhost:3001)
Provided by: `api-server.js`

Stores events, venues, and serves public pages.

**Key Endpoints:**
- `POST /api/events` - Save validated events
- `GET /event/:id` - Individual event page
- `GET /venue/:id` - Venue detail page with events

### 3. **Memory System**
Located in: `memory-system/` directory

8 JSON files that track:
- Successful extractions
- Failed patterns
- Performance metrics
- Venue profiles
- Prompt templates

---

## Setting Up n8n Workflow

### Prerequisites
```bash
# Ensure these services are running:
1. API Server: node api-server.js
2. Cloud Validator: PERPLEXITY_API_KEY="your-key" node event-validator-cloud.js
3. n8n: n8n start
```

### n8n Workflow Steps

#### Step 1: HTTP Request (Scrape Website)
```
Node: HTTP Request
Method: GET
URL: https://venue-website.com/events

Returns: HTML or JSON data
```

#### Step 2: Transform/Parse HTML
```
Node: Code (JavaScript)
Code:
  // Parse HTML or JSON to extract events
  // Return array of event objects:
  [
    {
      title: "Event Name",
      date: "2025-11-15",
      time: "7:30 PM",
      city: "Beaumont",
      category: "Music",
      location: "Venue Name"
      // Other optional fields...
    }
  ]
```

#### Step 3: Validate Events (Cloud Validator)
```
Node: HTTP Request
Method: POST
URL: http://localhost:3003/api/validate-batch
Headers: {"Content-Type": "application/json"}
Body: [{{ events_from_step_2 }}]

Returns:
{
  "total": 5,
  "approved": [3 cleaned events],
  "rejected": [2 spam events]
}
```

#### Step 4: Save to Database
```
Node: HTTP Request
Method: POST
URL: http://localhost:3001/api/events
Headers: {"Content-Type": "application/json"}
Body: (for each event in approved list)
{
  "title": "{{ event.title }}",
  "date": "{{ event.date }}",
  "time": "{{ event.time }}",
  "city": "{{ event.city }}",
  "location": "{{ event.location }}",
  "category": "{{ event.category }}",
  "image_url": "{{ event.image_url }}",
  "price": "{{ event.price }}",
  "age_restriction": "{{ event.age_restriction }}",
  "ticket_url": "{{ event.ticket_url }}"
}
```

#### Step 5: Schedule (Daily at Midnight)
```
Trigger: Cron
Time: 0 0 * * * (midnight UTC)
Or your local timezone equivalent
```

---

## Example: Complete n8n Workflow JSON

Here's a complete workflow you can import into n8n:

```json
{
  "name": "SETX Events Scraper with Cloud Validation",
  "nodes": [
    {
      "name": "Trigger",
      "type": "n8n-nodes-base.cron",
      "position": [250, 300],
      "parameters": {
        "cronExpression": "0 0 * * *"
      }
    },
    {
      "name": "Scrape Website",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300],
      "parameters": {
        "method": "GET",
        "url": "https://venue-website.com/events"
      }
    },
    {
      "name": "Parse Events",
      "type": "n8n-nodes-base.code",
      "position": [650, 300],
      "parameters": {
        "jsCode": "// Parse HTML/JSON and extract events\nconst events = [];\n// Your parsing logic here\nreturn events;"
      }
    },
    {
      "name": "Validate with Cloud",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 300],
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3003/api/validate-batch",
        "headers": {"Content-Type": "application/json"},
        "body": "={{ $node['Parse Events'].json }}"
      }
    },
    {
      "name": "Save Events",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1050, 300],
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3001/api/events",
        "loopOver": "={{ $node['Validate with Cloud'].json.approved }}",
        "body": "={{ $item.json }}"
      }
    }
  ],
  "connections": {
    "Trigger": { "main": [[ { "node": "Scrape Website" } ]] },
    "Scrape Website": { "main": [[ { "node": "Parse Events" } ]] },
    "Parse Events": { "main": [[ { "node": "Validate with Cloud" } ]] },
    "Validate with Cloud": { "main": [[ { "node": "Save Events" } ]] }
  }
}
```

---

## How Cloud Model Memory Learning Works

### Per Request (Instant)
Each time n8n calls the validator:

1. **Load memory** - Reads successful examples from `successful-extractions.json`
2. **Build prompt** - Includes 3 most successful past extractions
3. **Add guard rails** - Includes patterns to avoid from `error-log.json`
4. **Send to Perplexity** - Perplexity sees examples and learns from them
5. **Better validation** - Perplexity applies those patterns to current event
6. **Record success** - Adds validated event to memory for next time

### Result
- **Day 1:** Perplexity validates with generic rules
- **Day 2:** Perplexity validates with 1 success + generic rules
- **Day 3:** Perplexity validates with 3 successes + generic rules
- **Day 30:** Perplexity validates with 50+ successes + patterns
- **Result:** Fewer false positives, more accurate data

---

## Guard Rails (What Cloud Model Rejects)

The validator automatically rejects events that:

1. **Spam Indicators**
   - "viagra", "casino", "lottery", "cryptocurrency"
   - "click here", "buy now", "limited time"
   - "free money", "work from home"

2. **Invalid Dates**
   - Past dates (before today)
   - Wrong format (not YYYY-MM-DD)

3. **Generic Titles**
   - "event", "community event", "local event", "weekly event"
   - These are usually auto-generated/spam

4. **Missing Required Fields**
   - title, date, or city must be present
   - city must be in SETX area (Beaumont, Port Arthur, Orange, etc)

---

## Memory Files Structure

### successful-extractions.json
```json
{
  "extractions": [
    {
      "timestamp": "2025-11-02T12:00:00Z",
      "event": {
        "title": "Jazz Night at Julie Rogers",
        "date": "2025-11-15",
        "time": "7:30 PM",
        "price": "$15-25",
        "age_restriction": "All ages"
      },
      "changes": {
        "fields_filled": 2
      }
    }
  ]
}
```

### error-log.json
```json
{
  "errors": [
    {
      "timestamp": "2025-10-31T14:00:00Z",
      "pattern": "Events with 'limited time offer' in title",
      "reason": "Detected as spam"
    }
  ]
}
```

---

## Testing the Integration

### 1. Start Services
```bash
# Terminal 1: API
node api-server.js

# Terminal 2: Cloud Validator
PERPLEXITY_API_KEY="pplx-..." node event-validator-cloud.js

# Terminal 3: n8n (if not already running)
n8n start
```

### 2. Test Validator Directly
```bash
curl -X POST http://localhost:3003/api/validate-batch \
  -H "Content-Type: application/json" \
  -d '[
    {
      "title": "Jazz Festival 2025",
      "date": "2025-11-15",
      "city": "Beaumont",
      "category": "Music"
    }
  ]'

# Should return:
# {
#   "approved": [{ enriched event }],
#   "rejected": []
# }
```

### 3. Test Save to Database
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Jazz Festival 2025",
    "date": "2025-11-15",
    "time": "7:30 PM",
    "city": "Beaumont",
    "category": "Music",
    "location": "Julie Rogers Theatre"
  }'
```

### 4. Verify on Website
- Visit: http://localhost:3001/venues
- Click a venue to see events
- Click an event to see full details on `/event/:id` page

---

## Troubleshooting

### Validator returns 400 "API key not set"
**Problem:** Perplexity API key not being passed

**Solution:**
```bash
# Make sure API key is in environment BEFORE starting validator
export PERPLEXITY_API_KEY="pplx-..."
node event-validator-cloud.js
```

### Events not appearing in memory
**Problem:** Memory system not writing to files

**Solution:**
- Check file permissions: `chmod 755 memory-system/`
- Ensure `memory-system/` directory exists
- Check logs: `tail -f /tmp/cloud-validator.log`

### n8n workflow not triggering
**Problem:** Cron trigger not working

**Solution:**
- Verify n8n is running: `curl http://localhost:5678`
- Check workflow status in n8n UI
- Test manually by clicking "Execute" in n8n

---

## Next Steps

1. **Setup n8n workflow** - Use the JSON template above
2. **Configure for your venues** - Replace scraping URLs
3. **Set Perplexity API key** - Export in shell before running
4. **Test one venue** - Manually run workflow once
5. **Schedule for midnight** - Set Cron to `0 0 * * *`
6. **Monitor** - Check website daily for new events

---

## Key Benefits

✅ **Cloud model learns from memory** - Gets smarter each day without fine-tuning
✅ **No GPU needed** - Runs on any machine
✅ **Fast** - Perplexity inference is instant
✅ **Cost-effective** - ~$0.003 per venue (~$0.16/day)
✅ **Spam filtering** - Guards against junk data
✅ **Data enrichment** - Fills missing fields intelligently
✅ **Scalable** - Add more venues without code changes

---

**Questions?** Check the logs:
```bash
tail -f /tmp/cloud-validator.log
tail -f logs/api-server.log
```
