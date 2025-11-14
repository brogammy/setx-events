#!/usr/bin/env node

/**
 * ROBUST IMAGE DOWNLOADER
 * Uses axios for more reliable image downloading
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Database connection
const db = new sqlite3.Database(DB_PATH);

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Download image from URL using axios
async function downloadImage(url, filepath) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000
        });
        
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                // Check if file was created and has content
                const stats = fs.statSync(filepath);
                if (stats.size > 0) {
                    console.log(`      Downloaded ${stats.size} bytes`);
                    resolve(true);
                } else {
                    fs.unlinkSync(filepath);
                    resolve(false);
                }
            });
            writer.on('error', () => {
                fs.unlinkSync(filepath);
                resolve(false);
            });
        });
    } catch (error) {
        // Remove file if it was created
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        return false;
    }
}

// Get all venues
function getAllVenues() {
    return new Promise((resolve, reject) => {
        db.all('SELECT id, name FROM venues WHERE is_active = 1 ORDER BY id', (err, venues) => {
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

// Main function
async function main() {
    console.log('🚀 ROBUST VENUE IMAGE DOWNLOADER');
    console.log('================================\n');
    
    try {
        const venues = await getAllVenues();
        console.log(`Found ${venues.length} venues\n`);
        
        let successCount = 0;
        
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
            const localUrl = `/images/venues/venue-${venue.id}.jpg`;
            
            // Skip if file already exists
            if (fs.existsSync(filepath)) {
                console.log(`[${i+1}/${venues.length}] ${venue.name} - Already has image ✅`);
                successCount++;
                continue;
            }
            
            console.log(`[${i+1}/${venues.length}] ${venue.name}...`);
            
            try {
                // Try multiple image sources
                const sources = [
                    `https://picsum.photos/800/600?random=${venue.id}`,
                    `https://source.unsplash.com/800x600/?venue,building,${encodeURIComponent(venue.name)}`,
                    `https://source.unsplash.com/800x600/?event,space,${encodeURIComponent(venue.city)}`
                ];
                
                let success = false;
                for (const source of sources) {
                    console.log(`   Trying ${source.split('/')[2]}...`);
                    success = await downloadImage(source, filepath);
                    if (success) {
                        console.log(`   ✅ Success!`);
                        break;
                    }
                }
                
                if (success) {
                    await updateVenueImage(venue.id, localUrl);
                    successCount++;
                } else {
                    console.log(`   ❌ Failed to download from all sources`);
                }
            } catch (err) {
                console.log(`   ❌ Error: ${err.message}`);
            }
        }
        
        console.log(`\n================================`);
        console.log(`🎉 COMPLETED: ${successCount}/${venues.length} venues now have images`);
        console.log(`================================`);
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        db.close();
    }
}

main();