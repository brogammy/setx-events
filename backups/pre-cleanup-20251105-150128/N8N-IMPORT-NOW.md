# n8n Workflow Import - Do This Now (2 minutes)

## Status
- ✅ n8n is running on http://localhost:5678
- ✅ API is running on http://localhost:3001
- ✅ All 53 venues in database (verified)
- ✅ Workflow file is ready: `n8n-setx-scraper-COMPLETE.json`

**Next step: Import the workflow manually through the UI**

---

## The Simple Steps

### 1. Open n8n
```
http://localhost:5678
```

### 2. Click Import Workflow
Look for an **Import** button on the main screen or in the menu.

### 3. Choose "From File"
When prompted, select the file option.

### 4. Select This File
```
/home/sauly/setx-events/n8n-setx-scraper-COMPLETE.json
```

### 5. Click Import
n8n will load the workflow. You should see:
- Workflow name: "SETX Events Scraper - Complete with Real Venues"
- 10 nodes connected together

### 6. Click Save
Click the **Save** button (top-right corner or Ctrl+S)

### 7. Done!
The workflow is now imported and active. It will run daily at midnight automatically.

---

## What the Workflow Does

```
Every day at 00:00 (midnight):
  ↓
  Fetch ALL 53 venues from database
  ↓
  For each venue:
    ├─ Scrape venue website
    ├─ Parse HTML for events
    ├─ Validate with Perplexity (remove spam)
    ├─ Research images with MCP tool
    └─ Save to database
  ↓
  Get statistics
  ↓
  Log completion
```

---

## Verify It Worked

After saving, you should see in n8n:
- Workflow appears in the list
- Name: "SETX Events Scraper - Complete with Real Venues"
- Status: Active or Enabled

---

## Test It Manually (Optional)

Instead of waiting for midnight:

1. In n8n UI, find the workflow
2. Click the **Execute Workflow** button
3. Watch the nodes execute
4. Check database for new events:
```bash
curl http://localhost:3001/api/events | jq '.[0]'
```

---

## Troubleshooting

**"Import not working?"**
- Try Method 2: Copy-paste the JSON directly into n8n
- Or follow Method 3 in N8N-ACTUAL-SETUP.md for manual creation

**"Workflow imported but says error?"**
- Make sure API is running: `curl http://localhost:3001/api/health`
- Make sure optional services (if desired):
  - Perplexity validator: `curl http://localhost:3003/api/health`
  - MCP image tool: `curl http://localhost:3004/mcp/claude/health`

**"Where does it save events?"**
- API database: `http://localhost:3001/api/events`
- Website: `http://localhost:3001/venues` (shows updated events)

---

## That's It

The workflow is now part of your system. n8n is no longer excluded from the loop—it's the central orchestrator that runs everything daily.

Every midnight, the complete pipeline executes:
✅ Scrapes venues
✅ Parses events
✅ Validates data
✅ Researches images
✅ Saves to database
✅ Logs results

Your event system is now automated.
