#!/usr/bin/env node

/**
 * IMPROVED VENUE IMAGE SCRAPER
 * Better approach to get real venue images
 */

const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Venues to process (just a few for testing)
const venues = [
    { id: 3, name: 'Museum of the Gulf Coast', city: 'Port Arthur' },
    { id: 5, name: 'Beaumont Civic Centre', city: 'Beaumont' },
    { id: 10, name: 'Art Museum of Southeast Texas', city: 'Beaumont' }
];

// Download image from URL
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
        // Filter out obviously wrong URLs
        if (url.includes('google') || url.includes('gstatic') || url.includes('data:')) {
            console.log('    Skipping Google/generic URL');
            resolve(false);
            return;
        }
        
        const file = fs.createWriteStream(filepath);
        https.get(url, { timeout: 30000 }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    console.log(`    Downloaded ${stats.size} bytes`);
                    resolve(stats.size > 5000); // Check if file is larger than 5KB
                });
            } else {
                file.destroy();
                console.log(`    HTTP ${response.statusCode}`);
                resolve(false);
            }
        }).on('error', (err) => {
            file.destroy();
            console.log(`    Error: ${err.message}`);
            resolve(false);
        });
    });
}

// Extract actual venue images from Google Images
async function extractVenueImages(page) {
    try {
        // Wait for the page to load
        await page.waitForTimeout(3000);
        
        // Click on "Tools" to open options
        try {
            await page.click('#hdtb-tls');
            await page.waitForTimeout(1000);
            
            // Click on "Usage rights" and select "Labeled for reuse"
            await page.click('[aria-label="Usage rights"]');
            await page.waitForTimeout(1000);
            await page.click('[data-value="lfu"]');
            await page.waitForTimeout(2000);
        } catch (e) {
            console.log('    Could not apply usage rights filter');
        }
        
        // Extract image URLs with better selectors
        const imageUrls = await page.evaluate(() => {
            const images = [];
            // Look for images in the main results area
            const imgElements = document.querySelectorAll('img[data-src], img[src]');
            
            for (const img of imgElements) {
                let src = img.dataset.src || img.src;
                
                // Skip Google's own images and data URLs
                if (!src || 
                    src.includes('google') || 
                    src.includes('gstatic') || 
                    src.includes('data:') ||
                    src.includes('favicon') ||
                    src.length < 50) {
                    continue;
                }
                
                // Only include images that look like they could be venue photos
                if (src.startsWith('http') && 
                    (src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.png'))) {
                    images.push(src);
                }
            }
            
            return images.slice(0, 3); // Return first 3 images
        });
        
        console.log(`    Found ${imageUrls.length} candidate images`);
        return imageUrls;
    } catch (err) {
        console.log(`    Error extracting images: ${err.message}`);
        return [];
    }
}

// Search and download image for a venue
async function downloadVenueImage(browser, venue) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });
        
        const searchQuery = `${venue.name} ${venue.city} Texas`;
        const googleImagesUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch&safe=active`;
        
        console.log(`\n🔍 Searching for: ${venue.name}`);
        console.log(`   Query: ${searchQuery}`);
        
        await page.goto(googleImagesUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait for images to load
        await page.waitForTimeout(2000);
        
        const imageUrls = await extractVenueImages(page);
        
        // Try each image URL until we find one that works
        for (const imageUrl of imageUrls) {
            console.log(`   Trying image: ${imageUrl.substring(0, 80)}...`);
            
            const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
            
            const success = await downloadImage(imageUrl, filepath);
            if (success) {
                console.log(`   ✅ Successfully downloaded`);
                return true;
            }
        }
        
        console.log(`   ❌ No valid images found or downloaded`);
        return false;
    } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        return false;
    } finally {
        if (page) {
            await page.close();
        }
    }
}

// Main function
async function main() {
    console.log('📸 IMPROVED VENUE IMAGE SCRAPER');
    console.log('='.repeat(45));
    
    let browser;
    let successCount = 0;
    
    try {
        browser = await puppeteer.launch({
            headless: true, // Set to false for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            ]
        });
        
        console.log('🌐 Browser launched\n');
        
        for (const venue of venues) {
            // Skip if image already exists
            const existingPath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
            if (fs.existsSync(existingPath)) {
                console.log(`📁 ${venue.name} - Image already exists`);
                successCount++;
                continue;
            }
            
            const success = await downloadVenueImage(browser, venue);
            if (success) successCount++;
            
            // Delay between requests to be respectful
            await new Promise(r => setTimeout(r, 3000));
        }
        
    } catch (err) {
        console.error('Fatal error:', err.message);
        console.error(err.stack);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    console.log('\n' + '='.repeat(45));
    console.log(`✅ Successfully processed: ${successCount}/${venues.length}`);
    console.log('='.repeat(45) + '\n');
}

main().catch(console.error);