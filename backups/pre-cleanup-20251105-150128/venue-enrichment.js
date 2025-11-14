#!/usr/bin/env node

/**
 * VENUE ENRICHMENT SCRIPT
 *
 * Enriches venue data with:
 * - Complete addresses
 * - Phone numbers
 * - Email addresses
 * - Social media URLs (Facebook, Instagram)
 * - Logo URLs
 * - Latitude/Longitude for mapping
 * - Website information
 *
 * Run: PERPLEXITY_API_KEY="..." node venue-enrichment.js
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const API_URL = 'http://localhost:3001/api';
const DB_PATH = path.join(__dirname, 'database.sqlite');

class VenueEnricher {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.stats = {
            processed: 0,
            enriched: 0,
            errors: 0
        };
    }

    async initialize() {
        console.log('\n📍 VENUE ENRICHMENT SCRIPT');
        console.log('==========================\n');

        if (!PERPLEXITY_API_KEY) {
            console.error('❌ ERROR: PERPLEXITY_API_KEY not set!');
            console.error('Set: export PERPLEXITY_API_KEY="your-key"\n');
            process.exit(1);
        }

        // Test API connection
        try {
            await axios.post('https://api.perplexity.ai/chat/completions', {
                model: 'sonar',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 10
            }, {
                headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}` }
            });
            console.log('✅ Perplexity API connected\n');
        } catch (error) {
            console.error('❌ Perplexity API error:', error.message);
            process.exit(1);
        }
    }

    /**
     * Get all venues that need enrichment
     */
    async getVenuesToEnrich() {
        return new Promise((resolve) => {
            this.db.all(
                'SELECT * FROM venues WHERE is_active = 1 ORDER BY priority DESC',
                (err, rows) => {
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Enrich a single venue with Perplexity
     */
    async enrichVenue(venue) {
        console.log(`\n📍 Enriching: ${venue.name} (${venue.city})`);

        const prompt = `Find complete contact and location information for ${venue.name} in ${venue.city}, Texas.

Please search and provide:
{
  "address": "Full street address",
  "phone": "Phone number",
  "email": "Email address",
  "facebook_url": "Facebook page URL if exists",
  "instagram_handle": "Instagram handle (@username) if exists",
  "website": "Official website URL if not already known",
  "latitude": "Latitude coordinate (if available)",
  "longitude": "Longitude coordinate (if available)",
  "logo_url": "URL to venue logo image if available",
  "cover_image_url": "URL to venue header/cover image if available",
  "hours": "Business hours if available"
}

Return ONLY valid JSON, no explanation.`;

        try {
            const response = await axios.post(
                'https://api.perplexity.ai/chat/completions',
                {
                    model: 'sonar',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a venue research assistant. Find accurate venue contact and location information. Return ONLY valid JSON with no additional text.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 1500
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
                console.log('   ⚠️  No JSON found in response');
                return null;
            }

            const enrichData = JSON.parse(jsonMatch[0]);
            console.log('   ✅ Found details:');
            if (enrichData.address) console.log(`      Address: ${enrichData.address}`);
            if (enrichData.phone) console.log(`      Phone: ${enrichData.phone}`);
            if (enrichData.email) console.log(`      Email: ${enrichData.email}`);
            if (enrichData.facebook_url) console.log(`      Facebook: ✓`);
            if (enrichData.instagram_handle) console.log(`      Instagram: ✓`);

            return enrichData;
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            this.stats.errors++;
            return null;
        }
    }

    /**
     * Update venue with enriched data
     */
    async updateVenue(venue, enrichData) {
        return new Promise((resolve) => {
            const updates = [];
            const values = [];

            // Build dynamic update query
            if (enrichData.address && !venue.address) {
                updates.push('address = ?');
                values.push(enrichData.address);
            }
            if (enrichData.phone && !venue.phone) {
                updates.push('phone = ?');
                values.push(enrichData.phone);
            }
            if (enrichData.email && !venue.email) {
                updates.push('email = ?');
                values.push(enrichData.email);
            }
            if (enrichData.facebook_url && !venue.facebook_url) {
                updates.push('facebook_url = ?');
                values.push(enrichData.facebook_url);
            }
            if (enrichData.instagram_handle && !venue.instagram_url) {
                updates.push('instagram_url = ?');
                values.push(enrichData.instagram_handle);
            }
            if (enrichData.website && !venue.website) {
                updates.push('website = ?');
                values.push(enrichData.website);
            }
            if (enrichData.logo_url && !venue.logo_url) {
                updates.push('logo_url = ?');
                values.push(enrichData.logo_url);
            }
            if (enrichData.cover_image_url && !venue.cover_image_url) {
                updates.push('cover_image_url = ?');
                values.push(enrichData.cover_image_url);
            }

            if (updates.length === 0) {
                console.log('   ℹ️  No new data to update');
                resolve(false);
                return;
            }

            values.push(venue.id);
            const query = `UPDATE venues SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

            this.db.run(query, values, function(err) {
                if (err) {
                    console.log(`   ❌ Failed to update: ${err.message}`);
                    resolve(false);
                } else {
                    console.log(`   💾 Updated ${updates.length} field(s)`);
                    resolve(true);
                }
            });
        });
    }

    /**
     * Run enrichment for all venues
     */
    async enrichAll() {
        const venues = await this.getVenuesToEnrich();
        console.log(`📊 Found ${venues.length} venues to enrich\n`);
        console.log('Processing venues...\n');

        for (const venue of venues) {
            this.stats.processed++;

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));

            const enrichData = await this.enrichVenue(venue);
            if (enrichData) {
                const updated = await this.updateVenue(venue, enrichData);
                if (updated) {
                    this.stats.enriched++;
                }
            }
        }

        console.log('\n✅ ENRICHMENT COMPLETE\n');
        console.log('📊 Summary:');
        console.log(`   Processed: ${this.stats.processed}`);
        console.log(`   Enriched: ${this.stats.enriched}`);
        console.log(`   Errors: ${this.stats.errors}\n`);

        this.db.close();
    }
}

// Run enrichment
(async () => {
    const enricher = new VenueEnricher();
    await enricher.initialize();
    await enricher.enrichAll();
})().catch(console.error);
