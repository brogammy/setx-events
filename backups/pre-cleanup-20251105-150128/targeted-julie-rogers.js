#!/usr/bin/env node

/**
 * TARGETED VENUE IMAGE DOWNLOADER - Julie Rogers Theatre
 * Focus on getting a quality image of this specific venue
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
        
        // Skip data URLs and known bad patterns
        if (url.startsWith('data:') || url.includes('gstatic.com') || url.includes('favicon') || url.includes('logo')) {
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
                        // Valid image should be > 20KB for quality
                        const isValid = stats.size > 20000;
                        if (!isValid) {
                            fs.unlinkSync(filepath); // Remove small files
                        }
                        console.log(`    Downloaded ${stats.size} bytes`);
                        resolve(isValid);
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

// Google Images search with precise targeting
async function getImagesFromGoogleImages() {
    let browser;
    try {
        console.log(`🔍 Google Images search for "${VENUE_NAME}"`);
        
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
        
        // Targeted search query for actual venue photos
        const searchQuery = `${VENUE_NAME} ${VENUE_CITY} Texas building exterior photo`;
        const googleImagesUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;
        
        console.log(`   🔎 Searching: "${searchQuery}"`);
        await page.goto(googleImagesUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait for images to load
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 4000)));
        
        const imageUrls = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return images
                .map(img => {
                    // Try different ways to get the actual image URL
                    return img.src || img.dataset.src || img.getAttribute('data-src');
                })
                .filter(src => src && src.startsWith('http') && 
                       !src.includes('gstatic.com') && 
                       !src.includes('favicon') &&
                       !src.includes('logo') &&
                       !src.includes('data:') &&
                       src.length > 50) // Filter out small/thumbnail URLs
                .slice(0, 8);
        });
        
        console.log(`   📷 Found ${imageUrls.length} potential images`);
        await browser.close();
        return imageUrls;
        
    } catch (err) {
        console.log(`   ❌ Google Images failed: ${err.message.substring(0, 50)}...`);
        if (browser) await browser.close();
        return [];
    }
}

// Main function - focus on one venue until it works
async function main() {
    console.log(`🎯 TARGETED: ${VENUE_NAME}`);
    console.log('==========================');
    
    const filepath = path.join(IMAGES_DIR, `venue-${VENUE_ID}.jpg`);
    
    // Remove existing file for clean test
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
    }
    
    console.log('\n🔍 GOOGLE IMAGES APPROACH');
    let imageUrls = await getImagesFromGoogleImages();
    
    if (imageUrls.length > 0) {
        console.log(`\n📥 ATTEMPTING DOWNLOADS`);
        
        // Try images in order until one works
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            console.log(`\n   Image ${i+1}/${imageUrls.length}:`);
            console.log(`   URL: ${url.substring(0, 70)}...`);
            
            const success = await downloadImage(url, filepath);
            if (success) {
                const stats = fs.statSync(filepath);
                console.log(`\n🎉 SUCCESS!`);
                console.log(`   File: venue-${VENUE_ID}.jpg`);
                console.log(`   Size: ${stats.size} bytes`);
                console.log(`   Status: REAL VENUE PHOTO DOWNLOADED`);
                return;
            } else {
                console.log(`   ❌ Failed - trying next image`);
            }
        }
    }
    
    console.log(`\n💥 FAILED - No quality venue images found`);
    console.log(`   Next steps: Try different search terms or approach`);
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});