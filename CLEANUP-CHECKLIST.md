# Data Cleanup Execution Checklist

## Pre-Cleanup Tasks

- [ ] Read `AUDIT-SUMMARY.txt` for quick overview
- [ ] Read `VENUE-DATA-AUDIT-REPORT.md` for detailed findings
- [ ] Read `DATA-CLEANUP-ACTIONS.md` for step-by-step instructions
- [ ] Verify API server is running: `curl http://localhost:3001/api/health`
- [ ] Backup current database: `cp database.sqlite backups/database.sqlite.backup-$(date +%Y%m%d-%H%M%S)`

## Cleanup Execution

### Option 1: Automated SQL Script (Recommended - 5 minutes)

- [ ] Stop API server: `pkill -f "node api-server.js"`
- [ ] Verify database backed up
- [ ] Execute cleanup script:
  ```bash
  sqlite3 database.sqlite < CLEANUP-DATA-SCRIPT.sql
  ```
- [ ] Restart API server: `node api-server.js`
- [ ] Verify changes applied (see verification section below)

### Option 2: Manual SQLite Commands (10 minutes)

- [ ] Stop API server: `pkill -f "node api-server.js"`
- [ ] Open SQLite: `sqlite3 database.sqlite`
- [ ] **Fix #1:** Delete duplicate Julie Rogers Theatre
  ```sql
  DELETE FROM venues WHERE id = 7;
  SELECT id, name FROM venues WHERE name LIKE '%Julie%';
  ```
  Expected: Only ID 1 returned
  
- [ ] **Fix #2:** Mark Angel Gardens inactive
  ```sql
  UPDATE venues SET is_active = 0 
  WHERE id = 40 AND website = 'Not listed in search results';
  SELECT id, name, is_active FROM venues WHERE id = 40;
  ```
  Expected: is_active = 0
  
- [ ] **Fix #3:** Flag PACE venue for review
  ```sql
  UPDATE venues 
  SET description = COALESCE(description, '') || ' [NEEDS VERIFICATION: Website appears incorrect]'
  WHERE id = 26;
  SELECT id, description FROM venues WHERE id = 26;
  ```
  
- [ ] **Fix #4:** Consolidate Dunn Gallery events
  ```sql
  DELETE FROM events WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY title, location ORDER BY date) as rn 
      FROM events WHERE title = 'Exhibit on Display in the Dunn Gallery'
    ) WHERE rn > 1
  );
  UPDATE events 
  SET description = 'Ongoing exhibition - Daily during museum hours'
  WHERE title = 'Exhibit on Display in the Dunn Gallery' AND date = '2025-12-05';
  SELECT COUNT(*) FROM events WHERE title = 'Exhibit on Display in the Dunn Gallery';
  ```
  Expected: 1 event returned

- [ ] Exit SQLite: `.quit`
- [ ] Restart API server: `node api-server.js`
- [ ] Verify changes (see verification section below)

### Option 3: Via REST API (15 minutes)

- [ ] Verify API server is running
- [ ] **Fix #1:** Delete duplicate Julie Rogers Theatre
  ```bash
  curl -X DELETE http://localhost:3001/api/venues/7
  ```
  
- [ ] **Fix #2:** Mark Angel Gardens inactive
  ```bash
  curl -X PUT http://localhost:3001/api/venues/40 \
    -H "Content-Type: application/json" \
    -d '{"is_active": false}'
  ```
  
- [ ] **Fix #3 & #4:** No direct API for these (use SQL or script)

## Verification Steps

### Immediate Verification (After cleanup)

- [ ] Check venue count:
  ```bash
  sqlite3 database.sqlite "SELECT COUNT(*) FROM venues;"
  ```
  Expected: 53 (down from 54)

- [ ] Check active venues:
  ```bash
  sqlite3 database.sqlite "SELECT COUNT(*) FROM venues WHERE is_active = 1;"
  ```
  Expected: 51 (down from 52)

- [ ] Check duplicate Julie Rogers removed:
  ```bash
  sqlite3 database.sqlite "SELECT id, name FROM venues WHERE name LIKE '%Julie%';"
  ```
  Expected: Only 1 row (ID 1)

- [ ] Check Dunn Gallery consolidated:
  ```bash
  sqlite3 database.sqlite "SELECT COUNT(*) FROM events WHERE title = 'Exhibit on Display in the Dunn Gallery';"
  ```
  Expected: 1 (down from 23)

- [ ] Check total events:
  ```bash
  sqlite3 database.sqlite "SELECT COUNT(*) FROM events;"
  ```
  Expected: 77 (down from 99)

- [ ] Check Angel Gardens status:
  ```bash
  sqlite3 database.sqlite "SELECT id, name, is_active FROM venues WHERE id = 40;"
  ```
  Expected: is_active = 0

- [ ] Test API health:
  ```bash
  curl http://localhost:3001/api/health
  ```
  Expected: 200 OK with healthy status

- [ ] Test event endpoints:
  ```bash
  curl http://localhost:3001/api/events | jq '.data | length'
  ```
  Expected: Should work without errors

### Comprehensive Verification

- [ ] View all venues summary:
  ```bash
  sqlite3 database.sqlite "SELECT city, COUNT(*) as count FROM venues WHERE is_active = 1 GROUP BY city;"
  ```

- [ ] Spot-check several events:
  ```bash
  curl http://localhost:3001/api/events?city=Beaumont | jq '.data[:5]'
  ```

- [ ] Check database integrity:
  ```bash
  sqlite3 database.sqlite "PRAGMA integrity_check;"
  ```
  Expected: "ok"

## Priority 2 Tasks (Optional - Research Work)

- [ ] **Knights of Columbus - Port Arthur (ID: 30)**
  - [ ] Search for current contact info
  - [ ] Update venue record with findings
  - [ ] Save to: `PRIORITY-2-RESEARCH.txt`

- [ ] **Rose Hill Manor (ID: 23)**
  - [ ] Search for current contact info
  - [ ] Update venue record with findings

- [ ] **St. James Kirwin Hall (ID: 28)**
  - [ ] Search for current contact info
  - [ ] Update venue record with findings

- [ ] **Wellborn's (ID: 31)**
  - [ ] Search for current contact info
  - [ ] Update venue record with findings

- [ ] **Department Club - Port Arthur (ID: 33)**
  - [ ] Search for current contact info
  - [ ] Update venue record with findings

- [ ] **Benoit's Louis Hall Event Center (ID: 50)**
  - [ ] Search for current contact info
  - [ ] Update venue record with findings

- [ ] **Evergreen Event Center (ID: 47)**
  - [ ] Verify if Swimply pool is correct venue
  - [ ] Research actual venue status
  - [ ] Decide: keep or remove

## Post-Cleanup

- [ ] All checks passed? ✓
- [ ] No errors in logs? Check: `tail -20 logs/api-server.log`
- [ ] Frontend still loads? Visit: http://localhost:8081
- [ ] Can browse events without issues?
- [ ] Create summary of changes made
- [ ] Document any issues encountered
- [ ] Share results with team

## Rollback Plan (If Needed)

If cleanup causes issues:

```bash
# Stop API server
pkill -f "node api-server.js"

# Restore from backup
cp backups/database.sqlite.backup-YYYYMMDD database.sqlite

# Restart API server
node api-server.js
```

## Success Criteria

✅ Cleanup successful when:
- [ ] All 4 verification checks pass
- [ ] API server starts without errors
- [ ] Events/venues load in frontend
- [ ] No data corruption found (PRAGMA integrity_check = ok)
- [ ] All critical issues resolved

---

**Estimated Time to Complete:**
- Automated script: 5 minutes
- Manual SQL: 10 minutes
- Full cleanup with Priority 2: 2-3 hours

**Last Updated:** 2025-11-14
**Status:** Ready to Execute
