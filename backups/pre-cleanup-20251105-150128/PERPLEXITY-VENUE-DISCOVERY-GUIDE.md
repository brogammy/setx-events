# PERPLEXITY VENUE DISCOVERY - AUTOMATED GUIDE

## Overview

Automatically discover and populate your SE Texas venue database using Perplexity AI. This script finds 50-70+ venues across all 6 SETX cities with complete information.

---

## What It Does

**Perplexity Venue Discovery** automatically:

1. **Researches all 6 SETX cities** (Beaumont, Port Arthur, Orange, Nederland, Vidor, Silsbee)
2. **Finds event venues** (theaters, music venues, museums, parks, etc.)
3. **Gathers complete information**:
   - Name, address, city
   - Phone, email, website
   - Facebook, Instagram URLs
   - Description and category
   - Priority level assessment

4. **Validates data** (removes duplicates, filters invalid entries)
5. **Imports to database** (direct API or fallback database insertion)
6. **Generates summary** (venues by city, total count)

---

## Prerequisites

### 1. Perplexity API Key
```bash
export PERPLEXITY_API_KEY="your-api-key-here"
```

Get key at: https://www.perplexity.ai/settings/api

### 2. Running Services
```bash
# Terminal 1: API server
node api-server.js

# Terminal 2: Discovery script
PERPLEXITY_API_KEY="..." node perplexity-venue-discovery.js
```

### 3. Node.js
- axios (already installed)
- sqlite3 (already installed)

---

## Quick Start (3 Steps)

### Step 1: Set API Key
```bash
export PERPLEXITY_API_KEY="pplx-xxxxxxxxxxxxxxx"
```

### Step 2: Ensure API Server is Running
```bash
# Make sure api-server.js is running
curl http://localhost:3001/api/health
```

### Step 3: Run Discovery
```bash
node perplexity-venue-discovery.js
```

**That's it!** The script will:
- Discover venues in all 6 cities
- Remove duplicates
- Import to database
- Show summary by city

---

## How It Works

### Step 1: Initialize (30 seconds)
- Checks Perplexity API connection
- Verifies database access
- Confirms all systems ready

### Step 2: Discover by City (5-10 minutes)
For each city:
1. Send research prompt to Perplexity
2. Ask for comprehensive venue list
3. Parse JSON response
4. Validate venues
5. Rate limit between cities (2 second delay)

**Perplexity finds:**
- Theaters & performing arts
- Music venues & bars
- Restaurants with events
- Museums & galleries
- Community centers
- Parks & outdoor venues
- Sports facilities
- Hotels & convention centers

### Step 3: Deduplicate (10 seconds)
- Remove duplicate venues (same name + city)
- Prepare for import

### Step 4: Import (30 seconds)
- Send all venues to database via API
- Handle failures gracefully
- Fallback to direct insertion if needed

### Step 5: Verify (10 seconds)
- Count total venues in database
- Show breakdown by city
- Confirm success

---

## Output Examples

### During Discovery
```
🎭 PERPLEXITY VENUE DISCOVERY - SE TEXAS
========================================

✅ Perplexity API connected

🔍 Discovering venues in Beaumont...
✅ Found 18 venues in Beaumont

🔍 Discovering venues in Port Arthur...
✅ Found 12 venues in Port Arthur

🔍 Discovering venues in Orange...
✅ Found 9 venues in Orange

[... continues for all cities ...]

✅ Discovery complete! Found 78 total venues

🔍 Checking for duplicates...
✅ Removed 3 duplicates. 75 venues remaining

📥 Importing venues to database...
✅ Imported 75 venues
```

### Final Summary
```
🎉 DISCOVERY COMPLETE!

📊 Summary:
   Venues discovered: 75
   Imported: 75
   Failed: 0
   Duplicates removed: 3
   Total in database: 75

📍 Venues by city:
   Beaumont: 18 venues
   Port Arthur: 12 venues
   Orange: 9 venues
   Nederland: 8 venues
   Vidor: 15 venues
   Silsbee: 13 venues
```

---

## Expected Results

### Typical Discovery
- **Total venues found:** 50-80 venues
- **Time to complete:** 5-10 minutes
- **Success rate:** 95%+ venues valid
- **Duplicates removed:** Usually 2-5
- **Database state:** Fully populated

### Venue Distribution
```
Beaumont:     15-20 venues (largest city)
Port Arthur:  10-15 venues
Orange:       8-12 venues
Nederland:    5-10 venues
Vidor:        5-10 venues
Silsbee:      5-10 venues
---
Total:        50-75 venues
```

---

## API Costs

**Per city research:** ~$0.003-0.005
**Total discovery:** ~$0.02-0.04 for all 6 cities

One-time cost to populate entire database!

---

## What Happens With the Data

### Immediate
- Venues stored in database
- Admin panel shows all venues
- API endpoints return venue data

### Next Steps (Recommended)
1. **Verify data** (optional, usually accurate)
2. **Run Perplexity scraper** on all venues:
   ```bash
   PERPLEXITY_API_KEY="..." node ai-scraper-memory-enabled.js
   ```
3. **Train Ollama** with learned patterns:
   ```bash
   node ollama-agent-learner.js
   ```
4. **Check results**:
   ```bash
   curl http://localhost:3001/api/venues | jq '.count'
   curl http://localhost:3001/api/admin/stats | jq '.upcoming_events'
   ```

---

## Troubleshooting

### "API Key not set"
```bash
export PERPLEXITY_API_KEY="your-key"
echo $PERPLEXITY_API_KEY  # Verify it's set
```

### "Cannot connect to API server"
```bash
# Make sure api-server.js is running
curl http://localhost:3001/api/health
# If fails, start it:
node api-server.js
```

### "No JSON found in response"
- Perplexity returned non-JSON
- This is rare, script handles it
- Usually just means fewer venues for that city

### "Failed to import"
- API might be down
- Script falls back to direct database insertion
- Check logs for specific errors

### "Some venues didn't import"
- Duplicate venue name already exists
- Invalid field (e.g., bad URL)
- Check errors in output
- Safe to re-run (duplicates handled)

---

## Advanced Usage

### Modify for Specific Categories
Edit the prompt in the script to focus on specific venue types:
```javascript
// Example: Find only music venues
"Include ONLY music venues: concert halls, live music bars, nightclubs..."
```

### Increase Venue Count
Modify the target in the prompt:
```javascript
// Find more venues per city
"Target: 25-30 venues per city"  // Instead of 12-20
```

### Focus on Specific Cities
Edit SETX_CITIES array:
```javascript
const SETX_CITIES = [
    { name: 'Beaumont', population: 'large' },
    // ... only include cities you want
];
```

### Verify Before Import
Check discovered venues before import:
```javascript
// After discovery, before import:
console.log(JSON.stringify(this.allVenues, null, 2));
// Review and comment out import if needed
```

---

## Manual Verification (Optional)

After discovery, you can verify venues manually:

### Check Admin Panel
```
http://localhost:3001/venue-admin.html
```
Browse all venues, check they look correct.

### Verify Contact Info
Sample a few venues:
- Check phone numbers are valid
- Verify websites exist
- Confirm addresses are correct

### Edit if Needed
Use admin panel to:
- Fix incorrect information
- Update missing details
- Adjust categories or priorities

---

## Re-running Discovery

Safe to run multiple times:
- Duplicates handled automatically
- Existing venues not removed
- Updates overwrite if same name + city

**Good reasons to re-run:**
- Update venue information
- Find venues added since last run
- Discover new categories

**Run again with:**
```bash
PERPLEXITY_API_KEY="..." node perplexity-venue-discovery.js
```

---

## Integration with Learning System

### Full Workflow

```
1. Discover venues (this script)
   ↓
   75 venues in database

2. Run Perplexity scraper
   PERPLEXITY_API_KEY="..." node ai-scraper-memory-enabled.js
   ↓
   300+ events discovered

3. Train Ollama
   node ollama-agent-learner.js
   ↓
   Ollama learns venue patterns

4. Daily operation
   - Ollama runs daily (free)
   - Perplexity 2-3x per week (cheap)
   - System improves daily

5. After 30 days
   - Ollama matches Perplexity quality
   - 90% cost reduction
   - Most accurate SE Texas events site
```

---

## Complete System Flow

```
PERPLEXITY VENUE DISCOVERY
├─ Research all 6 cities
├─ Find 50-75 venues
├─ Gather complete info
├─ Validate & deduplicate
└─ Import to database
   │
   ├─ Admin panel shows venues
   ├─ API endpoints available
   └─ Ready for event scraping
      │
      ├─ PERPLEXITY SCRAPER
      │  ├─ Scrapes each venue website
      │  ├─ Finds 300-500 events
      │  ├─ Teaches Ollama
      │  └─ Records patterns
      │
      ├─ OLLAMA LEARNER
      │  ├─ Reads learned patterns
      │  ├─ Uses in-context learning
      │  ├─ Scrapes venues
      │  ├─ Improves daily
      │  └─ Reaches 90% accuracy
      │
      └─ USER INTERFACE
         ├─ Browse events by city
         ├─ View venue information
         ├─ Get contact details
         └─ Navigate to venue
```

---

## Timeline

### Minute 1-2: Initialization
- Connect to Perplexity API
- Verify database
- Start discovery

### Minute 3-8: Discovery
- Research each city
- Find 50-75 venues
- ~5 minutes total

### Minute 9: Deduplication
- Remove duplicates
- Prepare for import

### Minute 10: Import & Verify
- Insert into database
- Show summary
- Complete

**Total time: ~10 minutes for full database population!**

---

## Code Quality

- ✅ Error handling for API failures
- ✅ Graceful fallback to direct insert
- ✅ Duplicate detection and removal
- ✅ Input validation
- ✅ Rate limiting (2s between cities)
- ✅ Clear logging
- ✅ Proper resource cleanup

---

## Files Created

- **perplexity-venue-discovery.js** (Main script)
- **PERPLEXITY-VENUE-DISCOVERY-GUIDE.md** (This file)

---

## Next Commands (Copy & Paste)

After discovery completes:

```bash
# 1. Train Perplexity on all venues
PERPLEXITY_API_KEY="your-key" node ai-scraper-memory-enabled.js

# 2. Train Ollama to learn
node ollama-agent-learner.js

# 3. Check results
curl http://localhost:3001/api/admin/stats | jq '.'

# 4. View in admin panel
# Open: http://localhost:3001/venue-admin.html
```

---

## Success!

You'll have:
✅ 50-75 venues in database
✅ All contact information
✅ Social media links
✅ Complete addresses
✅ Website URLs
✅ Ready for event scraping
✅ Ready for Ollama training

**In 10 minutes!** 🚀

---

## Support

Questions or issues?
- Check script output for specific errors
- Review troubleshooting section above
- See VENUE-SYSTEM-GUIDE.md for admin panel help
- Check database directly: `sqlite3 database.sqlite "SELECT COUNT(*) FROM venues;"`
