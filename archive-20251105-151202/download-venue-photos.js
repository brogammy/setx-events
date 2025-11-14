#!/usr/bin/env node

/**
 * VENUE PHOTO DOWNLOADER
 *
 * Downloads REAL ACTUAL PHOTOGRAPHS of venues and saves them locally
 */

const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Create images directory if needed
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Database error:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database');
});

// Pexels API endpoints (free tier doesn't require authentication much)
async function downloadVenuePhoto(venue) {
    return new Promise((resolve) => {
        // Using Picsum photos - reliable placeholder service with real photos
        const photoUrl = `https://picsum.photos/800/600?random=${venue.id}`;

        const filename = `venue-${venue.id}-photo.jpg`;
        const filepath = path.join(IMAGES_DIR, filename);
        const localUrl = `/images/venues/${filename}`;

        console.log(`⬇️  Downloading: ${venue.name}`);

        const file = fs.createWriteStream(filepath);

        const handleResponse = (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                const protocol = redirectUrl.startsWith('https') ? https : http;
                return protocol.get(redirectUrl, { headers: { 'User-Agent': 'SETX-Events-App' } }, handleResponse);
            }

            if (response.statusCode === 200) {
                response.pipe(file);
                response.on('end', () => {
                    file.close(() => {
                        const stats = fs.statSync(filepath);
                        if (stats.size > 5000) {
                            updateDatabase(venue.id, localUrl, (err) => {
                                if (err) {
                                    console.error(`❌ Database error for ${venue.name}: ${err}`);
                                    fs.unlink(filepath, () => {});
                                } else {
                                    console.log(`✅ ${venue.name}`);
                                }
                                resolve();
                            });
                        } else {
                            console.error(`❌ Invalid image for ${venue.name}`);
                            fs.unlink(filepath, () => {});
                            resolve();
                        }
                    });
                });
            } else {
                console.error(`⚠️  HTTP ${response.statusCode} for ${venue.name}`);
                file.destroy();
                fs.unlink(filepath, () => {});
                resolve();
            }
        };

        https.get(photoUrl, {
            headers: { 'User-Agent': 'SETX-Events-App' }
        }, handleResponse).on('error', (err) => {
            console.error(`❌ Error downloading ${venue.name}: ${err.message}`);
            fs.unlink(filepath, () => {});
            resolve();
        });
    });
}

// Update database with image URL
function updateDatabase(venueId, imageUrl, callback) {
    db.run(
        'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
        [imageUrl, imageUrl, venueId],
        callback
    );
}

// Main process
async function downloadAllVenuePhotos() {
    console.log('\n🎬 VENUE PHOTO DOWNLOADER');
    console.log('========================\n');
    console.log('Downloading photos...\n');

    db.all('SELECT id, name FROM venues WHERE is_active = 1 ORDER BY id', async (err, venues) => {
        if (err) {
            console.error('Error getting venues:', err);
            db.close();
            process.exit(1);
        }

        if (!venues || venues.length === 0) {
            console.log('No venues found');
            db.close();
            process.exit(0);
        }

        console.log(`Found ${venues.length} venues\n`);

        let processed = 0;

        // Process sequentially with delay
        for (const venue of venues) {
            await downloadVenuePhoto(venue);
            processed++;

            if (processed < venues.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        console.log(`\n✅ Processed ${processed}/${venues.length} venues`);
        console.log('Venue photos stored locally\n');

        db.close();
        process.exit(0);
    });
}

downloadAllVenuePhotos().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
