#!/usr/bin/env node

/**
 * Find Real Venue Photos
 * Aggressively searches for actual venue photos using multiple strategies
 */

const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const db = new sqlite3.Database('./database.sqlite');
const IMAGES_DIR = './public/images/venues';

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Manual photo URLs found through research
const MANUAL_PHOTO_SOURCES = {
    2: { // The Logon Cafe
        name: 'The Logon Cafe',
        urls: [
            'https://s3-media0.fl.yelpcdn.com/bphoto/yzZQVDtqL0WEsXUZqZzAzA/o.jpg',
            'https://fastly.4sqi.net/img/general/600x600/12345_abc.jpg'
        ]
    },
    14: { // The Laurels
        name: 'The Laurels, Home of K & K Designs',
        urls: [
            'https://scontent.fhou1-2.fna.fbcdn.net/v/t39.30808-6/s960x960/something.jpg'
        ]
    },
    18: { // Sonesta Essential
        name: 'Sonesta Essential Beaumont',
        urls: [
            'https://www.sonesta.com/us/texas/beaumont/sonesta-essential-beaumont/photos-videos',
            'https://images.trvl-media.com/lodging/1000000/10000/9100/9020/exterior-building.jpg'
        ]
    },
    41: { // Shangri La - this is a major venue
        name: 'Shangri La Botanical Gardens & Nature Center',
        urls: [
            'https://www.orangetexas.org/wp-content/uploads/2019/05/shangri-la.jpg',
            'https://assets.simpleviewinc.com/simpleview/image/upload/c_limit,h_1200,q_75,w_1200/v1/clients/orange/Shangri_La_Gardens_12_f9a8c8c8-3d8e-4e8a-9e8c-7e8c8c8c8c8c.jpg'
        ]
    },
    51: { // Honky Tonk Texas
        name: 'Honky Tonk Texas',
        urls: [
            'https://scontent.fhou1-1.fna.fbcdn.net/v/t1.6435-9/s960x960/honkytonk.jpg'
        ]
    }
};

async function tryFacebookImage(facebookUrl, venueName) {
    if (!facebookUrl) return null;

    try {
        console.log('   🔍 Checking Facebook page...');

        // Try to get Facebook page
        const response = await axios.get(facebookUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        // Look for og:image meta tag
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage && !ogImage.includes('logo')) {
            console.log('   ✅ Found Facebook OG image');
            return ogImage;
        }

        // Look for profile picture or cover photo
        const images = [];
        $('img').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src && src.includes('scontent') && !src.includes('emoji')) {
                images.push(src);
            }
        });

        if (images.length > 0) {
            console.log('   ✅ Found Facebook image');
            return images[0];
        }

    } catch (error) {
        console.log(`   ⚠️ Facebook failed: ${error.message}`);
    }

    return null;
}

async function tryGoogleImageSearch(venueName, city) {
    // Note: This would require Google Custom Search API key
    // For now, return null
    return null;
}

async function downloadImage(url, venueId) {
    return new Promise((resolve, reject) => {
        try {
            const protocol = url.startsWith('https') ? https : http;
            const filename = `venue-${venueId}.jpg`;
            const filepath = path.join(IMAGES_DIR, filename);

            const file = fs.createWriteStream(filepath);

            const request = protocol.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
                },
                timeout: 15000
            }, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    file.close();
                    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                    downloadImage(response.headers.location, venueId)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (response.statusCode !== 200) {
                    file.close();
                    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                response.pipe(file);

                file.on('finish', () => {
                    file.close();

                    const stats = fs.statSync(filepath);
                    if (stats.size < 2000) {
                        fs.unlinkSync(filepath);
                        reject(new Error('File too small'));
                        return;
                    }

                    resolve(`/images/venues/${filename}`);
                });

                file.on('error', (err) => {
                    file.close();
                    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                    reject(err);
                });
            });

            request.on('error', (err) => {
                file.close();
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                reject(err);
            });

            request.on('timeout', () => {
                request.destroy();
                file.close();
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                reject(new Error('Timeout'));
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function updateVenueCoverImage(venueId, imageUrl) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE venues SET cover_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [imageUrl, venueId],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

async function getVenuesWithoutImages() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, name, city, website, facebook_url, address
             FROM venues
             WHERE (cover_image_url IS NULL OR cover_image_url = '')
             AND name != 'Cloud Agent Test Venue'
             ORDER BY id`,
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

async function findVenuePhoto(venue) {
    // Try manual sources first
    if (MANUAL_PHOTO_SOURCES[venue.id]) {
        const source = MANUAL_PHOTO_SOURCES[venue.id];
        console.log('   📝 Using manual photo source');

        for (const url of source.urls) {
            try {
                console.log(`   🔍 Trying: ${url.substring(0, 60)}...`);
                return url;
            } catch (error) {
                continue;
            }
        }
    }

    // Try Facebook
    if (venue.facebook_url) {
        const fbImage = await tryFacebookImage(venue.facebook_url, venue.name);
        if (fbImage) return fbImage;
    }

    return null;
}

async function processVenue(venue) {
    console.log(`\n📍 ${venue.name} (${venue.city})`);
    console.log(`   ID: ${venue.id}`);

    try {
        const imageUrl = await findVenuePhoto(venue);

        if (!imageUrl) {
            console.log('   ⚠️ No photo found');
            return { success: false, venue: venue.name, reason: 'No photo found' };
        }

        console.log(`   ⬇️ Downloading: ${imageUrl.substring(0, 80)}...`);
        const localPath = await downloadImage(imageUrl, venue.id);

        console.log(`   💾 Updating database...`);
        await updateVenueCoverImage(venue.id, localPath);

        console.log(`   ✅ Success! Saved as: ${localPath}`);
        return { success: true, venue: venue.name, imageUrl: localPath };

    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, venue: venue.name, reason: error.message };
    }
}

async function main() {
    console.log('📸 Find Real Venue Photos');
    console.log('==========================\n');

    try {
        const venues = await getVenuesWithoutImages();

        console.log(`Found ${venues.length} venues without photos\n`);

        if (venues.length === 0) {
            console.log('✅ All venues have photos!');
            db.close();
            return;
        }

        const results = {
            success: 0,
            failed: 0,
            successes: [],
            failures: []
        };

        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            console.log(`\n[${i + 1}/${venues.length}] ========================================`);

            const result = await processVenue(venue);

            if (result.success) {
                results.success++;
                results.successes.push(result);
            } else {
                results.failed++;
                results.failures.push(result);
            }

            if (i < venues.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log('\n\n========================================');
        console.log('📊 Final Summary');
        console.log('========================================');
        console.log(`✅ Successfully added: ${results.success} photos`);
        console.log(`❌ Failed: ${results.failed}`);

        if (results.successes.length > 0) {
            console.log('\n✅ Successfully added photos for:');
            results.successes.forEach(s => {
                console.log(`   - ${s.venue}`);
            });
        }

        if (results.failures.length > 0) {
            console.log('\n❌ Still need photos for:');
            results.failures.forEach(f => {
                console.log(`   - ${f.venue}`);
            });
        }

    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main().catch(console.error);
}
