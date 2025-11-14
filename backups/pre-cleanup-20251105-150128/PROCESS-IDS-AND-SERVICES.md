# Process IDs and Running Services - November 2, 2025

## Summary

All SETX Events services are running and operational. Full process documentation below.

---

## Active Services

### 1. n8n Workflow Automation
**Status**: ✅ RUNNING
**Process ID (PID)**: `1807682`
**User**: `sauly`
**Port**: `5678`
**Memory**: ~307 MB
**CPU**: 6.0%
**Uptime**: Started Nov 2 at 08:14 UTC

**Command**:
```bash
node /home/sauly/.nvm/versions/node/v20.19.5/bin/n8n start
```

**URL**: http://localhost:5678

**Workflow Status**:
- Workflow ID: `71c2b612-532e-497f-82a7-813726794bc7`
- Workflow Name: "SETX Events Scraper - Complete with Real Venues"
- Status: Active (active=1)
- Database: `/home/sauly/.n8n/database.sqlite`

**To Stop/Restart**:
```bash
# Kill process
kill 1807682

# Restart
cd /home/sauly && n8n start &
```

---

### 2. Express API Server
**Status**: ✅ RUNNING
**Process ID (PID)**: `1800282`
**User**: `sauly`
**Port**: `3001`
**Memory**: ~67 MB
**CPU**: 0.0%
**Uptime**: Started Nov 2 at 07:15 UTC (running for ~1 hour)

**Command**:
```bash
node api-server.js
```

**URL**: http://localhost:3001

**Features**:
- REST API with event/venue CRUD
- Admin dashboard for management
- Website frontend (venues, events, admin pages)
- Database: `/home/sauly/setx-events/database.sqlite`
- Data: 53 venues, 69 events

**API Endpoints**:
- `GET /api/health` - Health check
- `GET /api/venues` - List all venues
- `GET /api/events` - List all events
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

**To Stop/Restart**:
```bash
# Find and kill
kill 1800282

# Restart
cd /home/sauly/setx-events && node api-server.js &
```

---

### 3. Perplexity Event Validator (Cloud)
**Status**: ✅ RUNNING (OPTIONAL)
**Process ID (PID)**: `1803783`
**User**: `sauly`
**Port**: `3003`
**Memory**: ~58 MB
**CPU**: 0.0%
**Uptime**: Started Nov 2 at 07:33 UTC

**Command**:
```bash
node /home/sauly/setx-events/event-validator-cloud.js
```

**URL**: http://localhost:3003

**Purpose**:
- Validates events using Perplexity API
- Removes spam
- Enriches missing data
- Learns from validations

**Requirements**:
- `PERPLEXITY_API_KEY` environment variable

**To Stop/Restart**:
```bash
# Find and kill
kill 1803783

# Restart with API key
export PERPLEXITY_API_KEY="pplx-..."
cd /home/sauly/setx-events && node event-validator-cloud.js &
```

---

### 4. MCP Image Research Tool
**Status**: ✅ RUNNING (OPTIONAL)
**Process ID (PID)**: `1809411`
**User**: `sauly`
**Port**: `3004`
**Memory**: ~72 MB
**CPU**: 6.9%
**Uptime**: Started Nov 2 at 08:21 UTC

**Command**:
```bash
node /home/sauly/setx-events/claude-image-research-mcp.js
```

**URL**: http://localhost:3004

**Purpose**:
- Research and find images for events
- Universal MCP tool (works with any agent)
- Caches results for cost savings
- Validates image URLs
- Learns visual patterns

**Endpoints**:
- `POST /mcp/claude/research-event-images` - Research single event
- `POST /mcp/claude/research-batch-images` - Research multiple events
- `GET /mcp/claude/statistics` - View research statistics
- `GET /mcp/claude/health` - Health check

**Health Check**:
```bash
curl http://localhost:3004/mcp/claude/health
# Returns: {"status":"ok","service":"Claude Image Research MCP",...}
```

**To Stop/Restart**:
```bash
# Find and kill
kill 1809411

# Restart
cd /home/sauly/setx-events && node claude-image-research-mcp.js &
```

---

## Port Usage Summary

| Port | Service | PID | Status |
|------|---------|-----|--------|
| 3001 | Express API | 1800282 | ✅ Running |
| 3003 | Perplexity Validator | 1803783 | ✅ Running |
| 3004 | MCP Image Tool | 1809411 | ✅ Running |
| 5678 | n8n Workflow | 1807682 | ✅ Running |

---

## Database Files

### n8n Database
**Location**: `/home/sauly/.n8n/database.sqlite`
**Size**: Check with `ls -lh /home/sauly/.n8n/database.sqlite`

**Key Tables**:
- `workflow_entity` - Workflow definitions
- `shared_workflow` - Workflow-to-project mappings
- `webhook_entity` - Webhook configurations

**Our Workflow**:
```sql
SELECT id, name, active FROM workflow_entity WHERE id = '71c2b612-532e-497f-82a7-813726794bc7';
-- Result: 71c2b612-532e-497f-82a7-813726794bc7|SETX Events Scraper - Complete with Real Venues|1
```

### SETX Events Database
**Location**: `/home/sauly/setx-events/database.sqlite`
**Size**: Check with `ls -lh /home/sauly/setx-events/database.sqlite`

**Key Tables**:
- `venues` - 53 venues
- `events` - 69 events
- `event_sources` - Event source tracking
- `scrape_log` - Scraping audit trail

---

## Health Checks

### Test All Services
```bash
# API health
curl http://localhost:3001/api/health

# n8n responsive
curl -s http://localhost:5678 | grep -o "n8n.io" | head -1

# Validator health (if running)
curl http://localhost:3003/api/health

# Database check
sqlite3 /home/sauly/setx-events/database.sqlite "SELECT COUNT(*) FROM venues;"
```

### Expected Results
```json
{
  "status": "ok",
  "service": "api-server",
  "timestamp": "2025-11-02T14:30:00Z"
}
```

---

## Memory and Performance

### Current Usage
```
n8n:          ~307 MB  (6.0% CPU)
API:          ~67 MB   (0.0% CPU)
Validator:    ~58 MB   (0.0% CPU)
Total:        ~432 MB
```

### Monitoring
```bash
# Watch all services
watch -n 2 'ps aux | grep -E "n8n|api-server|event-validator" | grep -v grep'

# Top memory consumers
ps aux --sort=-%mem | grep -E "n8n|api-server|event-validator" | head -5
```

---

## Process Management

### Kill a Service
```bash
# Kill by PID
kill 1807682

# Kill by name
pkill -f "n8n start"
pkill -f "api-server.js"
pkill -f "event-validator-cloud.js"
```

### Restart All Services
```bash
# Option 1: Using existing script (if available)
./restart-all.sh

# Option 2: Manual restart
pkill -f "n8n start"
pkill -f "api-server.js"
pkill -f "event-validator-cloud.js"

sleep 2

cd /home/sauly && n8n start &
cd /home/sauly/setx-events && node api-server.js &
cd /home/sauly/setx-events && PERPLEXITY_API_KEY="pplx-..." node event-validator-cloud.js &
```

---

## Workflow Execution

### n8n Workflow Details
**Name**: SETX Events Scraper - Complete with Real Venues
**ID**: `71c2b612-532e-497f-82a7-813726794bc7`
**Nodes**: 10 (Cron → Fetch → Loop → Scrape → Parse → Validate → Images → Save → Stats → Log)
**Schedule**: Daily at 00:00 UTC
**Status**: Active

### Manual Execution
1. Open http://localhost:5678
2. Click on workflow
3. Click "Execute Workflow" button
4. Watch nodes execute in real-time

### Check Execution Results
```bash
# Get event count after execution
curl http://localhost:3001/api/events | jq 'length'

# Get all events
curl http://localhost:3001/api/events | jq '.'

# Check venue count (should be 53)
curl http://localhost:3001/api/venues | jq 'length'
```

---

## Logs and Debugging

### n8n Logs
```bash
# Real-time logs (if running in foreground)
tail -f /tmp/n8n.log

# Check n8n logs directory
ls -la /home/sauly/.n8n/logs/

# Check for errors
grep -i "error\|fail" /tmp/n8n.log
```

### API Logs
```bash
# If using log file
tail -f /home/sauly/setx-events/logs/api-server.log

# Or watch stdout
ps aux | grep "api-server.js"
```

### Validator Logs
```bash
# Tail logs
tail -f /home/sauly/setx-events/logs/validator.log
```

---

## Next Steps

### 1. Verify n8n Workflow Visible
- Open http://localhost:5678
- You should see "SETX Events Scraper - Complete with Real Venues" in workflows list
- Workflow status should be "Active"

### 2. Test Manual Execution
```bash
# In n8n UI, click "Execute Workflow"
# Watch nodes execute
# Check results:
curl http://localhost:3001/api/events | jq 'length'
```

### 3. Monitor Schedule
- Workflow runs daily at 00:00 UTC
- Check logs after execution
- Verify events saved to database

---

## Quick Reference

### Start All Services
```bash
# Terminal 1: API
cd /home/sauly/setx-events && node api-server.js &

# Terminal 2: n8n
cd /home/sauly && n8n start &

# Terminal 3: Validator (optional)
export PERPLEXITY_API_KEY="pplx-..."
cd /home/sauly/setx-events && node event-validator-cloud.js &
```

### Check All Running
```bash
ps aux | grep -E "n8n|api-server|event-validator" | grep -v grep
```

### Kill All
```bash
pkill -f "n8n start"
pkill -f "api-server.js"
pkill -f "event-validator-cloud.js"
```

### Port Status
```bash
lsof -i :3001 -i :3003 -i :3004 -i :5678
```

---

## Critical Information

**Last Updated**: November 2, 2025 14:14 UTC
**System**: Linux (sauly user)
**n8n Version**: Latest (via nvm)
**Node Version**: v20.19.5
**Database**: SQLite3

**Database Injection Fix Applied**:
- Added `shared_workflow` record linking workflow to project
- Allows n8n to recognize and display the workflow
- Workflow now shows in n8n GUI as "Active"

---

## Files Referenced

- **Workflow JSON**: `/home/sauly/setx-events/n8n-setx-scraper-COMPLETE.json`
- **API Code**: `/home/sauly/setx-events/api-server.js`
- **Validator Code**: `/home/sauly/setx-events/event-validator-cloud.js`
- **API Database**: `/home/sauly/setx-events/database.sqlite`
- **n8n Database**: `/home/sauly/.n8n/database.sqlite`
- **n8n Config**: `/home/sauly/.n8n/config`
