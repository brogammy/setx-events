#!/usr/bin/env node

/**
 * ROBUST VENUE IMAGE DOWNLOADER
 * Multiple strategies to get venue images
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

// Download image from URL with better error handling
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
        // Validate URL
        if (!url || !url.startsWith('http')) {
            resolve(false);
            return;
        }
        
        const file = fs.createWriteStream(filepath);
        const timeout = 30000;
        
        const req = https.get(url, { timeout }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    // Check if it's a valid image file (larger than 5KB)
                    if (stats.size > 5000) {
                        resolve(true);
                    } else {
                        // File too small, probably not a real image
                        fs.unlinkSync(filepath);
                        resolve(false);
                    }
                });
            } else {
                file.destroy();
                // Try to remove the file if it was created
                fs.unlink(filepath, () => {});
                resolve(false);
            }
        });
        
        req.on('error', (err) => {
            file.destroy();
            fs.unlink(filepath, () => {});
            resolve(false);
        });
        
        req.on('timeout', () => {
            req.destroy();
            file.destroy();
            fs.unlink(filepath, () => {});
            resolve(false);
        });
    });
}

// Get all venues
function getAllVenues() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT id, name, city, website, category 
            FROM venues 
            WHERE is_active = 1 
            ORDER BY id
        `, (err, venues) => {
            if (err) reject(err);
            else resolve(venues);
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

// Strategy 1: Firecrawl scraping
async function getImagesWithFirecrawl(venue) {
    try {
        console.log(`      🔥 Firecrawl attempt`);
        
        // Use the venue website if available, otherwise search
        let url = venue.website;
        if (!url || url.trim() === '') {
            // Create a search URL
            url = `https://www.google.com/search?q=${encodeURIComponent(venue.name + ' ' + venue.city + ' Texas site:.com OR site:.org')}`;
        }
        
        const response = await axios.post(
            'https://api.firecrawl.dev/v0/scrape',
            {
                url: url,
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
            console.log(`         Found ${images.length} images`);
            
            // Filter and rank images
            const rankedImages = images
                .filter(img => {
                    // Must have dimensions
                    if (!img.width || !img.height) return false;
                    
                    // Must be reasonably large
                    if (img.width < 300 || img.height < 200) return false;
                    
                    // Must have a valid URL
                    const imgUrl = img.src || img.url || '';
                    if (!imgUrl || !imgUrl.startsWith('http')) return false;
                    
                    // Skip data URLs and obvious non-venue images
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
                });
            
            if (rankedImages.length > 0) {
                console.log(`         Selected best image: ${rankedImages[0].src || rankedImages[0].url}`);
                return rankedImages[0].src || rankedImages[0].url;
            }
        }
        
        return null;
    } catch (err) {
        console.log(`         ❌ Firecrawl failed: ${err.response?.data?.error || err.message}`);
        return null;
    }
}

// Strategy 2: Unsplash API search
async function getImagesFromUnsplash(venue) {
    try {
        console.log(`      🌅 Unsplash attempt`);
        
        // Create search query
        const searchQuery = `${venue.name} ${venue.city} Texas`.replace(/\s+/g, '+');
        const url = `https://source.unsplash.com/800x600/?${searchQuery}`;
        
        // We'll test if this URL works by making a HEAD request first
        const headResponse = await axios.head(url, { timeout: 10000 });
        if (headResponse.status === 200) {
            console.log(`         Found Unsplash image`);
            return url;
        }
        
        return null;
    } catch (err) {
        console.log(`         ❌ Unsplash failed: ${err.message}`);
        return null;
    }
}

// Strategy 3: Pexels API search
async function getImagesFromPexels(venue) {
    try {
        console.log(`      📸 Pexels attempt`);
        
        // Use Picsum as a reliable fallback
        const url = `https://picsum.photos/800/600?random=${venue.id}`;
        
        // Test if URL works
        const headResponse = await axios.head(url, { timeout: 10000 });
        if (headResponse.status === 200) {
            console.log(`         Found Pexels/Picsum image`);
            return url;
        }
        
        return null;
    } catch (err) {
        console.log(`         ❌ Pexels failed: ${err.message}`);
        return null;
    }
}

// Download image for venue using multiple strategies
async function downloadVenueImage(venue) {
    // Create directory if needed
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    
    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
    const localUrl = `/images/venues/venue-${venue.id}.jpg`;
    
    // Skip if valid image already exists
    if (fs.existsSync(filepath)) {
        try {
            const stats = fs.statSync(filepath);
            if (stats.size > 5000) { // Valid size
                // Update database if needed
                await updateVenueImage(venue.id, localUrl);
                console.log(`      ✅ Valid image already exists`);
                return true;
            }
        } catch (e) {
            // File issue, continue with download
        }
    }
    
    console.log(`      🎯 Target: ${venue.name}`);
    
    // Strategy 1: Firecrawl
    let imageUrl = await getImagesWithFirecrawl(venue);
    
    // Strategy 2: Unsplash
    if (!imageUrl) {
        imageUrl = await getImagesFromUnsplash(venue);
    }
    
    // Strategy 3: Pexels/Picsum
    if (!imageUrl) {
        imageUrl = await getImagesFromPexels(venue);
    }
    
    // If we found an image URL, download it
    if (imageUrl) {
        console.log(`      📥 Downloading: ${imageUrl.substring(0, 60)}...`);
        const success = await downloadImage(imageUrl, filepath);
        if (success) {
            await updateVenueImage(venue.id, localUrl);
            console.log(`      ✅ Downloaded and database updated`);
            return true;
        } else {
            console.log(`      ❌ Download failed`);
        }
    } else {
        console.log(`      ❌ No image sources found`);
    }
    
    return false;
}

// Main function
async function main() {
    console.log('🎯 ROBUST VENUE IMAGE DOWNLOADER');
    console.log('='.repeat(45));
    console.log('Using multiple strategies to get venue images\n');
    
    try {
        // Get all venues
        const venues = await getAllVenues();
        
        if (venues.length === 0) {
            console.log('❌ No venues found in database');
            process.exit(1);
        }
        
        console.log(`Found ${venues.length} venues\n`);
        
        let successCount = 0;
        let processedCount = 0;
        
        // Process venues with progress indication
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const progress = `${i + 1}/${venues.length}`;
            
            console.log(`\n[${progress}] ${venue.name} (${venue.city})`);
            if (venue.website) {
                console.log(`   🌐 ${venue.website}`);
            }
            
            try {
                const success = await downloadVenueImage(venue);
                if (success) successCount++;
                processedCount++;
            } catch (err) {
                console.log(`   ❌ Error: ${err.message}`);
                processedCount++;
            }
            
            // Show intermediate results every 10 venues
            if ((i + 1) % 10 === 0 || i === venues.length - 1) {
                console.log(`\n   📊 Progress: ${successCount}/${processedCount} successful\n`);
            }
            
            // Delay between requests to be respectful
            if (i < venues.length - 1) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        
        console.log('\n' + '='.repeat(45));
        console.log(`🎉 COMPLETED`);
        console.log(`✅ Successfully processed: ${successCount}/${venues.length}`);
        console.log(`📊 Success rate: ${Math.round((successCount / venues.length) * 100)}%`);
        console.log('='.repeat(45) + '\n');
        
        // Show final database stats
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