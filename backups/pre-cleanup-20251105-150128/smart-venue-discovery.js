#!/usr/bin/env node

/**
 * SETX Events - Smart Venue Discovery Agent
 * 
 * - Discovers new venues using Perplexity AI
 * - Adds venues to database
 * - Automatically creates n8n workflow nodes for each venue
 * - Updates your n8n workflow file
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'YOUR_API_KEY_HERE';
const DB_PATH = path.join(__dirname, 'database.sqlite');
const N8N_WORKFLOW_PATH = path.join(__dirname, 'n8n-workflows/setx-workflow-two-merges.json');
const API_URL = 'http://localhost:3001/api/events';

const SETX_CITIES = ['Beaumont', 'Port Arthur', 'Orange', 'Nederland', 'Vidor', 'Silsbee'];

class SmartVenueDiscovery {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.newVenues = [];
        this.workflow = null;
    }

    async initialize() {
        console.log('🤖 SETX Smart Venue Discovery & Integration');
        console.log('===========================================\n');
        
        // Load existing n8n workflow
        if (fs.existsSync(N8N_WORKFLOW_PATH)) {
            this.workflow = JSON.parse(fs.readFileSync(N8N_WORKFLOW_PATH, 'utf8'));
            console.log('✅ Loaded n8n workflow\n');
        } else {
            console.log('⚠️  n8n workflow not found - will create venue list only\n');
        }
    }

    async discoverAll() {
        let totalDiscovered = 0;

        for (const city of SETX_CITIES) {
            console.log(`📍 Discovering venues in ${city}...`);
            
            const venues = await this.discoverVenuesInCity(city);
            console.log(`   ✅ Found ${venues.length} potential venues`);
            
            for (const venue of venues) {
                const saved = await this.saveVenue(venue);
                if (saved) {
                    totalDiscovered++;
                    this.newVenues.push(venue);
                }
            }
            
            console.log('');
            await this.sleep(2000); // Rate limiting
        }

        // Update n8n workflow with new venues
        if (this.newVenues.length > 0 && this.workflow) {
            console.log(`\n🔧 Updating n8n workflow with ${this.newVenues.length} new venues...`);
            await this.updateN8nWorkflow();
        }

        console.log(`\n🎉 Discovery complete!`);
        console.log(`   New venues added: ${totalDiscovered}`);
        console.log(`   Total venues in database: ${await this.getTotalVenues()}`);
        
        this.db.close();
    }

    async discoverVenuesInCity(city) {
        const prompt = `Find event venues in ${city}, Texas with websites or event calendars.

Search for venues that regularly host public events:
- Performance venues, theaters, concert halls
- Museums, galleries, cultural centers  
- Restaurants/bars with live music or events
- Parks and outdoor event spaces
- Community centers, recreation centers
- Churches with public events
- Sports facilities

For each venue found, return JSON with:
{
  "name": "Venue name",
  "address": "Street address",
  "city": "${city}",
  "category": "Type of venue",
  "website": "Official website URL with event calendar or events page",
  "facebook_url": "Facebook page URL if found",
  "phone": "Phone number if available",
  "description": "Brief description",
  "has_event_calendar": true if they have an events page/calendar,
  "cover_image_url": "Direct URL to high-quality photo of the venue from their website or business directory. Must be HTTP/HTTPS",
  "logo_url": "Direct URL to venue logo if available, otherwise same as cover_image_url"
}

Return JSON array of 5-8 real, currently operating venues with event calendars.
Only include venues that actually exist and have websites.
Return valid JSON only, no explanation.`;

        try {
            const response = await axios.post(
                'https://api.perplexity.ai/chat/completions',
                {
                    model: 'sonar',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a local venue discovery expert. Search the web for real venues with event calendars. Return only valid JSON with accurate information.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 3000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices[0].message.content;
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            
            if (jsonMatch) {
                const venues = JSON.parse(jsonMatch[0]);
                return venues.filter(v => this.validateVenue(v));
            } else {
                console.log(`   ⚠️  No valid JSON found for ${city}`);
                return [];
            }
        } catch (error) {
            console.log(`   ❌ API Error: ${error.message}`);
            return [];
        }
    }

    validateVenue(venue) {
        return venue.name && 
               venue.city && 
               venue.website &&
               venue.name.length > 2 &&
               !venue.name.toLowerCase().includes('example');
    }

    async isDuplicate(venue) {
        return new Promise((resolve) => {
            this.db.get(
                'SELECT id FROM venues WHERE name = ? AND city = ?',
                [venue.name, venue.city],
                (err, row) => resolve(!!row)
            );
        });
    }

    async saveVenue(venue) {
        try {
            const isDupe = await this.isDuplicate(venue);
            if (isDupe) {
                console.log(`   ⏭️  Already exists: ${venue.name}`);
                return false;
            }

            return new Promise((resolve) => {
                const priority = venue.has_event_calendar ? 8 : 5;
                
                this.db.run(
                    `INSERT INTO venues (name, address, city, category, website, facebook_url, phone, description, priority, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        venue.name,
                        venue.address || '',
                        venue.city,
                        venue.category || 'Community Venue',
                        venue.website || '',
                        venue.facebook_url || '',
                        venue.phone || '',
                        venue.description || '',
                        priority
                    ],
                    function(err) {
                        if (err) {
                            console.log(`   ⚠️  Failed to save: ${venue.name}`);
                            resolve(false);
                        } else {
                            console.log(`   💾 Added: ${venue.name}`);
                            resolve(true);
                        }
                    }
                );
            });
        } catch (error) {
            return false;
        }
    }

    async updateN8nWorkflow() {
        // Add new scraper and parser nodes for each venue
        let nodesAdded = 0;
        const lastNodePosition = this.getLastNodePosition();

        for (let i = 0; i < this.newVenues.length; i++) {
            const venue = this.newVenues[i];
            const nodeId = `scrape-${venue.name.toLowerCase().replace(/\s+/g, '-')}`;
            const parseId = `parse-${venue.name.toLowerCase().replace(/\s+/g, '-')}`;

            // Create scraper node
            const scraperNode = {
                parameters: {
                    url: venue.website,
                    options: {}
                },
                name: `Scrape ${venue.name}`,
                type: 'n8n-nodes-base.httpRequest',
                typeVersion: 3,
                position: [450, lastNodePosition + (i * 200)],
                id: nodeId
            };

            // Create parser node
            const parserNode = {
                parameters: {
                    jsCode: this.generateParserCode(venue)
                },
                name: `Parse ${venue.name} Events`,
                type: 'n8n-nodes-base.code',
                typeVersion: 2,
                position: [650, lastNodePosition + (i * 200)],
                id: parseId
            };

            // Add nodes to workflow
            this.workflow.nodes.push(scraperNode);
            this.workflow.nodes.push(parserNode);

            // Connect trigger to scraper
            if (!this.workflow.connections['Daily at 6am'].main[0].find(c => c.node === scraperNode.name)) {
                this.workflow.connections['Daily at 6am'].main[0].push({
                    node: scraperNode.name,
                    type: 'main',
                    index: 0
                });
            }

            // Connect scraper to parser
            this.workflow.connections[scraperNode.name] = {
                main: [[{
                    node: parserNode.name,
                    type: 'main',
                    index: 0
                }]]
            };

            // Connect parser to final merge
            this.workflow.connections[parserNode.name] = {
                main: [[{
                    node: 'Merge with Orange',
                    type: 'main',
                    index: 1
                }]]
            };

            nodesAdded++;
        }

        // Save updated workflow
        const backupPath = N8N_WORKFLOW_PATH + '.backup';
        fs.copyFileSync(N8N_WORKFLOW_PATH, backupPath);
        fs.writeFileSync(N8N_WORKFLOW_PATH, JSON.stringify(this.workflow, null, 2));

        console.log(`   ✅ Added ${nodesAdded} new scraper nodes to workflow`);
        console.log(`   📄 Workflow updated: ${N8N_WORKFLOW_PATH}`);
        console.log(`   💾 Backup saved: ${backupPath}`);
        console.log(`\n   ⚠️  Re-import the workflow in n8n to see new nodes!`);
    }

    getLastNodePosition() {
        const positions = this.workflow.nodes.map(n => n.position[1]);
        return Math.max(...positions) + 200;
    }

    generateParserCode(venue) {
        return `// Parse ${venue.name} Events (AI-generated)
const html = $input.item.json.data;
const events = [];

// Generic event pattern - adjust based on actual HTML
const eventPattern = /<div[^>]*class="[^"]*event[^"]*"[^>]*>([\\s\\S]{0,500}?)<\\/div>/gi;
let match;

while ((match = eventPattern.exec(html)) !== null) {
  const eventHtml = match[1];
  
  const titleMatch = /<h[1-4][^>]*>([^<]+)<\\/h[1-4]>/i.exec(eventHtml);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  const dateMatch = /<time[^>]*datetime="([^"]+)"/i.exec(eventHtml) || 
                    /([0-9]{1,2}\\/[0-9]{1,2}\\/[0-9]{2,4})/i.exec(eventHtml);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
  
  if (title && title.length > 3) {
    events.push({
      title: title,
      date: date,
      time: '',
      location: '${venue.name}',
      city: '${venue.city}',
      category: '${venue.category}',
      description: title,
      source_url: '${venue.website}'
    });
  }
}

return events.map(event => ({ json: event }));`;
    }

    async getTotalVenues() {
        return new Promise((resolve) => {
            this.db.get('SELECT COUNT(*) as count FROM venues WHERE is_active = 1', (err, row) => {
                resolve(row ? row.count : 0);
            });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Check for API key
if (!PERPLEXITY_API_KEY || PERPLEXITY_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('❌ ERROR: Perplexity API key not set!');
    console.error('Set: export PERPLEXITY_API_KEY="pplx-..."');
    process.exit(1);
}

// Run discovery
(async () => {
    const agent = new SmartVenueDiscovery();
    await agent.initialize();
    await agent.discoverAll();
})().catch(console.error);

