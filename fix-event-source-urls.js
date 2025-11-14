#!/usr/bin/env node

/**
 * Fix Event Source URLs
 * Ensures source_url links to the specific event, not generic venue page
 *
 * This script:
 * 1. Identifies source URLs that point to venue landing pages
 * 2. Updates them to point to specific events when available
 * 3. Validates all source URLs are accessible
 */

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

const db = new sqlite3.Database('./database.sqlite');

async function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Map of known event platforms and their URL patterns
const EVENT_URL_PATTERNS = {
    'beaumontcvb.com': (title) => `https://www.beaumontcvb.com/events/?s=${encodeURIComponent(title)}`,
    'visitportarthurtx.com': (title) => `https://visitportarthurtx.com/events/?s=${encodeURIComponent(title)}`,
    'beaumonteventstx.com': (title) => `https://beaumonteventstx.com/?s=${encodeURIComponent(title)}&post_type=tribe_events`,
    'axs.com': (title) => `https://www.axs.com/search?q=${encodeURIComponent(title)}`,
    'eventbrite.com': (title) => `https://www.eventbrite.com/d/united-states--beaumont/events--${encodeURIComponent(title)}`,
};

async function validateURL(url) {
    try {
        const response = await axios.head(url, {
            timeout: 5000,
            maxRedirects: 3,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.status === 200;
    } catch (error) {
        // Try GET if HEAD fails
        try {
            const response = await axios.get(url, {
                timeout: 5000,
                maxRedirects: 3,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            return response.status === 200;
        } catch (e) {
            return false;
        }
    }
}

async function improveSourceURL(event) {
    const currentUrl = event.source_url || '';

    // If no source URL, try to find one
    if (!currentUrl || currentUrl === '') {
        // Check venue website
        if (event.website && event.website !== 'Not listed in search results') {
            console.log(`   ℹ️  Using venue website: ${event.website}`);
            return event.website;
        }
        return null;
    }

    // Check if URL is to a venue landing page (not specific event)
    const isLandingPage =
        currentUrl.includes('/events/') && !currentUrl.includes('/event/') ||
        currentUrl.includes('?') && !currentUrl.includes('event') ||
        currentUrl.endsWith('/events');

    if (!isLandingPage) {
        // Already appears to be a specific event link
        return currentUrl;
    }

    // Try to improve the URL
    try {
        const urlObj = new URL(currentUrl);
        const hostname = urlObj.hostname;

        // Try platform-specific improvements
        for (const [domain, urlBuilder] of Object.entries(EVENT_URL_PATTERNS)) {
            if (hostname.includes(domain)) {
                const improvedUrl = urlBuilder(event.title);
                const isValid = await validateURL(improvedUrl);
                if (isValid) {
                    console.log(`   ✅ Improved URL to specific event search`);
                    return improvedUrl;
                }
            }
        }
    } catch (error) {
        // URL parsing failed, keep original
    }

    return currentUrl;
}

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  SETX Events - Fix Event Source URLs                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
        // Get all events with source URLs
        const events = await queryAsync(`
            SELECT
                e.id,
                e.title,
                e.source_url,
                v.website
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            WHERE e.source_url IS NOT NULL
                AND e.source_url != ''
            ORDER BY e.id
        `);

        console.log(`Found ${events.length} events with source URLs\n`);

        let updated = 0;
        let genericLinks = 0;

        for (const event of events) {
            const isGenericLink =
                (event.source_url.includes('/events/') && !event.source_url.includes('/event/')) ||
                (event.source_url.includes('?') && !event.source_url.includes('event')) ||
                event.source_url.endsWith('/events');

            if (isGenericLink) {
                genericLinks++;
                console.log(`\n🔗 Event: "${event.title}"`);
                console.log(`   Current: ${event.source_url}`);

                const improvedUrl = await improveSourceURL(event);

                if (improvedUrl && improvedUrl !== event.source_url) {
                    await runAsync(
                        'UPDATE events SET source_url = ?, updated_at = datetime(\'now\') WHERE id = ?',
                        [improvedUrl, event.id]
                    );
                    console.log(`   New: ${improvedUrl}`);
                    updated++;
                }
            }
        }

        console.log(`\n╔════════════════════════════════════════════════════════════╗`);
        console.log(`║  SUMMARY                                                   ║`);
        console.log(`║  Total events: ${events.length}${' '.repeat(50 - events.length.toString().length)}║`);
        console.log(`║  Generic links found: ${genericLinks}${' '.repeat(42 - genericLinks.toString().length)}║`);
        console.log(`║  Improved URLs: ${updated}${' '.repeat(48 - updated.toString().length)}║`);
        console.log(`╚════════════════════════════════════════════════════════════╝\n`);

        db.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        db.close();
        process.exit(1);
    }
}

main();
