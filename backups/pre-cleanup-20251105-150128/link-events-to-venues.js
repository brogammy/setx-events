#!/usr/bin/env node

/**
 * LINK EVENTS TO VENUES
 *
 * Matches existing events to venues based on:
 * 1. Exact location name match
 * 2. City match
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

async function linkEventsToVenues() {
    console.log('\n🔗 LINKING EVENTS TO VENUES\n');

    return new Promise((resolve) => {
        // Get all venues
        db.all('SELECT id, name, city FROM venues WHERE is_active = 1', (err, venues) => {
            if (err) {
                console.error('Error getting venues:', err);
                resolve();
                return;
            }

            console.log(`📍 Found ${venues.length} venues\n`);

            // Get all events without venue_id
            db.all('SELECT id, location, city FROM events WHERE venue_id IS NULL', (err, events) => {
                if (err) {
                    console.error('Error getting events:', err);
                    resolve();
                    return;
                }

                console.log(`📅 Found ${events.length} events without venue_id\n`);

                let matched = 0;
                let unmatched = 0;

                // For each event, try to find matching venue
                events.forEach(event => {
                    // Try exact location name match first
                    let matchedVenue = venues.find(v =>
                        v.name.toLowerCase() === (event.location || '').toLowerCase()
                    );

                    // If no exact match, try city match (pick first venue in same city)
                    if (!matchedVenue) {
                        matchedVenue = venues.find(v => v.city === event.city);
                    }

                    if (matchedVenue) {
                        // Update event with venue_id
                        db.run(
                            'UPDATE events SET venue_id = ? WHERE id = ?',
                            [matchedVenue.id, event.id],
                            function(err) {
                                if (!err) {
                                    console.log(`✅ ${event.id}: "${event.location}" → ${matchedVenue.name} (${matchedVenue.city})`);
                                    matched++;
                                } else {
                                    console.error(`❌ ${event.id}: Error updating`, err);
                                }
                            }
                        );
                    } else {
                        console.log(`⚠️  ${event.id}: "${event.location}" (${event.city}) - No matching venue`);
                        unmatched++;
                    }
                });

                // After all updates, show summary
                setTimeout(() => {
                    db.all('SELECT COUNT(*) as count FROM events WHERE venue_id IS NOT NULL', (err, result) => {
                        console.log(`\n✅ LINKING COMPLETE\n`);
                        console.log(`📊 Summary:`);
                        console.log(`   Matched: ${matched}`);
                        console.log(`   Unmatched: ${unmatched}`);
                        console.log(`   Total with venue_id: ${result[0].count}\n`);

                        db.close();
                        resolve();
                    });
                }, 500);
            });
        });
    });
}

linkEventsToVenues().then(() => {
    console.log('Done!\n');
    process.exit(0);
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
