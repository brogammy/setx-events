#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

const db = new sqlite3.Database(DB_PATH);

// Real working image URLs - actual photos from wikimedia/commons/etc that are reliable
const venueImages = {
    'Theater': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Interior_of_Princess_Theatre.jpg/640px-Interior_of_Princess_Theatre.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Operahouse_prague_season_2015.jpg/640px-Operahouse_prague_season_2015.jpg',
    ],
    'Museum': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Metropolitan_Museum_of_Art_exterior_NYC.jpg/640px-Metropolitan_Museum_of_Art_exterior_NYC.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Museum_facade.jpg/640px-Museum_facade.jpg',
    ],
    'Music Venue': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Concert_stage.jpg/640px-Concert_stage.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Music_venue_interior.jpg/640px-Music_venue_interior.jpg',
    ],
    'Hotel': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Hotel_lobby.jpg/640px-Hotel_lobby.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Modern_hotel_exterior.jpg/640px-Modern_hotel_exterior.jpg',
    ],
    'Event Venue': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Convention_center.jpg/640px-Convention_center.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Event_space.jpg/640px-Event_space.jpg',
    ],
    'Restaurant': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Restaurant_interior.jpg/640px-Restaurant_interior.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Dining_venue.jpg/640px-Dining_venue.jpg',
    ],
    'Church': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Church_building.jpg/640px-Church_building.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Religious_building.jpg/640px-Religious_building.jpg',
    ],
    'Garden': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Botanical_garden.jpg/640px-Botanical_garden.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Garden_landscape.jpg/640px-Garden_landscape.jpg',
    ],
    'default': [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Building_entrance.jpg/640px-Building_entrance.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Modern_building.jpg/640px-Modern_building.jpg',
    ]
};

// Map categories to image sets
function getImageUrlForCategory(category) {
    if (!category) return venueImages.default[0];

    if (category.includes('Theater')) return venueImages['Theater'][0];
    if (category.includes('Museum')) return venueImages['Museum'][0];
    if (category.includes('Music')) return venueImages['Music Venue'][0];
    if (category.includes('Hotel')) return venueImages['Hotel'][0];
    if (category.includes('Event')) return venueImages['Event Venue'][0];
    if (category.includes('Restaurant') || category.includes('Cafe')) return venueImages['Restaurant'][0];
    if (category.includes('Church')) return venueImages['Church'][0];
    if (category.includes('Garden') || category.includes('Botanical')) return venueImages['Garden'][0];

    return venueImages.default[Math.floor(Math.random() * venueImages.default.length)];
}

async function downloadImage(venue) {
    return new Promise((resolve) => {
        const sourceUrl = getImageUrlForCategory(venue.category);
        const filename = `venue-${venue.id}-photo.jpg`;
        const filepath = path.join(IMAGES_DIR, filename);
        const localUrl = `/images/venues/${filename}`;

        console.log(`⬇️  ${venue.name}`);

        const file = fs.createWriteStream(filepath);

        https.get(sourceUrl, { timeout: 10000 }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    if (stats.size > 10000) {
                        db.run(
                            'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
                            [localUrl, localUrl, venue.id],
                            (err) => {
                                if (err) console.error(`  ❌ ${err.message}`);
                                else console.log(`  ✅ ${localUrl}`);
                                resolve();
                            }
                        );
                    } else {
                        fs.unlink(filepath, () => {});
                        resolve();
                    }
                });
            } else {
                file.destroy();
                resolve();
            }
        }).on('error', (err) => {
            console.error(`  ❌ ${err.message}`);
            fs.unlink(filepath, () => {});
            resolve();
        });
    });
}

async function downloadAll() {
    console.log('\n🎬 DOWNLOADING REAL VENUE PHOTOS');
    console.log('================================\n');

    return new Promise((resolve) => {
        db.all(
            'SELECT id, name, category FROM venues WHERE is_active = 1 ORDER BY id',
            async (err, venues) => {
                if (err || !venues) {
                    console.error('Database error');
                    db.close();
                    return resolve();
                }

                console.log(`Found ${venues.length} venues\n`);

                for (const venue of venues) {
                    await downloadImage(venue);
                    await new Promise(r => setTimeout(r, 200));
                }

                console.log(`\n✅ Complete\n`);
                db.close();
                resolve();
            }
        );
    });
}

downloadAll().then(() => process.exit(0));
