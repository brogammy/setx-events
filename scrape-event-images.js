#!/usr/bin/env node

/**
 * Scrape Event Images from Venue Websites & Alternative Sources
 * Uses multiple strategies: venue websites, venue lookups, fallback image sources
 */

const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('./database.sqlite');
const IMAGES_DIR = './public/images/events';

// Alternative image sources when direct scraping fails
const FALLBACK_VENUES = {
    'jefferson-theatre': 'https://images.squarespace-cdn.com/content/v1/5a7e3d8e80bd5e6a4b73b7f5/1560706400000-0P0R5E5J8Z0H6K4D3V3K/Jefferson+Theatre+Beaumont+3.jpg',
    'julie-rogers': 'https://www.julierogerstheatre.com/images/exterior.jpg',
    'shangri-la': 'https://shangrilagardens.org/images/gardens.jpg',
    'port-arthur': 'https://visitportarthurtx.com/wp-content/uploads/2024/11/Port-Arthur-skyline.jpg',
    'beaumont': 'https://www.beaumontcvb.com/images/beaumont-event.jpg'
};

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

async function getEventsWithoutImages() {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT DISTINCT e.id, e.title, e.date, e.source_url, v.website, v.facebook_url, v.instagram_url, v.name as venue_name
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            WHERE (e.image_url IS NULL
                OR e.image_url LIKE '%placehold%'
                OR e.image_url = '')
            LIMIT 50
        `;
        db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function getVenueImage(venueName) {
    try {
        if (!venueName) return null;

        const venueLower = venueName.toLowerCase();

        // Check fallback venues
        for (const [key, url] of Object.entries(FALLBACK_VENUES)) {
            if (venueLower.includes(key) || venueLower.includes(key.replace('-', ' '))) {
                console.log(`   🎯 Found fallback image for: ${venueName}`);
                return url;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

async function scrapeImageFromUrl(url) {
    try {
        const response = await axios.get(url, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const images = [];

        // Collect all images on the page
        $('img').each((i, elem) => {
            let src = $(elem).attr('src') || $(elem).attr('data-src');
            if (!src || src.length < 3) return;

            // Convert to absolute URL
            let absoluteUrl = src;
            if (src.startsWith('//')) {
                absoluteUrl = 'https:' + src;
            } else if (src.startsWith('/')) {
                try {
                    const baseUrl = new URL(url);
                    absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${src}`;
                } catch (e) {
                    return;
                }
            } else if (!src.startsWith('http')) {
                try {
                    const baseUrl = new URL(url);
                    absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}/${src}`;
                } catch (e) {
                    return;
                }
            }

            // Skip obvious non-content images
            const alt = ($(elem).attr('alt') || '').toLowerCase();
            const className = ($(elem).attr('class') || '').toLowerCase();

            if (className.includes('logo') || className.includes('icon') ||
                className.includes('header') || className.includes('nav') ||
                alt.includes('logo') || alt.includes('icon')) {
                return;
            }

            if (src.includes('logo') || src.includes('icon') || src.includes('sprite') ||
                src.includes('nav') || src.includes('header') || src.includes('pixel')) {
                return;
            }

            images.push({
                url: absoluteUrl,
                alt: alt,
                class: className,
                width: $(elem).attr('width'),
                height: $(elem).attr('height')
            });
        });

        return images;
    } catch (error) {
        return [];
    }
}

async function findImageForEvent(event) {
    console.log(`\n🔍 Looking for image: "${event.title}"`);

    // PRIORITY 1: Try venue website first
    if (event.website) {
        console.log(`   1️⃣  Trying venue website: ${event.website}`);
        try {
            const images = await scrapeImageFromUrl(event.website);
            if (images.length > 0) {
                // Pick largest image
                const selected = images.sort((a, b) => {
                    const aSize = (parseInt(a.width) || 400) * (parseInt(a.height) || 300);
                    const bSize = (parseInt(b.width) || 400) * (parseInt(b.height) || 300);
                    return bSize - aSize;
                })[0];
                if (selected && selected.url) {
                    console.log(`   ✅ Found from venue website: ${selected.url.substring(0, 80)}`);
                    return selected.url;
                }
            }
        } catch (error) {
            console.log(`   ⚠️  Venue website error: ${error.message.substring(0, 40)}`);
        }
    }

    // PRIORITY 2: Try Facebook if available
    if (event.facebook_url) {
        console.log(`   2️⃣  Trying Facebook: ${event.facebook_url}`);
        try {
            const images = await scrapeImageFromUrl(event.facebook_url);
            if (images.length > 0) {
                const selected = images.sort((a, b) => {
                    const aSize = (parseInt(a.width) || 400) * (parseInt(a.height) || 300);
                    const bSize = (parseInt(b.width) || 400) * (parseInt(b.height) || 300);
                    return bSize - aSize;
                })[0];
                if (selected && selected.url) {
                    console.log(`   ✅ Found from Facebook: ${selected.url.substring(0, 80)}`);
                    return selected.url;
                }
            }
        } catch (error) {
            console.log(`   ⚠️  Facebook error`);
        }
    }

    // PRIORITY 3: Try event source URL
    if (event.source_url) {
        console.log(`   3️⃣  Trying event source: ${event.source_url}`);
        try {
            const images = await scrapeImageFromUrl(event.source_url);
            if (images.length > 0) {
                // Filter for relevant keywords
                const relevantKeywords = ['event', 'music', 'theater', 'concert', 'festival', 'market', 'fair', 'show', 'performance', 'gallery', 'exhibit', 'museum'];
                const priorityImages = images.filter(img => {
                    const keywords = event.title.toLowerCase().split(/\s+/);
                    return relevantKeywords.some(kw => img.alt.includes(kw) || img.class.includes(kw)) ||
                           keywords.some(kw => kw.length > 3 && (img.alt.includes(kw) || img.class.includes(kw)));
                });

                const selectedImages = priorityImages.length > 0 ? priorityImages : images;
                const selected = selectedImages.sort((a, b) => {
                    const aSize = (parseInt(a.width) || 400) * (parseInt(a.height) || 300);
                    const bSize = (parseInt(b.width) || 400) * (parseInt(b.height) || 300);
                    return bSize - aSize;
                })[0];

                if (selected && selected.url) {
                    console.log(`   ✅ Found from event source: ${selected.url.substring(0, 80)}`);
                    return selected.url;
                }
            }
        } catch (error) {
            console.log(`   ⚠️  Event source error: ${error.message.substring(0, 40)}`);
        }
    }

    // PRIORITY 4: Try fallback venue lookup
    const venueImage = await getVenueImage(event.venue_name);
    if (venueImage) {
        console.log(`   ✅ Found from venue fallback`);
        return venueImage;
    }

    console.log(`   ❌ No image found for this event`);
    return null;
}

async function updateEventImage(eventId, imageUrl) {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE events SET image_url = ?, updated_at = datetime(\'now\') WHERE id = ?';
        db.run(sql, [imageUrl, eventId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function main() {
    console.log('\n🖼️  SETX Events - Image Scraper\n');
    console.log('Fetching events without images...\n');

    const events = await getEventsWithoutImages();

    if (events.length === 0) {
        console.log('✅ All events already have images!\n');
        db.close();
        process.exit(0);
    }

    console.log(`Found ${events.length} events needing images\n`);

    let updated = 0;
    for (const event of events) {
        try {
            const imageUrl = await findImageForEvent(event);
            if (imageUrl) {
                await updateEventImage(event.id, imageUrl);
                updated++;
            }
        } catch (error) {
            console.error(`Error processing event ${event.id}: ${error.message}`);
        }
    }

    console.log(`\n✅ Updated ${updated} events with images\n`);
    db.close();
}

main().catch(err => {
    console.error('Fatal error:', err);
    db.close();
    process.exit(1);
});
