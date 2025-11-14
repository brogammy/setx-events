#!/usr/bin/env node

/**
 * REAL VENUE IMAGE SCRAPER
 * 
 * Scrapes actual venue images from Google Images using Puppeteer
 * Updates the database with real venue photos
 */

const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');
const TIMEOUT = 30000;

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Database connection
const db = new sqlite3.Database(DB_PATH);

// Download image from URL
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const file = fs.createWriteStream(filepath);
        protocol.get(url, { timeout: TIMEOUT }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    if (stats.size > 5000) {
                        resolve(true);
                    } else {
                        fs.unlinkSync(filepath);
                        resolve(false);
                    }
                });
            } else {
                file.destroy();
                resolve(false);
            }
        }).on('error', (err) => {
            file.destroy();
            fs.unlink(filepath, () => {});
            resolve(false);
        });
    });
}

// Extract actual image URL from Google Images
async function extractImageUrl(page) {
    try {
        // Wait for images to load
        await page.waitForSelector('img', { timeout: 10000 });
        
        // Get the actual image URL from the search results
        const imageUrl = await page.evaluate(() => {
            // Look for the first large image that's not a favicon or logo
            const imgs = Array.from(document.querySelectorAll('img'));
            
            // Filter out small images and Google's own icons
            const largeImages = imgs.filter(img => {
                // Skip very small images
                if (img.width < 100 || img.height < 100) return false;
                
                // Get the image source
                const src = img.src || img.dataset.src;
                if (!src) return false;
                
                // Skip data URLs, Google's own images, and very short URLs
                if (src.startsWith('data:') || 
                    src.includes('gstatic.com') || 
                    src.includes('google.com') ||
                    src.includes('favicon') ||
                    src.length < 50) {
                    return false;
                }
                
                return true;
            });
            
            // Return the first valid large image URL
            if (largeImages.length > 0) {
                return largeImages[0].src || largeImages[0].dataset.src;
            }
            
            return null;
        });
        
        return imageUrl;
    } catch (err) {
        console.error('Error extracting image URL:', err.message);
        return null;
    }
}

// Search and download image for a venue
async function downloadVenueImage(browser, venue) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Create search query for the specific venue
        const searchQuery = `"${venue.name}" ${venue.city} Texas site:facebook.com OR site:instagram.com OR site:*.com`;
        const googleImagesUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch&safe=active`;
        
        console.log(`\n[${venue.id}] 🔍 Searching for: ${venue.name}`);
        console.log(`    Query: ${searchQuery}`);
        
        // Navigate to Google Images
        await page.goto(googleImagesUrl, { 
            waitUntil: 'networkidle2', 
            timeout: TIMEOUT 
        });
        
        // Extract image URL
        const imageUrl = await extractImageUrl(page);
        
        if (imageUrl) {
            console.log(`    📎 Found image URL: ${imageUrl.substring(0, 60)}...`);
            
            const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
            const localUrl = `/images/venues/venue-${venue.id}.jpg`;
            
            const success = await downloadImage(imageUrl, filepath);
            if (success) {
                // Update database with the image URL
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
                        [localUrl, localUrl, venue.id],
                        (err) => {
                            if (err) {
                                console.error(`    ❌ Database error: ${err.message}`);
                                reject(err);
                            } else {
                                console.log(`    ✅ Downloaded and database updated`);
                                resolve();
                            }
                        }
                    );
                });
                return true;
            } else {
                console.log(`    ❌ Download failed or file too small`);
                return false;
            }
        } else {
            console.log(`    ❌ Could not find a suitable image`);
            return false;
        }
    } catch (err) {
        console.log(`    ❌ Error: ${err.message}`);
        return false;
    } finally {
        if (page) {
            await page.close();
        }
    }
}

// Get all active venues from database
function getActiveVenues() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT id, name, city FROM venues WHERE is_active = 1 ORDER BY id',
            (err, venues) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(venues);
                }
            }
        );
    });
}

// Main function
async function main() {
    console.log('\n📸 REAL VENUE IMAGE SCRAPER');
    console.log('='.repeat(50));
    console.log('This script will search for and download actual venue photos');
    console.log('from Google Images and update the database accordingly.\n');
    
    let browser;
    let successCount = 0;
    let failCount = 0;
    
    try {
        // Get all active venues
        const venues = await getActiveVenues();
        console.log(`Found ${venues.length} active venues\n`);
        
        // Launch browser
        browser = await puppeteer.launch({
            headless: true, // Set to false for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        console.log('🌐 Browser launched\n');
        
        // Process venues with progress indication
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const progress = `${i + 1}/${venues.length}`;
            
            // Skip if image already exists
            const imagePath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
            if (fs.existsSync(imagePath)) {
                console.log(`[${progress}] 📁 ${venue.name} - Image already exists, skipping`);
                successCount++;
                continue;
            }
            
            const success = await downloadVenueImage(browser, venue);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
            
            // Delay between requests to avoid rate limiting
            if (i < venues.length - 1) {
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        
    } catch (err) {
        console.error('Fatal error:', err.message);
        console.error(err.stack);
    } finally {
        if (browser) {
            await browser.close();
        }
        
        // Close database connection
        db.close();
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Failed to process: ${failCount}`);
    console.log(`📊 Success rate: ${Math.round((successCount / (successCount + failCount)) * 100)}%`);
    console.log('='.repeat(50) + '\n');
    
    process.exit(0);
}

// Run the script
if (require.main === module) {
    main().catch(err => {
        console.error('Unhandled error:', err);
        process.exit(1);
    });
}

module.exports = { downloadVenueImage, extractImageUrl };