#!/usr/bin/env node

/**
 * FIX VENUE IMAGE REFERENCES
 * Clear database references for missing image files
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Database connection
const db = new sqlite3.Database(DB_PATH);

// Get all active venues
function getAllVenues() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT id, name, cover_image_url 
            FROM venues 
            WHERE is_active = 1 
            ORDER BY id
        `, (err, venues) => {
            if (err) reject(err);
            else resolve(venues);
        });
    });
}

// Update venue image URLs
function clearVenueImage(venueId) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE venues SET cover_image_url = NULL, logo_url = NULL WHERE id = ?',
            [venueId],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

async function fixImageReferences() {
    console.log('🛠️  FIXING VENUE IMAGE REFERENCES');
    console.log('=================================');
    
    try {
        const venues = await getAllVenues();
        console.log(`Found ${venues.length} active venues`);
        
        let fixedCount = 0;
        
        for (const venue of venues) {
            const imageFile = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
            
            // Check if image file exists
            if (fs.existsSync(imageFile)) {
                const stats = fs.statSync(imageFile);
                console.log(`✅ venue-${venue.id}.jpg: ${stats.size} bytes`);
            } else {
                // Image file missing but database says it exists
                if (venue.cover_image_url) {
                    console.log(`❌ venue-${venue.id}.jpg: MISSING (was ${venue.cover_image_url})`);
                    await clearVenueImage(venue.id);
                    fixedCount++;
                } else {
                    console.log(`➖ venue-${venue.id}.jpg: No image reference`);
                }
            }
        }
        
        console.log(`\n🛠️  Fixed ${fixedCount} venue image references`);
        db.close();
        
    } catch (err) {
        console.error('Error:', err.message);
        db.close();
    }
}

fixImageReferences();