#!/usr/bin/env node

/**
 * WIKIPEDIA VENUE IMAGE DOWNLOADER
 * Download venue images from Wikipedia when available
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

// Download image with validation
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
        if (!url || !url.startsWith('http')) {
            resolve(false);
            return;
        }
        
        const file = fs.createWriteStream(filepath);
        
        const options = {
            headers: {
                'User-Agent': 'SETX-Events-Image-Downloader/1.0 (sauly@example.com)'
            }
        };
        
        https.get(url, options, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    try {
                        const stats = fs.statSync(filepath);
                        // Valid image should be > 10KB
                        const isValid = stats.size > 10000;
                        if (!isValid) {
                            fs.unlinkSync(filepath);
                        }
                        console.log(`    Size: ${stats.size} bytes`);
                        resolve(isValid);
                    } catch (e) {
                        resolve(false);
                    }
                });
            } else {
                console.log(`    HTTP ${response.statusCode}: ${response.statusMessage}`);
                file.destroy();
                fs.unlink(filepath, () => {});
                resolve(false);
            }
        }).on('error', (err) => {
            console.log(`    Download error: ${err.message}`);
            file.destroy();
            fs.unlink(filepath, () => {});
            resolve(false);
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

// Search Wikipedia for venue images
async function searchWikipediaForVenue(venue) {
    try {
        console.log(`   🔍 Searching Wikipedia for "${venue.name}"`);
        
        // Format venue name for Wikipedia search
        const searchName = venue.name
            .replace(/[^a-zA-Z0-9 ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/ /g, '_');
        
        // Search Wikipedia API for the page
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(venue.name)}&format=json`;
        
        const searchResponse = await new Promise((resolve, reject) => {
            const url = new URL(searchUrl);
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                headers: {
                    'User-Agent': 'SETX-Events-Image-Downloader/1.0 (sauly@example.com)'
                }
            };
            
            https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });
        
        if (searchResponse.query && searchResponse.query.search && searchResponse.query.search.length > 0) {
            const pageTitle = searchResponse.query.search[0].title;
            console.log(`   📄 Found Wikipedia page: ${pageTitle}`);
            
            // Get images from the page
            const imagesUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=images&format=json`;
            
            const imagesResponse = await new Promise((resolve, reject) => {
                const url = new URL(imagesUrl);
                const options = {
                    hostname: url.hostname,
                    path: url.pathname + url.search,
                    headers: {
                        'User-Agent': 'SETX-Events-Image-Downloader/1.0 (sauly@example.com)'
                    }
                };
                
                https.get(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(JSON.parse(data)));
                }).on('error', reject);
            });
            
            if (imagesResponse.query && imagesResponse.query.pages) {
                const pageId = Object.keys(imagesResponse.query.pages)[0];
                const page = imagesResponse.query.pages[pageId];
                
                if (page.images) {
                    // Look for venue-specific images (not logos or icons)
                    const venueImages = page.images
                        .filter(img => 
                            img.title.includes('jpg') || 
                            img.title.includes('jpeg') ||
                            img.title.includes('png')
                        )
                        .filter(img => 
                            !img.title.includes('logo') && 
                            !img.title.includes('icon') &&
                            !img.title.includes('map') &&
                            !img.title.includes('seal') &&
                            (img.title.toLowerCase().includes('front') ||
                             img.title.toLowerCase().includes('exterior') ||
                             img.title.toLowerCase().includes('building') ||
                             img.title.toLowerCase().includes('theatre') ||
                             img.title.toLowerCase().includes('venue'))
                        );
                    
                    if (venueImages.length > 0) {
                        const imageName = venueImages[0].title;
                        console.log(`   🖼️  Found venue image: ${imageName}`);
                        
                        // Get actual image URL
                        const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(imageName)}&prop=imageinfo&iiprop=url&format=json`;
                        
                        const imageResponse = await new Promise((resolve, reject) => {
                            const url = new URL(imageUrl);
                            const options = {
                                hostname: url.hostname,
                                path: url.pathname + url.search,
                                headers: {
                                    'User-Agent': 'SETX-Events-Image-Downloader/1.0 (sauly@example.com)'
                                }
                            };
                            
                            https.get(options, (res) => {
                                let data = '';
                                res.on('data', chunk => data += chunk);
                                res.on('end', () => resolve(JSON.parse(data)));
                            }).on('error', reject);
                        });
                        
                        if (imageResponse.query && imageResponse.query.pages) {
                            const imgPageId = Object.keys(imageResponse.query.pages)[0];
                            const imgPage = imageResponse.query.pages[imgPageId];
                            
                            if (imgPage.imageinfo && imgPage.imageinfo[0]) {
                                const actualImageUrl = imgPage.imageinfo[0].url;
                                console.log(`   📥 Image URL: ${actualImageUrl}`);
                                return actualImageUrl;
                            }
                        }
                    }
                }
            }
        }
        
        return null;
        
    } catch (err) {
        console.log(`   ❌ Wikipedia search failed: ${err.message}`);
        return null;
    }
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
    console.log('🔍 WIKIPEDIA VENUE IMAGE DOWNLOADER');
    console.log('====================================');
    
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
                // Try to find image on Wikipedia
                const imageUrl = await searchWikipediaForVenue(venue);
                
                if (imageUrl) {
                    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
                    const localUrl = `/images/venues/venue-${venue.id}.jpg`;
                    
                    console.log(`   📥 Downloading image...`);
                    const success = await downloadImage(imageUrl, filepath);
                    
                    if (success) {
                        await updateVenueImage(venue.id, localUrl);
                        console.log(`   ✅ Success! Image downloaded and database updated`);
                        successCount++;
                    } else {
                        console.log(`   ❌ Failed to download image`);
                    }
                } else {
                    console.log(`   ❌ No Wikipedia image found`);
                }
                
            } catch (err) {
                console.log(`   ❌ Error: ${err.message}`);
            }
            
            // Delay between requests
            if (i < venues.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
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