#!/usr/bin/env node

/**
 * DIRECT VENUE IMAGE DOWNLOADER
 * Downloads images directly from venue websites and social media to local storage
 */

const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const FIRECRAWL_API_KEY = 'fc-a0cc106a4ab3406f80cfabf625b75f53';
const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Database connection
const db = new sqlite3.Database(DB_PATH);

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Download image from URL and save locally
function downloadImageLocally(url, filepath) {
    return new Promise((resolve) => {
        if (!url || !url.startsWith('http')) {
            console.log(`         ❌ Invalid URL: ${url}`);
            resolve(false);
            return;
        }
        
        const file = fs.createWriteStream(filepath);
        const timeout = 30000;
        
        const req = https.get(url, { 
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    console.log(`         📦 Saved ${stats.size} bytes to ${path.basename(filepath)}`);
                    resolve(stats.size > 5000); // Valid image if larger than 5KB
                });
            } else {
                file.destroy();
                fs.unlink(filepath, () => {});
                console.log(`         ❌ HTTP ${response.statusCode} for ${url}`);
                resolve(false);
            }
        });
        
        req.on('error', (err) => {
            file.destroy();
            fs.unlink(filepath, () => {});
            console.log(`         ❌ Network error: ${err.message}`);
            resolve(false);
        });
        
        req.on('timeout', () => {
            req.destroy();
            file.destroy();
            fs.unlink(filepath, () => {});
            console.log(`         ❌ Timeout for ${url}`);
            resolve(false);
        });
    });
}

// Get all venues with websites or social media
function getVenuesWithSources() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT id, name, city, website, facebook_url, instagram_url 
            FROM venues 
            WHERE is_active = 1 
            AND (website IS NOT NULL OR facebook_url IS NOT NULL OR instagram_url IS NOT NULL)
            ORDER BY id
        `, (err, venues) => {
            if (err) reject(err);
            else resolve(venues);
        });
    });
}

// Update database with local image URL
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

// Scrape images from a URL using Firecrawl
async function scrapeImagesFromUrl(url, venueName) {
    try {
        console.log(`         🔥 Scraping: ${url}`);
        
        const response = await axios.post(
            'https://api.firecrawl.dev/v0/scrape',
            {
                url: url,
                formats: ['images']
            },
            {
                headers: {
                    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );
        
        if (response.data.success) {
            const images = response.data.data.images || [];
            console.log(`         📸 Found ${images.length} images`);
            
            // Filter for venue-related images
            const venueImages = images.filter(img => {
                // Must have width and height
                if (!img.width || !img.height) return false;
                
                // Must be reasonably large
                if (img.width < 200 || img.height < 150) return false;
                
                // Must have URL
                const imgUrl = img.src || img.url || '';
                if (!imgUrl || !imgUrl.startsWith('http')) return false;
                
                // Skip data URLs, icons, logos
                if (imgUrl.startsWith('data:') || 
                    imgUrl.includes('favicon') || 
                    imgUrl.includes('logo') || 
                    imgUrl.includes('icon') ||
                    imgUrl.includes('sprite') ||
                    imgUrl.includes('button')) return false;
                
                return true;
            });
            
            console.log(`         ✅ Filtered to ${venueImages.length} relevant images`);
            return venueImages;
        }
        
        return [];
    } catch (err) {
        console.log(`         ❌ Scraping failed: ${err.response?.data?.error || err.message}`);
        return [];
    }
}

// Download images for a venue
async function downloadVenueImages(venue) {
    console.log(`\n📍 ${venue.name} (${venue.city})`);
    
    // Collect all source URLs
    const sources = [];
    if (venue.website) sources.push({ type: 'website', url: venue.website });
    if (venue.facebook_url) sources.push({ type: 'facebook', url: venue.facebook_url });
    if (venue.instagram_url) sources.push({ type: 'instagram', url: venue.instagram_url });
    
    if (sources.length === 0) {
        console.log(`   ⚠️  No sources available`);
        return false;
    }
    
    console.log(`   🔗 Sources: ${sources.map(s => s.type).join(', ')}`);
    
    // Try each source
    for (const source of sources) {
        try {
            console.log(`   🔄 Processing ${source.type}: ${source.url}`);
            
            // Scrape images from this source
            const images = await scrapeImagesFromUrl(source.url, venue.name);
            
            if (images.length > 0) {
                // Try to download the best image
                // Sort by size and relevance
                images.sort((a, b) => {
                    const aSize = a.width * a.height;
                    const bSize = b.width * b.height;
                    
                    // Boost score for URLs containing venue name
                    const aUrl = a.src || a.url || '';
                    const bUrl = b.src || b.url || '';
                    const aNameBoost = aUrl.toLowerCase().includes(venue.name.toLowerCase().replace(/\s+/g, '')) ? 1.5 : 1;
                    const bNameBoost = bUrl.toLowerCase().includes(venue.name.toLowerCase().replace(/\s+/g, '')) ? 1.5 : 1;
                    
                    return (bSize * bNameBoost) - (aSize * aNameBoost);
                });
                
                // Try downloading images in order until one succeeds
                for (let i = 0; i < Math.min(3, images.length); i++) {
                    const image = images[i];
                    const imageUrl = image.src || image.url;
                    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}-${source.type}-${i + 1}.jpg`);
                    const localUrl = `/images/venues/venue-${venue.id}-${source.type}-${i + 1}.jpg`;
                    
                    console.log(`      ⬇️  Trying image ${i + 1}/${Math.min(3, images.length)}`);
                    
                    const success = await downloadImageLocally(imageUrl, filepath);
                    if (success) {
                        await updateVenueImage(venue.id, localUrl);
                        console.log(`      ✅ Success! Image saved and database updated`);
                        return true;
                    }
                }
            }
        } catch (err) {
            console.log(`   ❌ Error processing ${source.type}: ${err.message}`);
        }
    }
    
    console.log(`   ❌ No images downloaded for ${venue.name}`);
    return false;
}

// Download a placeholder image when direct sources fail
async function downloadPlaceholderImage(venue) {
    console.log(`   🎨 Downloading placeholder image for ${venue.name}`);
    
    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}-placeholder.jpg`);
    const localUrl = `/images/venues/venue-${venue.id}-placeholder.jpg`;
    
    // Use Picsum for a random high-quality image
    const placeholderUrl = `https://picsum.photos/800/600?random=${venue.id}`;
    
    const success = await downloadImageLocally(placeholderUrl, filepath);
    if (success) {
        await updateVenueImage(venue.id, localUrl);
        console.log(`   ✅ Placeholder saved and database updated`);
        return true;
    }
    
    return false;
}

// Main function
async function main() {
    console.log('🎯 DIRECT VENUE IMAGE DOWNLOADER');
    console.log('='.repeat(50));
    console.log('Downloading images directly from venue sources\n');
    
    try {
        // Get venues with sources
        const venues = await getVenuesWithSources();
        
        if (venues.length === 0) {
            console.log('❌ No venues with sources found');
            process.exit(1);
        }
        
        console.log(`Found ${venues.length} venues with sources\n`);
        
        let successCount = 0;
        
        // Process each venue
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const progress = `${i + 1}/${venues.length}`;
            
            try {
                const success = await downloadVenueImages(venue);
                if (success) {
                    successCount++;
                } else {
                    // Try placeholder as fallback
                    const placeholderSuccess = await downloadPlaceholderImage(venue);
                    if (placeholderSuccess) {
                        successCount++;
                    }
                }
            } catch (err) {
                console.log(`[${progress}] ❌ Error with ${venue.name}: ${err.message}`);
                // Try placeholder even on error
                const placeholderSuccess = await downloadPlaceholderImage(venue);
                if (placeholderSuccess) {
                    successCount++;
                }
            }
            
            // Show progress
            console.log(`\n📊 Progress: ${successCount}/${i + 1} venues processed\n`);
            
            // Delay between venues to be respectful
            if (i < venues.length - 1) {
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`🎉 COMPLETED`);
        console.log(`✅ Successfully processed: ${successCount}/${venues.length}`);
        console.log(`📊 Success rate: ${Math.round((successCount / venues.length) * 100)}%`);
        console.log('='.repeat(50) + '\n');
        
        // Show final stats
        db.get(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN cover_image_url IS NOT NULL AND cover_image_url != '' THEN 1 END) as with_images
            FROM venues 
            WHERE is_active = 1
        `, (err, stats) => {
            if (!err && stats) {
                console.log(`📈 Final Database Summary:`);
                console.log(`   Total active venues: ${stats.total}`);
                console.log(`   Venues with images: ${stats.with_images}`);
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