#!/usr/bin/env node

/**
 * SINGLE VENUE TEST - Julie Rogers Theatre
 * Focus on getting a real photo of this specific venue
 */

const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'public/images/venues');
const VENUE_ID = 1;
const VENUE_NAME = 'Julie Rogers Theatre';
const VENUE_WEBSITE = 'http://www.julierogerstheatre.com/';

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

// Strategy 1: Get images directly from venue website
async function getVenueImagesFromWebsite() {
    let browser;
    try {
        console.log(`🔍 Scraping venue website: ${VENUE_WEBSITE}`);
        
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
        await page.setViewport({ width: 1200, height: 800 });
        
        await page.goto(VENUE_WEBSITE, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Look for actual venue photos
        const imageUrls = await page.evaluate(() => {
            // Try to find hero/featured images first
            const heroImages = Array.from(document.querySelectorAll('header img, .hero img, .banner img, .main-image img'));
            if (heroImages.length > 0) {
                return heroImages.map(img => img.src).filter(src => src && src.startsWith('http'));
            }
            
            // Look for gallery or photo sections
            const photoSections = document.querySelectorAll('.gallery, .photos, [class*="photo"], [class*="gallery"]');
            if (photoSections.length > 0) {
                const galleryImages = [];
                photoSections.forEach(section => {
                    const images = section.querySelectorAll('img');
                    images.forEach(img => {
                        if (img.src && img.src.startsWith('http')) {
                            galleryImages.push(img.src);
                        }
                    });
                });
                if (galleryImages.length > 0) {
                    return galleryImages;
                }
            }
            
            // Get all large images as fallback
            const allImages = Array.from(document.querySelectorAll('img'));
            return allImages
                .filter(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.width > 400 && rect.height > 300; // Large images only
                })
                .map(img => img.src)
                .filter(src => src && src.startsWith('http'));
        });
        
        console.log(`📸 Found ${imageUrls.length} potential venue photos`);
        
        await browser.close();
        return imageUrls.slice(0, 3); // Return top 3
        
    } catch (err) {
        console.log(`❌ Website scraping failed: ${err.message}`);
        if (browser) await browser.close();
        return [];
    }
}

// Strategy 2: Google Images search for venue photos
async function getVenueImagesFromGoogle() {
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
        
        // Search for the venue specifically
        const searchQuery = `${VENUE_NAME} exterior photo`;
        const googleImagesUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;
        
        await page.goto(googleImagesUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait for images to load and extract URLs
        await page.waitForTimeout(3000);
        
        const imageUrls = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return images
                .map(img => img.src || img.dataset.src)
                .filter(src => src && src.startsWith('http') && !src.includes('gstatic.com'))
                .slice(0, 5);
        });
        
        console.log(`📷 Found ${imageUrls.length} Google Images`);
        await browser.close();
        
        return imageUrls;
        
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
    
    // Try venue website first
    console.log('\n1️⃣ ATTEMPT: Venue Website');
    let imageUrls = await getVenueImagesFromWebsite();
    
    let success = false;
    if (imageUrls.length > 0) {
        for (const url of imageUrls) {
            console.log(`\n📥 Trying URL: ${url.substring(0, 60)}...`);
            success = await downloadImage(url, filepath);
            if (success) {
                console.log(`✅ SUCCESS! Downloaded real venue photo`);
                break;
            } else {
                console.log(`❌ Failed to download`);
            }
        }
    }
    
    // Try Google Images if website failed
    if (!success) {
        console.log('\n2️⃣ ATTEMPT: Google Images');
        imageUrls = await getVenueImagesFromGoogle();
        
        if (imageUrls.length > 0) {
            for (const url of imageUrls) {
                console.log(`\n📥 Trying URL: ${url.substring(0, 60)}...`);
                success = await downloadImage(url, filepath);
                if (success) {
                    console.log(`✅ SUCCESS! Downloaded venue photo from Google Images`);
                    break;
                } else {
                    console.log(`❌ Failed to download`);
                }
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