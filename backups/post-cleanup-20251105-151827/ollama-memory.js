#!/usr/bin/env node

/**
 * OLLAMA SHARED MEMORY & LEARNING SYSTEM
 *
 * This module manages shared memory between:
 * - Perplexity (cloud AI scraper)
 * - Ollama Cloud Agent (if deployed)
 * - Ollama Local Agent (learns from both)
 *
 * The local Ollama learns successful scraping patterns, prompt refinements,
 * venue-specific knowledge, and error handling strategies.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const MEMORY_DIR = path.join(__dirname, 'memory');
const DB_PATH = path.join(__dirname, 'database.sqlite');

// Memory file locations
const MEMORY_FILES = {
    VENUE_PROFILES: path.join(MEMORY_DIR, 'venue-profiles.json'),
    PROMPT_TEMPLATES: path.join(MEMORY_DIR, 'prompt-templates.json'),
    EXTRACTION_PATTERNS: path.join(MEMORY_DIR, 'extraction-patterns.json'),
    SCRAPING_DECISIONS: path.join(MEMORY_DIR, 'scraping-decisions.json'),
    AGENT_PERFORMANCE: path.join(MEMORY_DIR, 'agent-performance.json'),
    ERROR_LOG: path.join(MEMORY_DIR, 'error-log.json'),
    SUCCESSFUL_EXTRACTIONS: path.join(MEMORY_DIR, 'successful-extractions.json'),
    LEARNING_INSIGHTS: path.join(MEMORY_DIR, 'learning-insights.json')
};

class OllamaMemorySystem {
    constructor() {
        this.ensureMemoryDir();
        this.db = new sqlite3.Database(DB_PATH);
    }

    /**
     * INITIALIZATION - Create memory directory and JSON files if they don't exist
     */
    ensureMemoryDir() {
        if (!fs.existsSync(MEMORY_DIR)) {
            fs.mkdirSync(MEMORY_DIR, { recursive: true });
            console.log(`📁 Created memory directory: ${MEMORY_DIR}`);
        }

        // Initialize all memory files with empty structures
        this.initializeFile(MEMORY_FILES.VENUE_PROFILES, {});
        this.initializeFile(MEMORY_FILES.PROMPT_TEMPLATES, {});
        this.initializeFile(MEMORY_FILES.EXTRACTION_PATTERNS, {});
        this.initializeFile(MEMORY_FILES.SCRAPING_DECISIONS, []);
        this.initializeFile(MEMORY_FILES.AGENT_PERFORMANCE, {});
        this.initializeFile(MEMORY_FILES.ERROR_LOG, []);
        this.initializeFile(MEMORY_FILES.SUCCESSFUL_EXTRACTIONS, []);
        this.initializeFile(MEMORY_FILES.LEARNING_INSIGHTS, []);
    }

    initializeFile(filePath, defaultValue) {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        }
    }

    // ==================== VENUE LEARNING ====================

    /**
     * Learn about a venue from Perplexity's successful scraping
     */
    learnVenueProfile(venueId, venueData, successfulEvents, agentName) {
        const profiles = this.readJSON(MEMORY_FILES.VENUE_PROFILES);

        if (!profiles[venueId]) {
            profiles[venueId] = {
                venueId,
                name: venueData.name,
                city: venueData.city,
                category: venueData.category,
                website: venueData.website,
                learningHistory: [],
                patterns: {
                    eventTitles: [],
                    eventTimes: [],
                    eventCategories: [],
                    eventDescriptionPatterns: []
                },
                successfulScrapesCount: 0,
                lastLearningFrom: null
            };
        }

        // Extract patterns from successful events
        for (const event of successfulEvents) {
            profiles[venueId].patterns.eventTitles.push(event.title);
            if (event.time) profiles[venueId].patterns.eventTimes.push(event.time);
            if (event.category) profiles[venueId].patterns.eventCategories.push(event.category);
            if (event.description) {
                profiles[venueId].patterns.eventDescriptionPatterns.push(
                    this.extractPattern(event.description)
                );
            }
        }

        // Keep only top 10 most recent examples (memory efficient)
        profiles[venueId].patterns.eventTitles =
            profiles[venueId].patterns.eventTitles.slice(-10);
        profiles[venueId].patterns.eventTimes =
            profiles[venueId].patterns.eventTimes.slice(-10);

        // Track learning source
        profiles[venueId].learningHistory.push({
            timestamp: new Date().toISOString(),
            agent: agentName,
            eventsLearned: successfulEvents.length
        });
        profiles[venueId].successfulScrapesCount += 1;
        profiles[venueId].lastLearningFrom = agentName;

        this.writeJSON(MEMORY_FILES.VENUE_PROFILES, profiles);
        console.log(`🧠 Learned venue profile for ${venueData.name} from ${agentName}`);
    }

    /**
     * Get venue profile for Ollama local to use
     */
    getVenueProfile(venueId) {
        const profiles = this.readJSON(MEMORY_FILES.VENUE_PROFILES);
        return profiles[venueId] || null;
    }

    /**
     * Get all venue profiles for batch learning
     */
    getAllVenueProfiles() {
        return this.readJSON(MEMORY_FILES.VENUE_PROFILES);
    }

    // ==================== PROMPT OPTIMIZATION ====================

    /**
     * Store a successful prompt that Perplexity used
     */
    recordSuccessfulPrompt(venueId, prompt, resultQuality, agentName) {
        const templates = this.readJSON(MEMORY_FILES.PROMPT_TEMPLATES);

        const key = `${venueId}_${agentName}`;
        if (!templates[key]) {
            templates[key] = {
                venueId,
                agent: agentName,
                prompts: [],
                bestPrompt: null,
                averageQuality: 0
            };
        }

        templates[key].prompts.push({
            timestamp: new Date().toISOString(),
            prompt: prompt,
            quality: resultQuality,
            eventCount: resultQuality.eventCount || 0
        });

        // Keep last 5 prompts
        if (templates[key].prompts.length > 5) {
            templates[key].prompts = templates[key].prompts.slice(-5);
        }

        // Find best prompt
        const bestPromptEntry = templates[key].prompts.reduce((best, current) =>
            current.quality > best.quality ? current : best
        );
        templates[key].bestPrompt = bestPromptEntry.prompt;
        templates[key].averageQuality =
            templates[key].prompts.reduce((sum, p) => sum + p.quality, 0) /
            templates[key].prompts.length;

        this.writeJSON(MEMORY_FILES.PROMPT_TEMPLATES, templates);
    }

    /**
     * Get best prompt for a venue (Ollama uses this)
     */
    getBestPromptForVenue(venueId, agentName = 'perplexity') {
        const templates = this.readJSON(MEMORY_FILES.PROMPT_TEMPLATES);
        const key = `${venueId}_${agentName}`;
        return templates[key]?.bestPrompt || null;
    }

    // ==================== EXTRACTION PATTERN LEARNING ====================

    /**
     * Learn extraction patterns from successful data parsing
     */
    learnExtractionPattern(venueId, htmlPattern, extractedData, agentName) {
        const patterns = this.readJSON(MEMORY_FILES.EXTRACTION_PATTERNS);

        if (!patterns[venueId]) {
            patterns[venueId] = {
                venueId,
                patterns: [],
                successRate: 0,
                totalAttempts: 0
            };
        }

        patterns[venueId].patterns.push({
            timestamp: new Date().toISOString(),
            agent: agentName,
            htmlPattern: htmlPattern,
            dataExtracted: extractedData,
                successCount: extractedData.length
        });

        // Keep last 10 patterns
        if (patterns[venueId].patterns.length > 10) {
            patterns[venueId].patterns = patterns[venueId].patterns.slice(-10);
        }

        patterns[venueId].totalAttempts += 1;
        patterns[venueId].successRate =
            patterns[venueId].patterns.filter(p => p.successCount > 0).length /
            patterns[venueId].totalAttempts;

        this.writeJSON(MEMORY_FILES.EXTRACTION_PATTERNS, patterns);
    }

    /**
     * Get extraction patterns for a venue
     */
    getExtractionPatterns(venueId) {
        const patterns = this.readJSON(MEMORY_FILES.EXTRACTION_PATTERNS);
        return patterns[venueId]?.patterns || [];
    }

    // ==================== DECISION LOGGING ====================

    /**
     * Log all major scraping decisions for learning
     */
    recordScrapingDecision(decision) {
        const decisions = this.readJSON(MEMORY_FILES.SCRAPING_DECISIONS);

        decisions.push({
            timestamp: new Date().toISOString(),
            agent: decision.agent,
            venueId: decision.venueId,
            venueName: decision.venueName,
            decision: decision.decision,
            reason: decision.reason,
            outcome: decision.outcome,
            eventsFound: decision.eventsFound || 0,
            duplicatesSkipped: decision.duplicatesSkipped || 0
        });

        // Keep last 10000 decisions
        if (decisions.length > 10000) {
            decisions.shift();
        }

        this.writeJSON(MEMORY_FILES.SCRAPING_DECISIONS, decisions);
    }

    /**
     * Analyze decision patterns to improve Ollama's future decisions
     */
    analyzeDecisionPatterns() {
        const decisions = this.readJSON(MEMORY_FILES.SCRAPING_DECISIONS);

        if (decisions.length === 0) return null;

        // Group by agent
        const byAgent = {};
        for (const decision of decisions.slice(-500)) { // Last 500 decisions
            if (!byAgent[decision.agent]) {
                byAgent[decision.agent] = { successful: 0, failed: 0, total: 0 };
            }
            byAgent[decision.agent].total += 1;
            if (decision.outcome === 'success') {
                byAgent[decision.agent].successful += 1;
            } else {
                byAgent[decision.agent].failed += 1;
            }
        }

        return byAgent;
    }

    // ==================== AGENT PERFORMANCE TRACKING ====================

    /**
     * Record performance metrics for each agent
     */
    recordAgentPerformance(agentName, metrics) {
        const performance = this.readJSON(MEMORY_FILES.AGENT_PERFORMANCE);

        if (!performance[agentName]) {
            performance[agentName] = {
                name: agentName,
                runs: [],
                totalEventsScraped: 0,
                totalDuplicatesDetected: 0,
                totalErrorsHandled: 0,
                averageSuccessRate: 0,
                costMetrics: {}
            };
        }

        performance[agentName].runs.push({
            timestamp: new Date().toISOString(),
            eventsScraped: metrics.eventsScraped || 0,
            duplicates: metrics.duplicates || 0,
            errors: metrics.errors || 0,
            successRate: metrics.successRate || 0,
            executionTime: metrics.executionTime || 0
        });

        // Keep last 30 runs
        if (performance[agentName].runs.length > 30) {
            performance[agentName].runs = performance[agentName].runs.slice(-30);
        }

        // Update aggregates
        performance[agentName].totalEventsScraped += metrics.eventsScraped || 0;
        performance[agentName].totalDuplicatesDetected += metrics.duplicates || 0;
        performance[agentName].totalErrorsHandled += metrics.errors || 0;
        performance[agentName].averageSuccessRate =
            performance[agentName].runs.reduce((sum, r) => sum + r.successRate, 0) /
            performance[agentName].runs.length;

        // Track costs if Perplexity
        if (agentName === 'perplexity' && metrics.apiCost) {
            if (!performance[agentName].costMetrics) performance[agentName].costMetrics = {};
            performance[agentName].costMetrics.lastCost = metrics.apiCost;
            performance[agentName].costMetrics.totalCost =
                (performance[agentName].costMetrics.totalCost || 0) + metrics.apiCost;
        }

        this.writeJSON(MEMORY_FILES.AGENT_PERFORMANCE, performance);
    }

    /**
     * Get performance comparison between agents
     */
    getAgentComparison() {
        const performance = this.readJSON(MEMORY_FILES.AGENT_PERFORMANCE);
        const comparison = {};

        for (const [agent, data] of Object.entries(performance)) {
            comparison[agent] = {
                successRate: data.averageSuccessRate,
                eventsScraped: data.totalEventsScraped,
                duplicateDetectionRate: data.totalDuplicatesDetected /
                    (data.totalEventsScraped + data.totalDuplicatesDetected || 1),
                errorHandlingRate: data.totalErrorsHandled
            };
        }

        return comparison;
    }

    // ==================== ERROR LEARNING ====================

    /**
     * Log errors for Ollama to learn from
     */
    recordError(error) {
        const errorLog = this.readJSON(MEMORY_FILES.ERROR_LOG);

        errorLog.push({
            timestamp: new Date().toISOString(),
            agent: error.agent,
            venueId: error.venueId,
            venueName: error.venueName,
            errorType: error.errorType,
            errorMessage: error.errorMessage,
            tried: error.tried,
            resolution: error.resolution
        });

        // Keep last 1000 errors
        if (errorLog.length > 1000) {
            errorLog.shift();
        }

        this.writeJSON(MEMORY_FILES.ERROR_LOG, errorLog);
    }

    /**
     * Get common error patterns and resolutions
     */
    getErrorPatterns() {
        const errorLog = this.readJSON(MEMORY_FILES.ERROR_LOG);
        const patterns = {};

        for (const error of errorLog.slice(-200)) {
            const key = error.errorType;
            if (!patterns[key]) {
                patterns[key] = {
                    count: 0,
                    resolutions: [],
                    lastOccurrence: null
                };
            }
            patterns[key].count += 1;
            if (error.resolution) {
                patterns[key].resolutions.push(error.resolution);
            }
            patterns[key].lastOccurrence = error.timestamp;
        }

        return patterns;
    }

    // ==================== SUCCESSFUL EXTRACTIONS DATABASE ====================

    /**
     * Store successful event extractions as training examples
     */
    recordSuccessfulExtraction(venueId, venueName, extractedEvent, agentName) {
        const extractions = this.readJSON(MEMORY_FILES.SUCCESSFUL_EXTRACTIONS);

        extractions.push({
            timestamp: new Date().toISOString(),
            agent: agentName,
            venueId,
            venueName,
            event: extractedEvent
        });

        // Keep last 5000 successful extractions
        if (extractions.length > 5000) {
            extractions.shift();
        }

        this.writeJSON(MEMORY_FILES.SUCCESSFUL_EXTRACTIONS, extractions);
    }

    /**
     * Get example extractions for a venue (for Ollama in-context learning)
     */
    getExtractionExamples(venueId, limit = 5) {
        const extractions = this.readJSON(MEMORY_FILES.SUCCESSFUL_EXTRACTIONS);
        return extractions
            .filter(e => e.venueId === venueId)
            .slice(-limit)
            .map(e => e.event);
    }

    // ==================== LEARNING INSIGHTS ====================

    /**
     * Generate insights from all learned data
     */
    generateLearningInsights() {
        const insights = {
            timestamp: new Date().toISOString(),
            topVenuesForLearning: this.getTopVenuesForLearning(),
            agentComparison: this.getAgentComparison(),
            commonErrors: this.getErrorPatterns(),
            bestPerformingVenues: this.getBestPerformingVenues(),
            recommendedFocusAreas: this.getRecommendedFocusAreas()
        };

        // Append to insights log
        const insightLog = this.readJSON(MEMORY_FILES.LEARNING_INSIGHTS);
        insightLog.push(insights);

        // Keep last 90 days of insights
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const filtered = insightLog.filter(i =>
            new Date(i.timestamp) > ninetyDaysAgo
        );

        this.writeJSON(MEMORY_FILES.LEARNING_INSIGHTS, filtered);
        return insights;
    }

    getTopVenuesForLearning() {
        const profiles = this.readJSON(MEMORY_FILES.VENUE_PROFILES);
        return Object.values(profiles)
            .sort((a, b) => b.successfulScrapesCount - a.successfulScrapesCount)
            .slice(0, 10)
            .map(v => ({ name: v.name, learns: v.successfulScrapesCount }));
    }

    getBestPerformingVenues() {
        const profiles = this.readJSON(MEMORY_FILES.VENUE_PROFILES);
        return Object.values(profiles)
            .filter(v => v.successfulScrapesCount >= 3)
            .slice(0, 10)
            .map(v => v.name);
    }

    getRecommendedFocusAreas() {
        const decisions = this.readJSON(MEMORY_FILES.SCRAPING_DECISIONS);
        const failedVenues = {};

        for (const decision of decisions.slice(-300)) {
            if (decision.outcome === 'failed') {
                if (!failedVenues[decision.venueId]) {
                    failedVenues[decision.venueId] = { name: decision.venueName, count: 0 };
                }
                failedVenues[decision.venueId].count += 1;
            }
        }

        return Object.values(failedVenues)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    // ==================== FILE I/O UTILITIES ====================

    readJSON(filePath) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (error) {
            console.warn(`⚠️  Error reading ${filePath}, returning empty`);
            return {};
        }
    }

    writeJSON(filePath, data) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`❌ Error writing to ${filePath}:`, error.message);
        }
    }

    // ==================== PATTERN EXTRACTION ====================

    extractPattern(text) {
        // Extract common patterns from description text
        return text.substring(0, 50) + (text.length > 50 ? '...' : '');
    }

    // ==================== DATABASE INTEGRATION ====================

    /**
     * Sync memory with database for backup
     */
    syncMemoryToDatabase() {
        return new Promise((resolve) => {
            // Create memory_snapshots table if it doesn't exist
            this.db.run(`
                CREATE TABLE IF NOT EXISTS memory_snapshots (
                    id INTEGER PRIMARY KEY,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    snapshot_type TEXT,
                    snapshot_data TEXT
                )
            `, () => {
                // Store current insights
                const insights = this.generateLearningInsights();
                this.db.run(
                    'INSERT INTO memory_snapshots (snapshot_type, snapshot_data) VALUES (?, ?)',
                    ['learning_insights', JSON.stringify(insights)],
                    () => resolve()
                );
            });
        });
    }

    // ==================== CLEANUP ====================

    closeDatabase() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) console.error('Error closing database:', err);
                else console.log('✅ Memory database closed');
                resolve();
            });
        });
    }
}

module.exports = OllamaMemorySystem;
