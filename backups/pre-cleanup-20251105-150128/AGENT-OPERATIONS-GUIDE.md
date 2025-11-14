# Agent Operations Guide - Universal MCP Service

## Overview

This guide explains how **ANY agent** (Perplexity, Claude, Ollama, GPT, etc.) can operate the SETX Events system by calling HTTP endpoints.

The system is completely agent-agnostic. No agent needs to know about the others.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ANY AGENT CAN USE THIS                   │
│                   (Perplexity, Claude, GPT, etc.)            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
     ┌─────────────────────────────────────┐
     │  Agent Orchestrator (Port 3005)    │
     │  Universal MCP Service             │
     └─────────────────────────────────────┘
           ↙          ↓         ↘
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │ Venue    │  │ Event    │  │ Learning │
     │Discovery │  │Validation│  │ Tracking │
     └──────────┘  └──────────┘  └──────────┘
           │          │              │
           ↓          ↓              ↓
     ┌──────────────────────────────────────┐
     │    SQLite Database                   │
     │  (Venues + Events)                   │
     └──────────────────────────────────────┘
           ↙          ↓         ↘
     n8n Workflow   Frontend   Memory System
```

---

## What Each Agent Role Does

### Cloud Agent (Perplexity/Claude)
**Purpose**: Discover new venues
**Task**: Search for event venues in SETX area

```
Cloud Agent
  ↓
Search: "event venues in Beaumont, Port Arthur, Orange Texas"
  ↓
Extract: Name, website, city, contact info
  ↓
POST /agent/venues/discover
  ↓
Database updated with new venues
```

**Responsible for:**
- Finding new venues
- Extracting venue data
- Submitting to system
- No validation needed (local agent does that)

### Local Agent (Ollama)
**Purpose**: Validate and process

**Phase 1 - Venue Validation**
```
Local Agent receives new venues from API
  ↓
Check: Duplicate? Valid website? Correct city?
  ↓
POST /agent/venues/validate
  ↓
Mark valid venues for n8n processing
```

**Phase 2 - Event Validation**
```
After n8n scrapes events
  ↓
Local Agent checks: Real event? Spam? Relevant?
  ↓
POST /agent/events/validate
  ↓
Store only authentic, relevant events
```

**Responsible for:**
- Quality control on venues
- Detecting spam events
- Checking authenticity
- No discovery needed (cloud agent does that)

---

## API Endpoints (For Any Agent)

### 1. VENUE DISCOVERY
**Who uses it**: Cloud agent (Perplexity, Claude)
**What it does**: Submit newly discovered venues

```bash
POST http://localhost:3005/agent/venues/discover
Content-Type: application/json

{
  "venues": [
    {
      "name": "Julie Rogers Theatre",
      "city": "Beaumont",
      "website": "https://www.julierogerstheatre.com",
      "phone": "(409) 835-2365",
      "email": "info@julierogerstheatre.com",
      "facebook_url": "https://facebook.com/julierogerstheatre",
      "instagram_handle": "@julierogerstheatre"
    },
    {
      "name": "The Orange Brewing Co",
      "city": "Orange",
      "website": "https://thebrewingco.com",
      "phone": "(409) 883-1234"
    }
  ],
  "agent_name": "Perplexity-Venue-Discovery-v1",
  "timestamp": "2025-11-02T15:30:00Z"
}

Response:
{
  "success": true,
  "results": {
    "submitted": 2,
    "duplicates": 0,
    "added": 2,
    "errors": []
  },
  "timestamp": "2025-11-02T15:30:05Z"
}
```

**Cloud Agent Prompt Example:**
```
You are searching for entertainment venues in Southeast Texas (SETX area).

Search for venues in: Beaumont, Port Arthur, Orange, Texas

For each venue found, extract:
- Name
- City
- Website URL
- Phone (if available)
- Email (if available)
- Facebook URL (if available)
- Instagram handle (if available)

Return as JSON array.

Then POST to: http://localhost:3005/agent/venues/discover
Include: "agent_name": "YourAgentName-v1"
```

---

### 2. VENUE VALIDATION
**Who uses it**: Local agent (Ollama)
**What it does**: Validate venues before n8n processes them

```bash
POST http://localhost:3005/agent/venues/validate
Content-Type: application/json

{
  "venues": [
    {
      "name": "Julie Rogers Theatre",
      "city": "Beaumont",
      "website": "https://www.julierogerstheatre.com"
    }
  ],
  "check_duplicates": true,
  "check_website": false
}

Response:
{
  "success": true,
  "total": 1,
  "valid": 1,
  "invalid": 0,
  "validated_venues": [
    {
      "name": "Julie Rogers Theatre",
      "city": "Beaumont",
      "website": "https://www.julierogerstheatre.com",
      "validation": {
        "is_valid": true,
        "errors": [],
        "warnings": []
      }
    }
  ]
}
```

**Local Agent Workflow:**
```
1. GET /agent/venues/current → Get venues n8n will use
2. Check each venue for:
   - Already in database? (skip if yes)
   - Valid city? (Beaumont, Port Arthur, Orange)
   - Website starts with http? (format check)
3. POST /agent/venues/validate → Validate batch
4. Review response:
   - "is_valid": true → Good to process
   - "is_valid": false → Fix or skip
5. Continue to n8n if valid
```

---

### 3. EVENT VALIDATION
**Who uses it**: Local agent (Ollama)
**What it does**: Check events for authenticity and relevance

```bash
POST http://localhost:3005/agent/events/validate
Content-Type: application/json

{
  "events": [
    {
      "title": "Jazz Festival 2025",
      "date": "2025-11-15",
      "time": "7:00 PM",
      "location": "Julie Rogers Theatre",
      "city": "Beaumont",
      "category": "Music",
      "description": "Annual jazz showcase featuring local and regional artists",
      "source_url": "https://julierogerstheatre.com/events/jazz"
    },
    {
      "title": "CLICK HERE FOR FREE MONEY",
      "date": "2025-11-10",
      "description": "Guaranteed money maker!",
      "category": "Spam"
    }
  ],
  "check_authenticity": true,
  "check_relevance": true
}

Response:
{
  "success": true,
  "total": 2,
  "valid": 1,
  "relevant": 1,
  "suspicious": 1,
  "validated_events": [
    {
      "title": "Jazz Festival 2025",
      "validation": {
        "is_valid": true,
        "is_relevant": true,
        "confidence": 98,
        "issues": {
          "authenticity": [],
          "relevance": [],
          "spam_indicators": []
        }
      }
    },
    {
      "title": "CLICK HERE FOR FREE MONEY",
      "validation": {
        "is_valid": false,
        "is_relevant": false,
        "confidence": 5,
        "issues": {
          "authenticity": ["Title too short or missing", ...],
          "relevance": ["Contains spam keyword: \"free money\""],
          "spam_indicators": ["Contains spam keyword: \"click here\""]
        }
      }
    }
  ]
}
```

**Local Agent Workflow:**
```
1. After n8n scrapes events
2. GET events from API
3. For each event, check:
   - Valid date format (YYYY-MM-DD)?
   - Title long enough? (>3 chars)
   - Description exists? (>10 chars)
   - Any spam keywords?
   - Relevant category for SETX?
4. POST /agent/events/validate → Validate batch
5. Review confidence scores:
   - >75% confidence → Save to database
   - <75% confidence → Flag for review
6. Update database with clean events
```

---

### 4. GET CURRENT VENUES
**Who uses it**: Any agent that needs venue list
**What it does**: Get venues currently in system for n8n to process

```bash
GET http://localhost:3005/agent/venues/current

Response:
{
  "success": true,
  "count": 53,
  "venues": [
    {
      "id": 1,
      "name": "Julie Rogers Theatre",
      "city": "Beaumont",
      "website": "https://www.julierogerstheatre.com",
      "is_active": 1,
      ...
    },
    ...
  ]
}
```

**Use case:**
- n8n needs to know which venues to scrape → GET this
- Local agent needs to validate new venues → GET this
- Cloud agent needs to compare against discovered venues → GET this

---

### 5. GET PERFORMANCE METRICS
**Who uses it**: Monitoring, optimization
**What it does**: See which agents discovered what

```bash
GET http://localhost:3005/agent/performance

Response:
{
  "success": true,
  "performance": {
    "agents": [
      {
        "name": "Perplexity-Venue-Discovery-v1",
        "venues_discovered": 5,
        "success_rate": 0.95,
        "last_run": "2025-11-02T15:30:00Z"
      },
      {
        "name": "Ollama-Venue-Validator-v1",
        "venues_validated": 5,
        "valid_rate": 0.92,
        "last_run": "2025-11-02T15:35:00Z"
      }
    ]
  }
}
```

---

### 6. GET LEARNING INSIGHTS
**Who uses it**: Optimization, strategic decisions
**What it does**: See what system has learned

```bash
GET http://localhost:3005/agent/insights

Response:
{
  "success": true,
  "insights": {
    "venue_patterns": [
      {
        "city": "Beaumont",
        "avg_website_quality": 0.85,
        "most_active_day": "Friday"
      }
    ],
    "event_patterns": [
      {
        "category": "Music",
        "avg_attendance": "250-500",
        "best_promotion_time": "2-3 weeks before"
      }
    ]
  }
}
```

---

## Example: Cloud Agent (Perplexity) Venue Discovery

```python
# Pseudo-code showing how Perplexity discovers venues

import requests

ORCHESTRATOR_URL = "http://localhost:3005"

def discover_venues():
    # 1. Search for venues
    venues = perplexity_search(
        "Event venues in Beaumont, Port Arthur, Orange Texas. " +
        "Include name, website, phone. JSON format."
    )

    # 2. Submit to orchestrator
    response = requests.post(
        f"{ORCHESTRATOR_URL}/agent/venues/discover",
        json={
            "venues": venues,
            "agent_name": "Perplexity-Venue-Discovery-v2",
            "timestamp": datetime.now().isoformat()
        }
    )

    # 3. Get results
    results = response.json()
    print(f"Added {results['results']['added']} new venues")

    return results

# Run daily
if __name__ == "__main__":
    discover_venues()
```

---

## Example: Local Agent (Ollama) Event Validation

```python
# Pseudo-code showing how Ollama validates events

import requests
import json

ORCHESTRATOR_URL = "http://localhost:3005"
API_URL = "http://localhost:3001/api"

def validate_events():
    # 1. Get events from API (after n8n scraped)
    events_response = requests.get(f"{API_URL}/events")
    events = events_response.json()

    # 2. Validate batch
    validation = requests.post(
        f"{ORCHESTRATOR_URL}/agent/events/validate",
        json={
            "events": events,
            "check_authenticity": True,
            "check_relevance": True
        }
    )

    results = validation.json()

    # 3. Update database based on validation
    for event in results['validated_events']:
        if event['validation']['confidence'] > 75:
            # Update event as validated
            requests.put(
                f"{API_URL}/events/{event['id']}",
                json={"validated": True}
            )

    print(f"Validated {results['valid']} events, flagged {results['suspicious']}")

    return results

# Run after n8n completes
if __name__ == "__main__":
    validate_events()
```

---

## Daily Workflow (For Any Agent Setup)

### Day Execution Timeline

```
00:00 (Midnight)
  ↓
n8n Workflow Starts
  ├─ Fetch all venues from /agent/venues/current
  ├─ Scrape each venue's website
  ├─ Parse events from HTML
  └─ POST raw events to /api/events

00:30 (30 minutes later)
  ↓
Local Agent (Ollama) Runs
  ├─ GET /agent/venues/current
  ├─ Validate venue list
  ├─ GET /api/events (from n8n scraping)
  ├─ POST /agent/events/validate
  └─ Update database with valid events only

00:45 (45 minutes later)
  ↓
Cloud Agent (Perplexity) Can Run
  ├─ Search for NEW venues (not in /agent/venues/current)
  ├─ Extract venue data
  └─ POST /agent/venues/discover

01:00 (1 hour later)
  ↓
Local Agent Validates New Venues
  ├─ GET /agent/venues/current (refreshed)
  ├─ Check newly discovered venues
  ├─ POST /agent/venues/validate
  └─ Flag good ones for n8n

Next Midnight
  ↓
n8n includes new venues in next scrape cycle
```

---

## Key Design Principles

### 1. Agent Independence
- Each agent works independently
- No agent needs to know about others
- Agents communicate only through orchestrator

### 2. Universal Access
- Any agent can use these endpoints
- Cloud agents, local agents, GPT, Perplexity, Claude, Ollama
- No code changes needed to add new agent types

### 3. Quality Control
- Cloud agents discover (quantity)
- Local agents validate (quality)
- Separate concerns = better results

### 4. Learning
- Every action is recorded in memory system
- System improves over time
- Future agents learn from past patterns

### 5. Flexibility
- Agent implementation is up to you
- Call orchestrator endpoints however you want
- HTTP/JSON is universal

---

## Monitoring & Debugging

### Check Service Health
```bash
curl http://localhost:3005/agent/health
```

### View Agent Performance
```bash
curl http://localhost:3005/agent/performance | jq '.'
```

### View Learning Insights
```bash
curl http://localhost:3005/agent/insights | jq '.'
```

### Test Venue Discovery
```bash
curl -X POST http://localhost:3005/agent/venues/discover \
  -H "Content-Type: application/json" \
  -d '{
    "venues": [{
      "name": "Test Venue",
      "city": "Beaumont",
      "website": "https://test.com"
    }],
    "agent_name": "test-agent"
  }'
```

### Test Event Validation
```bash
curl -X POST http://localhost:3005/agent/events/validate \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "title": "Test Event",
      "date": "2025-11-15",
      "description": "A test event for validation"
    }]
  }'
```

---

## Summary

**ANY agent** can operate this system by:

1. **Cloud agents** → POST `/agent/venues/discover`
2. **Local agents** → POST `/agent/venues/validate` and `/agent/events/validate`
3. **All agents** → GET `/agent/venues/current`, `/agent/performance`, `/agent/insights`

No agent lock-in. No hardcoded agent types. Pure HTTP/JSON universal interface.

The system learns from every action and improves over time, regardless of which agent performs the action.
