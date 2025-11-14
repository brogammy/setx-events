#!/usr/bin/env node

/**
 * CLOUD-BASED EVENT VALIDATOR WITH MEMORY
 *
 * Uses Perplexity Cloud Model + Memory-Based Few-Shot Learning
 *
 * How it works:
 * 1. n8n scrapes raw events
 * 2. Sends to this validator
 * 3. Validator queries memory system for successful examples
 * 4. Feeds examples to Perplexity as "steady directives"
 * 5. Perplexity refines/validates/enriches the event data
 * 6. Returns cleaned, enriched event
 *
 * This gives cloud models "memory" without fine-tuning.
 * Benefits:
 * - ✅ Fast (cloud inference)
 * - ✅ Learns from your past successes
 * - ✅ No GPU needed
 * - ✅ Instant improvement as memory grows
 *
 * Run: PERPLEXITY_API_KEY="your-key" node event-validator-cloud.js
 * Listen: http://localhost:3003/api/validate
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'YOUR_API_KEY_HERE';
const MEMORY_DIR = path.join(__dirname, 'memory-system');

/**
 * Load successful examples from memory
 */
function loadMemoryExamples() {
    try {
        const successPath = path.join(MEMORY_DIR, 'successful-extractions.json');
        if (fs.existsSync(successPath)) {
            const data = JSON.parse(fs.readFileSync(successPath, 'utf8'));
            // Return top 3 successful examples
            return (data.extractions || []).slice(0, 3).map(ext => ext.event);
        }
    } catch (error) {
        console.error('Error loading memory:', error.message);
    }
    return [];
}

/**
 * Load guard rails from memory (what to avoid)
 */
function loadGuardRails() {
    try {
        const errorsPath = path.join(MEMORY_DIR, 'error-log.json');
        if (fs.existsSync(errorsPath)) {
            const data = JSON.parse(fs.readFileSync(errorsPath, 'utf8'));
            // Return patterns to avoid
            return (data.errors || []).slice(0, 3).map(err => err.pattern);
        }
    } catch (error) {
        console.error('Error loading guard rails:', error.message);
    }
    return [];
}

/**
 * Build prompt with memory-based few-shot examples
 */
function buildValidationPrompt(event, successExamples, guardRails) {
    let prompt = `You are an event validator and enricher. Your job is to:
1. Validate event data
2. Remove spam/invalid events
3. Fill in missing fields intelligently
4. Ensure data quality

STEADY DIRECTIVES (RULES - ALWAYS FOLLOW):
- Reject events with spam indicators (viagra, crypto, MLM, etc)
- Reject events with past dates (before today)
- Reject generic titles ("event", "community event", etc)
- Only accept events from SETX cities: Beaumont, Port Arthur, Orange, Hardin, Jefferson, Jasper
- Date format MUST be YYYY-MM-DD
- If price is missing, estimate based on event type
- If time is missing, suggest reasonable time for event type
- If description is missing, create brief (2-3 sentence) description

SUCCESSFUL EXAMPLES (learn from these):
`;

    // Add successful examples
    successExamples.forEach((ex, i) => {
        prompt += `\nExample ${i + 1}:
${JSON.stringify(ex, null, 2)}
`;
    });

    prompt += `
PATTERNS TO AVOID (based on past failures):
`;

    guardRails.forEach((rail, i) => {
        prompt += `\n${i + 1}. ${rail}`;
    });

    prompt += `

EVENT TO VALIDATE:
${JSON.stringify(event, null, 2)}

VALIDATE AND ENRICH this event. Return ONLY valid JSON with:
- All original fields
- Any filled-in missing fields
- A "valid" boolean field
- A "notes" field explaining any changes

Return ONLY JSON, no markdown or additional text.`;

    return prompt;
}

/**
 * Validate event with Perplexity using memory-based few-shot learning
 */
async function validateEventWithMemory(event) {
    try {
        if (PERPLEXITY_API_KEY === 'YOUR_API_KEY_HERE') {
            return {
                valid: false,
                reason: 'Perplexity API key not configured',
                event: event
            };
        }

        // Load memory examples and guard rails
        const successExamples = loadMemoryExamples();
        const guardRails = loadGuardRails();

        // Build prompt with memory context
        const prompt = buildValidationPrompt(event, successExamples, guardRails);

        console.log(`\n🔍 Validating: ${event.title} (with memory-based examples)`);

        // Call Perplexity with memory examples in prompt
        const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
                model: 'sonar', // Fast cloud model
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert event validator and data enricher. You always follow the steady directives provided. Return only valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.2, // Low temperature for consistency
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            return {
                valid: false,
                reason: 'No valid JSON response from model',
                event: event
            };
        }

        const validated = JSON.parse(jsonMatch[0]);

        if (validated.valid === false) {
            console.log(`   ❌ REJECTED: ${validated.notes || 'Failed validation'}`);
            return {
                valid: false,
                reason: validated.notes || 'Validation failed',
                event: event
            };
        }

        console.log(`   ✅ APPROVED`);

        // Record successful validation in memory
        recordSuccessfulValidation(event, validated);

        return {
            valid: true,
            event: validated,
            notes: validated.notes || 'Validated successfully'
        };
    } catch (error) {
        console.error(`   ⚠️  Validation error: ${error.message}`);
        return {
            valid: false,
            reason: error.message,
            event: event
        };
    }
}

/**
 * Record successful validation in memory
 */
function recordSuccessfulValidation(original, validated) {
    try {
        const successPath = path.join(MEMORY_DIR, 'successful-extractions.json');
        let data = { extractions: [] };

        if (fs.existsSync(successPath)) {
            data = JSON.parse(fs.readFileSync(successPath, 'utf8'));
        }

        // Keep only last 50
        data.extractions = [
            {
                timestamp: new Date().toISOString(),
                event: validated,
                changes: {
                    original_title: original.title,
                    final_title: validated.title,
                    fields_filled: Object.keys(validated).length - Object.keys(original).length
                }
            },
            ...data.extractions.slice(0, 49)
        ];

        fs.writeFileSync(successPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error recording success:', error.message);
    }
}

/**
 * Single event validation endpoint
 */
app.post('/api/validate', async (req, res) => {
    const event = req.body;

    if (!event.title || !event.date || !event.city) {
        return res.status(400).json({
            valid: false,
            reason: 'Missing required fields: title, date, city',
            event: event
        });
    }

    const result = await validateEventWithMemory(event);
    const statusCode = result.valid ? 200 : 400;
    res.status(statusCode).json(result);
});

/**
 * Batch validation endpoint (for n8n)
 */
app.post('/api/validate-batch', async (req, res) => {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    console.log(`\n🔄 Batch validating ${events.length} events with memory...`);

    const results = {
        total: events.length,
        approved: [],
        rejected: []
    };

    for (const event of events) {
        const result = await validateEventWithMemory(event);

        if (result.valid) {
            results.approved.push(result.event);
        } else {
            results.rejected.push({
                event: event,
                reason: result.reason
            });
        }
    }

    console.log(`   ✅ ${results.approved.length} approved, ❌ ${results.rejected.length} rejected`);

    res.json(results);
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
    const memoryExamples = loadMemoryExamples();
    res.json({
        status: 'ok',
        service: 'cloud-event-validator',
        model: 'Perplexity sonar',
        memory_examples_available: memoryExamples.length,
        timestamp: new Date().toISOString()
    });
});

/**
 * Memory status endpoint
 */
app.get('/api/memory-status', (req, res) => {
    const examples = loadMemoryExamples();
    const guards = loadGuardRails();

    res.json({
        successful_examples: examples.length,
        guard_rails: guards.length,
        recent_examples: examples.slice(0, 2),
        timestamp: new Date().toISOString()
    });
});

/**
 * START SERVER
 */
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('☁️  CLOUD-BASED EVENT VALIDATOR');
    console.log('   (Perplexity + Memory-Based Few-Shot)');
    console.log(`   Model: Perplexity sonar (fast)`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Memory: http://localhost:${PORT}/api/memory-status`);
    console.log('========================================\n');

    if (PERPLEXITY_API_KEY === 'YOUR_API_KEY_HERE') {
        console.log('⚠️  WARNING: Perplexity API key not set!');
        console.log('   Set: export PERPLEXITY_API_KEY="pplx-..."');
    }
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down validator...');
    process.exit(0);
});
