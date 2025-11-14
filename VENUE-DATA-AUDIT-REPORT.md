# SETX Events Database Audit Report
**Date:** November 14, 2025
**Total Venues:** 54
**Total Events:** 99

---

## Executive Summary

**CRITICAL ISSUES FOUND:**

### ⚠️ Closed/Inactive Venues (2)
1. **Ramada Inn Port Arthur** (ID: 32) - Status: CLOSED as of March 2025
   - Website: ramada.com (general)
   - Marked as: `is_active = 0` ✅ (correctly marked)
   - Status: Properly handled

2. **Cloud Agent Test Venue** (ID: 54) - Test/Dummy Venue
   - Website: https://cloud-agent-test.com
   - Marked as: `is_active = 0` ✅ (correctly marked)
   - Status: Development artifact, properly disabled

### 🟡 Data Quality Issues (Multiple)

#### Duplicate Venues
- **Julie Rogers Theatre** appears TWICE (IDs: 1 and 7)
  - ID 1: `http://www.julierogerstheatre.com/`
  - ID 7: `https://www.beaumonttexas.gov/234/Beaumont-Events`
  - Both marked as active and pointing to same venue
  - **Recommendation:** Delete ID 7, consolidate to ID 1

#### Missing or Incomplete Information
- **Knights of Columbus - Port Arthur** (ID: 30)
  - No website or contact info
  - Marked as active
  
- **Rose Hill Manor** (ID: 23)
  - No website or phone
  - Marked as active

- **St. James Kirwin Hall** (ID: 28)
  - No website, phone, or email
  - Marked as active

- **Wellborn's (owned by Bobby Wilson)** (ID: 31)
  - No website, phone, or email
  - Marked as active

- **Benoit's Louis Hall Event Center** (ID: 50) - Vidor
  - No website listed
  - Marked as active
  
- **Department Club** (ID: 33) - Port Arthur
  - No website or phone
  - Marked as active
  - Note: Listed on tourism site but minimal info

- **PACE (Port Arthur Community Events)** (ID: 26)
  - Website: https://www.texaspaceauthority.org/ (appears to be WRONG - Texas Space Authority is aerospace org)
  - Marked as active

- **Angel Gardens** (ID: 40) - Orange
  - Website: "Not listed in search results"
  - Facebook: "Not listed in search results (but referenced as 'Angel Gardens Facebook' in one result)"
  - Marked as active
  - **Status:** Data quality issue - appears to be placeholder/placeholder text

#### Questionable/Uncertain Venues
- **Evergreen Event Center** (ID: 47) - Vidor
  - Website: https://swimply.com/pooldetails/74722 (appears to be swimming pool rental, not typical event venue)
  - Facebook: "Not publicly listed in search results"

---

## Verified OPEN Venues (Sample Verification)

✅ **Julie Rogers Theatre** - CONFIRMED OPEN
   - Verified: Has 2025 events, multiple ticketing platforms
   - Status: Active

✅ **Art Museum of Southeast Texas (AMSET)** - CONFIRMED OPEN
   - Hours: Mon-Fri 9am-5pm, Sat 10am-5pm, Sun 12pm-5pm
   - Free admission
   - Status: Active

✅ **Ford Park Entertainment Complex** - CONFIRMED OPEN
   - Currently managed by OVG360
   - 2025 events: Jon Pardi (10/24/25), Mannheim Steamroller (12/29/25)
   - Status: Active

✅ **The Logon Cafe & Pub** - CONFIRMED OPEN (As of November 2025)
   - Located: 3805 Calder Ave, Beaumont
   - Hours: 11am-12:30am
   - Still operating as music venue/restaurant
   - Status: Active

---

## Event Data Issues

### 🔴 CRITICAL: Duplicate/Repetitive Events
- **"Exhibit on Display in the Dunn Gallery"** at Museum of the Gulf Coast appears **MULTIPLE TIMES**
  - Event IDs: 172-194 (23 consecutive entries!)
  - Dates: Daily from 2025-12-05 through 2025-12-28
  - This appears to be an exhibition that runs continuously
  - **Issue:** Each date is a separate event entry instead of one recurring event
  - **Recommendation:** Consolidate into single recurring event or single event with "Daily" notation

### Recent Events (Spot Check)
- Mannheim Steamroller Christmas (12/29/25) - ✅ VERIFIED at Ford Park
- PCRMM Annual Gala (6/6/26) - Bowers Civic Center Port Arthur - REASONABLE
- Whose Live Anyway? (3/14/26) - Jefferson Theatre - REASONABLE

### Event Time Issues
- Many events have "TBD" or "Museum hours" as time
- Some events use inconsistent time formats (7:30 PM vs 06:00 PM)

---

## Database Schema Observations

### Venues Table Issues
- No `last_scraped` column (schema shows: id, name, address, city, category, website, facebook_url, instagram_url, phone, email, description, logo_url, cover_image_url, is_active, priority, created_at, updated_at)
- `is_active` field is INTEGER (0/1) - working correctly
- `priority` field exists but rarely used (defaults to 5)

### Events Table Issues
- Total 99 events, but many are duplicates (Dunn Gallery exhibition)
- No `recurring_event` flag or pattern field
- Some time values are descriptive text ("Museum hours 9:00 AM - 5:00 PM") rather than standard time format

---

## Recommendations

### Priority 1: IMMEDIATE ACTION REQUIRED
1. **Remove duplicate Julie Rogers Theatre** (ID: 7)
   ```sql
   DELETE FROM venues WHERE id = 7;
   ```

2. **Fix Angel Gardens venue** (ID: 40)
   - Either find real website/contact or mark as inactive
   - Current data contains placeholder text

3. **Consolidate Dunn Gallery events** (IDs: 172-194)
   - Replace 23 separate daily events with single recurring event
   - Update event model to support recurring patterns

4. **Fix PACE venue** (ID: 26)
   - Replace Space Authority URL with correct venue website
   - Research actual PACE event venue location

### Priority 2: DATA QUALITY IMPROVEMENTS
1. **Add missing information** for:
   - Knights of Columbus - Port Arthur (ID: 30)
   - Rose Hill Manor (ID: 23)
   - St. James Kirwin Hall (ID: 28)
   - Wellborn's (ID: 31)
   - Department Club (ID: 33)
   - Benoit's Louis Hall (ID: 50)

2. **Verify Evergreen Event Center** (ID: 47)
   - Swimply pool rental doesn't seem like traditional event venue
   - Verify if this is correct venue or data entry error

3. **Standardize time formats**
   - Convert all times to HH:MM format or consistent string format
   - Handle "TBD" and "Museum hours" times differently (use event_description field instead)

### Priority 3: LONG-TERM IMPROVEMENTS
1. Implement recurring event support in database
2. Add venue verification status (verified, unverified, inactive)
3. Add venue last_verified_date column
4. Implement automated venue website checking
5. Add event URL/source tracking for verification

---

## Statistics

### Venue Distribution by City
- Beaumont: 20 venues
- Port Arthur: 13 venues
- Orange: 10 venues
- Other (Silsbee, Vidor, Nederland): 11 venues

### Venue Status
- Active: 52 venues (96.3%)
- Inactive: 2 venues (3.7%)

### Event Distribution by City
- Port Arthur (Museum of Gulf Coast): ~23 events (mostly Dunn Gallery repetitions)
- Beaumont: ~40 events
- Orange: ~20 events
- Other: ~16 events

### Top Event Categories
- Museum: ~23 events
- Theater/Performing Arts: ~15 events
- Music/Concert: ~20 events
- Other: ~41 events

---

## Conclusion

The database has **good overall data quality** with two critical issues:

✅ **What's Working Well:**
- Most venues are still in business (96.3% active)
- Event venues are mostly legitimate and verifiable
- Inactive venues are properly marked

❌ **Critical Issues to Fix:**
1. Duplicate Julie Rogers Theatre entry
2. Placeholder data for Angel Gardens
3. Incorrect URL for PACE venue
4. Excessive event duplication (Dunn Gallery)

🔧 **Estimated Fix Time:** 1-2 hours for manual cleanup

