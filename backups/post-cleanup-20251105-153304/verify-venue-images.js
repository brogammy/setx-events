#!/usr/bin/env node

/**
 * VENUE IMAGE VERIFICATION
 * Show which venues have actual image files
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
            SELECT id, name, city, cover_image_url 
            FROM venues 
            WHERE is_active = 1 
            ORDER BY id
        `, (err, venues) => {
            if (err) reject(err);
            else resolve(venues);
        });
    });
}

async function verifyImages() {
    console.log('🔍 VENUE IMAGE VERIFICATION');
    console.log('==========================');
    
    try {
        const venues = await getAllVenues();
        let withImages = 0;
        let withoutImages = 0;
        
        console.log('\n📊 STATUS BY VENUE:');
        console.log('==================');
        
        for (const venue of venues) {
            const imageFile = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
            
            if (fs.existsSync(imageFile)) {
                const stats = fs.statSync(imageFile);
                console.log(`✅ ${venue.id}. ${venue.name} (${venue.city}) - ${stats.size} bytes`);
                withImages++;
            } else {
                console.log(`❌ ${venue.id}. ${venue.name} (${venue.city}) - No image`);
                withoutImages++;
            }
        }
        
        console.log('\n📈 SUMMARY:');
        console.log('===========');
        console.log(`Total venues: ${venues.length}`);
        console.log(`With images: ${withImages}`);
        console.log(`Without images: ${withoutImages}`);
        console.log(`Coverage: ${Math.round((withImages / venues.length) * 100)}%`);
        
        db.close();
        
    } catch (err) {
        console.error('Error:', err.message);
        db.close();
    }
}

verifyImages();