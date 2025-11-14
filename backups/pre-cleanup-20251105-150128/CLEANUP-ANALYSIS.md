# SETX Events - Cleanup Analysis & Recommendations

**Generated:** 2025-11-04
**Purpose:** Identify unused files and reduce project clutter

---

## Summary

**Total Files in Root:** 77 JavaScript files, 54 Markdown docs
**Recommended for Deletion:** ~50+ files (65% reduction)
**Space Saved:** ~2-3 MB (excluding node_modules/backups)

---

## ✅ CORE FILES - KEEP THESE (Currently Running)

### Active Services
```
api-server.js              # Main API server (PID: 183269, Port: 3001)
dashboard-server.js        # Dashboard WebSocket server (PID: 86292)
```

### Core Scrapers & Logic
```
index.js                   # Ollama-powered event scraper
ai-scraper.js              # Perplexity AI scraper
venue-scraper.js           # Base scraping utilities
venue-service.js           # Venue business logic
venue-api-routes.js        # Venue API endpoints
event-validator.js         # Event validation logic
```

### Support Systems
```
ollama-memory.js           # Ollama learning/memory system
agent-orchestrator.js      # Agent coordination layer
local-agent-controller.js  # Local agent management
```

### Configuration & Startup
```
package.json               # Node dependencies
restart-all.sh             # Main service restart script
start-all.sh               # Alternative startup script
daily-scrape.sh            # Cron job script
complete-setup.sh          # Initial setup script
populate-events.sh         # Event population script
integrate-backup.sh        # Backup integration
install-everything.sh      # Dependency installer
```

### N8N Workflows
```
n8n-workflows/             # All workflow JSON files (KEEP ALL)
n8n-setx-scraper-COMPLETE.json
n8n-setx-scraper-workflow.json
setup-n8n-workflow.sh
```

### Database & Data
```
database.sqlite            # Main SQLite database (110 KB)
memory/                    # Ollama memory files
memory-system/             # Memory system storage
image-research-cache/      # Image research cache
```

---

## 🗑️ SAFE TO DELETE - Experimental/Test Files (43+ files)

### Image Downloader Experiments (30+ files)
**These were various attempts to download venue images. Most are duplicates or failed experiments.**

```bash
# Test Scripts
test-venue-image-download.js
test-download.jpg
test-first-venue.js
test-julie-rogers.js
test-museum-venue.js
test-real-websites.js
test-search-terms.js
test-n8n-scrapers.js

# Image Download Attempts (many variations of the same concept)
claude-download-venue-images.js
clean-and-redownload-images.js
create-venue-images.js
direct-venue-image-downloader.js
direct-wikipedia-downloader.js
download-all-venue-images.js
download-and-store-venue-images.js
download-real-venue-photos.js
download-remaining.js
download-screenshots.js
download-venue-images-now.js
download-venue-photos.js
download-with-firecrawl.js
download-working-images.js
enrich-venue-images.js
fetch-real-venue-images.js
final-venue-downloader.js
final-venue-images.js
find-venue-info.js
fix-image-references.js
fresh-venue-image-downloader.js
generate-venue-images.js
get-venue-image.js
google-images-downloader.js
image-enricher.js
image-filler.js
improved-venue-image-scraper.js
manual-google-visit.js
perplexity-image-finder.js
priority-website-image-downloader.js
real-venue-image-scraper.js
real-venue-photo-downloader.js
robust-image-downloader.js
robust-venue-image-downloader.js
scrape-venue-websites.js
targeted-julie-rogers.js
targeted-venue-downloader.js
test-and-download-images.js
unsplash-venue-image-downloader.js
wikipedia-venue-downloader.js
firecrawl-image-downloader.js
firecrawl-venue-image-downloader.js
use-firecrawl-mcp.js

# Image-related metadata
venue-image-summary.md
venue-images-list.txt
venues-with-images.txt
```

### Discovery/Research Experiments
```bash
cloud-venue-discovery-agent.js
perplexity-venue-discovery.js
smart-venue-discovery.js
detailed-julie-search.js
claude-image-research-mcp.js
```

### Other Experimental Files
```bash
ai-scraper-memory-enabled.js      # Superseded by ai-scraper.js
api-server-complete.js            # Old version, use api-server.js
event-validator-cloud.js          # Cloud variant not used
link-events-to-venues.js          # One-time migration script
venue-enrichment.js               # Experimental enrichment
service-monitor.js                # Not actively used
update-event-images.js            # One-time script
trigger-cloud-agent-venue-images.js
setx-workflow-two-merges.json     # Old workflow variant
```

### Unused HTML Pages (in root, not public/)
```bash
admin-dashboard.html              # Duplicate of public/dashboard.html
admin.html                        # Duplicate of public/dashboard.html
```

---

## 📚 DOCUMENTATION - Consolidate & Reduce (54 files → ~10 files)

### Keep These Essential Docs
```
README.md                         # Main project overview
CLAUDE.md                         # Developer instructions (for Claude Code)
SYSTEM-MAP.md                     # System architecture map
VENUE-SYSTEM-GUIDE.md             # Venue system documentation
QUICK_START.md                    # Quick start guide
ARCHITECTURE.md                   # Architecture details
```

### Archive or Delete - Redundant Documentation
**Most of these are session notes, progress logs, or duplicate information:**

```bash
# Session Notes & Progress Logs (DELETE)
AGENT-OPERATIONS-GUIDE.md
AGENT-STRATEGY-FOR-YOUR-SYSTEM.md
AGENTS-COMPLETE.md
AGENTS.md
AI-SCRAPER-GUIDE.md
ALL-SERVICES-RUNNING-SUMMARY.md
CLOUD-AGENT-IMAGE-RESEARCH.md
CONTINUE-WORK.md
DOCUMENTATION_INDEX.md
FINAL-ARCHITECTURE-COMPLETE.md
FINAL-PROGRESS-VERIFICATION.md
FINAL-SUMMARY.md
IMAGE-SYSTEM-COMPLETE.md
LEARNING-SYSTEM-SUMMARY.md
LOCAL-AGENT-ARCHITECTURE.md
MCP-QUICK-START.md
MCP-UNIVERSAL-IMAGE-RESEARCH.md
MEMORY-AND-LEARNING-EXPLAINED.md
MEMORY-SYSTEM-README.md
N8N-ACTUAL-SETUP.md
N8N-CLOUD-VALIDATOR-INTEGRATION.md
N8N-IMPORT-NOW.md
N8N-INTEGRATION-COMPLETE.md
N8N-LOCAL-AGENT-SETUP.md
OLLAMA-IMPLEMENTATION-GUIDE.md
OLLAMA-LEARNING-QUICKSTART.md
OLLAMA-LEARNING-SYSTEM.md
PERPLEXITY-VENUE-DISCOVERY-GUIDE.md
PHASE1-COMPLETE.md
PROCESS-IDS-AND-SERVICES.md
PROGRESS-PRESERVATION.md
QUICK-REFERENCE.md
QUICK-START-IMAGES.md
QUICK-STATUS.txt
REBOOT-DOCUMENTATION.md
START-HERE.md
STATUS-SUMMARY.md
SYSTEM-COMPLETE.md
SYSTEM-READY-TO-USE.md
SYSTEM-STATUS-COMPLETE.md
SYSTEM-STATUS-FINAL.md
SYSTEM_DIAGRAM.md
THIS-SESSION-SUMMARY.md
UPDATES-COMPLETED.md
VENUE-EXPANSION-PLAN.md
VENUE-SYSTEM-SUMMARY.md
VENUE_IMAGE_DISCOVERY_PROMPT.md
WHAT-WAS-BUILT.md
```

---

## 🗂️ BACKUP FOLDERS - Clean Up Old Backups

```bash
backup/                    # DELETE (if empty or old)
backup_20251101_085906/    # DELETE (old backup)
backup_20251101_090149/    # DELETE (old backup)
backup_20251101_090359/    # DELETE (old backup)
backup_20251101_090653/    # DELETE (old backup)
backups/                   # KEEP (current backup system)
```

**Action:** Delete backup_* folders created on Nov 1st. Keep only `backups/` folder.

---

## 📋 PUBLIC FOLDER - Already Clean

The `public/` folder is well-organized. All files are actively used:

```
public/
  ├── index.html              # Main event listing (Port 8081)
  ├── venues.html             # Venue listing
  ├── dashboard.html          # Admin dashboard
  ├── simple-dashboard.html   # Simplified dashboard
  ├── live-dashboard.html     # Real-time dashboard
  ├── venue-admin.html        # Venue administration
  ├── venue.html              # Individual venue view
  ├── event.html              # Individual event view
  └── images/                 # Venue images directory
```

**Action:** No cleanup needed in public/ folder.

---

## 🚀 Recommended Cleanup Script

Create this script to safely archive experimental files:

```bash
#!/bin/bash
# cleanup-experimental-files.sh

ARCHIVE_DIR="archive-$(date +%Y%m%d)"
mkdir -p "$ARCHIVE_DIR"

echo "📦 Archiving experimental files to $ARCHIVE_DIR/"

# Archive image downloader experiments
mv *-image*.js "$ARCHIVE_DIR/" 2>/dev/null
mv *-venue-image*.js "$ARCHIVE_DIR/" 2>/dev/null
mv download-*.js "$ARCHIVE_DIR/" 2>/dev/null
mv test-*.js "$ARCHIVE_DIR/" 2>/dev/null
mv *-julie-*.js "$ARCHIVE_DIR/" 2>/dev/null
mv firecrawl-*.js "$ARCHIVE_DIR/" 2>/dev/null

# Archive redundant docs
mv *-COMPLETE.md "$ARCHIVE_DIR/" 2>/dev/null
mv *-SUMMARY.md "$ARCHIVE_DIR/" 2>/dev/null
mv PHASE*.md "$ARCHIVE_DIR/" 2>/dev/null
mv STATUS-*.md "$ARCHIVE_DIR/" 2>/dev/null
mv QUICK-STATUS.txt "$ARCHIVE_DIR/" 2>/dev/null

# Archive old backups
mv backup_20251101_* "$ARCHIVE_DIR/" 2>/dev/null

# Archive unused HTML
mv admin-dashboard.html "$ARCHIVE_DIR/" 2>/dev/null
mv admin.html "$ARCHIVE_DIR/" 2>/dev/null

echo "✅ Files archived to $ARCHIVE_DIR/"
echo ""
echo "📊 To permanently delete:"
echo "   rm -rf $ARCHIVE_DIR"
echo ""
echo "📊 To restore a file:"
echo "   cp $ARCHIVE_DIR/filename.js ."
```

---

## 📊 File Count Summary

| Category | Current | After Cleanup | Reduction |
|----------|---------|---------------|-----------|
| JavaScript files | 77 | 25 | -67% |
| Markdown docs | 54 | 8 | -85% |
| Backup folders | 5 | 1 | -80% |
| Public HTML files | 9 | 9 | 0% |

---

## ⚠️ Important Notes

1. **Test First**: Run the application after cleanup to ensure nothing breaks
2. **Archive, Don't Delete**: Move files to an archive folder first
3. **Check Dependencies**: Some test files might be referenced in docs
4. **Backup Database**: Always backup `database.sqlite` before major changes
5. **Git Status**: If using git, commit current state before cleanup

---

## 🎯 Next Steps

1. **Review this list** - Confirm which files you want to keep
2. **Create archive folder** - Don't delete, just move files
3. **Run cleanup script** - Use the script above or manual selection
4. **Test application** - Verify all services still work
5. **Remove archive** - After confirming everything works (1-2 weeks)

---

## 🔍 How to Verify File Usage

To check if a file is actually used:

```bash
# Search for imports/requires of a file
grep -r "require.*filename" . --exclude-dir=node_modules
grep -r "import.*filename" . --exclude-dir=node_modules

# Check if any process is running it
ps aux | grep filename

# Check recent access time
stat filename.js
```

---

**Questions?** Check [CLAUDE.md](CLAUDE.md) for development guidance.
