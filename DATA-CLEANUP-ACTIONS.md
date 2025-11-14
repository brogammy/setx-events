# SETX Events - Data Cleanup Actions

## Overview
Comprehensive audit completed on 2025-11-14 identifying data quality issues and closed venues.

**Key Finding:** Database is 96.3% healthy with mostly legitimate venues. Four critical issues require immediate attention.

---

## Critical Issues Found

### 1. ✅ RAMADA INN PORT ARTHUR - Already Handled
- **Status:** Correctly marked as `is_active = 0`
- **Verified:** Closed as of March 2025
- **Action:** None needed - already properly marked

### 2. ⚠️ CLOUD AGENT TEST VENUE - Already Handled
- **Status:** Correctly marked as `is_active = 0`
- **Reason:** Development/testing artifact
- **Action:** None needed - already properly marked

---

## Data Quality Issues to Fix

### Priority 1: IMMEDIATE (Execute These)

#### Issue 1.1: Duplicate Julie Rogers Theatre
- **Venue IDs:** 1 and 7
- **Problem:** Same venue appears twice with different URLs
- **Fix:** Delete ID 7, keep ID 1
```sql
DELETE FROM venues WHERE id = 7;
```
**Expected Result:** 54 → 53 venues

#### Issue 1.2: Angel Gardens Has Placeholder Data
- **Venue ID:** 40
- **Problem:** Website shows "Not listed in search results" (placeholder text)
- **Fix:** Mark as inactive until real data is found
```sql
UPDATE venues SET is_active = 0
WHERE id = 40 AND website = 'Not listed in search results';
```
**Expected Result:** 52 active → 51 active venues

#### Issue 1.3: Dunn Gallery Event Explosion
- **Event IDs:** 172-194 (23 consecutive duplicate entries)
- **Problem:** Same exhibition repeated daily instead of single ongoing event
- **Fix:** Keep first occurrence, delete 22 duplicates
```sql
DELETE FROM events WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY title, location ORDER BY date) as rn
    FROM events
    WHERE title = 'Exhibit on Display in the Dunn Gallery'
  )
  WHERE rn > 1
);
```
**Expected Result:** 99 → 77 events

#### Issue 1.4: PACE Venue Has Wrong URL
- **Venue ID:** 26
- **Current URL:** https://www.texaspaceauthority.org/ (Texas Space Authority - aerospace org)
- **Problem:** URL points to unrelated organization
- **Fix:** Flag for manual research and correction
```sql
UPDATE venues SET description = COALESCE(description, '')
  || ' [NEEDS VERIFICATION: Website appears incorrect - currently points to Space Authority]'
WHERE id = 26;
```

---

### Priority 2: Research & Fix (Manual Work)

#### Venues Missing Website/Contact Info
These venues should be researched to add legitimate contact information:

1. **Knights of Columbus - Port Arthur** (ID: 30)
   - No website, phone, or email
   - Action: Research and add contact info

2. **Rose Hill Manor** (ID: 23)
   - No website or phone
   - Action: Research and add contact info

3. **St. James Kirwin Hall** (ID: 28)
   - No website, phone, or email
   - Action: Research and add contact info

4. **Wellborn's (owned by Bobby Wilson)** (ID: 31)
   - No website, phone, or email
   - Action: Research and add contact info

5. **Department Club** (ID: 33) - Port Arthur
   - No website or phone (listed on tourism site but minimal info)
   - Action: Research and add contact info

6. **Benoit's Louis Hall Event Center** (ID: 50) - Vidor
   - No website listed
   - Action: Research and add contact info

#### Questionable Venues
1. **Evergreen Event Center** (ID: 47) - Vidor
   - Website: https://swimply.com/pooldetails/74722 (swimming pool rental)
   - Issue: Unusual for traditional event venue
   - Action: Verify if correct venue or data entry error

---

## How to Apply Fixes

### Option A: Automatic (Recommended)
Execute the provided SQL cleanup script:
```bash
# Backup database first
cp database.sqlite backups/database.sqlite.backup-$(date +%Y%m%d-%H%M%S)

# Stop API server
pkill -f "node api-server.js"

# Apply cleanup script
sqlite3 database.sqlite < CLEANUP-DATA-SCRIPT.sql

# Restart API server
node api-server.js
```

### Option B: Manual via API
Use the Express API to update venues:
```bash
# Mark Angel Gardens inactive
curl -X PUT http://localhost:3001/api/venues/40 \
  -H "Content-Type: application/json" \
  -d '{"is_active": 0}'

# Delete duplicate venue
curl -X DELETE http://localhost:3001/api/venues/7
```

### Option C: Step-by-Step via SQLite CLI
```bash
sqlite3 database.sqlite

# View venues before changes
SELECT id, name, city, is_active FROM venues WHERE id IN (1, 7, 26, 40);

# Delete duplicate
DELETE FROM venues WHERE id = 7;

# Mark Angel Gardens inactive
UPDATE venues SET is_active = 0 WHERE id = 40;

# View changes
SELECT COUNT(*) FROM venues WHERE is_active = 1;
SELECT COUNT(*) FROM events WHERE title = 'Exhibit on Display in the Dunn Gallery';
```

---

## Expected Results After Cleanup

### Before Cleanup
- **Venues:** 54 total (52 active, 2 inactive)
- **Events:** 99 total
- **Issues:** 4 critical, 6 missing data, 1 questionable

### After Priority 1 Cleanup
- **Venues:** 53 total (51 active, 2 inactive)
- **Events:** 77 total
- **Issues Resolved:** All 4 critical issues
- **Remaining:** 6 missing data (Priority 2), 1 questionable (Priority 2)

---

## Verification Steps

After running cleanup, verify changes:

```bash
# Check venue count
curl http://localhost:3001/api/venues | jq 'length'

# Check active venues
sqlite3 database.sqlite "SELECT COUNT(*) FROM venues WHERE is_active = 1;"

# Check duplicate Julie Rogers Theatre removed
sqlite3 database.sqlite "SELECT id, name FROM venues WHERE name LIKE '%Julie%';"

# Check Dunn Gallery consolidated
sqlite3 database.sqlite "SELECT COUNT(*) FROM events WHERE title = 'Exhibit on Display in the Dunn Gallery';"

# Check Angel Gardens inactive
sqlite3 database.sqlite "SELECT id, name, is_active FROM venues WHERE id = 40;"
```

---

## Verified Open Venues (Sample)

These venues were verified as currently operating in 2025:

✅ **Julie Rogers Theatre** - Active, multiple 2025 events scheduled
✅ **Art Museum of Southeast Texas (AMSET)** - Open Mon-Sun, free admission
✅ **Ford Park Entertainment Complex** - Active, 2025 events scheduled
✅ **The Logon Cafe & Pub** - Open 11am-12:30am, still operating

---

## Ongoing Recommendations

### Short-term (1-2 weeks)
1. Execute Priority 1 cleanup script
2. Research and add data for Priority 2 venues
3. Verify Evergreen Event Center status

### Medium-term (1-2 months)
1. Implement venue verification status in database
2. Add `last_verified_date` column to track when venue info was last checked
3. Create automated website availability checker

### Long-term (3+ months)
1. Implement recurring event support in database schema
2. Add event source/URL tracking for easier verification
3. Set up quarterly audit process
4. Implement venue rating/quality score based on data completeness

---

## Questions?

If unsure about any venue:
1. Check venue website directly
2. Search Google Maps for business listing
3. Call venue directly for current status
4. Check social media (Facebook, Instagram)

For detailed audit report, see: `VENUE-DATA-AUDIT-REPORT.md`

---

**Last Updated:** 2025-11-14
**Audit Completed By:** Claude Code
**Database File:** database.sqlite (54 venues, 99 events)
