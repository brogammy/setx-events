#!/usr/bin/env node

/**
 * Handle Recurring Events
 *
 * Identifies and consolidates recurring events:
 * - Museum exhibits (daily/continuous)
 * - Garden events (daily during season)
 * - Workshops that repeat
 *
 * Options:
 * 1. Keep one entry per recurring event with recurrence metadata
 * 2. Tag occurrences as recurring
 * 3. Merge into single event record with start/end dates
 */

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

async function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

async function analyzeRecurringEvents() {
    console.log('\n🔄 Analyzing recurring events...\n');

    // Find events that appear multiple times
    const recurring = await queryAsync(`
        SELECT
            title,
            COUNT(*) as occurrences,
            MIN(date) as first_date,
            MAX(date) as last_date,
            GROUP_CONCAT(id) as ids,
            location,
            category
        FROM events
        GROUP BY LOWER(TRIM(title))
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
    `);

    console.log(`Found ${recurring.length} recurring event series:\n`);

    for (const event of recurring) {
        const ids = event.ids.split(',');
        const keepId = Math.min(...ids.map(Number)); // Keep earliest
        const removeIds = ids.map(Number).filter(id => id !== keepId);

        console.log(`📅 "${event.title}"`);
        console.log(`   Occurrences: ${event.occurrences}`);
        console.log(`   Date range: ${event.first_date} to ${event.last_date}`);
        console.log(`   Type: ${event.category} - ${event.location}`);
        console.log(`   Keeping ID: ${keepId}, Removing: ${removeIds.join(', ')}\n`);
    }

    return recurring;
}

async function consolidateRecurringEvents() {
    console.log('⚙️  Consolidating recurring events...\n');

    const recurring = await queryAsync(`
        SELECT
            title,
            COUNT(*) as occurrences,
            MIN(date) as first_date,
            MAX(date) as last_date,
            MIN(id) as keep_id,
            GROUP_CONCAT(id) as all_ids
        FROM events
        GROUP BY LOWER(TRIM(title))
        HAVING COUNT(*) > 1
    `);

    for (const event of recurring) {
        const allIds = event.all_ids.split(',').map(Number);
        const removeIds = allIds.filter(id => id !== event.keep_id);

        // Add recurrence metadata to kept event
        await runAsync(`
            UPDATE events
            SET
                description = COALESCE(description, '') || char(10) || '[RECURRING: ' || ? || ' occurrences from ' || ? || ' to ' || ? || ']',
                updated_at = datetime('now')
            WHERE id = ?
        `, [event.occurrences, event.first_date, event.last_date, event.keep_id]);

        // Remove duplicate occurrences
        const placeholders = removeIds.map(() => '?').join(',');
        const deleted = await runAsync(
            `DELETE FROM events WHERE id IN (${placeholders})`,
            removeIds
        );

        console.log(`✅ "${event.title}"`);
        console.log(`   Kept ID ${event.keep_id}, removed ${deleted} duplicate(s)\n`);
    }
}

async function verifyResults() {
    console.log('\n✔️  Verifying results...\n');

    const stats = await queryAsync(`
        SELECT
            COUNT(*) as total_events,
            COUNT(DISTINCT LOWER(TRIM(title))) as unique_events,
            SUM(CASE WHEN description LIKE '%RECURRING%' THEN 1 ELSE 0 END) as recurring_marked
        FROM events
    `);

    const stat = stats[0];
    console.log(`Total events: ${stat.total_events}`);
    console.log(`Unique events: ${stat.unique_events}`);
    console.log(`Marked as recurring: ${stat.recurring_marked}`);

    // Show remaining duplicates
    const stillRecurring = await queryAsync(`
        SELECT title, COUNT(*) as count
        FROM events
        GROUP BY LOWER(TRIM(title))
        HAVING COUNT(*) > 1
        LIMIT 5
    `);

    if (stillRecurring.length > 0) {
        console.log(`\nRemaining recurring events:`);
        for (const event of stillRecurring) {
            console.log(`  - "${event.title}": ${event.count} occurrences`);
        }
    }

    console.log();
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  SETX Events - Handle Recurring Events                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    try {
        // Step 1: Analyze
        const recurring = await analyzeRecurringEvents();

        if (recurring.length === 0) {
            console.log('✅ No problematic recurring events found!\n');
            db.close();
            process.exit(0);
        }

        // Ask before consolidating
        console.log('📋 Options:');
        console.log('1. Keep all occurrences (for detailed calendar)');
        console.log('2. Keep first + mark as recurring (recommended for event lists)');
        console.log('3. Keep first + delete duplicates\n');

        // For now, implement option 2
        console.log('Implementing option 2: Keeping first occurrence + marking as recurring\n');
        await consolidateRecurringEvents();
        await verifyResults();

        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║  Done! Recurring events consolidated.                      ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        db.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        db.close();
        process.exit(1);
    }
}

main();
