#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

async function testUrlAccessible(url) {
    return new Promise((resolve) => {
        if (!url || !url.startsWith('http')) {
            resolve(false);
            return;
        }

        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.head(url, { timeout: 5000 }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.abort();
            resolve(false);
        });
    });
}

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

async function findAlternativeImage(venue) {
    try {
        const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
                model: 'sonar',
                messages: [
                    {
                        role: 'user',
                        content: `Find a DIRECT image URL for "${venue.name}" in ${venue.city}, Texas. Try: venue website, TripAdvisor, Yelp, Wikipedia, Google Images. Return ONLY the HTTP/HTTPS URL, nothing else. If none found: none`
                    }
                ],
                temperature: 0.1,
                max_tokens: 300
            },
            {
                headers: { 'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}` },
                timeout: 10000
            }
        );

        const url = response.data.choices[0].message.content.trim();
        if (url.startsWith('http') && url.length < 500) {
            return url;
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function processVenues() {
    console.log('\n📥 TEST & DOWNLOAD VENUE IMAGES\n');

    return new Promise((resolve) => {
        db.all(
            'SELECT id, name, city, cover_image_url FROM venues WHERE is_active = 1 ORDER BY id',
            async (err, venues) => {
                if (err || !venues) {
                    console.log('Database error');
                    db.close();
                    return resolve();
                }

                console.log(`Processing ${venues.length} venues\n`);
                let downloaded = 0;
                let found_alternative = 0;

                for (const venue of venues) {
                    process.stdout.write(`${venue.name.substring(0, 35).padEnd(35)} `);

                    // Test if current URL works
                    const accessible = await testUrlAccessible(venue.cover_image_url);

                    if (accessible) {
                        const success = await downloadImage(venue);
                        if (success) {
                            db.run('UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
                                [`/images/venues/venue-${venue.id}.jpg`, `/images/venues/venue-${venue.id}.jpg`, venue.id]);
                            console.log('✅');
                            downloaded++;
                        } else {
                            console.log('⚠️ (no file)');
                        }
                    } else {
                        console.log('🔍 (finding alt)');
                        const altUrl = await findAlternativeImage(venue);

                        if (altUrl) {
                            const success = await downloadImage({ ...venue, cover_image_url: altUrl });
                            if (success) {
                                db.run('UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
                                    [`/images/venues/venue-${venue.id}.jpg`, `/images/venues/venue-${venue.id}.jpg`, venue.id]);
                                console.log('  ✅ (alt found)');
                                downloaded++;
                                found_alternative++;
                            } else {
                                console.log('  ❌ (alt failed)');
                            }
                        } else {
                            console.log('  ❌ (no alt)');
                        }
                    }

                    await new Promise(r => setTimeout(r, 500));
                }

                setTimeout(() => {
                    console.log(`\n✅ Downloaded ${downloaded}/${venues.length} images`);
                    console.log(`   ${found_alternative} using alternative sources\n`);
                    db.close();
                    resolve();
                }, 1000);
            }
        );
    });
}

processVenues().then(() => process.exit(0));
