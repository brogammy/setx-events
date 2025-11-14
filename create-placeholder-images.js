#!/usr/bin/env node

/**
 * Create Placeholder Images for Venues
 * Generates simple colored placeholder images with venue names
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);
const db = new sqlite3.Database('./database.sqlite');
const IMAGES_DIR = './public/images/venues';

async function createPlaceholderWithImageMagick(venueId, venueName, city) {
    const filename = `venue-${venueId}.jpg`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Use ImageMagick to create a simple placeholder
    const text = venueName.length > 30 ? venueName.substring(0, 27) + '...' : venueName;
    const command = `convert -size 800x600 xc:#21808d -gravity center -fill white -pointsize 40 -annotate +0+0 "${text}\\n${city}, TX" "${filepath}"`;

    try {
        await execPromise(command);
        return `/images/venues/${filename}`;
    } catch (error) {
        throw new Error(`ImageMagick failed: ${error.message}`);
    }
}

async function updateVenueCoverImage(venueId, imageUrl) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE venues SET cover_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [imageUrl, venueId],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

async function getVenuesWithoutImages() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, name, city
             FROM venues
             WHERE (cover_image_url IS NULL OR cover_image_url = '')
             AND name != 'Cloud Agent Test Venue'
             ORDER BY id`,
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

async function main() {
    console.log('🎨 Create Placeholder Images for Venues');
    console.log('==========================================\n');

    try {
        // Check if ImageMagick is available
        try {
            await execPromise('convert -version');
            console.log('✅ ImageMagick found\n');
        } catch (error) {
            console.error('❌ ImageMagick not found. Install with: sudo apt-get install imagemagick');
            process.exit(1);
        }

        const venues = await getVenuesWithoutImages();

        console.log(`📊 Found ${venues.length} venues without images\n`);

        if (venues.length === 0) {
            console.log('✅ All venues already have images!');
            db.close();
            return;
        }

        const results = {
            success: 0,
            failed: 0
        };

        for (const venue of venues) {
            console.log(`📍 Processing: ${venue.name} (${venue.city})`);

            try {
                const localPath = await createPlaceholderWithImageMagick(venue.id, venue.name, venue.city);
                await updateVenueCoverImage(venue.id, localPath);

                console.log(`   ✅ Created: ${localPath}`);
                results.success++;
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                results.failed++;
            }
        }

        console.log('\n==========================================');
        console.log('📊 Summary');
        console.log('==========================================');
        console.log(`✅ Successfully created: ${results.success} placeholders`);
        console.log(`❌ Failed: ${results.failed}`);

        console.log('\n💡 These are temporary placeholders.');
        console.log('   Replace them with real venue photos when available.');

    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main().catch(console.error);
}
