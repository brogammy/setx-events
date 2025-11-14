#!/usr/bin/env node

/**
 * Perplexity-Powered Venue Image Finder
 * Uses Perplexity API to intelligently search for venue images
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'YOUR_API_KEY_HERE';
const db = new sqlite3.Database('./database.sqlite');
const IMAGES_DIR = './public/images/venues';

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

async function askPerplexity(prompt) {
    try {
        const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
                model: 'llama-3.1-sonar-small-128k-online',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that finds publicly available images of venues. Return ONLY a valid direct image URL (ending in .jpg, .png, .jpeg, .webp) or the word "NONE" if no suitable image is found. No explanations.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 200
            },
            {
                headers: {
                    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0].message.content.trim();

        // Extract URL if present
        const urlMatch = content.match(/(https?:\/\/[^\s]+\.(jpg|jpeg|png|webp))/i);
        if (urlMatch) {
            return urlMatch[1];
        }

        // Check if response is a direct URL
        if (content.startsWith('http') && /\.(jpg|jpeg|png|webp)$/i.test(content)) {
            return content;
        }

        return null;
    } catch (error) {
        console.error(`   ⚠️  Perplexity API error: ${error.message}`);
        return null;
    }
}

async function findVenueImage(venue) {
    console.log(`   🔍 Searching Perplexity for image...`);

    const prompts = [
        `Find a direct image URL for "${venue.name}" in ${venue.city}, Texas. Return ONLY the direct image URL (must end in .jpg, .png, .jpeg, or .webp). If it's a theater, museum, botanical garden, or public venue, look for official photos. ${venue.website ? 'Website: ' + venue.website : ''}`,

        `Search for a photo of "${venue.name}" located in ${venue.city}, TX. Return ONLY a direct downloadable image URL ending in .jpg, .png, .jpeg, or .webp. Check Wikipedia Commons, Flickr, or the venue's official website.`,

        `Find "${venue.name}" ${venue.city} Texas building exterior photo. Return ONLY the direct image URL.`
    ];

    for (const prompt of prompts) {
        const imageUrl = await askPerplexity(prompt);
        if (imageUrl) {
            console.log(`   ✅ Found image URL: ${imageUrl}`);
            return imageUrl;
        }
        // Wait between retries
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return null;
}

async function downloadImage(url, venueId) {
    return new Promise((resolve, reject) => {
        try {
            const protocol = url.startsWith('https') ? https : http;
            const filename = `venue-${venueId}.jpg`;
            const filepath = path.join(IMAGES_DIR, filename);

            const file = fs.createWriteStream(filepath);

            protocol.get(url, (response) => {
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
                    fs.unlinkSync(filepath);
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                response.pipe(file);

                file.on('finish', () => {
                    file.close();

                    // Check if file is valid (not empty, reasonable size)
                    const stats = fs.statSync(filepath);
                    if (stats.size < 1000) {
                        fs.unlinkSync(filepath);
                        reject(new Error('Downloaded file too small'));
                        return;
                    }

                    resolve(`/images/venues/${filename}`);
                });

                file.on('error', (err) => {
                    file.close();
                    fs.unlinkSync(filepath);
                    reject(err);
                });
            }).on('error', (err) => {
                file.close();
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
                reject(err);
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

async function processVenue(venue) {
    console.log(`\n📍 Processing: ${venue.name} (${venue.city})`);
    console.log(`   ID: ${venue.id}`);
    if (venue.website) console.log(`   Website: ${venue.website}`);

    try {
        // Use Perplexity to find image
        const imageUrl = await findVenueImage(venue);

        if (!imageUrl) {
            console.log(`   ⚠️  No image URL found`);
            return { success: false, venue: venue.name, reason: 'No image found' };
        }

        console.log(`   ⬇️  Downloading image from: ${imageUrl.substring(0, 60)}...`);
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
    console.log('🖼️  Perplexity Venue Image Finder');
    console.log('================================\n');

    if (!PERPLEXITY_API_KEY) {
        console.error('❌ Error: PERPLEXITY_API_KEY environment variable not set');
        process.exit(1);
    }

    try {
        const venues = await getVenuesWithoutImages();

        console.log(`📊 Found ${venues.length} venues without images\n`);

        if (venues.length === 0) {
            console.log('✅ All venues already have images!');
            db.close();
            return;
        }

        console.log('🎯 Starting image search and download...\n');

        const results = {
            success: 0,
            failed: 0,
            successes: [],
            failures: []
        };

        // Process each venue
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

            // Wait between requests to avoid rate limiting
            if (i < venues.length - 1) {
                console.log(`\n   ⏳ Waiting 3 seconds before next venue...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
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
                console.log(`   - ${s.venue}: ${s.imageUrl}`);
            });
        }

        if (results.failures.length > 0) {
            console.log('\n❌ Failed to find images for:');
            results.failures.forEach(f => {
                console.log(`   - ${f.venue}: ${f.reason}`);
            });
        }

        console.log('\n💡 For remaining venues, you can:');
        console.log('   1. Manually visit their websites and download images');
        console.log('   2. Use Google Image Search and save appropriate images');
        console.log('   3. Contact venues for official photos');
        console.log('   4. Use stock photos for generic venue types');

    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { processVenue, findVenueImage };
