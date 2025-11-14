#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

async function downloadImage(venue) {
    return new Promise((resolve) => {
        if (!venue.cover_image_url || !venue.cover_image_url.startsWith('http')) {
            resolve(false);
            return;
        }

        const filename = `venue-${venue.id}.jpg`;
        const filepath = path.join(IMAGES_DIR, filename);
        const file = fs.createWriteStream(filepath);
        const sourceUrl = venue.cover_image_url;

        const protocol = sourceUrl.startsWith('https') ? https : http;

        const handleResponse = (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
                return redirectProtocol.get(redirectUrl, { timeout: 10000 }, handleResponse);
            }

            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    try {
                        const stats = fs.statSync(filepath);
                        if (stats.size > 5000) {
                            resolve(true);
                        } else {
                            fs.unlinkSync(filepath);
                            resolve(false);
                        }
                    } catch (e) {
                        resolve(false);
                    }
                });
            } else {
                file.destroy();
                try { fs.unlinkSync(filepath); } catch(e) {}
                resolve(false);
            }
        };

        protocol.get(sourceUrl, { timeout: 10000 }, handleResponse)
            .on('error', () => {
                try { fs.unlinkSync(filepath); } catch(e) {}
                resolve(false);
            });
    });
}

async function processVenues() {
    console.log('\n⬇️  DOWNLOADING WORKING VENUE IMAGES\n');

    return new Promise((resolve) => {
        db.all(
            'SELECT id, name, cover_image_url FROM venues WHERE cover_image_url LIKE "http%" ORDER BY id',
            async (err, venues) => {
                if (err || !venues || venues.length === 0) {
                    console.log('No venues with HTTP URLs');
                    db.close();
                    return resolve();
                }

                console.log(`Testing and downloading ${venues.length} venue images\n`);
                let downloaded = 0;

                for (const venue of venues) {
                    process.stdout.write(`${venue.name.substring(0, 40).padEnd(40)} `);
                    const success = await downloadImage(venue);

                    if (success) {
                        db.run('UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
                            [`/images/venues/venue-${venue.id}.jpg`, `/images/venues/venue-${venue.id}.jpg`, venue.id]);
                        console.log('✅');
                        downloaded++;
                    } else {
                        console.log('❌');
                    }
                }

                setTimeout(() => {
                    console.log(`\n✅ Downloaded ${downloaded}/${venues.length} venue images locally\n`);
                    db.close();
                    resolve();
                }, 1000);
            }
        );
    });
}

processVenues().then(() => process.exit(0));
