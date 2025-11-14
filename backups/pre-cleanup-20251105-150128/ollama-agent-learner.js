#!/usr/bin/env node

/**
 * OLLAMA LOCAL AGENT - LEARNER & SCRAPER
 *
 * This is an evolved version of the Ollama scraper that:
 * 1. Learns from Perplexity's successful scrapes
 * 2. Applies learned patterns to improve its own scraping
 * 3. Shares its discoveries back to the memory system
 * 4. Improves over time with each run
 *
 * Run with: node ollama-agent-learner.js
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const OllamaMemorySystem = require('./ollama-memory');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const API_URL = 'http://localhost:3001/api/events';
const DB_PATH = path.join(__dirname, 'database.sqlite');

class OllamaAgentLearner {
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
            successfulExtractions: 0
        };
    }

    async initialize() {
        console.log('🤖 OLLAMA AGENT LEARNER - Starting Intelligent Scraping');
        console.log('========================================================\n');

        // Check if Ollama is running
        try {
            await axios.get(`${OLLAMA_URL}/api/tags`);
            console.log('✅ Ollama is running');
        } catch (error) {
            console.error('❌ Ollama is not running!');
            console.error('Start it with: ollama serve\n');
            process.exit(1);
        }

        await this.loadVenues();
        console.log(`📍 Loaded ${this.venues.length} venues\n`);

        // Show learning insights from previous runs
        this.showLearningInsights();
    }

    showLearningInsights() {
        const insights = this.memory.generateLearningInsights();
        console.log('📚 LEARNING INSIGHTS FROM PREVIOUS RUNS:');
        console.log(`   Top venues for learning: ${insights.topVenuesForLearning.map(v => v.name).join(', ')}`);
        if (insights.commonErrors && Object.keys(insights.commonErrors).length > 0) {
            console.log(`   ⚠️  Common errors to avoid: ${Object.keys(insights.commonErrors).slice(0, 3).join(', ')}`);
        }
        console.log('');
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

    /**
     * MAIN SCRAPING LOOP - Uses learned patterns
     */
    async scrapeAll() {
        console.log('🔍 SCRAPING WITH LEARNED PATTERNS\n');

        for (const venue of this.venues) {
            this.metrics.venuesProcessed += 1;

            console.log(`📍 ${venue.name} (${venue.city})`);

            try {
                // Get what we learned about this venue
                const venueProfile = this.memory.getVenueProfile(venue.id);
                const extractionExamples = this.memory.getExtractionExamples(venue.id, 3);

                console.log(`   📚 Using ${extractionExamples.length} learned examples`);

                // Scrape with learned context
                const events = await this.scrapeVenueWithLearnedContext(
                    venue,
                    venueProfile,
                    extractionExamples
                );

                console.log(`   ✅ Found ${events.length} events`);

                // Save events and learn from success
                for (const event of events) {
                    const saved = await this.saveEvent(event, venue);
                    if (saved) {
                        this.metrics.eventsScraped += 1;
                        // Record successful extraction for future learning
                        this.memory.recordSuccessfulExtraction(
                            venue.id,
                            venue.name,
                            event,
                            'ollama-local'
                        );
                        this.memory.recordScrapingDecision({
                            agent: 'ollama-local',
                            venueId: venue.id,
                            venueName: venue.name,
                            decision: 'extract_and_save',
                            reason: 'matched_learned_pattern',
                            outcome: 'success',
                            eventsFound: 1
                        });
                        this.metrics.successfulExtractions += 1;
                    }
                }
            } catch (error) {
                this.metrics.errors += 1;
                console.log(`   ❌ Error: ${error.message}`);
                this.memory.recordError({
                    agent: 'ollama-local',
                    venueId: venue.id,
                    venueName: venue.name,
                    errorType: 'scraping_error',
                    errorMessage: error.message,
                    tried: 'scrape_with_learned_context',
                    resolution: 'logged_for_analysis'
                });
            }

            console.log('');
        }

        // Learn from this run and record metrics
        await this.finalizeRun();
    }

    /**
     * ENHANCED SCRAPING - Uses learned venue profiles and examples
     */
    async scrapeVenueWithLearnedContext(venue, venueProfile, extractionExamples) {
        const sourceUrl = venue.website || venue.facebook_url || '';

        if (!sourceUrl) {
            console.log('   ⚠️  No URL available');
            return [];
        }

        // Build intelligent prompt using what we learned
        const prompt = this.buildIntelligentPrompt(venue, venueProfile, extractionExamples);

        try {
            const response = await axios.post(
                `${OLLAMA_URL}/api/generate`,
                {
                    model: 'llama3.1',
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.5, // Lower than before - more focused on learned patterns
                        num_predict: 1200
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
            throw error;
        }
    }

    /**
     * BUILD SMART PROMPT with learned context
     */
    buildIntelligentPrompt(venue, venueProfile, extractionExamples) {
        let prompt = `You are an expert event extractor for ${venue.name} in ${venue.city}, Texas.

VENUE CONTEXT:
- Name: ${venue.name}
- Type: ${venue.category}
- Website: ${venue.website || venue.facebook_url || 'Unknown'}
${venue.description ? '- About: ' + venue.description : ''}
`;

        // Add what we learned about this venue
        if (venueProfile) {
            prompt += `\nLEARNED PATTERNS FOR THIS VENUE:
Successful event titles: ${venueProfile.patterns.eventTitles.slice(0, 3).join(', ') || 'None yet'}
Common event times: ${venueProfile.patterns.eventTimes.slice(0, 3).join(', ') || 'Varies'}
Categories: ${venueProfile.patterns.eventCategories.slice(0, 3).join(', ') || 'Various'}
Previous successful scrapes: ${venueProfile.successfulScrapesCount}
Last learned from: ${venueProfile.lastLearningFrom}
`;
        }

        // Add extraction examples for in-context learning
        if (extractionExamples && extractionExamples.length > 0) {
            prompt += `\nSUCCESSFUL EXTRACTION EXAMPLES FROM THIS VENUE:
${extractionExamples.map((ex, i) => `
Example ${i + 1}:
- Title: ${ex.title}
- Date: ${ex.date}
- Time: ${ex.time}
- Category: ${ex.category}
- Description: ${ex.description}
`).join('\n')}

Use these examples as templates for what we're looking for.
`;
        }

        prompt += `
TASK: Extract upcoming events for the next 30 days, following the patterns above.

Return a JSON array with this exact structure:
[
  {
    "title": "Event name (realistic, similar to learned patterns)",
    "date": "YYYY-MM-DD (within next 30 days)",
    "time": "HH:MM AM/PM or time range (or empty string)",
    "location": "${venue.name}",
    "city": "${venue.city}",
    "category": "${venue.category}",
    "description": "Brief description matching the style of learned examples",
    "source_url": "${venue.website || venue.facebook_url || ''}"
  }
]

Guidelines:
- Look for events matching the learned patterns
- Generate 1-3 realistic events
- Follow the date/time format strictly
- Return ONLY valid JSON, no explanation`;

        return prompt;
    }

    /**
     * Validate and save event
     */
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
                'SELECT id FROM events WHERE LOWER(title) = LOWER(?) AND date = ? AND LOWER(city) = LOWER(?)',
                [event.title, event.date, event.city],
                (err, row) => resolve(!!row)
            );
        });
    }

    async saveEvent(event, venue) {
        try {
            const isDupe = await this.isDuplicate(event);
            if (isDupe) {
                console.log(`   ⏭️  Duplicate: ${event.title}`);
                this.metrics.duplicates += 1;
                return false;
            }

            await axios.post(API_URL, event);
            console.log(`   💾 Saved: ${event.title}`);
            return true;
        } catch (error) {
            console.log(`   ⚠️  Failed to save: ${event.title}`);
            this.metrics.errors += 1;
            return false;
        }
    }

    /**
     * Finalize run - record metrics and learn from performance
     */
    async finalizeRun() {
        const executionTime = Date.now() - this.startTime;

        console.log('\n🎉 SCRAPING COMPLETE - RECORDING LEARNING\n');
        console.log('📊 PERFORMANCE METRICS:');
        console.log(`   Events scraped: ${this.metrics.eventsScraped}`);
        console.log(`   Duplicates detected: ${this.metrics.duplicates}`);
        console.log(`   Errors: ${this.metrics.errors}`);
        console.log(`   Successful extractions: ${this.metrics.successfulExtractions}`);
        console.log(`   Execution time: ${(executionTime / 1000).toFixed(2)}s`);
        console.log(`   Success rate: ${((this.metrics.eventsScraped / (this.metrics.eventsScraped + this.metrics.duplicates + this.metrics.errors || 1)) * 100).toFixed(1)}%`);

        // Record metrics for learning
        const successRate = this.metrics.eventsScraped /
            (this.metrics.eventsScraped + this.metrics.duplicates + 1);

        this.memory.recordAgentPerformance('ollama-local', {
            eventsScraped: this.metrics.eventsScraped,
            duplicates: this.metrics.duplicates,
            errors: this.metrics.errors,
            successRate: successRate,
            executionTime: executionTime
        });

        // Sync memory to database backup
        await this.memory.syncMemoryToDatabase();

        console.log('\n✅ Metrics recorded and memory synchronized');
        console.log('🧠 Memory system will improve future scraping runs\n');

        await this.memory.closeDatabase();
        this.db.close();
    }
}

// Run the learner
(async () => {
    const agent = new OllamaAgentLearner();
    await agent.initialize();
    await agent.scrapeAll();
})().catch(console.error);
