#!/usr/bin/env node

/**
 * FIRECRAWL VENUE IMAGE DOWNLOADER
 * Uses Firecrawl API to scrape real venue images from their websites
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

// Download image from URL
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, { timeout: 30000 }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    resolve(stats.size > 5000); // Check if file is larger than 5KB
                });
            } else {
                file.destroy();
                resolve(false);
            }
        }).on('error', (err) => {
            file.destroy();
            resolve(false);
        });
    });
}

// Get venue websites from database
function getVenuesWithWebsites() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT id, name, city, website 
            FROM venues 
            WHERE is_active = 1 
            AND website IS NOT NULL 
            AND website != ''
            ORDER BY id
        `, (err, venues) => {
            if (err) reject(err);
            else resolve(venues);
        });
    });
}

// Get all venues (for those without websites)
function getAllVenues() {
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

// Scrape images using Firecrawl
async function scrapeVenueImagesWithFirecrawl(venue) {
    try {
        console.log(`   🔥 Scraping with Firecrawl: ${venue.name}`);
        
        // If venue has a website, use that
        let url = venue.website;
        if (!url) {
            // Otherwise, search for the venue
            url = `https://www.google.com/search?q=${encodeURIComponent(venue.name + ' ' + venue.city + ' Texas')}`;
        }
        
        const response = await axios.post(
            'https://api.firecrawl.dev/v0/scrape',
            {
                url: url,
                formats: ['screenshot', 'images']
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
            // Get images from the response
            const images = response.data.data.images || [];
            console.log(`      Found ${images.length} images`);
            
            // Filter for likely venue images (larger images, not icons or logos)
            const venueImages = images.filter(img => {
                // Skip very small images
                if (img.width < 300 || img.height < 200) return false;
                
                // Skip likely icons or logos
                if (img.width < img.height * 0.5) return false; // Too tall and narrow
                
                // Skip images with common icon names
                const url = img.src || img.url || '';
                if (url.includes('icon') || url.includes('logo') || url.includes('favicon')) return false;
                
                return true;
            });
            
            console.log(`      Found ${venueImages.length} potential venue images`);
            
            if (venueImages.length > 0) {
                // Return the first (likely largest/most relevant) image
                return venueImages[0].src || venueImages[0].url;
            }
        }
        
        return null;
    } catch (err) {
        console.log(`      ❌ Firecrawl error: ${err.response?.data?.error || err.message}`);
        return null;
    }
}

// Download image for venue
async function downloadVenueImage(venue) {
    // Create directory if needed
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    
    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
    const localUrl = `/images/venues/venue-${venue.id}.jpg`;
    
    // First try Firecrawl
    const firecrawlImageUrl = await scrapeVenueImagesWithFirecrawl(venue);
    
    if (firecrawlImageUrl) {
        console.log(`   📥 Downloading Firecrawl image`);
        const success = await downloadImage(firecrawlImageUrl, filepath);
        if (success) {
            await updateVenueImage(venue.id, localUrl);
            console.log(`   ✅ Downloaded Firecrawl image and updated database`);
            return true;
        }
    }
    
    // Fallback to search-based approach
    console.log(`   🔍 Trying search-based approach`);
    const searchQuery = `${venue.name} ${venue.city} Texas`;
    const searchImageUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent(searchQuery)}`;
    
    const success = await downloadImage(searchImageUrl, filepath);
    if (success) {
        await updateVenueImage(venue.id, localUrl);
        console.log(`   ✅ Downloaded search-based image and updated database`);
        return true;
    }
    
    return false;
}

// Main function
async function main() {
    console.log('🔥 FIRECRAWL VENUE IMAGE DOWNLOADER');
    console.log('='.repeat(45));
    console.log('Using Firecrawl API to get real venue images\n');
    
    try {
        // First try venues with websites
        console.log('Getting venues with websites...');
        let venues = await getVenuesWithWebsites();
        
        // If no venues with websites, get all venues
        if (venues.length === 0) {
            console.log('No venues with websites found, getting all venues...');
            venues = await getAllVenues();
        }
        
        if (venues.length === 0) {
            console.log('❌ No venues found in database');
            process.exit(1);
        }
        
        console.log(`Found ${venues.length} venues\n`);
        
        let successCount = 0;
        
        // Process venues
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const progress = `${i + 1}/${venues.length}`;
            
            console.log(`\n[${progress}] ${venue.name} (${venue.city})`);
            if (venue.website) {
                console.log(`   Website: ${venue.website}`);
            }
            
            try {
                const success = await downloadVenueImage(venue);
                if (success) successCount++;
            } catch (err) {
                console.log(`   ❌ Error processing venue: ${err.message}`);
            }
            
            // Delay between requests to be respectful
            if (i < venues.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        
        console.log('\n' + '='.repeat(45));
        console.log(`✅ Successfully processed: ${successCount}/${venues.length}`);
        console.log('='.repeat(45) + '\n');
        
    } catch (err) {
        console.error('Fatal error:', err.message);
        console.error(err.stack);
    } finally {
        db.close();
    }
}

main().catch(err => {
    console.error('Unhandled error:', err.message);
    process.exit(1);
});