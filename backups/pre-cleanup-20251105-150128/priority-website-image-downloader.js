#!/usr/bin/env node

/**
 * PRIORITY WEBSITE IMAGE DOWNLOADER
 * Prioritizes venue websites and social media before other sources
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

// Get all venues with priority on those with websites
function getAllVenues() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT id, name, city, website, facebook_url, instagram_url, category 
            FROM venues 
            WHERE is_active = 1 
            ORDER BY 
                CASE 
                    WHEN website IS NOT NULL AND website != '' THEN 1
                    WHEN facebook_url IS NOT NULL AND facebook_url != '' THEN 2
                    WHEN instagram_url IS NOT NULL AND instagram_url != '' THEN 3
                    ELSE 4
                END,
                id
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

// Strategy 1: Direct website scraping with Firecrawl
async function getImagesFromWebsite(venue) {
    try {
        if (!venue.website || venue.website.trim() === '') {
            return null;
        }
        
        console.log(`      🌐 Scraping website: ${venue.website}`);
        
        const response = await axios.post(
            'https://api.firecrawl.dev/v0/scrape',
            {
                url: venue.website,
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
            console.log(`         Found ${images.length} images on website`);
            
            // Filter for venue-specific images (photos of the venue itself)
            const venueImages = images
                .filter(img => {
                    // Must have dimensions
                    if (!img.width || !img.height) return false;
                    
                    // Must be reasonably large (at least 400x300)
                    if (img.width < 400 || img.height < 300) return false;
                    
                    // Must have a valid URL
                    const imgUrl = img.src || img.url || '';
                    if (!imgUrl || !imgUrl.startsWith('http')) return false;
                    
                    // Skip data URLs and obvious non-venue images
                    if (imgUrl.startsWith('data:') || 
                        imgUrl.includes('favicon') || 
                        imgUrl.includes('logo') ||
                        imgUrl.includes('icon') ||
                        imgUrl.includes('sprite')) return false;
                    
                    // Skip social media icons
                    if (imgUrl.includes('facebook') || 
                        imgUrl.includes('twitter') || 
                        imgUrl.includes('instagram') ||
                        imgUrl.includes('social')) return false;
                    
                    return true;
                })
                .sort((a, b) => {
                    // Rank by size (larger is better for venue photos)
                    const aSize = a.width * a.height;
                    const bSize = b.width * b.height;
                    return bSize - aSize;
                });
            
            if (venueImages.length > 0) {
                console.log(`         Selected venue image: ${venueImages[0].src || venueImages[0].url}`);
                return venueImages[0].src || venueImages[0].url;
            }
        }
        
        return null;
    } catch (err) {
        console.log(`         ❌ Website scraping failed: ${err.response?.data?.error || err.message}`);
        return null;
    }
}

// Strategy 2: Facebook page scraping
async function getImagesFromFacebook(venue) {
    try {
        if (!venue.facebook_url || venue.facebook_url.trim() === '') {
            return null;
        }
        
        console.log(`      📘 Scraping Facebook: ${venue.facebook_url}`);
        
        const response = await axios.post(
            'https://api.firecrawl.dev/v0/scrape',
            {
                url: venue.facebook_url,
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
            console.log(`         Found ${images.length} images on Facebook`);
            
            // Filter for high-quality images
            const goodImages = images
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
                    // Rank by size
                    const aSize = a.width * a.height;
                    const bSize = b.width * b.height;
                    return bSize - aSize;
                });
            
            if (goodImages.length > 0) {
                console.log(`         Selected Facebook image: ${goodImages[0].src || goodImages[0].url}`);
                return goodImages[0].src || goodImages[0].url;
            }
        }
        
        return null;
    } catch (err) {
        console.log(`         ❌ Facebook scraping failed: ${err.response?.data?.error || err.message}`);
        return null;
    }
}

// Strategy 3: Instagram scraping
async function getImagesFromInstagram(venue) {
    try {
        if (!venue.instagram_url || venue.instagram_url.trim() === '') {
            return null;
        }
        
        console.log(`      📷 Scraping Instagram: ${venue.instagram_url}`);
        
        const response = await axios.post(
            'https://api.firecrawl.dev/v0/scrape',
            {
                url: venue.instagram_url,
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
            console.log(`         Found ${images.length} images on Instagram`);
            
            // Filter for high-quality images
            const goodImages = images
                .filter(img => {
                    // Must have dimensions
                    if (!img.width || !img.height) return false;
                    
                    // Must be reasonably large (Instagram photos are typically square)
                    if (img.width < 200 || img.height < 200) return false;
                    
                    // Must have a valid URL
                    const imgUrl = img.src || img.url || '';
                    if (!imgUrl || !imgUrl.startsWith('http')) return false;
                    
                    // Skip data URLs
                    if (imgUrl.startsWith('data:')) return false;
                    
                    return true;
                })
                .sort((a, b) => {
                    // Rank by size
                    const aSize = a.width * a.height;
                    const bSize = b.width * b.height;
                    return bSize - aSize;
                });
            
            if (goodImages.length > 0) {
                console.log(`         Selected Instagram image: ${goodImages[0].src || goodImages[0].url}`);
                return goodImages[0].src || goodImages[0].url;
            }
        }
        
        return null;
    } catch (err) {
        console.log(`         ❌ Instagram scraping failed: ${err.response?.data?.error || err.message}`);
        return null;
    }
}

// Strategy 4: Direct social media API calls (if URLs are social media handles)
async function getImagesFromSocialHandles(venue) {
    try {
        console.log(`      🤝 Checking social handles`);
        
        // Build search URLs for social media
        const searches = [];
        
        // Add Facebook search
        if (venue.facebook_url && !venue.facebook_url.startsWith('http')) {
            searches.push(`https://www.facebook.com/${venue.facebook_url}`);
        }
        
        // Add Instagram search
        if (venue.instagram_url && !venue.instagram_url.startsWith('http')) {
            searches.push(`https://www.instagram.com/${venue.instagram_url}`);
        }
        
        // Try each search
        for (const url of searches) {
            try {
                console.log(`         Searching: ${url}`);
                
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
                        timeout: 30000
                    }
                );
                
                if (response.data.success) {
                    const images = response.data.data.images || [];
                    const profileImages = images.filter(img => 
                        img.width && img.height && 
                        img.width > 150 && img.height > 150 &&
                        (img.src || img.url)
                    );
                    
                    if (profileImages.length > 0) {
                        return profileImages[0].src || profileImages[0].url;
                    }
                }
            } catch (e) {
                // Continue to next search
            }
        }
        
        return null;
    } catch (err) {
        return null;
    }
}

// Strategy 5: Targeted Google search with venue-specific terms
async function getImagesFromTargetedSearch(venue) {
    try {
        console.log(`      🔍 Targeted Google search`);
        
        // Create specific search query for the venue
        const searchTerms = [
            `"${venue.name}" ${venue.city} Texas`,
            `${venue.name} ${venue.city} Texas official photos`,
            `${venue.name} ${venue.city} Texas venue images`,
            `${venue.name} ${venue.city} Texas event space`
        ];
        
        // Try each search term
        for (const term of searchTerms) {
            try {
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(term)}&tbm=isch&safe=active`;
                
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
                        timeout: 30000
                    }
                );
                
                if (response.data.success) {
                    const images = response.data.data.images || [];
                    const goodImages = images.filter(img => 
                        img.width && img.height && 
                        img.width > 300 && img.height > 200 &&
                        (img.src || img.url) &&
                        !(img.src || img.url).includes('google') &&
                        !(img.src || img.url).includes('gstatic')
                    );
                    
                    if (goodImages.length > 0) {
                        // Sort by most likely to be a venue photo
                        goodImages.sort((a, b) => {
                            const aUrl = a.src || a.url || '';
                            const bUrl = b.src || b.url || '';
                            
                            // Prefer URLs that contain venue-related terms
                            const aScore = (aUrl.includes('venue') ? 2 : 0) + 
                                          (aUrl.includes(venue.name.toLowerCase().replace(/\s+/g, '')) ? 3 : 0);
                            const bScore = (bUrl.includes('venue') ? 2 : 0) + 
                                          (bUrl.includes(venue.name.toLowerCase().replace(/\s+/g, '')) ? 3 : 0);
                            
                            // Also consider size
                            const aSize = a.width * a.height;
                            const bSize = b.width * b.height;
                            
                            return (bScore * 1000000 + bSize) - (aScore * 1000000 + aSize);
                        });
                        
                        console.log(`         Found targeted search image`);
                        return goodImages[0].src || goodImages[0].url;
                    }
                }
            } catch (e) {
                // Continue to next search term
            }
        }
        
        return null;
    } catch (err) {
        console.log(`         ❌ Targeted search failed: ${err.message}`);
        return null;
    }
}

// Download image for venue using priority strategies
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
                console.log(`      ✅ Valid image already exists`);
                return true;
            }
        } catch (e) {
            // File issue, continue with download
        }
    }
    
    console.log(`   🎯 Processing: ${venue.name} (${venue.city})`);
    
    // Strategy priority:
    // 1. Direct website
    let imageUrl = await getImagesFromWebsite(venue);
    
    // 2. Facebook page
    if (!imageUrl) {
        imageUrl = await getImagesFromFacebook(venue);
    }
    
    // 3. Instagram page
    if (!imageUrl) {
        imageUrl = await getImagesFromInstagram(venue);
    }
    
    // 4. Social handles
    if (!imageUrl) {
        imageUrl = await getImagesFromSocialHandles(venue);
    }
    
    // 5. Targeted search (Google Images with specific terms)
    if (!imageUrl) {
        imageUrl = await getImagesFromTargetedSearch(venue);
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
        console.log(`      ❌ No images found using any strategy`);
    }
    
    return false;
}

// Main function
async function main() {
    console.log('🎯 PRIORITY WEBSITE IMAGE DOWNLOADER');
    console.log('='.repeat(50));
    console.log('Priority: Website → Facebook → Instagram → Social Handles → Targeted Search\n');
    
    try {
        // Get all venues prioritized by having websites/social media
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
            
            // Show what sources we have
            const sources = [];
            if (venue.website) sources.push('🌐 Website');
            if (venue.facebook_url) sources.push('📘 Facebook');
            if (venue.instagram_url) sources.push('📷 Instagram');
            
            if (sources.length > 0) {
                console.log(`   Sources: ${sources.join(', ')}`);
            } else {
                console.log(`   🔍 No direct sources, will search`);
            }
            
            try {
                const success = await downloadVenueImage(venue);
                if (success) successCount++;
                processedCount++;
            } catch (err) {
                console.log(`   ❌ Error: ${err.message}`);
                processedCount++;
            }
            
            // Show intermediate results every 5 venues
            if ((i + 1) % 5 === 0 || i === venues.length - 1) {
                console.log(`\n   📊 Progress: ${successCount}/${processedCount} successful\n`);
            }
            
            // Delay between requests to be respectful
            if (i < venues.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`🎉 COMPLETED`);
        console.log(`✅ Successfully processed: ${successCount}/${venues.length}`);
        console.log(`📊 Success rate: ${Math.round((successCount / venues.length) * 100)}%`);
        console.log('='.repeat(50) + '\n');
        
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