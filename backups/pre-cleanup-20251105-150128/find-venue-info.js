#!/usr/bin/env node

/**
 * FIND VENUE INFORMATION - Julie Rogers Theatre
 * Look for official information and images
 */

const puppeteer = require('puppeteer');

async function findVenueInfo() {
    let browser;
    try {
        console.log('🔍 FINDING VENUE INFORMATION');
        console.log('============================');
        
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
        
        // Search for general info first
        console.log('\n🔎 Searching for venue information...');
        const searchUrl = 'https://www.google.com/search?q=Julie+Rogers+Theatre+Beaumont+Texas+history';
        
        await page.goto(searchUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait and extract useful information
        await page.waitForTimeout(3000);
        
        const info = await page.evaluate(() => {
            // Get title and description
            const title = document.querySelector('h1')?.textContent || 
                         document.querySelector('h2')?.textContent || 
                         document.title;
            
            // Get snippet/description
            const snippets = Array.from(document.querySelectorAll('span, div'))
                .filter(el => el.textContent && el.textContent.length > 100 && el.textContent.length < 500)
                .map(el => el.textContent.trim())
                .filter(text => 
                    text.includes('theatre') || 
                    text.includes('performing') || 
                    text.includes('venue') ||
                    text.includes('Julie Rogers')
                );
            
            return {
                title: title,
                snippets: snippets.slice(0, 3),
                // Try to find image URLs in the page
                imageUrls: Array.from(document.querySelectorAll('img'))
                    .map(img => img.src)
                    .filter(src => src && src.startsWith('http') && src.includes('theatre'))
                    .slice(0, 5)
            };
        });
        
        console.log(`\n📄 Title: ${info.title}`);
        console.log(`\n📝 Snippets:`);
        info.snippets.forEach((snippet, i) => {
            console.log(`   ${i+1}. ${snippet.substring(0, 100)}...`);
        });
        
        console.log(`\n🖼️  Page Images:`);
        info.imageUrls.forEach((url, i) => {
            console.log(`   ${i+1}. ${url.substring(0, 80)}...`);
        });
        
        await browser.close();
        
        // Now try to find actual venue photos
        console.log('\n🔍 Looking for actual venue photos...');
        await findVenuePhotos();
        
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
        if (browser) await browser.close();
    }
}

async function findVenuePhotos() {
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
        
        // Try searching Wikipedia or similar sites
        const searchTerms = [
            'Julie Rogers Theatre Beaumont Texas site:wikipedia.org',
            'Julie Rogers Theatre Beaumont Texas building photo'
        ];
        
        for (const term of searchTerms) {
            console.log(`\n🔎 Searching: ${term}`);
            const url = `https://www.google.com/search?q=${encodeURIComponent(term)}`;
            
            await page.goto(url, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            await page.waitForTimeout(3000);
            
            const results = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a'))
                    .filter(a => a.href && (a.href.includes('wikipedia') || a.href.includes('theatre')))
                    .map(a => ({ text: a.textContent.trim(), href: a.href }))
                    .filter(item => item.text.length > 20)
                    .slice(0, 5);
            });
            
            console.log(`   🔗 Results:`);
            results.forEach((result, i) => {
                console.log(`      ${i+1}. ${result.text.substring(0, 60)}...`);
                console.log(`         ${result.href}`);
            });
        }
        
        await browser.close();
        
    } catch (err) {
        console.log(`❌ Error finding photos: ${err.message}`);
        if (browser) await browser.close();
    }
}

findVenueInfo();