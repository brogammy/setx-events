#!/usr/bin/env node

/**
 * Add Missing Venue Images
 * Downloads images for venues that don't have cover_image_url set
 * Uses web search to find appropriate venue images
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const db = new sqlite3.Database('./database.sqlite');
const IMAGES_DIR = './public/images/venues';

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Image sources to try
const IMAGE_SOURCES = {
    // Wikipedia Commons - free images
    wikipedia: async (venueName, city) => {
        try {
            const searchQuery = `${venueName} ${city} Texas`;
            const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=original&titles=${encodeURIComponent(searchQuery)}`;
            const response = await axios.get(url);
            const pages = response.data.query.pages;
            const page = Object.values(pages)[0];
            if (page.original) {
                return page.original.source;
            }
        } catch (error) {
            console.log(`   ⚠️  Wikipedia search failed: ${error.message}`);
        }
        return null;
    },

    // Google search for publicly available images
    googleImages: async (venueName, city) => {
        // This would require Google Custom Search API
        // For now, return null
        return null;
    },

    // Fallback: Generate a placeholder or use generic venue image
    placeholder: (venueId, venueName, city) => {
        // Return a generic venue placeholder
        return `https://via.placeholder.com/800x600/21808d/ffffff?text=${encodeURIComponent(venueName)}`;
    }
};

async function downloadImage(url, venueId) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const filename = `venue-${venueId}.jpg`;
        const filepath = path.join(IMAGES_DIR, filename);

        const file = fs.createWriteStream(filepath);

        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                fs.unlinkSync(filepath);
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve(`/images/venues/${filename}`);
            });
        }).on('error', (err) => {
            fs.unlinkSync(filepath);
            reject(err);
        });
    });
}

async function searchVenueImage(venueName, city) {
    console.log(`   🔍 Searching for image: ${venueName}, ${city}`);

    // Try Wikipedia first
    const wikiUrl = await IMAGE_SOURCES.wikipedia(venueName, city);
    if (wikiUrl) {
        console.log(`   ✅ Found Wikipedia image`);
        return wikiUrl;
    }

    // Try other sources here...

    return null;
}

async function updateVenueCoverImage(venueId, imageUrl) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE venues SET cover_image_url = ? WHERE id = ?',
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
             WHERE cover_image_url IS NULL OR cover_image_url = ''
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

    try {
        // Try to find an image
        let imageUrl = await searchVenueImage(venue.name, venue.city);

        if (imageUrl) {
            console.log(`   ⬇️  Downloading image...`);
            const localPath = await downloadImage(imageUrl, venue.id);

            console.log(`   💾 Updating database...`);
            await updateVenueCoverImage(venue.id, localPath);

            console.log(`   ✅ Success! Image saved as: ${localPath}`);
            return { success: true, venue: venue.name };
        } else {
            console.log(`   ⚠️  No image found`);
            return { success: false, venue: venue.name, reason: 'No image found' };
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return { success: false, venue: venue.name, reason: error.message };
    }
}

async function main() {
    console.log('🖼️  Add Missing Venue Images');
    console.log('================================\n');

    try {
        const venues = await getVenuesWithoutImages();

        console.log(`📊 Found ${venues.length} venues without images\n`);

        if (venues.length === 0) {
            console.log('✅ All venues already have images!');
            db.close();
            return;
        }

        const results = {
            success: 0,
            failed: 0,
            failures: []
        };

        // Process each venue
        for (const venue of venues) {
            const result = await processVenue(venue);

            if (result.success) {
                results.success++;
            } else {
                results.failed++;
                results.failures.push(result);
            }

            // Wait a bit between requests to be polite
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n================================');
        console.log('📊 Summary');
        console.log('================================');
        console.log(`✅ Successfully added: ${results.success}`);
        console.log(`❌ Failed: ${results.failed}`);

        if (results.failures.length > 0) {
            console.log('\n❌ Failures:');
            results.failures.forEach(f => {
                console.log(`   - ${f.venue}: ${f.reason}`);
            });
        }

        console.log('\n💡 Note: For failed venues, you may need to:');
        console.log('   1. Manually download images from their websites');
        console.log('   2. Use a paid API like Google Custom Search');
        console.log('   3. Take photos yourself if local venues');
        console.log('   4. Use Perplexity API for better image discovery');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { processVenue, searchVenueImage };
