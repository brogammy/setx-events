#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

// Simple SVG image generator for venue placeholder
function generateVenueImage(venueId, venueName, category) {
    // Generate consistent color from venue name
    const hash = venueName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = hash % 360;
    const colors = {
        'Theater': '#FF6B6B',
        'Museum': '#4ECDC4',
        'Music Venue': '#95E1D3',
        'Hotel': '#F7DC6F',
        'Restaurant': '#F8B739',
        'Event Venue': '#BB8FCE',
        'Church': '#85C1E2',
        'Garden': '#52B788',
        'default': `hsl(${hue}, 70%, 60%)`
    };

    const bgColor = colors[category] || colors.default;
    const text = venueName.substring(0, 25);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="600" fill="${bgColor}"/>
    <text x="400" y="250" font-size="48" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial, sans-serif">
        ${escapeXml(text)}
    </text>
    <text x="400" y="350" font-size="24" text-anchor="middle" fill="white" font-family="Arial, sans-serif" opacity="0.9">
        SETX Events
    </text>
    <rect x="300" y="400" width="200" height="3" fill="white" opacity="0.5"/>
</svg>`;
}

function escapeXml(str) {
    return String(str).replace(/[<>&'"]/g, c => {
        const chars = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
        return chars[c];
    });
}

async function createAllImages() {
    console.log('\n🎨 CREATING VENUE PLACEHOLDER IMAGES\n');

    return new Promise((resolve) => {
        db.all(
            'SELECT id, name, category FROM venues WHERE is_active = 1 ORDER BY id',
            async (err, venues) => {
                if (err || !venues) {
                    console.log('Database error');
                    db.close();
                    return resolve();
                }

                console.log(`Creating images for ${venues.length} venues\n`);
                let created = 0;

                for (const venue of venues) {
                    const filename = `venue-${venue.id}.svg`;
                    const filepath = path.join(IMAGES_DIR, filename);
                    const svg = generateVenueImage(venue.id, venue.name, venue.category);

                    try {
                        fs.writeFileSync(filepath, svg);

                        // Update database
                        db.run(
                            'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
                            [`/images/venues/${filename}`, `/images/venues/${filename}`, venue.id],
                            () => {
                                process.stdout.write('.');
                                created++;
                                if (created % 10 === 0) console.log(' ' + created);
                            }
                        );
                    } catch (e) {
                        process.stdout.write('E');
                    }
                }

                setTimeout(() => {
                    console.log(`\n✅ Created ${created}/${venues.length} venue images locally\n`);
                    db.close();
                    resolve();
                }, 1000);
            }
        );
    });
}

createAllImages().then(() => process.exit(0));
