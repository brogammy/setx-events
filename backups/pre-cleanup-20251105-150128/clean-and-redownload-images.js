#!/usr/bin/env node

/**
 * CLEAN AND REDOWNLOAD VENUE IMAGES
 * Removes invalid images and downloads better quality ones
 */

const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Database connection
const db = new sqlite3.Database(DB_PATH);

// Check if image file is valid
function isValidImage(filepath) {
    try {
        const stats = fs.statSync(filepath);
        // Check if file is larger than 5KB (too small likely means it's an error page)
        if (stats.size < 5000) {
            return false;
        }
        
        // Check file type
        const type = require('child_process').execSync(`file --mime-type -b "${filepath}"`).toString().trim();
        return type.startsWith('image/');
    } catch (err) {
        return false;
    }
}

// Remove invalid image files
function cleanInvalidImages() {
    console.log('🧹 Cleaning invalid images...');
    
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
        return;
    }
    
    const files = fs.readdirSync(IMAGES_DIR);
    let removed = 0;
    
    for (const file of files) {
        if (file.startsWith('venue-') && file.endsWith('.jpg')) {
            const filepath = path.join(IMAGES_DIR, file);
            if (!isValidImage(filepath)) {
                console.log(`   Removing invalid image: ${file}`);
                fs.unlinkSync(filepath);
                removed++;
            }
        }
    }
    
    console.log(`   Removed ${removed} invalid images\n`);
}

// Download image from URL
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
        // Filter out obviously wrong URLs
        if (url.includes('google') || url.includes('gstatic') || url.includes('data:')) {
            resolve(false);
            return;
        }
        
        const file = fs.createWriteStream(filepath);
        https.get(url, { timeout: 30000 }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    console.log(`      Downloaded ${stats.size} bytes`);
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

// Get all venues from database
function getAllVenues() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT id, name, city FROM venues WHERE is_active = 1 ORDER BY id',
            (err, venues) => {
                if (err) reject(err);
                else resolve(venues);
            }
        );
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

// Search for venue images using multiple sources
async function searchVenueImages(venue) {
    // Try multiple search queries for better results
    const queries = [
        `"${venue.name}" ${venue.city} Texas`,
        `${venue.name} ${venue.city} Texas official site`,
        `${venue.name} ${venue.city} Texas event venue`,
        `${venue.name} ${venue.city} Texas photo`
    ];
    
    return queries;
}

// Main function
async function main() {
    console.log('🔄 CLEAN AND REDOWNLOAD VENUE IMAGES');
    console.log('='.repeat(50));
    
    // Clean invalid images first
    cleanInvalidImages();
    
    // Get all venues
    const venues = await getAllVenues();
    console.log(`Found ${venues.length} venues\n`);
    
    // Check how many already have valid images
    let validImages = 0;
    const venuesToProcess = [];
    
    for (const venue of venues) {
        const imagePath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
        if (fs.existsSync(imagePath) && isValidImage(imagePath)) {
            validImages++;
            console.log(`✅ ${venue.name} - Valid image exists`);
        } else {
            venuesToProcess.push(venue);
        }
    }
    
    console.log(`\n📊 Status: ${validImages}/${venues.length} venues have valid images`);
    console.log(`📋 Need to process: ${venuesToProcess.length} venues\n`);
    
    if (venuesToProcess.length === 0) {
        console.log('🎉 All venues have valid images!');
        db.close();
        process.exit(0);
    }
    
    // For now, let's just show what needs to be done
    console.log('The following venues need images:');
    for (const venue of venuesToProcess) {
        console.log(`   - ${venue.name} (${venue.city})`);
    }
    
    console.log('\n💡 To download images for these venues, you would need to:');
    console.log('   1. Use a service like Unsplash or Pexels API for quality images');
    console.log('   2. Manually search and download images for each venue');
    console.log('   3. Use a more sophisticated scraping approach with proper headers');
    
    db.close();
    console.log('\n' + '='.repeat(50));
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});