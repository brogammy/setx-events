#!/usr/bin/env node

/**
 * SINGLE VENUE TEST - Julie Rogers Theatre (Google Images approach)
 * Focus on getting a real photo when website is not accessible
 */

const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'public/images/venues');
const VENUE_ID = 1;
const VENUE_NAME = 'Julie Rogers Theatre';
const VENUE_CITY = 'Beaumont';

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
        
        https.get(url, { timeout: 30000 }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    try {
                        const stats = fs.statSync(filepath);
                        // Valid image should be > 10KB
                        console.log(`    Downloaded ${stats.size} bytes`);
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

// Google Images search for venue photos with better targeting
async function getVenueImagesFromGoogle() {
    let browser;
    try {
        console.log(`🔍 Google Images search for "${VENUE_NAME} ${VENUE_CITY} Texas"`);
        
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
        
        // Search for the venue specifically with multiple search terms
        const searchQueries = [
            `${VENUE_NAME} ${VENUE_CITY} Texas exterior`,
            `${VENUE_NAME} ${VENUE_CITY} performance venue`,
            `${VENUE_NAME} ${VENUE_CITY} Texas building photo`,
            `${VENUE_NAME} Beaumont Texas`
        ];
        
        for (const searchQuery of searchQueries) {
            console.log(`\n   Trying search: "${searchQuery}"`);
            const googleImagesUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;
            
            await page.goto(googleImagesUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Wait for images to load and extract URLs
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
            
            const imageUrls = await page.evaluate(() => {
                const images = Array.from(document.querySelectorAll('img'));
                return images
                    .map(img => img.src || img.dataset.src)
                    .filter(src => src && src.startsWith('http') && !src.includes('gstatic.com') && !src.includes('data:'))
                    .slice(0, 8); // Get more images to increase chances
            });
            
            console.log(`   📷 Found ${imageUrls.length} Google Images`);
            
            if (imageUrls.length > 0) {
                await browser.close();
                return imageUrls;
            }
        }
        
        await browser.close();
        return [];
        
    } catch (err) {
        console.log(`❌ Google Images search failed: ${err.message}`);
        if (browser) await browser.close();
        return [];
    }
}

// Main test function
async function main() {
    console.log(`🎯 TESTING: ${VENUE_NAME}`);
    console.log('========================');
    
    const filepath = path.join(IMAGES_DIR, `venue-${VENUE_ID}.jpg`);
    
    // Remove existing file for clean test
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
    }
    
    console.log('\n🔍 ATTEMPT: Google Images (Multiple Search Strategies)');
    let imageUrls = await getVenueImagesFromGoogle();
    
    let success = false;
    if (imageUrls.length > 0) {
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            console.log(`\n📥 Trying URL ${i+1}/${imageUrls.length}: ${url.substring(0, 60)}...`);
            success = await downloadImage(url, filepath);
            if (success) {
                console.log(`✅ SUCCESS! Downloaded venue photo from Google Images`);
                break;
            } else {
                console.log(`❌ Failed to download`);
            }
        }
    }
    
    // Final result
    if (success) {
        const stats = fs.statSync(filepath);
        console.log(`\n🎉 FINAL RESULT:`);
        console.log(`   File: venue-${VENUE_ID}.jpg`);
        console.log(`   Size: ${stats.size} bytes`);
        console.log(`   Status: SUCCESS! Real venue photo downloaded`);
    } else {
        console.log(`\n💥 FINAL RESULT:`);
        console.log(`   Status: FAILED - Could not get real venue photo`);
    }
}

main().catch(err => {
    console.error('Unhandled error:', err.message);
    process.exit(1);
});