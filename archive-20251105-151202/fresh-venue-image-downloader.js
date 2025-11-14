#!/usr/bin/env node

/**
 * FRESH VENUE IMAGE DOWNLOADER
 * Gets actual photos of venues using multiple targeted approaches
 * Only downloads quality, relevant images of the actual venues
 */

const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');
const FIRECRAWL_API_KEY = 'fc-a0cc106a4ab3406f80cfabf625b75f53';

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
        
        // Skip data URLs and known bad patterns
        if (url.startsWith('data:') || url.includes('gstatic.com') || url.includes('favicon')) {
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
                        // Valid image should be > 15KB for quality
                        const isValid = stats.size > 15000;
                        if (!isValid) {
                            fs.unlinkSync(filepath); // Remove small files
                        }
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

// Strategy 1: Try venue website directly with Puppeteer
async function getImagesFromVenueWebsite(venue) {
    let browser;
    try {
        console.log(`    🌐 Trying venue website`);
        
        if (!venue.website || venue.website.trim() === '' || !venue.website.startsWith('http')) {
            console.log(`    ❌ No valid website URL`);
            return [];
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
        await page.setViewport({ width: 1200, height: 800 });
        
        console.log(`    🔗 ${venue.website}`);
        await page.goto(venue.website, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait for dynamic content
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
        
        // Extract venue-specific images
        const imageUrls = await page.evaluate(() => {
            // Look for specific venue-related selectors first
            const venueSelectors = [
                '.hero-image', '.main-image', '.featured-image',
                '.venue-photo', '.building-photo', '.exterior-photo',
                '[class*="hero"] img', '[class*="gallery"] img',
                'header img', '.banner img'
            ];
            
            let images = [];
            
            // Try venue-specific selectors
            for (const selector of venueSelectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
                    if (img && img.src) {
                        images.push(img.src);
                    }
                });
            }
            
            // If none found, get large images
            if (images.length === 0) {
                const allImages = Array.from(document.querySelectorAll('img'));
                images = allImages
                    .filter(img => {
                        const rect = img.getBoundingClientRect();
                        return rect.width > 400 && rect.height > 300; // Large images only
                    })
                    .map(img => img.src)
                    .filter(src => src && src.startsWith('http'));
            }
            
            // Remove duplicates and filter
            return [...new Set(images)]
                .filter(src => src && src.startsWith('http') && !src.includes('favicon'))
                .slice(0, 5); // Return top 5
        });
        
        console.log(`    📸 Found ${imageUrls.length} venue images`);
        await browser.close();
        return imageUrls;
        
    } catch (err) {
        console.log(`    ❌ Website failed: ${err.message.substring(0, 50)}...`);
        if (browser) await browser.close();
        return [];
    }
}

// Strategy 2: Google Images search with precise targeting
async function getImagesFromGoogleImages(venue) {
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
        
        // Multiple search strategies for better results
        const searchQueries = [
            `${venue.name} ${venue.city} Texas building exterior`,
            `${venue.name} ${venue.city} Texas venue photo`,
            `${venue.name} ${venue.city} Texas official`,
        ];
        
        for (const query of searchQueries) {
            console.log(`    🔎 "${query}"`);
            const googleImagesUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
            
            await page.goto(googleImagesUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Wait for images to load
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
            
            const imageUrls = await page.evaluate(() => {
                const images = Array.from(document.querySelectorAll('img'));
                return images
                    .map(img => img.src || img.dataset.src)
                    .filter(src => src && src.startsWith('http') && 
                           !src.includes('gstatic.com') && 
                           !src.includes('favicon') &&
                           !src.includes('logo') &&
                           !src.includes('data:'))
                    .slice(0, 6);
            });
            
            if (imageUrls.length > 0) {
                console.log(`    📷 Found ${imageUrls.length} images`);
                await browser.close();
                return imageUrls;
            }
        }
        
        await browser.close();
        return [];
        
    } catch (err) {
        console.log(`    ❌ Google Images failed: ${err.message.substring(0, 50)}...`);
        if (browser) await browser.close();
        return [];
    }
}

// Strategy 3: Firecrawl API for advanced scraping
async function getImagesFromFirecrawl(venue) {
    try {
        console.log(`    🔥 Firecrawl API`);
        
        // Create search query
        const searchQuery = `${venue.name} ${venue.city} Texas official website`;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        
        const response = await axios.post(
            'https://api.firecrawl.dev/v0/scrape',
            {
                url: searchUrl,
                formats: ['images'],
                onlyMainContent: true
            },
            {
                headers: {
                    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 45000
            }
        );
        
        if (response.data.success) {
            const images = response.data.data.images || [];
            console.log(`    🔥 Found ${images.length} images via Firecrawl`);
            
            // Filter for quality venue images
            const venueImages = images
                .filter(img => {
                    // Must have dimensions
                    if (!img.width || !img.height) return false;
                    
                    // Must be reasonably large
                    if (img.width < 400 || img.height < 300) return false;
                    
                    // Must have a valid URL
                    const imgUrl = img.src || img.url || '';
                    if (!imgUrl || !imgUrl.startsWith('http')) return false;
                    
                    // Skip data URLs and non-venue images
                    if (imgUrl.startsWith('data:') || 
                        imgUrl.includes('favicon') || 
                        imgUrl.includes('logo') ||
                        imgUrl.includes('icon')) return false;
                    
                    return true;
                })
                .sort((a, b) => {
                    // Rank by size (larger is better)
                    const aSize = a.width * a.height;
                    const bSize = b.width * b.height;
                    return bSize - aSize;
                })
                .map(img => img.src || img.url)
                .slice(0, 5);
            
            return venueImages;
        }
        
        return [];
    } catch (err) {
        console.log(`    ❌ Firecrawl failed: ${err.response?.data?.error || err.message}`);
        return [];
    }
}

// Download image for venue with quality control
async function downloadVenueImage(venue) {
    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
    const localUrl = `/images/venues/venue-${venue.id}.jpg`;
    
    // Skip if good quality image already exists
    if (fs.existsSync(filepath)) {
        try {
            const stats = fs.statSync(filepath);
            if (stats.size > 20000) { // Good quality threshold
                console.log(`    ✅ Quality image already exists (${stats.size} bytes)`);
                return true;
            } else {
                // Remove poor quality image
                fs.unlinkSync(filepath);
            }
        } catch (e) {
            // File issue, continue with download
        }
    }
    
    console.log(`\n🎯 ${venue.name} (${venue.city})`);
    if (venue.website) {
        console.log(`   🌐 ${venue.website}`);
    }
    
    let imageUrls = [];
    let strategyUsed = '';
    
    // Strategy 1: Venue website
    if (venue.website) {
        imageUrls = await getImagesFromVenueWebsite(venue);
        strategyUsed = 'Venue Website';
    }
    
    // Strategy 2: Google Images
    if (imageUrls.length === 0) {
        imageUrls = await getImagesFromGoogleImages(venue);
        strategyUsed = 'Google Images';
    }
    
    // Strategy 3: Firecrawl (if first two failed)
    if (imageUrls.length === 0) {
        imageUrls = await getImagesFromFirecrawl(venue);
        strategyUsed = 'Firecrawl API';
    }
    
    // Try to download the best image
    if (imageUrls.length > 0) {
        console.log(`    📥 Trying ${imageUrls.length} images from ${strategyUsed}`);
        
        // Try images in order until one works
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            console.log(`    📥 Image ${i+1}: ${url.substring(0, 60)}...`);
            
            const success = await downloadImage(url, filepath);
            if (success) {
                await updateVenueImage(venue.id, localUrl);
                const stats = fs.statSync(filepath);
                console.log(`    ✅ SUCCESS! Downloaded ${stats.size} bytes from ${strategyUsed}`);
                return true;
            } else {
                console.log(`    ❌ Failed to download`);
            }
        }
    } else {
        console.log(`    ❌ No images found from any strategy`);
    }
    
    return false;
}

// Main function
async function main() {
    console.log('🏢 FRESH VENUE IMAGE DOWNLOADER');
    console.log('================================');
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
        let processedCount = 0;
        
        // Process venues with progress tracking
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const progress = `${i + 1}/${venues.length}`;
            
            try {
                const success = await downloadVenueImage(venue);
                if (success) successCount++;
                processedCount++;
                
                // Show intermediate results
                if ((i + 1) % 5 === 0 || i === venues.length - 1) {
                    console.log(`\n   📊 Progress: ${successCount}/${processedCount} successful\n`);
                }
                
                // Delay between venues to be respectful
                if (i < venues.length - 1) {
                    await new Promise(r => setTimeout(r, 2000));
                }
                
            } catch (err) {
                console.log(`   ❌ Error with ${venue.name}: ${err.message}`);
                processedCount++;
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`🎉 FINAL RESULTS`);
        console.log(`✅ Successfully downloaded: ${successCount}/${venues.length}`);
        console.log(`📊 Success rate: ${Math.round((successCount / venues.length) * 100)}%`);
        console.log('='.repeat(50) + '\n');
        
        // Database summary
        db.get(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN cover_image_url IS NOT NULL AND cover_image_url != '' THEN 1 END) as with_images
            FROM venues 
            WHERE is_active = 1
        `, (err, stats) => {
            if (!err && stats) {
                console.log(`📈 Database Summary:`);
                console.log(`   Total venues: ${stats.total}`);
                console.log(`   With images: ${stats.with_images}`);
                console.log(`   Coverage: ${Math.round((stats.with_images / stats.total) * 100)}%`);
            }
            db.close();
        });
        
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