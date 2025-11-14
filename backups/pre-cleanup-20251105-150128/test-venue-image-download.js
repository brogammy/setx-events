#!/usr/bin/env node

/**
 * TEST VENUE IMAGE DOWNLOAD
 * Simple script to test downloading images for a few venues
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

// Test venues
const testVenues = [
    { id: 3, name: 'Museum of the Gulf Coast', city: 'Port Arthur' },
    { id: 5, name: 'Beaumont Civic Centre', city: 'Beaumont' },
    { id: 10, name: 'Art Museum of Southeast Texas', city: 'Beaumont' }
];

// Download image from URL
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
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

// Extract image URL from Google Images results
async function extractImageUrl(page) {
    try {
        // Wait for images to load
        await page.waitForSelector('img', { timeout: 10000 });
        
        // Get image URLs
        const imageUrls = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return images
                .map(img => img.src || img.dataset.src)
                .filter(src => src && src.startsWith('http') && !src.includes('gstatic.com') && !src.includes('data:'))
                .slice(0, 5); // Get first 5 images
        });
        
        console.log(`    Found ${imageUrls.length} potential images`);
        return imageUrls[0] || null; // Return first image
    } catch (err) {
        console.log(`    Error extracting images: ${err.message}`);
        return null;
    }
}

// Search and download image for a venue
async function downloadVenueImage(browser, venue) {
    let page;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        const searchQuery = `${venue.name} ${venue.city} Texas`;
        const googleImagesUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;
        
        console.log(`\n🔍 Searching for: ${venue.name}`);
        console.log(`   Query: ${searchQuery}`);
        
        await page.goto(googleImagesUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        const imageUrl = await extractImageUrl(page);
        
        if (imageUrl) {
            console.log(`   Image URL: ${imageUrl.substring(0, 80)}...`);
            
            const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
            
            const success = await downloadImage(imageUrl, filepath);
            if (success) {
                console.log(`   ✅ Successfully downloaded`);
                return true;
            } else {
                console.log(`   ❌ Download failed`);
                return false;
            }
        } else {
            console.log(`   ❌ No valid image found`);
            return false;
        }
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
    console.log('📸 TEST VENUE IMAGE DOWNLOADER');
    console.log('='.repeat(40));
    
    let browser;
    let successCount = 0;
    
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        
        console.log('🌐 Browser launched\n');
        
        for (const venue of testVenues) {
            const success = await downloadVenueImage(browser, venue);
            if (success) successCount++;
            
            // Delay between requests
            await new Promise(r => setTimeout(r, 2000));
        }
        
    } catch (err) {
        console.error('Fatal error:', err.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    console.log('\n' + '='.repeat(40));
    console.log(`✅ Successfully downloaded: ${successCount}/${testVenues.length}`);
    console.log('='.repeat(40) + '\n');
}

main().catch(console.error);