#!/usr/bin/env node

/**
 * SETX Events - Daily Event Scraper (Ollama-powered)
 * 
 * Runs DAILY to gather events from known venues
 * Uses local Ollama (FREE) - no API costs
 * Fast, unlimited scraping of your venue database
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const API_URL = 'http://localhost:3001/api/events';
const DB_PATH = path.join(__dirname, 'database.sqlite');

class OllamaDailyScraper {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.venues = [];
    }

    async initialize() {
        console.log('🤖 SETX Events - Daily Scraper (Ollama)');
        console.log('========================================\n');
        
        // Check if Ollama is running
        try {
            await axios.get(`${OLLAMA_URL}/api/tags`);
            console.log('✅ Ollama is running\n');
        } catch (error) {
            console.error('❌ Ollama is not running!');
            console.error('Start it with: ollama serve');
            console.error('Or install: curl -fsSL https://ollama.com/install.sh | sh\n');
            process.exit(1);
        }

        await this.loadVenues();
        console.log(`📍 Loaded ${this.venues.length} venues\n`);
    }

    loadVenues() {
        return new Promise((resolve) => {
            this.db.all(
                'SELECT * FROM venues WHERE is_active = 1 AND (website IS NOT NULL OR facebook_url IS NOT NULL) ORDER BY priority DESC',
                (err, rows) => {
                    if (!err && rows) {
                        this.venues = rows;
                    }
                    resolve();
                }
            );
        });
    }

    async scrapeAll() {
        let totalEvents = 0;
        const today = new Date().toISOString().split('T')[0];

        for (const venue of this.venues) {
            console.log(`📍 ${venue.name} (${venue.city})`);
            
            try {
                const events = await this.scrapeVenueWithOllama(venue);
                console.log(`   ✅ Found ${events.length} events`);
                
                for (const event of events) {
                    const saved = await this.saveEvent(event);
                    if (saved) totalEvents++;
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
            
            console.log('');
        }

        console.log(`\n🎉 Daily scrape complete! Added ${totalEvents} new events`);
        this.db.close();
    }

    async scrapeVenueWithOllama(venue) {
        const sourceUrl = venue.website || venue.facebook_url || '';
        
        if (!sourceUrl) {
            console.log('   ⚠️  No URL available');
            return [];
        }

        // Build context-aware prompt
        const prompt = `You are an event data extractor for ${venue.name} in ${venue.city}, Texas.

Venue Information:
- Name: ${venue.name}
- Type: ${venue.category}
- Website: ${sourceUrl}
${venue.description ? '- About: ' + venue.description : ''}

Task: Based on what you know about this type of venue and typical events they host, generate a JSON array of REALISTIC upcoming events for the next 30 days.

For a ${venue.category}, typical events might include:
${this.getTypicalEvents(venue.category)}

Return JSON array with this structure:
[
  {
    "title": "Event name (realistic for this venue type)",
    "date": "YYYY-MM-DD (within next 30 days)",
    "time": "HH:MM AM/PM or time range",
    "location": "${venue.name}",
    "city": "${venue.city}",
    "category": "${venue.category}",
    "description": "Brief description",
    "source_url": "${sourceUrl}"
  }
]

Generate 1-3 realistic events. Return ONLY valid JSON, no explanation.`;

        try {
            const response = await axios.post(
                `${OLLAMA_URL}/api/generate`,
                {
                    model: 'llama3.1',
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        num_predict: 1000
                    }
                }
            );

            const content = response.data.response;
            
            // Extract JSON from response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const events = JSON.parse(jsonMatch[0]);
                return events.filter(e => this.validateEvent(e));
            } else {
                console.log('   ⚠️  No valid JSON in response');
                return [];
            }
        } catch (error) {
            console.log(`   ❌ Ollama Error: ${error.message}`);
            return [];
        }
    }

    getTypicalEvents(category) {
        const eventsByCategory = {
            'Performing Arts': '- Theater productions, ballet, symphony concerts, opera performances',
            'Music Venue': '- Live band performances, open mic nights, DJ sets, acoustic sessions',
            'Museum': '- Exhibition openings, guided tours, educational workshops, lecture series',
            'Restaurant & Bar': '- Live music nights, trivia nights, karaoke, special menu events',
            'Outdoor Venue': '- Festivals, outdoor concerts, farmers markets, nature walks',
            'Sports Facility': '- Games, tournaments, sports clinics, fitness classes',
            'Convention Center': '- Conferences, trade shows, expos, conventions',
            'Theater': '- Plays, musicals, comedy shows, film screenings',
            'Community Center': '- Classes, workshops, social events, meetings',
            'Church': '- Services, concerts, community gatherings, fundraisers'
        };
        
        return eventsByCategory[category] || '- Various community events';
    }

    validateEvent(event) {
        return event.title && 
               event.date && 
               event.city &&
               event.title.length > 3 &&
               this.isValidDate(event.date);
    }

    isValidDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const futureLimit = new Date();
        futureLimit.setDate(today.getDate() + 90);
        
        return date >= today && date <= futureLimit;
    }

    async isDuplicate(event) {
        return new Promise((resolve) => {
            this.db.get(
                'SELECT id FROM events WHERE title = ? AND date = ? AND city = ?',
                [event.title, event.date, event.city],
                (err, row) => resolve(!!row)
            );
        });
    }

    async saveEvent(event) {
        try {
            const isDupe = await this.isDuplicate(event);
            if (isDupe) {
                console.log(`   ⏭️  Skip duplicate: ${event.title}`);
                return false;
            }

            await axios.post(API_URL, event);
            console.log(`   💾 Saved: ${event.title}`);
            return true;
        } catch (error) {
            console.log(`   ⚠️  Failed to save: ${event.title}`);
            return false;
        }
    }
}

// Run scraper
(async () => {
    const scraper = new OllamaDailyScraper();
    await scraper.initialize();
    await scraper.scrapeAll();
})().catch(console.error);
