#!/usr/bin/env node

/**
 * VENUE PHOTO DOWNLOADER
 * Gets actual photos of venues using multiple targeted approaches
 */

const puppeteer = require('puppeteer');
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

// Get all active venues from database
function getActiveVenues() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT id, name, city, website 
            FROM venues 
            WHERE is_active = 1 
            ORDER BY id
        `, (err, venues) => {
            if (err) reject(err);
            else resolve(venues);
        });
    });
}

// Download image with validation
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
        if (!url || !url.startsWith('http')) {
            resolve(false);
            return;
        }
        
        const file = fs.createWriteStream(filepath);
        
        https.get(url, { timeout: 30000 }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    try {
                        const stats = fs.statSync(filepath);
                        // Valid image should be > 10KB
                        resolve(stats.size > 10000);
                    } catch (e) {
                        resolve(false);
                    }
                });
            } else {
                file.destroy();
                fs.unlink(filepath, () => {});
                resolve(false);
            }
        }).on('error', (err) => {
            file.destroy();
            fs.unlink(filepath, () => {});
            resolve(false);
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

// Strategy 1: Get images directly from venue website using Puppeteer
async function getVenueImagesFromWebsite(venue) {
    let browser;
    try {
        console.log(`    🕵️‍♂️ Scraping venue website`);
        
        if (!venue.website || venue.website.trim() === '') {
            console.log(`    ❌ No website URL`);
            return null;
        }
        
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Set viewport for consistent screenshots
        await page.setViewport({ width: 1200, height: 800 });
        
        console.log(`    🌐 Visiting: ${venue.website}`);
        await page.goto(venue.website, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Look for hero images, gallery images, or venue photos
        const imageUrls = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            const venueImageSelectors = [
                'header img', '.hero img', '.banner img', 
                '.cover img', '.gallery img', '.photo img',
                '[class*="hero"] img', '[class*="banner"] img',
                '[class*="gallery"] img', '[class*="photo"] img'
            ];
            
            // First look for specifically venue-related images
            let foundImages = [];
            for (const selector of venueImageSelectors) {
                const elements = document.querySelectorAll(selector);
                foundImages = foundImages.concat(Array.from(elements).map(el => el.src));
            }
            
            // If none found, get high-quality images
            if (foundImages.length === 0) {
                foundImages = images
                    .filter(img => {
                        // Get images with dimensions
                        const rect = img.getBoundingClientRect();
                        return rect.width > 300 && rect.height > 200;
                    })
                    .map(img => img.src)
                    .filter(src => src && (src.startsWith('http') || src.startsWith('//')));
            }
            
            return foundImages.slice(0, 3); // Return top 3
        });
        
        console.log(`    📸 Found ${imageUrls.length} potential venue images`);
        
        await browser.close();
        return imageUrls.length > 0 ? imageUrls[0] : null;
        
    } catch (err) {
        console.log(`    ❌ Website scraping failed: ${err.message}`);
        if (browser) await browser.close();
        return null;
    }
}

// Strategy 2: Google Images search for venue photos
async function getVenueImagesFromGoogle(venue) {
    let browser;
    try {
        console.log(`    🔍 Google Images search`);
        
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Search for "[venue name] [city] Texas venue photo"
        const searchQuery = `${venue.name} ${venue.city} Texas venue photo`;
        const googleImagesUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;
        
        console.log(`    🔎 Searching: "${searchQuery}"`);
        await page.goto(googleImagesUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Extract image URLs from Google Images
        const imageUrls = await page.evaluate(() => {
            // Wait a bit for images to load
            return new Promise((resolve) => {
                setTimeout(() => {
                    const images = Array.from(document.querySelectorAll('img'));
                    const urls = images
                        .map(img => {
                            // Try different sources
                            return img.src || img.dataset.src || img.getAttribute('data-src');
                        })
                        .filter(src => src && src.startsWith('http') && !src.includes('gstatic.com'))
                        .slice(0, 5); // Get first 5 images
                    
                    resolve(urls);
                }, 3000); // Wait 3 seconds for images to load
            });
        });
        
        console.log(`    📷 Found ${imageUrls.length} Google Images`);
        await browser.close();
        
        return imageUrls.length > 0 ? imageUrls[0] : null;
        
    } catch (err) {
        console.log(`    ❌ Google Images search failed: ${err.message}`);
        if (browser) await browser.close();
        return null;
    }
}

// Download image for venue with multiple strategies
async function downloadVenueImage(venue) {
    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
    const localUrl = `/images/venues/venue-${venue.id}.jpg`;
    
    // Skip if valid image already exists
    if (fs.existsSync(filepath)) {
        try {
            const stats = fs.statSync(filepath);
            if (stats.size > 10000) { // Valid size
                console.log(`    ✅ Good image already exists`);
                return true;
            }
        } catch (e) {
            // File issue, continue with download
        }
    }
    
    console.log(`\n🎯 ${venue.name} (${venue.city})`);
    if (venue.website) {
        console.log(`   🌐 ${venue.website}`);
    }
    
    let imageUrl = null;
    
    // Strategy 1: Try venue website first
    if (venue.website) {
        imageUrl = await getVenueImagesFromWebsite(venue);
    }
    
    // Strategy 2: Try Google Images
    if (!imageUrl) {
        imageUrl = await getVenueImagesFromGoogle(venue);
    }
    
    // If we found an image URL, download it
    if (imageUrl) {
        console.log(`   📥 Downloading: ${imageUrl.substring(0, 60)}...`);
        const success = await downloadImage(imageUrl, filepath);
        if (success) {
            await updateVenueImage(venue.id, localUrl);
            console.log(`   ✅ Downloaded and database updated`);
            return true;
        } else {
            console.log(`   ❌ Download failed`);
        }
    } else {
        console.log(`   ❌ No quality images found`);
    }
    
    return false;
}

// Main function
async function main() {
    console.log('🏢 REAL VENUE PHOTO DOWNLOADER');
    console.log('===============================');
    console.log('Getting actual photos of venues\n');
    
    try {
        // Get all venues
        const venues = await getActiveVenues();
        
        if (venues.length === 0) {
            console.log('❌ No venues found in database');
            process.exit(1);
        }
        
        console.log(`Found ${venues.length} active venues\n`);
        
        let successCount = 0;
        
        // Process venues one by one
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const progress = `${i + 1}/${venues.length}`;
            
            try {
                const success = await downloadVenueImage(venue);
                if (success) successCount++;
            } catch (err) {
                console.log(`   ❌ Error: ${err.message}`);
            }
            
            // Show progress
            if ((i + 1) % 5 === 0 || i === venues.length - 1) {
                console.log(`\n   📊 Progress: ${successCount}/${i + 1} successful\n`);
            }
            
            // Delay between requests
            if (i < venues.length - 1) {
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        
        console.log('\n' + '='.repeat(40));
        console.log(`🎉 COMPLETED`);
        console.log(`✅ Successfully processed: ${successCount}/${venues.length}`);
        console.log(`📊 Success rate: ${Math.round((successCount / venues.length) * 100)}%`);
        console.log('='.repeat(40) + '\n');
        
        db.close();
        
    } catch (err) {
        console.error('Fatal error:', err.message);
        db.close();
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Unhandled error:', err.message);
    process.exit(1);
});