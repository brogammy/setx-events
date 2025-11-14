#!/usr/bin/env node

/**
 * MANUAL SEARCH TEST - Julie Rogers Theatre
 * Test different search approaches to find images
 */

const puppeteer = require('puppeteer');

async function testSearchTerms() {
    let browser;
    try {
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
        
        // Test different search terms
        const searchTerms = [
            'Julie Rogers Theatre Beaumont Texas',
            'Julie Rogers Performing Arts Center Beaumont',
            '1990 Julie Rogers Street Beaumont Texas',
            'Julie Rogers Theatre building photo'
        ];
        
        for (const term of searchTerms) {
            console.log(`\n🔍 Testing search: "${term}"`);
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(term)}&tbm=isch`;
            
            await page.goto(googleUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Wait for images to load
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
            
            const imageCount = await page.evaluate(() => {
                const images = Array.from(document.querySelectorAll('img'));
                return images.filter(img => 
                    img.src && img.src.startsWith('http') && 
                    !img.src.includes('gstatic.com') && 
                    img.src.length > 50
                ).length;
            });
            
            console.log(`   📷 Found ${imageCount} images`);
        }
        
        await browser.close();
        
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
        if (browser) await browser.close();
    }
}

testSearchTerms();