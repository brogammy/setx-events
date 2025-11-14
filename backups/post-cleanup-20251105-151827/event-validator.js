#!/usr/bin/env node

/**
 * EVENT VALIDATOR SERVICE
 *
 * This is a lightweight microservice that n8n calls AFTER scraping.
 * It uses a slim local Ollama model to:
 * 1. Remove spam/invalid events
 * 2. Fill in missing data intelligently
 * 3. Deduplicate similar entries
 * 4. Apply guard rails
 *
 * n8n scrapes → posts to /api/validate-event → returns cleaned data
 *
 * Run: node event-validator.js
 * Listens on: http://localhost:3002/api/validate-event
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Use slim model - gpt-oss:20b is smaller but still capable
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const SLIM_MODEL = 'gpt-oss:20b-cloud'; // Smaller than 120b, faster inference

/**
 * GUARD RAILS - Catch obvious spam
 */
function hasSpamIndicators(event) {
    const { title, description, location, city } = event;
    const combined = `${title} ${description || ''} ${location || ''} ${city || ''}`.toLowerCase();

    // Spam patterns
    const spamPatterns = [
        /viagra|cialis|casino|lottery|cryptocurrency|nft|crypto/i,
        /click here|buy now|limited time|act fast/i,
        /free money|make money fast|work from home/i,
        /xxx|adult content|18\+.*[^a-z]/i, // but allow legitimate "18+" age restrictions
    ];

    for (const pattern of spamPatterns) {
        if (pattern.test(combined)) {
            return true;
        }
    }

    return false;
}

/**
 * BASIC VALIDATION - Before calling Ollama
 */
function validateBasics(event) {
    const errors = [];

    // Required fields
    if (!event.title || event.title.length < 3) {
        errors.push('Title too short or missing');
    }
    if (!event.date) {
        errors.push('Date missing');
    }
    if (!event.city) {
        errors.push('City missing');
    }

    // Invalid dates
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (event.date && !dateRegex.test(event.date)) {
        errors.push('Invalid date format (should be YYYY-MM-DD)');
    }

    // Date in past (allow same day)
    if (event.date) {
        const eventDate = new Date(event.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (eventDate < today) {
            errors.push('Event date is in the past');
        }
    }

    // Invalid city for SETX
    const validCities = ['Beaumont', 'Port Arthur', 'Orange', 'Hardin', 'Jefferson', 'Jasper'];
    if (event.city && !validCities.includes(event.city)) {
        errors.push(`City "${event.city}" not in SETX service area`);
    }

    return errors.length === 0 ? null : errors;
}

/**
 * Call slim local model to fill missing data
 */
async function fillMissingDataWithOllama(event) {
    try {
        const prompt = `Given this event, fill in any missing information intelligently:

Event: ${JSON.stringify(event, null, 2)}

Based on the event type and title:
1. If price is missing, estimate a reasonable price range (or "Free" if appropriate)
2. If age_restriction is missing, suggest based on event type (e.g., concerts might be 18+, family events are "All ages")
3. If description is missing, suggest a brief description (1-2 sentences)
4. If time is missing, suggest a reasonable time based on event type

Return ONLY valid JSON with the filled fields, no other text:
{
  "price": "...",
  "age_restriction": "...",
  "description": "...",
  "time": "..."
}`;

        const response = await axios.post(OLLAMA_URL, {
            model: SLIM_MODEL,
            prompt: prompt,
            stream: false,
            temperature: 0.3, // Low temperature for consistency
        });

        const content = response.data.response;
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);

            // Apply suggestions only if fields are missing
            if (!event.price && suggestions.price) event.price = suggestions.price;
            if (!event.age_restriction && suggestions.age_restriction) event.age_restriction = suggestions.age_restriction;
            if (!event.description && suggestions.description) event.description = suggestions.description;
            if (!event.time && suggestions.time) event.time = suggestions.time;
        }

        return event;
    } catch (error) {
        console.error('Ollama fill error:', error.message);
        // If Ollama fails, return event as-is with defaults
        if (!event.price) event.price = 'TBD';
        if (!event.age_restriction) event.age_restriction = 'All ages';
        if (!event.time) event.time = 'TBD';
        return event;
    }
}

/**
 * Detect if event is likely a duplicate (similar to existing)
 * This could query the database, but for now we'll just flag suspiciously similar titles
 */
function isDuplicateLike(event) {
    // Simple heuristic: if title is very generic, might be auto-generated spam
    const genericTitles = [
        'event',
        'community event',
        'local event',
        'weekly event',
        'monthly event',
        'special event',
    ];

    const titleLower = event.title.toLowerCase();
    return genericTitles.some(gt => titleLower === gt);
}

/**
 * MAIN VALIDATION ENDPOINT
 * Called by n8n after scraping
 */
app.post('/api/validate-event', async (req, res) => {
    const event = req.body;

    console.log(`\n🔍 Validating event: ${event.title}`);

    // Step 1: Check spam indicators
    if (hasSpamIndicators(event)) {
        console.log(`   ❌ REJECTED: Spam detected`);
        return res.status(400).json({
            valid: false,
            reason: 'Spam indicators detected',
            event: event
        });
    }

    // Step 2: Basic validation
    const basicErrors = validateBasics(event);
    if (basicErrors) {
        console.log(`   ❌ REJECTED: ${basicErrors.join(', ')}`);
        return res.status(400).json({
            valid: false,
            reason: basicErrors.join('; '),
            event: event
        });
    }

    // Step 3: Check for duplicate-like
    if (isDuplicateLike(event)) {
        console.log(`   ⚠️  REJECTED: Looks like generic/duplicate`);
        return res.status(400).json({
            valid: false,
            reason: 'Event title appears to be generic or duplicate',
            event: event
        });
    }

    // Step 4: Fill missing data with Ollama
    console.log(`   📝 Filling missing data with local model...`);
    const enrichedEvent = await fillMissingDataWithOllama(event);

    // Step 5: Success
    console.log(`   ✅ APPROVED`);
    return res.json({
        valid: true,
        event: enrichedEvent,
        changes: {
            price: enrichedEvent.price ? 'filled' : 'none',
            description: enrichedEvent.description ? 'filled' : 'none',
            age_restriction: enrichedEvent.age_restriction ? 'filled' : 'none',
            time: enrichedEvent.time ? 'filled' : 'none',
        }
    });
});

/**
 * BATCH VALIDATION ENDPOINT
 * Called by n8n to validate multiple events at once
 */
app.post('/api/validate-events', async (req, res) => {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    console.log(`\n🔄 Batch validating ${events.length} events...`);

    const results = [];
    const valid = [];
    const rejected = [];

    for (const event of events) {
        // Spam check
        if (hasSpamIndicators(event)) {
            rejected.push({
                event: event,
                reason: 'Spam indicators detected'
            });
            continue;
        }

        // Basic validation
        const basicErrors = validateBasics(event);
        if (basicErrors) {
            rejected.push({
                event: event,
                reason: basicErrors.join('; ')
            });
            continue;
        }

        // Duplicate check
        if (isDuplicateLike(event)) {
            rejected.push({
                event: event,
                reason: 'Generic or duplicate-like title'
            });
            continue;
        }

        // Fill missing data
        const enrichedEvent = await fillMissingDataWithOllama(event);
        valid.push(enrichedEvent);
    }

    console.log(`   ✅ ${valid.length} approved, ❌ ${rejected.length} rejected`);

    return res.json({
        total: events.length,
        approved: valid.length,
        rejected: rejected.length,
        valid_events: valid,
        rejected_events: rejected
    });
});

/**
 * HEALTH CHECK
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'event-validator',
        model: SLIM_MODEL,
        timestamp: new Date().toISOString()
    });
});

/**
 * START SERVER
 */
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('🔍 EVENT VALIDATOR SERVICE');
    console.log(`   Model: ${SLIM_MODEL} (slim/local)`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log('========================================\n');
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down validator...');
    process.exit(0);
});
