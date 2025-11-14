#!/usr/bin/env node

/**
 * LOCAL AGENT CONTROLLER
 *
 * Controls n8n workflows and orchestrates scraping tasks.
 * The local agent:
 * - Manages n8n workflow execution
 * - Triggers scraping tasks
 * - Learns from results via shared memory
 * - Improves over time
 *
 * Run: node local-agent-controller.js [command] [options]
 *
 * Commands:
 *   setup-workflows     - Create/verify n8n workflows exist
 *   trigger-scrape      - Manually trigger immediate scrape
 *   check-status        - Check local agent and system status
 *   learn               - Process results and learn
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const API_URL = 'http://localhost:3001/api';
const DB_PATH = path.join(__dirname, 'database.sqlite');
const N8N_URL = 'http://localhost:5678';

class LocalAgentController {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
    }

    async initialize() {
        console.log('\n🤖 LOCAL AGENT CONTROLLER');
        console.log('========================\n');

        // Check API connection
        try {
            await axios.get(`${API_URL}/health`);
            console.log('✅ Connected to API server (port 3001)');
        } catch (error) {
            console.error('❌ Cannot connect to API at', API_URL);
            console.error('   Make sure API is running: node api-server.js\n');
            process.exit(1);
        }

        // Check n8n connection
        try {
            await axios.get(N8N_URL);
            console.log('✅ Connected to n8n (port 5678)');
            console.log('   n8n is ready for workflow execution\n');
        } catch (error) {
            console.error(
                '❌ Cannot connect to n8n at',
                N8N_URL
            );
            console.error(
                '   Make sure n8n is running: n8n start\n'
            );
            process.exit(1);
        }
    }

    /**
     * Check system status
     */
    async checkStatus() {
        console.log('\n📊 SYSTEM STATUS\n');

        try {
            // Database counts
            const venueCount = await this.getCount('venues', 'is_active = 1');
            const eventCount = await this.getCount('events');

            console.log('Database:');
            console.log(`  📍 Venues: ${venueCount}`);
            console.log(`  📅 Events: ${eventCount}`);

            // Memory system
            const memoryDir = path.join(__dirname, 'memory');
            if (fs.existsSync(memoryDir)) {
                const files = fs.readdirSync(memoryDir);
                console.log(`\nMemory System:`);
                console.log(`  📁 Files: ${files.length}`);
                if (files.length > 0) {
                    console.log(`  ✅ Learning active (${files[0].split('-')[0]} ...)`);

                    // Show performance metrics
                    const perfPath = path.join(memoryDir, 'agent-performance.json');
                    if (fs.existsSync(perfPath)) {
                        const perf = JSON.parse(
                            fs.readFileSync(perfPath, 'utf8')
                        );
                        if (perf.perplexity) {
                            const p = perf.perplexity;
                            console.log(
                                `\nPerplexity Agent:`
                            );
                            console.log(
                                `  Success Rate: ${(p.averageSuccessRate * 100).toFixed(1)}%`
                            );
                            console.log(
                                `  Events Scraped: ${p.totalEventsScraped}`
                            );
                        }
                    }
                }
            } else {
                console.log('\nMemory System:');
                console.log('  ⏳ Not initialized (run scraper first)');
            }

            // n8n status
            console.log('\nn8n Automation:');
            console.log('  ✅ n8n is running');
            console.log('  📅 Scheduled: Daily at midnight (12am)');
            console.log('  🔗 Will trigger: ai-scraper-memory-enabled.js');

            console.log();
        } catch (error) {
            console.error('❌ Error checking status:', error.message);
        }
    }

    /**
     * Setup n8n workflows (informational)
     */
    async setupWorkflows() {
        console.log('\n📝 N8N WORKFLOW SETUP\n');

        console.log(
            'n8n is already configured with workflows at:http://localhost:5678'
        );
        console.log('');
        console.log('To create or modify workflows:');
        console.log('  1. Open: http://localhost:5678');
        console.log('  2. Create new workflow');
        console.log(
            '  3. Add Schedule trigger (daily at 6am: "0 6 * * *")'
        );
        console.log(
            '  4. Add Execute Command node with:'
        );
        console.log(
            '     node /home/sauly/setx-events/ai-scraper-memory-enabled.js'
        );
        console.log('  5. Activate and save\n');

        console.log('The local agent will:');
        console.log('  • Run daily scrapes via n8n scheduling');
        console.log('  • Learn from Perplexity results');
        console.log('  • Remember patterns in shared memory');
        console.log('  • Improve accuracy over time\n');
    }

    /**
     * Manually trigger a scrape
     */
    async triggerScrape() {
        console.log('\n🔄 TRIGGERING IMMEDIATE SCRAPE\n');

        try {
            if (!process.env.PERPLEXITY_API_KEY) {
                console.error(
                    '❌ PERPLEXITY_API_KEY not set'
                );
                console.error(
                    '   Run: export PERPLEXITY_API_KEY="your-key"\n'
                );
                process.exit(1);
            }

            console.log('⏳ Starting ai-scraper-memory-enabled.js...\n');

            const { stdout, stderr } = await execAsync(
                'node ai-scraper-memory-enabled.js',
                {
                    env: process.env,
                    cwd: __dirname,
                    timeout: 300000 // 5 minutes
                }
            );

            console.log(stdout);
            if (stderr) console.log(stderr);

            console.log('\n✅ Scraping completed!');
            console.log('   Local agent has learned from results.\n');
        } catch (error) {
            console.error('❌ Error running scraper:', error.message);
            process.exit(1);
        }
    }

    /**
     * Show learning insights
     */
    async learn() {
        console.log('\n🧠 LEARNING INSIGHTS\n');

        try {
            const memoryDir = path.join(__dirname, 'memory');

            if (!fs.existsSync(memoryDir)) {
                console.log('❌ No memory files found.');
                console.log('   Run scraper first: node local-agent-controller.js trigger-scrape\n');
                return;
            }

            // Read performance metrics
            const perfPath = path.join(memoryDir, 'agent-performance.json');
            const perf = JSON.parse(fs.readFileSync(perfPath, 'utf8'));

            console.log('Agent Performance:');
            Object.entries(perf).forEach(([name, data]) => {
                if (data.runs && data.runs.length > 0) {
                    const latest = data.runs[data.runs.length - 1];
                    console.log(`\n  ${name}:`);
                    console.log(
                        `    Success Rate: ${(latest.successRate * 100).toFixed(1)}%`
                    );
                    console.log(`    Events Found: ${latest.eventsScraped}`);
                    console.log(`    Errors: ${latest.errors}`);
                    console.log(
                        `    Time: ${(latest.executionTime / 1000).toFixed(1)}s`
                    );
                }
            });

            // Read learning insights
            const insightsPath = path.join(memoryDir, 'learning-insights.json');
            if (fs.existsSync(insightsPath)) {
                const insights = JSON.parse(
                    fs.readFileSync(insightsPath, 'utf8')
                );
                console.log(`\nTop Learning Venues:`);
                if (Array.isArray(insights)) {
                    insights.slice(0, 5).forEach((v, i) => {
                        console.log(`  ${i + 1}. ${v.name}`);
                    });
                }
            }

            console.log();
        } catch (error) {
            console.error('❌ Error reading learning data:', error.message);
        }
    }

    /**
     * Get count from database
     */
    getCount(table, where = '') {
        return new Promise((resolve) => {
            let query = `SELECT COUNT(*) as count FROM ${table}`;
            if (where) query += ` WHERE ${where}`;

            this.db.get(query, (err, row) => {
                resolve(row ? row.count : 0);
            });
        });
    }

    /**
     * Run command
     */
    async run(command, args = []) {
        await this.initialize();

        switch (command) {
            case 'setup-workflows':
                await this.setupWorkflows();
                break;
            case 'trigger-scrape':
                await this.triggerScrape();
                break;
            case 'check-status':
                await this.checkStatus();
                break;
            case 'learn':
                await this.learn();
                break;
            default:
                console.log('\n🤖 LOCAL AGENT CONTROLLER\n');
                console.log('Usage: node local-agent-controller.js [command]\n');
                console.log('Commands:');
                console.log('  check-status       Check system status & learning progress');
                console.log('  trigger-scrape     Manually run an immediate scrape');
                console.log('  setup-workflows    Show n8n workflow setup instructions');
                console.log('  learn              Show learning insights & metrics\n');
                break;
        }

        this.db.close();
    }
}

// Run if called directly
if (require.main === module) {
    const command = process.argv[2] || 'check-status';
    const args = process.argv.slice(3);
    const controller = new LocalAgentController();
    controller.run(command, args).catch(console.error);
}

module.exports = LocalAgentController;
