# ⚡ QUICK REFERENCE - SETX EVENTS

## 🚀 Start the System

```bash
# Terminal 1: API Server
node api-server.js

# Terminal 2: Check status
node local-agent-controller.js check-status
```

**Then open in browser:**
- Venues: http://localhost:3001/venues
- Admin: http://localhost:3001/admin

---

## 📍 Public Pages

| Page | URL | What You See |
|------|-----|--------------|
| **All Venues** | /venues | Search, filter, browse 53 venues |
| **Venue Details** | /venue/1 | Full venue info, events, contact |

---

## 🎮 Commands

```bash
# Check system health
node local-agent-controller.js check-status

# Run scraper now (doesn't wait for midnight)
node local-agent-controller.js trigger-scrape

# See learning progress
node local-agent-controller.js learn

# Show n8n setup
node local-agent-controller.js setup-workflows
```

---

## 📊 Database

```bash
# How many venues?
sqlite3 database.sqlite "SELECT COUNT(*) FROM venues WHERE is_active = 1;"

# How many events?
sqlite3 database.sqlite "SELECT COUNT(*) FROM events;"

# View a venue
sqlite3 database.sqlite "SELECT name, address, phone, email FROM venues LIMIT 1;"
```

---

## 🔧 Automation

**Runs automatically every day at midnight:**
- Searches 53 venues for events
- Adds new events to database
- Learns from successful scrapes
- Improves accuracy over time

**You don't need to do anything - it just works!**

---

## 💾 Backup & Restore

```bash
# Backup database
cp database.sqlite database.sqlite.backup

# Backup memory
cp -r memory/ memory.backup/

# Restore
cp database.sqlite.backup database.sqlite
cp -r memory.backup/ memory/
```

---

## 🐛 Troubleshooting

### API Server Won't Start
```bash
# Kill existing process
pkill -f "node api-server.js"

# Start fresh
node api-server.js
```

### Venues Page Shows No Data
1. Check API is running: `curl http://localhost:3001/api/health`
2. Check database: `sqlite3 database.sqlite "SELECT COUNT(*) FROM venues;"`
3. Restart API server

### n8n Automation Not Running
1. Check n8n is running: `curl http://localhost:5678`
2. Open n8n: http://localhost:5678
3. Verify workflow is "Active" (green toggle)

### Scraper Errors
```bash
# Check API key is set
echo $PERPLEXITY_API_KEY

# Manual test
PERPLEXITY_API_KEY="your-key" node ai-scraper-memory-enabled.js
```

---

## 📈 Monitoring

```bash
# Watch for new events
watch -n 5 "sqlite3 database.sqlite 'SELECT COUNT(*) FROM events;'"

# Watch for scraper runs
tail -f logs/api-server.log

# Check memory updates
ls -lt memory/ | head -5
```

---

## 🌐 URLs

| Service | URL |
|---------|-----|
| **API** | http://localhost:3001 |
| **Venues** | http://localhost:3001/venues |
| **Admin** | http://localhost:3001/admin |
| **n8n** | http://localhost:5678 |
| **Health** | http://localhost:3001/api/health |

---

## 📞 Support

Check these docs for more help:
- `SYSTEM-COMPLETE.md` - Full system overview
- `N8N-LOCAL-AGENT-SETUP.md` - Automation setup
- `CLAUDE.md` - Developer guide
- `AGENTS.md` - AI model guidance

---

## ✅ Daily Checklist

- [ ] System running: `node local-agent-controller.js check-status`
- [ ] Events growing: Check database count
- [ ] Learning active: Check memory files exist
- [ ] API responsive: `curl http://localhost:3001/api/health`
- [ ] Admin accessible: Visit http://localhost:3001/admin

---

**That's it! The system runs itself. Just monitor and enjoy!** 🎉
