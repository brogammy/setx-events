#!/usr/bin/env node

/**
 * DIRECT WIKIPEDIA IMAGE DOWNLOADER
 * Download venue images from Wikipedia with proper HTTP handling
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

// Simple HTTP GET with proper headers
function httpGet(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'SETX-Events-Image-Downloader/1.0 (sauly@example.com)'
            }
        };
        
        https.get(url, options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                if (response.statusCode === 200) {
                    resolve({ data: data, statusCode: response.statusCode });
                } else {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }
            });
        }).on('error', reject);
    });
}

// Download binary file with proper headers
function downloadBinaryFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'SETX-Events-Image-Downloader/1.0 (sauly@example.com)'
            }
        };
        
        const file = fs.createWriteStream(filepath);
        
        https.get(url, options, (response) => {
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

// Get venues that need images
function getVenuesNeedingImages() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT id, name, city 
            FROM venues 
            WHERE is_active = 1 
            AND (cover_image_url IS NULL OR cover_image_url = '')
            ORDER BY id
        `, (err, venues) => {
            if (err) reject(err);
            else resolve(venues);
        });
    });
}

// Update database with image URL
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

// Process venues that need images
async function processVenues() {
    console.log('📥 DIRECT WIKIPEDIA IMAGE DOWNLOADER');
    console.log('=====================================');
    
    try {
        const venues = await getVenuesNeedingImages();
        
        if (venues.length === 0) {
            console.log('✅ All venues have images');
            db.close();
            return;
        }
        
        console.log(`Found ${venues.length} venues needing images\n`);
        
        let successCount = 0;
        
        // Process just the first few to test
        const testVenues = venues.slice(0, 10);
        
        for (let i = 0; i < testVenues.length; i++) {
            const venue = testVenues[i];
            const progress = `${i + 1}/${testVenues.length}`;
            
            console.log(`\n🎯 [${progress}] ${venue.name} (${venue.city})`);
            
            try {
                // Create a simple search to find Wikipedia page
                const searchQuery = encodeURIComponent(venue.name);
                const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${searchQuery}`;
                
                try {
                    const response = await httpGet(searchUrl);
                    const data = JSON.parse(response.data);
                    
                    if (data.thumbnail && data.thumbnail.source) {
                        console.log(`   🖼️  Found image: ${data.thumbnail.source}`);
                        
                        const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
                        const localUrl = `/images/venues/venue-${venue.id}.jpg`;
                        
                        try {
                            const size = await downloadBinaryFile(data.thumbnail.source, filepath);
                            console.log(`   ✅ Downloaded ${size} bytes`);
                            
                            if (size > 10000) { // Valid size check
                                await updateVenueImage(venue.id, localUrl);
                                console.log(`   📁 Database updated`);
                                successCount++;
                            } else {
                                console.log(`   ❌ Image too small, deleting`);
                                fs.unlinkSync(filepath);
                            }
                        } catch (downloadErr) {
                            console.log(`   ❌ Download failed: ${downloadErr.message}`);
                        }
                    } else {
                        console.log(`   ❌ No thumbnail found`);
                    }
                } catch (apiErr) {
                    console.log(`   ❌ Wikipedia API error: ${apiErr.message}`);
                }
                
            } catch (err) {
                console.log(`   ❌ Error: ${err.message}`);
            }
            
            // Delay between requests
            if (i < testVenues.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`🎉 COMPLETED TEST RUN`);
        console.log(`✅ Successfully processed: ${successCount}/${testVenues.length}`);
        console.log('='.repeat(50) + '\n');
        
        db.close();
        
    } catch (err) {
        console.error('Fatal error:', err.message);
        db.close();
    }
}

processVenues();