#!/usr/bin/env node

/**
 * Add Remaining Venue Images
 * Manual image sources for specific venues that failed automated scraping
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const db = new sqlite3.Database('./database.sqlite');
const IMAGES_DIR = './public/images/venues';

// Manually curated image sources for specific venues
const MANUAL_IMAGES = {
    41: {
        name: 'Shangri La Botanical Gardens & Nature Center',
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Shangri_La_Botanical_Gardens_entrance.jpg/1200px-Shangri_La_Botanical_Gardens_entrance.jpg',
        source: 'Wikipedia Commons'
    },
    18: {
        name: 'Sonesta Essential Beaumont',
        url: 'https://via.placeholder.com/800x600/21808d/ffffff?text=Sonesta+Essential+Beaumont',
        source: 'Placeholder'
    },
    19: {
        name: 'Quality Inn and Suites',
        url: 'https://via.placeholder.com/800x600/21808d/ffffff?text=Quality+Inn+Beaumont',
        source: 'Placeholder'
    },
    38: {
        name: 'SureStay by Best Western',
        url: 'https://via.placeholder.com/800x600/21808d/ffffff?text=SureStay+Orange',
        source: 'Placeholder'
    }
};

async function downloadImage(url, venueId) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const filename = `venue-${venueId}.jpg`;
        const filepath = path.join(IMAGES_DIR, filename);

        const file = fs.createWriteStream(filepath);

        protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
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
                if (stats.size < 1000) {
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
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            reject(err);
        });
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

async function main() {
    console.log('🖼️  Add Remaining Venue Images');
    console.log('================================\n');

    const results = {
        success: 0,
        failed: 0
    };

    for (const [venueId, venueInfo] of Object.entries(MANUAL_IMAGES)) {
        console.log(`\n📍 Processing: ${venueInfo.name}`);
        console.log(`   ID: ${venueId}`);
        console.log(`   Source: ${venueInfo.source}`);

        try {
            console.log(`   ⬇️  Downloading...`);
            const localPath = await downloadImage(venueInfo.url, venueId);

            console.log(`   💾 Updating database...`);
            await updateVenueCoverImage(venueId, localPath);

            console.log(`   ✅ Success! Saved as: ${localPath}`);
            results.success++;

            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            results.failed++;
        }
    }

    console.log('\n================================');
    console.log('📊 Summary');
    console.log('================================');
    console.log(`✅ Successfully added: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);

    db.close();
}

if (require.main === module) {
    main().catch(console.error);
}
