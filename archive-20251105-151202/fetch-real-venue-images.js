#!/usr/bin/env node

/**
 * FETCH REAL VENUE IMAGES
 * Uses Perplexity API to find actual photos of each venue
 */

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

if (!PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY not set');
    process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);

async function findVenueImageUrl(venue) {
    try {
        const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
                model: 'sonar',
                messages: [
                    {
                        role: 'user',
                        content: `Find a DIRECT URL to a real photograph or image of "${venue.name}" in ${venue.city}, Texas. Search their website, Google Images, or business directories. Return ONLY the image URL (HTTP/HTTPS), nothing else. If no image found, respond with: none`
                    }
                ],
                temperature: 0.1,
                max_tokens: 500
            },
            {
                headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}` },
                timeout: 15000
            }
        );

        const result = response.data.choices[0].message.content.trim();

        if (result.startsWith('http') && result.length < 500) {
            return result;
        }
        return null;
    } catch (err) {
        console.error(`  ⚠️  Error: ${err.message}`);
        return null;
    }
}

async function updateVenue(venueId, imageUrl) {
    return new Promise((resolve) => {
        db.run(
            'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
            [imageUrl, imageUrl, venueId],
            (err) => {
                resolve(!err);
            }
        );
    });
}

async function fetchAllImages() {
    console.log('\n🖼️  FETCHING REAL VENUE IMAGES');
    console.log('==============================\n');

    return new Promise((resolve) => {
        db.all(
            'SELECT id, name, city FROM venues WHERE is_active = 1 ORDER BY id',
            async (err, venues) => {
                if (err || !venues) {
                    console.error('Database error');
                    db.close();
                    return resolve();
                }

                console.log(`Found ${venues.length} venues\n`);
                let updated = 0;

                for (const venue of venues) {
                    process.stdout.write(`⏳ ${venue.name}... `);

                    const imageUrl = await findVenueImageUrl(venue);

                    if (imageUrl) {
                        const success = await updateVenue(venue.id, imageUrl);
                        if (success) {
                            console.log(`✅`);
                            updated++;
                        } else {
                            console.log(`❌ DB error`);
                        }
                    } else {
                        console.log(`⚠️`);
                    }

                    // Rate limiting - be nice to Perplexity
                    await new Promise(r => setTimeout(r, 1000));
                }

                console.log(`\n✅ Updated ${updated}/${venues.length} venues with real images\n`);
                db.close();
                resolve();
            }
        );
    });
}

fetchAllImages().then(() => process.exit(0));
