#!/usr/bin/env node

/**
 * Scrape Event Images from Venue Websites
 * Finds images related to events from venue websites and updates the database
 */

const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('./database.sqlite');
const IMAGES_DIR = './public/images/events';

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

async function getEventsWithoutImages() {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT DISTINCT e.id, e.title, e.date, e.source_url, v.website
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

async function findImageForEvent(event) {
    try {
        const sourceUrl = event.source_url;
        const venueName = event.title.split(' - ')[0] || event.title;

        if (!sourceUrl || sourceUrl === '') {
            console.log(`⚠️  No source URL for: ${event.title}`);
            return null;
        }

        console.log(`\n🔍 Looking for image: "${event.title}"`);
        console.log(`   From: ${sourceUrl}`);

        const response = await axios.get(sourceUrl, {
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
            if (!src) return;

            // Convert to absolute URL
            let absoluteUrl = src;
            if (src.startsWith('//')) {
                absoluteUrl = 'https:' + src;
            } else if (src.startsWith('/')) {
                try {
                    const baseUrl = new URL(sourceUrl);
                    absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${src}`;
                } catch (e) {
                    return;
                }
            } else if (!src.startsWith('http')) {
                try {
                    const baseUrl = new URL(sourceUrl);
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
                src.includes('nav') || src.includes('header')) {
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

        // Prefer images with relevant keywords in alt text or class
        const relevantKeywords = ['event', 'music', 'theater', 'concert', 'festival', 'market', 'fair', 'show', 'performance', 'gallery', 'exhibit', 'museum'];
        const priorityImages = images.filter(img => {
            const keywords = event.title.toLowerCase().split(/\s+/);
            return relevantKeywords.some(kw => img.alt.includes(kw) || img.class.includes(kw)) ||
                   keywords.some(kw => kw.length > 3 && (img.alt.includes(kw) || img.class.includes(kw)));
        });

        // Use prioritized images first, then fall back to any images
        const selectedImages = priorityImages.length > 0 ? priorityImages : images;

        // Pick the largest or first relevant image
        let selectedImage = selectedImages.sort((a, b) => {
            const aSize = (parseInt(a.width) || 0) * (parseInt(a.height) || 0);
            const bSize = (parseInt(b.width) || 0) * (parseInt(b.height) || 0);
            return bSize - aSize;
        })[0];

        // If no relevant image, pick any image (skip very small ones)
        if (!selectedImage) {
            selectedImage = images.find(img => {
                const size = (parseInt(img.width) || 200) * (parseInt(img.height) || 200);
                return size > 5000; // Skip very small images
            });
        }

        if (selectedImage && selectedImage.url) {
            console.log(`   ✅ Found: ${selectedImage.url}`);
            return selectedImage.url;
        } else {
            console.log(`   ❌ No suitable image found`);
            return null;
        }
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return null;
    }
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
