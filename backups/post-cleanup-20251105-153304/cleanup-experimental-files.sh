#!/bin/bash
# SETX Events - Safe Cleanup Script
# Archives experimental and unused files without deleting them

set -e  # Exit on error

ARCHIVE_DIR="archive-$(date +%Y%m%d-%H%M%S)"

echo "🧹 SETX Events - File Cleanup"
echo "================================"
echo ""
echo "This script will MOVE (not delete) experimental files to:"
echo "   $ARCHIVE_DIR/"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

mkdir -p "$ARCHIVE_DIR"
cd ~/setx-events

echo ""
echo "📦 Step 1: Archiving image downloader experiments..."
count=0
for file in \
    claude-download-venue-images.js \
    clean-and-redownload-images.js \
    create-venue-images.js \
    direct-venue-image-downloader.js \
    direct-wikipedia-downloader.js \
    download-all-venue-images.js \
    download-and-store-venue-images.js \
    download-real-venue-photos.js \
    download-remaining.js \
    download-screenshots.js \
    download-venue-images-now.js \
    download-venue-photos.js \
    download-with-firecrawl.js \
    download-working-images.js \
    enrich-venue-images.js \
    fetch-real-venue-images.js \
    final-venue-downloader.js \
    final-venue-images.js \
    find-venue-info.js \
    fix-image-references.js \
    fresh-venue-image-downloader.js \
    generate-venue-images.js \
    get-venue-image.js \
    google-images-downloader.js \
    image-enricher.js \
    image-filler.js \
    improved-venue-image-scraper.js \
    manual-google-visit.js \
    perplexity-image-finder.js \
    priority-website-image-downloader.js \
    real-venue-image-scraper.js \
    real-venue-photo-downloader.js \
    robust-image-downloader.js \
    robust-venue-image-downloader.js \
    scrape-venue-websites.js \
    targeted-julie-rogers.js \
    targeted-venue-downloader.js \
    test-and-download-images.js \
    unsplash-venue-image-downloader.js \
    wikipedia-venue-downloader.js \
    firecrawl-image-downloader.js \
    firecrawl-venue-image-downloader.js \
    use-firecrawl-mcp.js; do
    if [ -f "$file" ]; then
        mv "$file" "$ARCHIVE_DIR/"
        ((count++))
    fi
done
echo "   ✅ Archived $count image-related files"

echo ""
echo "📦 Step 2: Archiving test scripts..."
count=0
for file in test-*.js test-*.jpg; do
    if [ -f "$file" ]; then
        mv "$file" "$ARCHIVE_DIR/"
        ((count++))
    fi
done
echo "   ✅ Archived $count test files"

echo ""
echo "📦 Step 3: Archiving experimental scrapers..."
count=0
for file in \
    cloud-venue-discovery-agent.js \
    perplexity-venue-discovery.js \
    smart-venue-discovery.js \
    detailed-julie-search.js \
    claude-image-research-mcp.js \
    ai-scraper-memory-enabled.js \
    api-server-complete.js \
    event-validator-cloud.js \
    link-events-to-venues.js \
    venue-enrichment.js \
    service-monitor.js \
    update-event-images.js \
    trigger-cloud-agent-venue-images.js \
    setx-workflow-two-merges.json; do
    if [ -f "$file" ]; then
        mv "$file" "$ARCHIVE_DIR/"
        ((count++))
    fi
done
echo "   ✅ Archived $count experimental files"

echo ""
echo "📦 Step 4: Archiving redundant documentation..."
count=0
for file in \
    AGENT-OPERATIONS-GUIDE.md \
    AGENT-STRATEGY-FOR-YOUR-SYSTEM.md \
    AGENTS-COMPLETE.md \
    AGENTS.md \
    AI-SCRAPER-GUIDE.md \
    ALL-SERVICES-RUNNING-SUMMARY.md \
    CLOUD-AGENT-IMAGE-RESEARCH.md \
    CONTINUE-WORK.md \
    DOCUMENTATION_INDEX.md \
    FINAL-ARCHITECTURE-COMPLETE.md \
    FINAL-PROGRESS-VERIFICATION.md \
    FINAL-SUMMARY.md \
    IMAGE-SYSTEM-COMPLETE.md \
    LEARNING-SYSTEM-SUMMARY.md \
    LOCAL-AGENT-ARCHITECTURE.md \
    MCP-QUICK-START.md \
    MCP-UNIVERSAL-IMAGE-RESEARCH.md \
    MEMORY-AND-LEARNING-EXPLAINED.md \
    MEMORY-SYSTEM-README.md \
    N8N-ACTUAL-SETUP.md \
    N8N-CLOUD-VALIDATOR-INTEGRATION.md \
    N8N-IMPORT-NOW.md \
    N8N-INTEGRATION-COMPLETE.md \
    N8N-LOCAL-AGENT-SETUP.md \
    OLLAMA-IMPLEMENTATION-GUIDE.md \
    OLLAMA-LEARNING-QUICKSTART.md \
    OLLAMA-LEARNING-SYSTEM.md \
    PERPLEXITY-VENUE-DISCOVERY-GUIDE.md \
    PHASE1-COMPLETE.md \
    PROCESS-IDS-AND-SERVICES.md \
    PROGRESS-PRESERVATION.md \
    QUICK-REFERENCE.md \
    QUICK-START-IMAGES.md \
    QUICK-STATUS.txt \
    REBOOT-DOCUMENTATION.md \
    START-HERE.md \
    STATUS-SUMMARY.md \
    SYSTEM-COMPLETE.md \
    SYSTEM-READY-TO-USE.md \
    SYSTEM-STATUS-COMPLETE.md \
    SYSTEM-STATUS-FINAL.md \
    SYSTEM_DIAGRAM.md \
    THIS-SESSION-SUMMARY.md \
    UPDATES-COMPLETED.md \
    VENUE-EXPANSION-PLAN.md \
    VENUE-SYSTEM-SUMMARY.md \
    VENUE_IMAGE_DISCOVERY_PROMPT.md \
    WHAT-WAS-BUILT.md \
    venue-image-summary.md \
    venue-images-list.txt \
    venues-with-images.txt; do
    if [ -f "$file" ]; then
        mv "$file" "$ARCHIVE_DIR/"
        ((count++))
    fi
done
echo "   ✅ Archived $count documentation files"

echo ""
echo "📦 Step 5: Archiving old backup folders..."
count=0
for dir in backup backup_20251101_*; do
    if [ -d "$dir" ]; then
        mv "$dir" "$ARCHIVE_DIR/"
        ((count++))
    fi
done
echo "   ✅ Archived $count backup folders"

echo ""
echo "📦 Step 6: Archiving duplicate HTML files..."
count=0
for file in admin-dashboard.html admin.html; do
    if [ -f "$file" ]; then
        mv "$file" "$ARCHIVE_DIR/"
        ((count++))
    fi
done
echo "   ✅ Archived $count HTML files"

echo ""
echo "================================"
echo "✅ Cleanup Complete!"
echo "================================"
echo ""
echo "📊 All files moved to: $ARCHIVE_DIR/"
echo ""
echo "🔍 Next steps:"
echo "   1. Test your application:"
echo "      ./restart-all.sh"
echo "      curl http://localhost:3001/api/health"
echo ""
echo "   2. Browse to verify it works:"
echo "      http://localhost:8081"
echo ""
echo "   3. If everything works, you can delete the archive:"
echo "      rm -rf $ARCHIVE_DIR"
echo ""
echo "   4. To restore a file:"
echo "      cp $ARCHIVE_DIR/filename.js ."
echo ""
echo "📁 Files remaining in root:"
ls -1 *.js 2>/dev/null | wc -l | xargs echo "   JavaScript files:"
ls -1 *.md 2>/dev/null | wc -l | xargs echo "   Documentation files:"
echo ""
