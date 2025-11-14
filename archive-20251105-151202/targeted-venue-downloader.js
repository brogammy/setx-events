#!/usr/bin/env node

/**
 * TARGETED VENUE IMAGE DOWNLOADER
 * Use this to manually download images for specific venues
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Database connection
const db = new sqlite3.Database(DB_PATH);

// Create images directory if needed
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Download binary file
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'SETX-Events-Image-Downloader/1.0 (sauly@example.com)'
            }
        };
        
        const file = fs.createWriteStream(filepath);
        
        https.get(options, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    try {
                        const stats = fs.statSync(filepath);
                        resolve(stats.size);
                    } catch (e) {
                        reject(e);
                    }
                });
            } else {
                file.destroy();
                fs.unlink(filepath, () => {});
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            }
        }).on('error', (err) => {
            file.destroy();
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

// Update database
function updateVenueImage(venueId, localUrl) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
            [localUrl, localUrl, venueId],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// Get specific venue
function getVenue(venueId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT id, name, city 
            FROM venues 
            WHERE id = ? AND is_active = 1
        `, [venueId], (err, venue) => {
            if (err) reject(err);
            else resolve(venue);
        });
    });
}

// Manual download function
async function downloadVenueImage(venueId, imageUrl) {
    try {
        console.log(`🎯 Downloading image for venue ID: ${venueId}`);
        
        const venue = await getVenue(venueId);
        if (!venue) {
            console.log(`❌ Venue not found or not active`);
            return;
        }
        
        console.log(`📍 ${venue.name} (${venue.city})`);
        console.log(`🔗 ${imageUrl}`);
        
        const filepath = path.join(IMAGES_DIR, `venue-${venueId}.jpg`);
        const localUrl = `/images/venues/venue-${venueId}.jpg`;
        
        try {
            const size = await downloadImage(imageUrl, filepath);
            console.log(`✅ Downloaded ${size} bytes`);
            
            if (size > 10000) {
                await updateVenueImage(venueId, localUrl);
                console.log(`📁 Database updated`);
                console.log(`\n🎉 SUCCESS! Real venue image added`);
            } else {
                console.log(`❌ Image too small, deleting`);
                fs.unlinkSync(filepath);
            }
        } catch (err) {
            console.log(`❌ Download failed: ${err.message}`);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
        }
        
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
    } finally {
        db.close();
    }
}

// Show usage
function showUsage() {
    console.log('🔧 TARGETED VENUE IMAGE DOWNLOADER');
    console.log('===================================');
    console.log('');
    console.log('Usage:');
    console.log('  node targeted-venue-downloader.js <venueId> <imageUrl>');
    console.log('');
    console.log('Example:');
    console.log('  node targeted-venue-downloader.js 5 "https://example.com/venue-photo.jpg"');
    console.log('');
    console.log('To find venue IDs without images:');
    console.log('  node verify-venue-images.js');
}

// Main
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length !== 2) {
        showUsage();
        process.exit(1);
    }
    
    const venueId = parseInt(args[0]);
    const imageUrl = args[1];
    
    if (isNaN(venueId)) {
        console.log('❌ Invalid venue ID');
        process.exit(1);
    }
    
    if (!imageUrl.startsWith('http')) {
        console.log('❌ Invalid image URL');
        process.exit(1);
    }
    
    await downloadVenueImage(venueId, imageUrl);
}

if (require.main === module) {
    main();
}

module.exports = { downloadVenueImage, updateVenueImage };