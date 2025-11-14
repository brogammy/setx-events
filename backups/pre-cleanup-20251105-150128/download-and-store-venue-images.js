#!/usr/bin/env node

/**
 * DOWNLOAD AND STORE VENUE IMAGES LOCALLY
 *
 * Fetches real image URLs from Perplexity, downloads the files locally,
 * and stores local paths in database
 */

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

if (!PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY not set');
    process.exit(1);
}

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
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
        return null;
    }
}

async function downloadAndSaveImage(sourceUrl, venueId) {
    return new Promise((resolve) => {
        const filename = `venue-${venueId}.jpg`;
        const filepath = path.join(IMAGES_DIR, filename);
        const file = fs.createWriteStream(filepath);

        const protocol = sourceUrl.startsWith('https') ? https : http;

        const handleResponse = (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
                return redirectProtocol.get(redirectUrl, { timeout: 10000 }, handleResponse);
            }

            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    if (stats.size > 5000) {
                        resolve(true);
                    } else {
                        fs.unlink(filepath, () => {});
                        resolve(false);
                    }
                });
            } else {
                file.destroy();
                fs.unlink(filepath, () => {});
                resolve(false);
            }
        };

        protocol.get(sourceUrl, { timeout: 10000 }, handleResponse).on('error', () => {
            fs.unlink(filepath, () => {});
            resolve(false);
        });
    });
}

async function processAllVenues() {
    console.log('\n📥 DOWNLOADING VENUE IMAGES LOCALLY');
    console.log('===================================\n');

    return new Promise((resolve) => {
        db.all(
            'SELECT id, name, city FROM venues WHERE is_active = 1 ORDER BY id',
            async (err, venues) => {
                if (err || !venues) {
                    console.error('Database error');
                    db.close();
                    return resolve();
                }

                console.log(`Processing ${venues.length} venues\n`);
                let downloaded = 0;

                for (const venue of venues) {
                    process.stdout.write(`⏳ ${venue.name}... `);

                    // Find image URL
                    const imageUrl = await findVenueImageUrl(venue);

                    if (imageUrl) {
                        // Download and save locally
                        const success = await downloadAndSaveImage(imageUrl, venue.id);

                        if (success) {
                            // Update database with local path
                            const localUrl = `/images/venues/venue-${venue.id}.jpg`;
                            db.run(
                                'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
                                [localUrl, localUrl, venue.id],
                                (err) => {
                                    if (!err) {
                                        console.log(`✅`);
                                        downloaded++;
                                    } else {
                                        console.log(`❌`);
                                    }
                                }
                            );
                        } else {
                            console.log(`⚠️ (download failed)`);
                        }
                    } else {
                        console.log(`⚠️ (no URL found)`);
                    }

                    // Rate limiting
                    await new Promise(r => setTimeout(r, 1000));
                }

                // Wait for all database updates to complete
                setTimeout(() => {
                    console.log(`\n✅ Downloaded and stored ${downloaded}/${venues.length} venue images locally\n`);
                    db.close();
                    resolve();
                }, 2000);
            }
        );
    });
}

processAllVenues().then(() => process.exit(0));
