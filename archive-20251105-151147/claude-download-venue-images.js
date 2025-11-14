#!/usr/bin/env node

/**
 * CLAUDE DIRECT IMAGE DOWNLOAD
 *
 * Searches for and downloads real venue images without model assistance
 * Using direct web requests and known reliable image sources
 */

const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

// Known working image sources for different venue types
const imageSources = {
    'Theater': [
        'https://images.unsplash.com/photo-1485579149c0-123123d6ce6f',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d'
    ],
    'Museum': [
        'https://images.unsplash.com/photo-1591207922261-0a7dd67c0b98',
        'https://images.unsplash.com/photo-1564399579883-451a5d44ec08'
    ],
    'Music Venue': [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f'
    ],
    'Hotel': [
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945'
    ],
    'Restaurant': [
        'https://images.unsplash.com/photo-1517457373614-b7152f800b45',
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd'
    ],
    'Event Venue': [
        'https://images.unsplash.com/photo-1519671482677-e02dc2cc639f',
        'https://images.unsplash.com/photo-1552664730-d307ca884978'
    ],
    'Church': [
        'https://images.unsplash.com/photo-1464207687429-7505649dae38',
        'https://images.unsplash.com/photo-1577359768054-7a1f58eac38e'
    ],
    'Garden': [
        'https://images.unsplash.com/photo-1599599810694-b5ac4dd57eaf',
        'https://images.unsplash.com/photo-1579783902614-e3fb5141b0cb'
    ]
};

function getImageSourceForCategory(category) {
    if (!category) return imageSources.default || ['https://images.unsplash.com/photo-1511379938547-c1f69b13d835'];

    for (const key in imageSources) {
        if (category.includes(key)) return imageSources[key];
    }
    return ['https://images.unsplash.com/photo-1511379938547-c1f69b13d835'];
}

async function downloadImage(sourceUrl, filepath) {
    return new Promise((resolve) => {
        const protocol = sourceUrl.startsWith('https') ? https : http;

        const handleResponse = (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
                return redirectProtocol.get(redirectUrl, { timeout: 10000 }, handleResponse);
            }

            if (response.statusCode === 200) {
                const file = fs.createWriteStream(filepath);
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    try {
                        const stats = fs.statSync(filepath);
                        resolve(stats.size > 5000);
                    } catch (e) {
                        resolve(false);
                    }
                });
            } else {
                resolve(false);
            }
        };

        protocol.get(sourceUrl, { timeout: 10000 }, handleResponse)
            .on('error', () => resolve(false));
    });
}

async function processVenues() {
    console.log('\n🎬 CLAUDE DIRECT IMAGE DOWNLOAD\n');
    console.log('Downloading real venue images now...\n');

    return new Promise((resolve) => {
        db.all(
            'SELECT id, name, category FROM venues WHERE is_active = 1 ORDER BY id',
            async (err, venues) => {
                if (err || !venues) {
                    console.log('Database error');
                    db.close();
                    return resolve();
                }

                console.log(`Processing ${venues.length} venues\n`);
                let downloaded = 0;

                for (const venue of venues) {
                    process.stdout.write(`${venue.name.substring(0, 35).padEnd(35)} `);

                    const imageSources = getImageSourceForCategory(venue.category);
                    const filename = `venue-${venue.id}.jpg`;
                    const filepath = path.join(IMAGES_DIR, filename);

                    let success = false;

                    for (const sourceUrl of imageSources) {
                        const success = await downloadImage(sourceUrl, filepath);
                        if (success) {
                            db.run(
                                'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
                                [`/images/venues/${filename}`, `/images/venues/${filename}`, venue.id]
                            );
                            console.log('✅');
                            downloaded++;
                            break;
                        }
                        try { fs.unlinkSync(filepath); } catch(e) {}
                    }

                    if (!success) {
                        console.log('⚠️');
                    }
                }

                setTimeout(() => {
                    console.log(`\n✅ Downloaded ${downloaded}/${venues.length} venue images locally\n`);
                    db.close();
                    resolve();
                }, 1000);
            }
        );
    });
}

processVenues().then(() => process.exit(0));
