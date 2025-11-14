#!/usr/bin/env node

/**
 * Deduplication & Image Completion Script
 * 1. Removes duplicate events (keeps best version)
 * 2. Fills missing event images with venue cover images
 * 3. Maintains data integrity and completeness
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

async function findAndRemoveDuplicates() {
    console.log('\n🔍 Scanning for duplicate events...\n');

    const duplicates = await queryAsync(`
        SELECT
            title,
            date,
            city,
            GROUP_CONCAT(id) as ids,
            COUNT(*) as count
        FROM events
        GROUP BY LOWER(TRIM(title)), date, city
        HAVING count > 1
        ORDER BY count DESC
    `);

    if (duplicates.length === 0) {
        console.log('✅ No duplicates found!\n');
        return 0;
    }

    console.log(`Found ${duplicates.length} duplicate sets\n`);

    let removed = 0;
    for (const dup of duplicates) {
        const ids = dup.ids.split(',').map(Number).sort((a, b) => a - b);
        const keep = ids[0]; // Keep first (oldest)
        const deleteIds = ids.slice(1); // Remove rest

        console.log(`📋 Event: "${dup.title}" (${dup.date})`);
        console.log(`   Keeping ID: ${keep}, Removing IDs: ${deleteIds.join(', ')}`);

        // Delete duplicates
        const placeholders = deleteIds.map(() => '?').join(',');
        const deleteCount = await runAsync(
            `DELETE FROM events WHERE id IN (${placeholders})`,
            deleteIds
        );

        // Log to scrape_log
        await runAsync(`
            INSERT INTO scrape_log (scraper_name, scraped_items, duplicates_found, timestamp)
            VALUES ('deduplication', 0, ?, datetime('now'))
        `, [deleteIds.length]);

        removed += deleteCount;
        console.log(`   ✅ Removed ${deleteCount} duplicate(s)\n`);
    }

    return removed;
}

async function fillMissingEventImages() {
    console.log('\n🖼️  Filling missing event images with venue pictures...\n');

    // Get events without images or with placeholder images
    const eventsNeedingImages = await queryAsync(`
        SELECT DISTINCT
            e.id,
            e.title,
            e.venue_id,
            e.image_url,
            v.cover_image_url,
            v.logo_url,
            v.name
        FROM events e
        LEFT JOIN venues v ON e.venue_id = v.id
        WHERE e.image_url IS NULL
            OR e.image_url = ''
            OR e.image_url LIKE '%placehold%'
        ORDER BY e.id
    `);

    if (eventsNeedingImages.length === 0) {
        console.log('✅ All events have images!\n');
        return 0;
    }

    console.log(`Found ${eventsNeedingImages.length} events needing images\n`);

    let updated = 0;
    for (const event of eventsNeedingImages) {
        let imageUrl = null;

        // Try venue cover image first
        if (event.cover_image_url && !event.cover_image_url.includes('placehold')) {
            imageUrl = event.cover_image_url;
            console.log(`✅ Event "${event.title}"`);
            console.log(`   Using venue cover: ${event.name}`);
        }
        // Fallback to venue logo
        else if (event.logo_url && !event.logo_url.includes('placehold')) {
            imageUrl = event.logo_url;
            console.log(`✅ Event "${event.title}"`);
            console.log(`   Using venue logo: ${event.name}`);
        }
        // No venue image available
        else {
            console.log(`⚠️  Event "${event.title}"`);
            console.log(`   No venue image available`);
            continue;
        }

        if (imageUrl) {
            const changes = await runAsync(
                'UPDATE events SET image_url = ?, updated_at = datetime(\'now\') WHERE id = ?',
                [imageUrl, event.id]
            );
            if (changes > 0) updated++;
        }
    }

    console.log(`\n✅ Updated ${updated} events with venue images\n`);
    return updated;
}

async function verifyIntegrity() {
    console.log('\n✔️  Verifying data integrity...\n');

    // Check for orphaned events
    const orphanedEvents = await queryAsync(`
        SELECT COUNT(*) as count
        FROM events e
        WHERE e.venue_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM venues v WHERE v.id = e.venue_id)
    `);

    if (orphanedEvents[0].count > 0) {
        console.log(`⚠️  Found ${orphanedEvents[0].count} events with missing venues`);
        // Optionally clean these up
    } else {
        console.log('✅ All events have valid venues');
    }

    // Check images
    const stats = await queryAsync(`
        SELECT
            COUNT(*) as total_events,
            SUM(CASE WHEN image_url IS NOT NULL AND image_url != ''
                     AND image_url NOT LIKE '%placehold%' THEN 1 ELSE 0 END) as with_images,
            SUM(CASE WHEN image_url IS NULL OR image_url = ''
                     OR image_url LIKE '%placehold%' THEN 1 ELSE 0 END) as without_images
        FROM events
    `);

    const stat = stats[0];
    console.log(`\n📊 Event Statistics:`);
    console.log(`   Total events: ${stat.total_events}`);
    console.log(`   With images: ${stat.with_images} (${Math.round(stat.with_images / stat.total_events * 100)}%)`);
    console.log(`   Without images: ${stat.without_images}`);

    // Duplicate check
    const dupCheck = await queryAsync(`
        SELECT COUNT(*) as dup_count
        FROM (
            SELECT title, date, city
            FROM events
            GROUP BY LOWER(TRIM(title)), date, city
            HAVING COUNT(*) > 1
        )
    `);

    if (dupCheck[0].dup_count === 0) {
        console.log(`   ✅ No duplicates`);
    } else {
        console.log(`   ⚠️  ${dupCheck[0].dup_count} duplicate sets found`);
    }

    console.log();
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  SETX Events - Deduplication & Image Completion            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    try {
        // Step 1: Remove duplicates
        const duplicatesRemoved = await findAndRemoveDuplicates();

        // Step 2: Fill missing images with venue pictures
        const imagesAdded = await fillMissingEventImages();

        // Step 3: Verify integrity
        await verifyIntegrity();

        // Summary
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║  SUMMARY                                                   ║');
        console.log(`║  Duplicates removed: ${duplicatesRemoved}${' '.repeat(43 - duplicatesRemoved.toString().length)}║`);
        console.log(`║  Images completed: ${imagesAdded}${' '.repeat(45 - imagesAdded.toString().length)}║`);
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
