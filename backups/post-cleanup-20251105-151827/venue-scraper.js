#!/usr/bin/env node

/**
 * SETX Events - Venue-Focused Intelligent Scraper
 * 
 * This scraper prioritizes direct venue sources (websites, Facebook, Instagram)
 * and learns which sources are most reliable over time.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const API_URL = 'http://localhost:3001/api/events';
const DB_PATH = path.join(__dirname, 'database.sqlite');

class VenueFocusedScraper {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.venues = [];
        this.sources = [];
    }

    async initialize() {
        await this.loadVenues();
        await this.loadSources();
        await this.discoverNewVenueSources();
    }

    // Load venues from database, prioritized by success rate and priority
    loadVenues() {
        return new Promise((resolve) => {
            this.db.all(
                `SELECT * FROM venues WHERE is_active = 1 ORDER BY priority DESC, scrape_success_rate DESC`,
                (err, rows) => {
                    if (!err && rows) {
                        this.venues = rows;
                        console.log(`📍 Loaded ${rows.length} active venues`);
                    }
                    resolve();
                }
            );
        });
    }

    // Load event sources, prioritized by performance
    loadSources() {
        return new Promise((resolve) => {
            this.db.all(
                `SELECT * FROM event_sources WHERE is_active = 1 ORDER BY priority DESC, average_events_per_scrape DESC`,
                (err, rows) => {
                    if (!err && rows) {
                        this.sources = rows;
                        console.log(`🔗 Loaded ${rows.length} active sources`);
                    }
                    resolve();
                }
            );
        });
    }

    // Discover new venue sources by checking social media and calendar feeds
    async discoverNewVenueSources() {
        console.log('\n🔍 Discovering new venue sources...\n');

        for (const venue of this.venues) {
            // Check Facebook Events
            if (venue.facebook_url && !this.hasSource(venue.facebook_url + '/events')) {
                await this.addSource(venue.facebook_url + '/events', 'social', venue.id, 'Facebook Events');
            }

            // Check website for calendar/events pages
            if (venue.website) {
                const calendarUrls = await this.findCalendarPages(venue.website);
                for (const url of calendarUrls) {
                    if (!this.hasSource(url)) {
                        await this.addSource(url, 'venue', venue.id, 'Venue Calendar');
                    }
                }
            }

            // Check common calendar platforms
            const venueName = venue.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const potentialSources = [
                `https://www.eventbrite.com/o/${venueName}`,
                `https://www.facebook.com/${venueName}/events`,
                `https://${venueName}.ticketmaster.com/`,
            ];

            for (const url of potentialSources) {
                if (!this.hasSource(url)) {
                    await this.addSource(url, 'aggregator', venue.id, 'Platform Check');
                }
            }
        }
    }

    // Check if source already exists
    hasSource(url) {
        return this.sources.some(s => s.source_url === url);
    }

    // Add new source to database
    async addSource(url, type, venueId, discoveryMethod) {
        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR IGNORE INTO event_sources (source_url, source_type, venue_id, notes) VALUES (?, ?, ?, ?)`,
                [url, type, venueId, `Discovered via: ${discoveryMethod}`],
                function(err) {
                    if (!err && this.changes > 0) {
                        console.log(`   ➕ Added new source: ${url}`);
                    }
                    resolve();
                }
            );
        });
    }

    // Find calendar/events pages on venue websites
    async findCalendarPages(websiteUrl) {
        const calendarUrls = [];
        
        try {
            const response = await axios.get(websiteUrl, { timeout: 10000 });
            const $ = cheerio.load(response.data);
            
            // Look for calendar/events links
            $('a').each((i, elem) => {
                const href = $(elem).attr('href');
                const text = $(elem).text().toLowerCase();
                
                if (href && (
                    text.includes('event') ||
                    text.includes('calendar') ||
                    text.includes('schedule') ||
                    href.includes('/events') ||
                    href.includes('/calendar') ||
                    href.includes('/schedule')
                )) {
                    // Make absolute URL
                    let absoluteUrl = href;
                    if (href.startsWith('/')) {
                        const baseUrl = new URL(websiteUrl);
                        absoluteUrl = `${baseUrl.protocol}//${baseUrl.host}${href}`;
                    } else if (!href.startsWith('http')) {
                        absoluteUrl = websiteUrl.replace(/\/$/, '') + '/' + href;
                    }
                    
                    if (!calendarUrls.includes(absoluteUrl)) {
                        calendarUrls.push(absoluteUrl);
                    }
                }
            });
        } catch (error) {
            // Website not accessible, skip
        }
        
        return calendarUrls;
    }

    // Scrape all high-priority sources
    async scrapeAll() {
        console.log('\n🚀 Starting venue-focused scraping...\n');
        let totalEvents = 0;

        // Prioritize venue-direct sources
        const venueSources = this.sources.filter(s => s.source_type === 'venue' || s.source_type === 'social');
        const otherSources = this.sources.filter(s => s.source_type !== 'venue' && s.source_type !== 'social');
        
        const orderedSources = [...venueSources, ...otherSources];

        for (const source of orderedSources) {
            const venue = this.venues.find(v => v.id === source.venue_id);
            const venueName = venue ? venue.name : 'Unknown';
            
            console.log(`📍 Scraping: ${venueName} - ${source.source_url}`);
            
            try {
                const events = await this.scrapeSource(source, venue);
                console.log(`   ✅ Found ${events.length} events`);
                
                for (const event of events) {
                    event.venue_id = venue ? venue.id : null;
                    const saved = await this.saveEvent(event);
                    if (saved) totalEvents++;
                }

                await this.updateSourceMetrics(source.id, events.length, true);
                if (venue) {
                    await this.updateVenueMetrics(venue.id, events.length);
                }

            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                await this.updateSourceMetrics(source.id, 0, false);
            }
            
            console.log('');
        }

        console.log(`\n🎉 Scraping complete! Total new events: ${totalEvents}`);
        this.db.close();
    }

    // Scrape a single source with learned strategies
    async scrapeSource(source, venue) {
        const response = await axios.get(source.source_url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Try learned strategy first if available
        let events = [];
        if (source.scrape_strategy) {
            try {
                const strategy = JSON.parse(source.scrape_strategy);
                events = this.applyLearnedStrategy($, strategy, venue);
            } catch (e) {
                // Strategy failed, fall back to discovery
            }
        }

        // If no learned strategy or it failed, try discovery
        if (events.length === 0) {
            events = await this.discoverAndExtract($, html, source, venue);
        }

        return events;
    }

    // Apply previously learned extraction strategy
    applyLearnedStrategy($, strategy, venue) {
        const events = [];
        
        $(strategy.container).each((i, elem) => {
            const $elem = $(elem);
            
            const event = {
                title: this.cleanText($elem.find(strategy.title).text()),
                date: this.parseDate($elem.find(strategy.date).text() || $elem.find(strategy.date).attr('datetime')),
                time: this.cleanText($elem.find(strategy.time).text()),
                location: venue ? venue.name : this.cleanText($elem.find(strategy.location).text()),
                city: venue ? venue.city : '',
                category: venue ? venue.category : 'Community Event',
                description: this.cleanText($elem.find(strategy.description).text()),
                source_url: venue ? venue.website : ''
            };

            if (this.validateEvent(event)) {
                events.push(event);
            }
        });

        return events;
    }

    // Discover extraction patterns
    async discoverAndExtract($, html, source, venue) {
        const events = [];

        // Strategy 1: JSON-LD structured data
        const jsonLdEvents = this.extractJSONLD($, venue);
        if (jsonLdEvents.length > 0) {
            await this.saveStrategy(source.id, { type: 'json-ld' });
            return jsonLdEvents;
        }

        // Strategy 2: Facebook Events (if Facebook URL)
        if (source.source_url.includes('facebook.com')) {
            // Facebook requires authenticated scraping or Graph API
            // For now, note this and suggest manual Facebook integration
            console.log(`   ℹ️  Facebook events require API integration - skipping for now`);
            return [];
        }

        // Strategy 3: Common event patterns
        const patterns = [
            { container: '.event, article.event, .tribe-event', title: 'h2, h3, .event-title', date: 'time, .date, .event-date', description: 'p, .description' },
            { container: '[itemtype*="Event"]', title: '[itemprop="name"]', date: '[itemprop="startDate"]', description: '[itemprop="description"]' },
            { container: 'tr.event, tr[class*="event"]', title: 'td:nth-child(2), .title', date: 'td:nth-child(1), .date', description: 'td:last-child' }
        ];

        for (const pattern of patterns) {
            const discovered = this.extractWithPattern($, pattern, venue);
            if (discovered.length > 0) {
                await this.saveStrategy(source.id, pattern);
                return discovered;
            }
        }

        return events;
    }

    // Extract JSON-LD
    extractJSONLD($, venue) {
        const events = [];
        
        $('script[type="application/ld+json"]').each((i, elem) => {
            try {
                const data = JSON.parse($(elem).html());
                const items = Array.isArray(data) ? data : [data];
                
                items.forEach(item => {
                    if (item['@type'] === 'Event') {
                        events.push({
                            title: item.name,
                            date: this.parseDate(item.startDate),
                            time: this.parseTime(item.startDate),
                            location: venue ? venue.name : (item.location?.name || ''),
                            city: venue ? venue.city : '',
                            category: venue ? venue.category : 'Community Event',
                            description: this.cleanText(item.description),
                            source_url: venue ? venue.website : ''
                        });
                    }
                });
            } catch (e) {}
        });

        return events.filter(e => this.validateEvent(e));
    }

    // Extract with pattern
    extractWithPattern($, pattern, venue) {
        const events = [];
        
        $(pattern.container).each((i, elem) => {
            const $elem = $(elem);
            
            const event = {
                title: this.cleanText($elem.find(pattern.title).text()),
                date: this.parseDate($elem.find(pattern.date).text() || $elem.find(pattern.date).attr('datetime') || $elem.find(pattern.date).attr('content')),
                time: pattern.time ? this.cleanText($elem.find(pattern.time).text()) : '',
                location: venue ? venue.name : '',
                city: venue ? venue.city : '',
                category: venue ? venue.category : 'Community Event',
                description: pattern.description ? this.cleanText($elem.find(pattern.description).text()) : '',
                source_url: venue ? venue.website : ''
            };

            if (this.validateEvent(event)) {
                events.push(event);
            }
        });

        return events;
    }

    // Save successful strategy
    async saveStrategy(sourceId, strategy) {
        return new Promise((resolve) => {
            this.db.run(
                `UPDATE event_sources SET scrape_strategy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [JSON.stringify(strategy), sourceId],
                () => resolve()
            );
        });
    }

    // Update source performance metrics
    async updateSourceMetrics(sourceId, eventsFound, success) {
        return new Promise((resolve) => {
            this.db.run(
                `UPDATE event_sources 
                 SET total_scrapes = total_scrapes + 1,
                     successful_scrapes = successful_scrapes + ?,
                     average_events_per_scrape = ((average_events_per_scrape * total_scrapes) + ?) / (total_scrapes + 1),
                     last_successful_scrape = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE last_successful_scrape END,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [success ? 1 : 0, eventsFound, success, sourceId],
                () => resolve()
            );
        });
    }

    // Update venue performance metrics
    async updateVenueMetrics(venueId, eventsFound) {
        return new Promise((resolve) => {
            this.db.run(
                `UPDATE venues 
                 SET total_events_found = total_events_found + ?,
                     last_scraped = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [eventsFound, venueId],
                () => resolve()
            );
        });
    }

    // Helper methods (same as before)
    cleanText(text) {
        if (!text) return '';
        return text.toString()
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 500);
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        return null;
    }

    parseTime(dateStr) {
        if (!dateStr) return '';
        const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        return timeMatch ? timeMatch[0] : '';
    }

    validateEvent(event) {
        return event.title && 
               event.title.length > 3 && 
               event.date && 
               event.city;
    }

    async isDuplicate(event) {
        return new Promise((resolve) => {
            this.db.get(
                `SELECT id FROM events WHERE title = ? AND date = ?`,
                [event.title, event.date],
                (err, row) => resolve(!!row)
            );
        });
    }

    async saveEvent(event) {
        try {
            const isDupe = await this.isDuplicate(event);
            if (isDupe) {
                console.log(`   ⏭️  Skipping duplicate: ${event.title}`);
                return false;
            }

            await axios.post(API_URL, event);
            console.log(`   💾 Saved: ${event.title}`);
            return true;
        } catch (error) {
            return false;
        }
    }
}

// Run the scraper
(async () => {
    const scraper = new VenueFocusedScraper();
    await scraper.initialize();
    await scraper.scrapeAll();
})().catch(console.error);
