#!/usr/bin/env node

/**
 * MANUAL GOOGLE IMAGES VISIT - Julie Rogers Theatre
 * Actually visit Google Images and wait for content
 */

const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

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
                        const isValid = stats.size > 15000;
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

async function manualGoogleVisit() {
    let browser;
    try {
        console.log('🔍 MANUAL GOOGLE IMAGES VISIT');
        console.log('==============================');
        
        browser = await puppeteer.launch({
            headless: true, // Let's see what's happening
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setViewport({ width: 1200, height: 800 });
        
        // Go directly to Google Images
        console.log('\n🌐 Visiting Google Images...');
        await page.goto('https://www.google.com/imghp', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Type search query
        console.log('⌨️  Entering search query...');
        await page.type('input[name="q"]', 'Julie Rogers Theatre Beaumont Texas');
        
        // Click search button
        console.log('🖱️  Clicking search...');
        await page.click('input[name="btnK"]');
        
        // Wait for results
        console.log('⏳ Waiting for search results...');
        await page.waitForSelector('img', { timeout: 30000 });
        await page.waitForTimeout(5000); // Wait extra for images to load
        
        // Scroll to load more images
        console.log('⏬ Scrolling to load more images...');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(3000);
        
        // Get image URLs
        console.log('📸 Extracting image URLs...');
        const imageUrls = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return images
                .map(img => img.src)
                .filter(src => 
                    src && 
                    src.startsWith('http') && 
                    !src.includes('gstatic.com') && 
                    !src.includes('favicon') &&
                    !src.includes('data:') &&
                    src.length > 100
                )
                .slice(0, 15);
        });
        
        console.log(`\n📷 Found ${imageUrls.length} image URLs:`);
        
        // Try downloading each one
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            console.log(`\n--- Trying Image ${i+1} ---`);
            console.log(`URL: ${url.substring(0, 80)}...`);
            
            const filepath = path.join(IMAGES_DIR, `venue-1-attempt-${i+1}.jpg`);
            const success = await downloadImage(url, filepath);
            
            if (success) {
                console.log(`✅ SUCCESS! Quality image downloaded`);
                // Copy as main venue image
                fs.copyFileSync(filepath, path.join(IMAGES_DIR, `venue-1.jpg`));
                console.log(`📁 Saved as venue-1.jpg`);
                break;
            } else {
                console.log(`❌ Failed or low quality`);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            }
        }
        
        // Keep browser open so we can see what happened
        console.log('\n👀 Browser will stay open for inspection');
        console.log('Press Ctrl+C to close when done');
        
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
        if (browser) await browser.close();
    }
}

manualGoogleVisit().catch(console.error);