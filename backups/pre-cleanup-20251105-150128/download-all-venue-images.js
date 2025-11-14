#!/usr/bin/env node

/**
 * DOWNLOAD ALL VENUE IMAGES
 * Simple script to download images for all venues
 */

const https = require('https');
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

// Download image from URL
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(true);
                });
            } else {
                file.destroy();
                fs.unlink(filepath, () => {});
                resolve(false);
            }
        }).on('error', () => {
            file.destroy();
            fs.unlink(filepath, () => {});
            resolve(false);
        });
    });
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
    console.log('🚀 DOWNLOADING IMAGES FOR ALL VENUES');
    console.log('=====================================\n');
    
    try {
        const venues = await getAllVenues();
        console.log(`Found ${venues.length} venues\n`);
        
        let successCount = 0;
        
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
            const localUrl = `/images/venues/venue-${venue.id}.jpg`;
            
            // Use a reliable image source
            const imageUrl = `https://picsum.photos/800/600?random=${venue.id}`;
            
            process.stdout.write(`[${i+1}/${venues.length}] ${venue.name}... `);
            
            try {
                const success = await downloadImage(imageUrl, filepath);
                if (success) {
                    await updateVenueImage(venue.id, localUrl);
                    console.log('✅');
                    successCount++;
                } else {
                    console.log('❌');
                }
            } catch (err) {
                console.log('❌');
            }
        }
        
        console.log(`\n=====================================`);
        console.log(`🎉 COMPLETED: ${successCount}/${venues.length} venues now have images`);
        console.log(`=====================================`);
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        db.close();
    }
}

main();