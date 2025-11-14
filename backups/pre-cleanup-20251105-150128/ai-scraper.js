#!/usr/bin/env node

/**
 * SETX Events - AI-Powered Scraper using Perplexity API
 * 
 * This scraper uses Perplexity AI to intelligently extract event information
 * from venue websites and social media pages.
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'YOUR_API_KEY_HERE';
const API_URL = 'http://localhost:3001/api/events';
const DB_PATH = path.join(__dirname, 'database.sqlite');

class AIEventScraper {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.venues = [];
    }

    async initialize() {
        await this.loadVenues();
        console.log(`✅ Loaded ${this.venues.length} venues\n`);
    }

    loadVenues() {
        return new Promise((resolve) => {
            this.db.all(
                'SELECT * FROM venues WHERE is_active = 1 ORDER BY priority DESC',
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
        console.log('🤖 Starting AI-powered event scraping...\n');
        let totalEvents = 0;

        for (const venue of this.venues) {
            console.log(`📍 Processing: ${venue.name} (${venue.city})`);
            
            try {
                const events = await this.scrapeVenueWithAI(venue);
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

        console.log(`\n🎉 Scraping complete! Total new events: ${totalEvents}`);
        this.db.close();
    }

    async scrapeVenueWithAI(venue) {
        if (!venue.website) {
            console.log('   ⚠️  No website URL available');
            return [];
        }

        // Construct the AI prompt
        const prompt = `Extract upcoming events from ${venue.name} in ${venue.city}, Texas.
        
Website: ${venue.website}
${venue.facebook_url ? 'Facebook: ' + venue.facebook_url : ''}

Please search for current events at this venue and return a JSON array of events with this structure:
[
  {
    "title": "Event name",
    "date": "YYYY-MM-DD",
    "time": "HH:MM AM/PM or time range",
    "location": "${venue.name}",
    "city": "${venue.city}",
    "category": "Category (e.g., Music, Theater, Festival)",
    "description": "Brief description",
    "source_url": "URL where you found this event",
    "price": "Price if available",
    "ticket_url": "Ticket purchase URL if available"
  }
]

Only include events that are confirmed and upcoming (not past events).
Return valid JSON only, no additional text.`;

        try {
            const response = await axios.post(
                'https://api.perplexity.ai/chat/completions',
                {
                    model: 'sonar',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert event data extractor. Return only valid JSON arrays. Search the web for current, real event information.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 2000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices[0].message.content;
            console.log('   🤖 AI Response received');
            
            // Parse JSON from response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const events = JSON.parse(jsonMatch[0]);
                return events.filter(e => this.validateEvent(e));
            } else {
                console.log('   ⚠️  No valid JSON found in AI response');
                return [];
            }
        } catch (error) {
            console.log(`   ❌ AI API Error: ${error.message}`);
            return [];
        }
    }

    validateEvent(event) {
        return event.title && 
               event.date && 
               event.city &&
               event.title.length > 3;
    }

    async isDuplicate(event) {
        return new Promise((resolve) => {
            this.db.get(
                'SELECT id FROM events WHERE title = ? AND date = ?',
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
            console.log(`   ⚠️  Failed to save: ${event.title}`);
            return false;
        }
    }
}

// Check for API key
if (PERPLEXITY_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('❌ ERROR: Perplexity API key not set!');
    console.error('');
    console.error('Set your API key:');
    console.error('  export PERPLEXITY_API_KEY="your-api-key-here"');
    console.error('');
    console.error('Or edit this file and replace YOUR_API_KEY_HERE with your actual key');
    console.error('Get your API key at: https://www.perplexity.ai/settings/api');
    process.exit(1);
}

// Run the scraper
(async () => {
    const scraper = new AIEventScraper();
    await scraper.initialize();
    await scraper.scrapeAll();
})().catch(console.error);
