#!/usr/bin/env node

/**
 * Scrape Venue Websites for Images
 * Directly visits venue websites and scrapes the first suitable image
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

async function scrapeWebsiteForImage(url, venueName) {
    try {
        console.log(`   🌐 Fetching: ${url}`);

        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const images = [];

        // Find images in various locations
        $('img').each((i, elem) => {
            const src = $(elem).attr('src') || $(elem).attr('data-src');
            if (src) {
                // Make absolute URL
                let absoluteUrl = src;
                if (src.startsWith('//')) {
                    absoluteUrl = 'https:' + src;
                } else if (src.startsWith('/')) {
                    const baseUrl = new URL(url);
                    absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${src}`;
                } else if (!src.startsWith('http')) {
                    const baseUrl = new URL(url);
                    absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}/${src}`;
                }

                // Filter out small images, icons, logos
                const alt = $(elem).attr('alt') || '';
                const className = $(elem).attr('class') || '';

                // Skip obvious non-venue images
                if (className.includes('logo') || className.includes('icon') ||
                    alt.toLowerCase().includes('logo') || alt.toLowerCase().includes('icon') ||
                    src.includes('logo') || src.includes('icon') || src.includes('sprite')) {
                    return;
                }

                images.push({
                    url: absoluteUrl,
                    alt: alt,
                    class: className
                });
            }
        });

        console.log(`   📸 Found ${images.length} potential images`);

        // Prefer images with venue name in alt text or class
        const priorityImages = images.filter(img =>
            img.alt.toLowerCase().includes(venueName.toLowerCase()) ||
            img.alt.toLowerCase().includes('venue') ||
            img.alt.toLowerCase().includes('building') ||
            img.alt.toLowerCase().includes('exterior')
        );

        if (priorityImages.length > 0) {
            console.log(`   ✅ Found priority image`);
            return priorityImages[0].url;
        }

        // Otherwise return first suitable image
        if (images.length > 0) {
            return images[0].url;
        }

        return null;
    } catch (error) {
        console.log(`   ⚠️  Scraping failed: ${error.message}`);
        return null;
    }
}

async function downloadImage(url, venueId) {
    return new Promise((resolve, reject) => {
        try {
            const protocol = url.startsWith('https') ? https : http;

            // Determine file extension
            let ext = '.jpg';
            if (url.match(/\.(png|jpeg|jpg|webp)($|\?)/i)) {
                ext = url.match(/\.(png|jpeg|jpg|webp)/i)[0];
            }

            const filename = `venue-${venueId}${ext}`;
            const filepath = path.join(IMAGES_DIR, filename);

            const file = fs.createWriteStream(filepath);

            const request = protocol.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 15000
            }, (response) => {
                // Follow redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    file.close();
                    fs.unlinkSync(filepath);
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
                        reject(new Error('File too small (likely error page)'));
                        return;
                    }

                    // Return with .jpg extension for consistency
                    const savedFilename = `venue-${venueId}.jpg`;
                    if (ext !== '.jpg') {
                        fs.renameSync(filepath, path.join(IMAGES_DIR, savedFilename));
                    }

                    resolve(`/images/venues/${savedFilename}`);
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
                reject(new Error('Request timeout'));
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
            `SELECT id, name, city, website, facebook_url
             FROM venues
             WHERE (cover_image_url IS NULL OR cover_image_url = '')
             AND website IS NOT NULL
             AND website != ''
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

async function processVenue(venue) {
    console.log(`\n📍 Processing: ${venue.name} (${venue.city})`);
    console.log(`   ID: ${venue.id}`);
    console.log(`   Website: ${venue.website}`);

    try {
        // Scrape website for image
        const imageUrl = await scrapeWebsiteForImage(venue.website, venue.name);

        if (!imageUrl) {
            console.log(`   ⚠️  No suitable image found`);
            return { success: false, venue: venue.name, reason: 'No image found' };
        }

        console.log(`   ⬇️  Downloading: ${imageUrl.substring(0, 80)}...`);
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
    console.log('🖼️  Website Image Scraper');
    console.log('================================\n');

    try {
        const venues = await getVenuesWithoutImages();

        console.log(`📊 Found ${venues.length} venues with websites but no images\n`);

        if (venues.length === 0) {
            console.log('✅ All venues with websites already have images!');
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
            console.log(`\n[${ i + 1}/${venues.length}] ========================================`);

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

        console.log('\n\n================================');
        console.log('📊 Final Summary');
        console.log('================================');
        console.log(`✅ Successfully added: ${results.success} images`);
        console.log(`❌ Failed: ${results.failed}`);

        if (results.successes.length > 0) {
            console.log('\n✅ Successfully added images for:');
            results.successes.forEach(s => {
                console.log(`   - ${s.venue}`);
            });
        }

        if (results.failures.length > 0) {
            console.log('\n❌ Failed to find/download images for:');
            results.failures.forEach(f => {
                console.log(`   - ${f.venue}: ${f.reason}`);
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

module.exports = { processVenue, scrapeWebsiteForImage };
