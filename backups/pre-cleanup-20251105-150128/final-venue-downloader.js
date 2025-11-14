#!/usr/bin/env node

/**
 * FINAL VENUE IMAGE DOWNLOADER
 * Targeted approach to get images for remaining venues
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
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'SETX-Events-Image-Downloader/1.0 (sauly@example.com)'
            }
        };
        
        https.get(options, (response) => {
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

// Try to get image from Unsplash as fallback
async function tryUnsplashImage(venue) {
    try {
        console.log(`   🌅 Trying Unsplash for "${venue.name}"`);
        
        // Create search query
        const searchQuery = encodeURIComponent(`${venue.name} ${venue.city} Texas`);
        const unsplashUrl = `https://source.unsplash.com/800x600/?${searchQuery}`;
        
        // Test if URL works by making a HEAD request first
        const urlObj = new URL(unsplashUrl);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'HEAD',
            headers: {
                'User-Agent': 'SETX-Events-Image-Downloader/1.0 (sauly@example.com)'
            }
        };
        
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, resolve);
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            req.end();
        });
        
        if (response.statusCode === 200) {
            console.log(`   📥 Found Unsplash image`);
            return unsplashUrl;
        }
        
        return null;
    } catch (err) {
        console.log(`   ❌ Unsplash failed: ${err.message}`);
        return null;
    }
}

// Process venues that need images
async function processVenues() {
    console.log('🎯 FINAL VENUE IMAGE DOWNLOADER');
    console.log('===============================');
    
    try {
        const venues = await getVenuesNeedingImages();
        
        if (venues.length === 0) {
            console.log('✅ All venues have images');
            db.close();
            return;
        }
        
        console.log(`Found ${venues.length} venues needing images\n`);
        
        let successCount = 0;
        
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const progress = `${i + 1}/${venues.length}`;
            
            console.log(`\n🎯 [${progress}] ${venue.name} (${venue.city})`);
            
            try {
                // Try Wikipedia first
                const searchQuery = encodeURIComponent(venue.name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim());
                const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${searchQuery}`;
                
                try {
                    const response = await httpGet(searchUrl);
                    const data = JSON.parse(response.data);
                    
                    if (data.thumbnail && data.thumbnail.source) {
                        console.log(`   🖼️  Wikipedia image found`);
                        
                        const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
                        const localUrl = `/images/venues/venue-${venue.id}.jpg`;
                        
                        try {
                            const size = await downloadBinaryFile(data.thumbnail.source, filepath);
                            console.log(`   ✅ Downloaded ${size} bytes`);
                            
                            if (size > 10000) { // Valid size check
                                await updateVenueImage(venue.id, localUrl);
                                console.log(`   📁 Database updated`);
                                successCount++;
                                continue; // Move to next venue
                            } else {
                                console.log(`   ❌ Image too small, deleting`);
                                fs.unlinkSync(filepath);
                            }
                        } catch (downloadErr) {
                            console.log(`   ❌ Download failed: ${downloadErr.message}`);
                        }
                    } else {
                        console.log(`   ❌ No Wikipedia thumbnail found`);
                    }
                } catch (apiErr) {
                    if (apiErr.message.includes('404')) {
                        console.log(`   ❌ No Wikipedia page found`);
                    } else {
                        console.log(`   ❌ Wikipedia API error: ${apiErr.message}`);
                    }
                }
                
                // Try Unsplash as fallback
                const unsplashUrl = await tryUnsplashImage(venue);
                if (unsplashUrl) {
                    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
                    const localUrl = `/images/venues/venue-${venue.id}.jpg`;
                    
                    try {
                        const size = await downloadBinaryFile(unsplashUrl, filepath);
                        console.log(`   ✅ Downloaded Unsplash image (${size} bytes)`);
                        
                        if (size > 10000) {
                            await updateVenueImage(venue.id, localUrl);
                            console.log(`   📁 Database updated`);
                            successCount++;
                            continue;
                        } else {
                            console.log(`   ❌ Image too small, deleting`);
                            fs.unlinkSync(filepath);
                        }
                    } catch (downloadErr) {
                        console.log(`   ❌ Unsplash download failed: ${downloadErr.message}`);
                        if (fs.existsSync(filepath)) {
                            fs.unlinkSync(filepath);
                        }
                    }
                }
                
            } catch (err) {
                console.log(`   ❌ Error: ${err.message}`);
            }
            
            // Delay between requests
            if (i < venues.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`🎉 COMPLETED`);
        console.log(`✅ Successfully processed: ${successCount}/${venues.length}`);
        console.log('='.repeat(50) + '\n');
        
        db.close();
        
    } catch (err) {
        console.error('Fatal error:', err.message);
        db.close();
    }
}

processVenues();