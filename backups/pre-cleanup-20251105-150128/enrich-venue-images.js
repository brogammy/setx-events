#!/usr/bin/env node

/**
 * ENRICH VENUE IMAGES
 *
 * Uses Perplexity API to find real photos of existing venues
 * that currently have broken/missing images
 */

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

if (!PERPLEXITY_API_KEY) {
    console.error('❌ ERROR: PERPLEXITY_API_KEY not set');
    process.exit(1);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Database error:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database');
});

async function findImageUrl(venue) {
    const prompt = `Find a DIRECT URL to a high-quality photograph of ${venue.name} in ${venue.city}, Texas.

Look for:
- Official website photo
- Google Images result
- Business directory listing photo
- Social media profile picture

Return ONLY a valid HTTP/HTTPS URL to a real JPG/PNG image, nothing else. No explanation.

If you cannot find a real image URL, respond with: none`;

    try {
        const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
                model: 'sonar',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 200
            },
            {
                headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}` },
                timeout: 10000
            }
        );

        const result = response.data.choices[0].message.content.trim();

        // Validate it's a URL
        if (result.startsWith('http')) {
            return result;
        }
        return null;
    } catch (err) {
        console.error(`  ⚠️  API error for ${venue.name}: ${err.message}`);
        return null;
    }
}

async function updateVenueImage(venueId, imageUrl) {
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

async function enrichVenues() {
    console.log('\n🖼️  VENUE IMAGE ENRICHMENT');
    console.log('=========================\n');

    return new Promise((resolve) => {
        db.all(
            `SELECT id, name, city FROM venues
             WHERE is_active = 1
             AND (cover_image_url IS NULL OR cover_image_url LIKE '%wp-content%' OR cover_image_url = '')
             ORDER BY priority DESC LIMIT 10`,
            async (err, venues) => {
                if (err) {
                    console.error('Database error:', err);
                    db.close();
                    process.exit(1);
                }

                if (!venues || venues.length === 0) {
                    console.log('No venues needing image enrichment');
                    db.close();
                    process.exit(0);
                }

                console.log(`Found ${venues.length} venues needing images\n`);

                let updated = 0;

                for (const venue of venues) {
                    console.log(`🔍 ${venue.name} (${venue.city})...`);

                    const imageUrl = await findImageUrl(venue);

                    if (imageUrl) {
                        const success = await updateVenueImage(venue.id, imageUrl);
                        if (success) {
                            console.log(`  ✅ ${imageUrl.substring(0, 60)}...`);
                            updated++;
                        } else {
                            console.log(`  ❌ Database update failed`);
                        }
                    } else {
                        console.log(`  ⚠️  No image found`);
                    }

                    // Rate limiting
                    await new Promise(r => setTimeout(r, 1000));
                }

                console.log(`\n✅ Enriched ${updated}/${venues.length} venues with images\n`);
                db.close();
                resolve();
            }
        );
    });
}

enrichVenues().then(() => process.exit(0)).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
