#!/usr/bin/env node

/**
 * DETAILED IMAGE SEARCH - Julie Rogers Theatre
 * Get actual image URLs from Google Images
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
                        // Valid image should be > 15KB
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

async function getJulieRogersImages() {
    let browser;
    try {
        console.log('🔍 GETTING JULIE ROGERS THEATRE IMAGES');
        console.log('=====================================');
        
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
        await page.setViewport({ width: 1200, height: 800 });
        
        // Search for Julie Rogers Theatre
        const searchQuery = 'Julie Rogers Theatre Beaumont Texas';
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;
        
        console.log(`\n🔎 Searching: "${searchQuery}"`);
        await page.goto(googleUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait for images to load
        console.log('⏳ Waiting for images to load...');
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));
        
        // Get all image URLs
        const imageData = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return images
                .map((img, index) => ({
                    index: index,
                    src: img.src || img.dataset.src || img.getAttribute('data-src'),
                    alt: img.alt || '',
                    width: img.width || 0,
                    height: img.height || 0
                }))
                .filter(data => 
                    data.src && 
                    data.src.startsWith('http') && 
                    !data.src.includes('gstatic.com') && 
                    !data.src.includes('favicon') &&
                    !data.src.includes('data:') &&
                    data.src.length > 100 // Longer URLs are more likely to be real images
                )
                .slice(0, 10); // Get first 10
        });
        
        console.log(`\n📸 Found ${imageData.length} potential images:`);
        
        if (imageData.length > 0) {
            // Try to download each image
            for (let i = 0; i < imageData.length; i++) {
                const data = imageData[i];
                console.log(`\n--- Image ${i+1} ---`);
                console.log(`URL: ${data.src.substring(0, 80)}...`);
                
                const filepath = path.join(IMAGES_DIR, `venue-1-test-${i+1}.jpg`);
                const success = await downloadImage(data.src, filepath);
                
                if (success) {
                    console.log(`✅ SUCCESS! Downloaded quality image`);
                    // Keep this as the main image
                    fs.copyFileSync(filepath, path.join(IMAGES_DIR, `venue-1.jpg`));
                    console.log(`📁 Copied as venue-1.jpg`);
                    break;
                } else {
                    console.log(`❌ Failed or low quality`);
                    // Clean up failed download
                    if (fs.existsSync(filepath)) {
                        fs.unlinkSync(filepath);
                    }
                }
            }
        }
        
        await browser.close();
        
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
        if (browser) await browser.close();
    }
}

getJulieRogersImages();