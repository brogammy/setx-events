#!/usr/bin/env node

/**
 * PERPLEXITY SCRAPER - MEMORY-ENABLED VERSION
 *
 * This enhanced version of ai-scraper.js automatically teaches Ollama by:
 * 1. Recording successful venue profiles
 * 2. Storing best prompts that worked
 * 3. Logging extraction patterns
 * 4. Tracking performance metrics
 * 5. Updating decision patterns
 *
 * The Ollama local agent learns from all of this.
 *
 * Run with: PERPLEXITY_API_KEY="your-key" node ai-scraper-memory-enabled.js
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const OllamaMemorySystem = require('./ollama-memory');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'YOUR_API_KEY_HERE';
const API_URL = 'http://localhost:3001/api/events';
const DB_PATH = path.join(__dirname, 'database.sqlite');

class PerplexityMemoryEnabledScraper {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.memory = new OllamaMemorySystem();
        this.venues = [];
        this.startTime = Date.now();
        this.metrics = {
            eventsScraped: 0,
            duplicates: 0,
            errors: 0,
            venuesProcessed: 0,
            apiCost: 0
        };
    }

    async initialize() {
        console.log('🤖 PERPLEXITY SCRAPER - MEMORY-ENABLED (Teaching Ollama)\n');
        console.log('========================================================\n');

        if (PERPLEXITY_API_KEY === 'YOUR_API_KEY_HERE') {
            console.error('❌ ERROR: Perplexity API key not set!');
            console.error('Set: export PERPLEXITY_API_KEY="pplx-..."');
            process.exit(1);
        }

        await this.loadVenues();
        console.log(`📍 Loaded ${this.venues.length} venues\n`);
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

    /**
     * SCRAPE WITH MEMORY RECORDING
     */
    async scrapeAll() {
        console.log('🔍 SCRAPING WITH PERPLEXITY (Teaching Ollama)\n');

        for (const venue of this.venues) {
            this.metrics.venuesProcessed += 1;

            console.log(`📍 Processing: ${venue.name} (${venue.city})`);

            try {
                const events = await this.scrapeVenueWithAI(venue);
                console.log(`   ✅ Found ${events.length} events`);

                // Save events and TEACH OLLAMA from success
                let savedCount = 0;
                for (const event of events) {
                    const saved = await this.saveEvent(event, venue);
                    if (saved) {
                        this.metrics.eventsScraped += 1;
                        savedCount += 1;
                    }
                }

                // Teach Ollama from our success
                if (savedCount > 0) {
                    this.memory.learnVenueProfile(
                        venue.id,
                        venue,
                        events.filter(e => !this.isDuplicateLocally(e)),
                        'perplexity'
                    );

                    // Record the successful prompt for future use
                    const usedPrompt = this.buildPrompt(venue);
                    this.memory.recordSuccessfulPrompt(
                        venue.id,
                        usedPrompt,
                        { eventCount: savedCount },
                        'perplexity'
                    );

                    // Log successful decision
                    this.memory.recordScrapingDecision({
                        agent: 'perplexity',
                        venueId: venue.id,
                        venueName: venue.name,
                        decision: 'extract_and_save',
                        reason: 'perplexity_found_valid_events',
                        outcome: 'success',
                        eventsFound: savedCount
                    });
                }
            } catch (error) {
                this.metrics.errors += 1;
                console.log(`   ❌ Error: ${error.message}`);

                // Learn from our failures too
                this.memory.recordError({
                    agent: 'perplexity',
                    venueId: venue.id,
                    venueName: venue.name,
                    errorType: 'scraping_error',
                    errorMessage: error.message,
                    tried: 'perplexity_api_call',
                    resolution: 'logged_for_ollama_to_learn'
                });

                this.memory.recordScrapingDecision({
                    agent: 'perplexity',
                    venueId: venue.id,
                    venueName: venue.name,
                    decision: 'failed_to_extract',
                    reason: error.message,
                    outcome: 'failed'
                });
            }

            console.log('');
        }

        await this.finalizeRun();
    }

    /**
     * Call Perplexity API
     */
    async scrapeVenueWithAI(venue) {
        if (!venue.website) {
            console.log('   ⚠️  No website URL available');
            return [];
        }

        const prompt = this.buildPrompt(venue);

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

            // Extract JSON
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const events = JSON.parse(jsonMatch[0]);
                return events.filter(e => this.validateEvent(e));
            } else {
                console.log('   ⚠️  No valid JSON found in Perplexity response');
                return [];
            }
        } catch (error) {
            console.log(`   ❌ Perplexity API Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Build prompt for Perplexity
     */
    buildPrompt(venue) {
        return `Extract upcoming events from ${venue.name} in ${venue.city}, Texas.

Website: ${venue.website}
${venue.facebook_url ? 'Facebook: ' + venue.facebook_url : ''}
${venue.description ? 'Description: ' + venue.description : ''}

Please search for current events at this venue and return a JSON array of events with this structure:
[
  {
    "title": "Event name",
    "date": "YYYY-MM-DD",
    "time": "HH:MM AM/PM or time range",
    "location": "${venue.name}",
    "city": "${venue.city}",
    "category": "${venue.category || 'Community Event'}",
    "description": "Brief description",
    "source_url": "URL where you found this event",
    "price": "Price if available",
    "ticket_url": "Ticket purchase URL if available",
    "image_url": "URL to event poster/image if available",
    "age_restriction": "Age restriction if any (e.g., '18+', 'All ages')"
  }
]

Only include events that are confirmed and upcoming (not past events).
Return valid JSON only, no additional text.`;
    }

    validateEvent(event) {
        return event.title &&
            event.date &&
            event.city &&
            event.title.length > 3;
    }

    isDuplicateLocally(event) {
        // Simple local check
        return false; // Full check happens on save
    }

    async isDuplicate(event) {
        return new Promise((resolve) => {
            this.db.get(
                'SELECT id FROM events WHERE title = ? AND date = ? AND LOWER(city) = LOWER(?)',
                [event.title, event.date, event.city],
                (err, row) => resolve(!!row)
            );
        });
    }

    async saveEvent(event, venue) {
        try {
            const isDupe = await this.isDuplicate(event);
            if (isDupe) {
                console.log(`   ⏭️  Skipping duplicate: ${event.title}`);
                this.metrics.duplicates += 1;
                return false;
            }

            // Add venue_id to event
            event.venue_id = venue.id;

            await axios.post(API_URL, event);
            console.log(`   💾 Saved: ${event.title}`);

            // Record successful extraction for Ollama to learn from
            this.memory.recordSuccessfulExtraction(
                venue.id,
                venue.name,
                event,
                'perplexity'
            );

            return true;
        } catch (error) {
            console.log(`   ⚠️  Failed to save: ${event.title}`);
            return false;
        }
    }

    /**
     * FINALIZE - Record metrics and sync
     */
    async finalizeRun() {
        const executionTime = Date.now() - this.startTime;

        console.log('\n🎉 PERPLEXITY SCRAPING COMPLETE\n');
        console.log('📊 PERFORMANCE METRICS:');
        console.log(`   Events scraped: ${this.metrics.eventsScraped}`);
        console.log(`   Duplicates detected: ${this.metrics.duplicates}`);
        console.log(`   Errors: ${this.metrics.errors}`);
        console.log(`   Execution time: ${(executionTime / 1000).toFixed(2)}s`);

        // Record metrics for comparison with Ollama
        this.memory.recordAgentPerformance('perplexity', {
            eventsScraped: this.metrics.eventsScraped,
            duplicates: this.metrics.duplicates,
            errors: this.metrics.errors,
            successRate: this.metrics.eventsScraped /
                (this.metrics.eventsScraped + this.metrics.duplicates + 1),
            executionTime: executionTime
        });

        // Sync to database
        await this.memory.syncMemoryToDatabase();

        // Show what we're teaching Ollama
        console.log('\n🧠 TEACHING OLLAMA:');
        const comparison = this.memory.getAgentComparison();
        console.log('   Agent Comparison:');
        for (const [agent, metrics] of Object.entries(comparison)) {
            console.log(`     ${agent}: ${(metrics.successRate * 100).toFixed(1)}% success rate`);
        }

        const insights = this.memory.generateLearningInsights();
        console.log(`   Top venues for learning: ${insights.topVenuesForLearning.map(v => v.name).join(', ')}`);

        console.log('\n✅ Ollama local agent will use this data on next run!\n');

        await this.memory.closeDatabase();
        this.db.close();
    }
}

// Run scraper
(async () => {
    const scraper = new PerplexityMemoryEnabledScraper();
    await scraper.initialize();
    await scraper.scrapeAll();
})().catch(console.error);
