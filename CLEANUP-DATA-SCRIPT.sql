-- SETX Events Database Cleanup Script
-- Priority 1: Critical Data Quality Fixes
-- Date: 2025-11-14

-- ============================================
-- ISSUE 1: Remove Duplicate Julie Rogers Theatre
-- ============================================
-- Julie Rogers Theatre appears twice (IDs: 1 and 7)
-- ID 1: Official website URL
-- ID 7: City government page (duplicate source)
-- Keep ID 1, delete ID 7

DELETE FROM venues WHERE id = 7;

-- Verify deletion
SELECT 'After deleting duplicate Julie Rogers Theatre:' AS status;
SELECT id, name, city, website FROM venues WHERE name LIKE '%Julie%';

-- ============================================
-- ISSUE 2: Mark questionable venues for review
-- ============================================

-- Angel Gardens (ID: 40) - has placeholder text in URL
-- Current website: "Not listed in search results"
-- This should be either fixed or marked inactive
UPDATE venues 
SET is_active = 0 
WHERE id = 40 AND website = 'Not listed in search results';

SELECT 'Marked Angel Gardens as inactive (needs manual verification):' AS status;
SELECT id, name, city, website, is_active FROM venues WHERE id = 40;

-- ============================================
-- ISSUE 3: Fix PACE venue incorrect URL
-- ============================================
-- PACE (ID: 26) currently points to Texas Space Authority
-- This needs to be researched and corrected manually
-- For now, just flag it with a note

UPDATE venues 
SET description = COALESCE(description, '') || ' [NEEDS VERIFICATION: Website appears incorrect - currently points to Space Authority]'
WHERE id = 26;

SELECT 'Flagged PACE venue for URL verification:' AS status;
SELECT id, name, city, website, description FROM venues WHERE id = 26;

-- ============================================
-- ISSUE 4: Consolidate Dunn Gallery Events
-- ============================================
-- The "Exhibit on Display in the Dunn Gallery" event
-- appears 23 times with consecutive daily dates (2025-12-05 through 2025-12-28)
-- Delete all but the first occurrence

-- First, see what we have
SELECT 'Dunn Gallery Events Before Cleanup:' AS status;
SELECT id, title, date FROM events 
WHERE title = 'Exhibit on Display in the Dunn Gallery' 
ORDER BY date;

-- Delete duplicates, keep only the first one (earliest date)
DELETE FROM events 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY title, location ORDER BY date) as rn 
    FROM events 
    WHERE title = 'Exhibit on Display in the Dunn Gallery'
  )
  WHERE rn > 1
);

-- Update the kept event to indicate it's a recurring/ongoing exhibition
UPDATE events 
SET description = 'Ongoing exhibition in the Dunn Gallery - Daily exhibition during museum hours'
WHERE title = 'Exhibit on Display in the Dunn Gallery' 
  AND date = '2025-12-05';

SELECT 'After Dunn Gallery consolidation:' AS status;
SELECT id, title, date, description FROM events 
WHERE title = 'Exhibit on Display in the Dunn Gallery';

-- ============================================
-- SUMMARY: Changes Made
-- ============================================
SELECT '=== CLEANUP SUMMARY ===' AS status;
SELECT 'Deleted duplicate Julie Rogers Theatre (ID: 7)' AS action
UNION ALL
SELECT 'Marked Angel Gardens as inactive (ID: 40)' AS action
UNION ALL
SELECT 'Flagged PACE venue for URL review (ID: 26)' AS action
UNION ALL
SELECT 'Consolidated Dunn Gallery events (kept 1, deleted 22)' AS action;

-- Final venue count
SELECT COUNT(*) as total_active_venues FROM venues WHERE is_active = 1;
SELECT COUNT(*) as total_inactive_venues FROM venues WHERE is_active = 0;

-- Final event count
SELECT COUNT(*) as total_events FROM events;
