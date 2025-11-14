#!/usr/bin/env node

/**
 * PERPLEXITY VENUE DISCOVERY
 *
 * Uses Perplexity API to automatically discover and research venues
 * across all SE Texas cities. Populates venue database with complete
 * information including contact details, websites, and social media.
 *
 * Run: PERPLEXITY_API_KEY="your-key" node perplexity-venue-discovery.js
 */

const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const API_URL = 'http://localhost:3001/api/venues/import';
const DB_PATH = path.join(__dirname, 'database.sqlite');

const SETX_CITIES = [
    { name: 'Beaumont', population: 'large' },
    { name: 'Port Arthur', population: 'medium' },
    { name: 'Orange', population: 'medium' },
    { name: 'Nederland', population: 'small' },
    { name: 'Vidor', population: 'small' },
    { name: 'Silsbee', population: 'small' }
];

class PerplexityVenueDiscovery {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.allVenues = [];
        this.stats = {
            discovered: 0,
            imported: 0,
            failed: 0,
            duplicates: 0
        };
    }

    async initialize() {
        console.log('\n🎭 PERPLEXITY VENUE DISCOVERY - SE TEXAS');
        console.log('========================================\n');

        if (!PERPLEXITY_API_KEY) {
            console.error('❌ ERROR: PERPLEXITY_API_KEY not set!');
            console.error('Set: export PERPLEXITY_API_KEY="your-key"');
            process.exit(1);
        }

        // Check API connection
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
     * Discover venues for a single city
     */
    async discoverCityVenues(city) {
        console.log(`\n🔍 Discovering venues in ${city.name}...`);

        const prompt = `You are a comprehensive local venue research expert. Find ALL event venues in ${city.name}, Texas.

Include venues that host any type of public events:
- Theaters, performing arts venues, concert halls
- Music venues, bars, restaurants with live music
- Museums, galleries, cultural centers
- Community centers, recreation centers, parks
- Hotels with event spaces
- Churches/religious centers with events
- Sports facilities, arenas
- Convention centers, banquet halls
- Night clubs, entertainment venues
- Outdoor venues, amphitheaters

For EACH venue found, return complete JSON with:
{
  "name": "Official venue name",
  "address": "Full street address",
  "city": "${city.name}",
  "category": "Venue type (Music Venue, Theater, Museum, etc.)",
  "website": "Official website URL if exists",
  "facebook_url": "Facebook page URL if exists",
  "instagram_url": "@handle or Instagram URL if exists",
  "phone": "Phone number if available",
  "email": "Contact email if available",
  "description": "1-2 sentences about the venue",
  "priority": 8 (if major venue), 6 (if mid-tier), 4 (if smaller),
  "cover_image_url": "Direct URL to a high-quality photo of the venue from their website, Google Images, or business directory. Must be HTTP/HTTPS URL",
  "logo_url": "Direct URL to venue logo if available, otherwise use same as cover_image_url"
}

IMPORTANT:
- Only include real, currently operating venues
- Verify information is current
- Don't include closed/defunct venues
- Don't include non-venue businesses
- Format: Return ONLY valid JSON array, no explanation

Target: 12-20 venues per city`;

        try {
            const response = await axios.post(
                'https://api.perplexity.ai/chat/completions',
                {
                    model: 'sonar',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a thorough venue research assistant. Find comprehensive, accurate information about event venues. Return ONLY valid JSON arrays with no additional text or explanation.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 4000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices[0].message.content;

            // Extract JSON from response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.log(`⚠️  No JSON found in response for ${city.name}`);
                return [];
            }

            const venues = JSON.parse(jsonMatch[0]);
            console.log(`✅ Found ${venues.length} venues in ${city.name}`);

            // Validate and clean venues
            return venues
                .filter(v => this.validateVenue(v, city.name))
                .map(v => this.cleanVenue(v, city.name));

        } catch (error) {
            console.log(`❌ Error discovering ${city.name}: ${error.message}`);
            return [];
        }
    }

    /**
     * Validate venue data
     */
    validateVenue(venue, city) {
        // Must have name and be in correct city
        if (!venue.name || venue.name.length < 3) return false;
        if (!venue.city || venue.city.toLowerCase() !== city.toLowerCase()) return false;

        // Reject obviously invalid entries
        if (venue.name.toLowerCase().includes('test')) return false;
        if (venue.name.toLowerCase().includes('example')) return false;
        if (venue.name.toLowerCase().includes('sample')) return false;

        return true;
    }

    /**
     * Clean and standardize venue data
     */
    cleanVenue(venue, city) {
        return {
            name: venue.name?.trim() || '',
            address: venue.address?.trim() || '',
            city: city.trim(),
            category: venue.category?.trim() || 'Community Venue',
            website: this.cleanUrl(venue.website),
            facebook_url: this.cleanUrl(venue.facebook_url),
            instagram_url: venue.instagram_url?.trim() || '',
            phone: venue.phone?.trim() || '',
            email: venue.email?.trim() || '',
            description: venue.description?.trim() || '',
            priority: parseInt(venue.priority) || 5
        };
    }

    /**
     * Clean and validate URLs
     */
    cleanUrl(url) {
        if (!url) return '';
        url = url.trim();
        if (!url.includes('://')) {
            if (url.includes('facebook')) return `https://www.facebook.com/${url.replace(/@|www\.facebook\.com\//g, '')}`;
            return `https://${url}`;
        }
        return url;
    }

    /**
     * Check if venue already exists in database
     */
    async isDuplicate(venue) {
        return new Promise((resolve) => {
            this.db.get(
                'SELECT id FROM venues WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?)',
                [venue.name, venue.city],
                (err, row) => resolve(!!row)
            );
        });
    }

    /**
     * Discover all cities
     */
    async discoverAllCities() {
        console.log('\n📍 Starting comprehensive venue discovery for all SE Texas cities...\n');

        for (const city of SETX_CITIES) {
            const venues = await this.discoverCityVenues(city);
            this.allVenues.push(...venues);

            // Rate limiting - be nice to Perplexity API
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`\n✅ Discovery complete! Found ${this.allVenues.length} total venues\n`);
    }

    /**
     * Remove duplicates from discovered venues
     */
    async deduplicateVenues() {
        console.log('🔍 Checking for duplicates...\n');

        const unique = [];
        const seen = new Set();

        for (const venue of this.allVenues) {
            const key = `${venue.name.toLowerCase()}_${venue.city.toLowerCase()}`;
            if (seen.has(key)) {
                this.stats.duplicates++;
            } else {
                seen.add(key);
                unique.push(venue);
            }
        }

        this.allVenues = unique;
        console.log(`✅ Removed ${this.stats.duplicates} duplicates. ${this.allVenues.length} venues remaining\n`);
    }

    /**
     * Import venues to database via API
     */
    async importVenuesToDatabase() {
        console.log('📥 Importing venues to database...\n');

        try {
            const response = await axios.post(API_URL, {
                venues: this.allVenues
            });

            const result = response.data;
            this.stats.imported = result.imported;
            this.stats.failed = result.failed;

            console.log(`✅ Imported ${result.imported} venues`);
            if (result.failed > 0) {
                console.log(`⚠️  ${result.failed} failed to import`);
                if (result.errors) {
                    result.errors.slice(0, 3).forEach(err => {
                        console.log(`   - ${err.venue}: ${err.error}`);
                    });
                }
            }
        } catch (error) {
            console.log(`❌ Import error: ${error.message}`);
            console.log('📝 Falling back to direct database insertion...');
            await this.insertVenuesDirect();
        }
    }

    /**
     * Direct database insertion (fallback)
     */
    async insertVenuesDirect() {
        return new Promise((resolve) => {
            const stmt = this.db.prepare(`
                INSERT INTO venues (
                    name, address, city, category, website, facebook_url,
                    instagram_url, phone, email, description, priority, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `);

            for (const venue of this.allVenues) {
                stmt.run(
                    venue.name,
                    venue.address,
                    venue.city,
                    venue.category,
                    venue.website,
                    venue.facebook_url,
                    venue.instagram_url,
                    venue.phone,
                    venue.email,
                    venue.description,
                    venue.priority,
                    (err) => {
                        if (!err) {
                            this.stats.imported++;
                        } else {
                            this.stats.failed++;
                        }
                    }
                );
            }

            stmt.finalize(() => {
                console.log(`✅ Direct insert: ${this.stats.imported} venues added\n`);
                resolve();
            });
        });
    }

    /**
     * Verify import
     */
    async verifyImport() {
        return new Promise((resolve) => {
            this.db.get(
                `SELECT COUNT(*) as total FROM venues WHERE is_active = 1`,
                (err, row) => {
                    const total = row?.total || 0;
                    console.log(`📊 Database verification:`);
                    console.log(`   Total venues in database: ${total}`);
                    resolve(total);
                }
            );
        });
    }

    /**
     * Get summary by city
     */
    async getSummaryByCity() {
        return new Promise((resolve) => {
            this.db.all(
                `SELECT city, COUNT(*) as count FROM venues WHERE is_active = 1 GROUP BY city ORDER BY count DESC`,
                (err, rows) => {
                    console.log(`\n📍 Venues by city:`);
                    rows?.forEach(row => {
                        console.log(`   ${row.city}: ${row.count} venues`);
                    });
                    resolve();
                }
            );
        });
    }

    /**
     * Main execution
     */
    async run() {
        try {
            await this.initialize();
            await this.discoverAllCities();
            await this.deduplicateVenues();
            await this.importVenuesToDatabase();

            const totalVenues = await this.verifyImport();
            await this.getSummaryByCity();

            console.log(`\n🎉 DISCOVERY COMPLETE!`);
            console.log(`\n📊 Summary:`);
            console.log(`   Venues discovered: ${this.allVenues.length}`);
            console.log(`   Imported: ${this.stats.imported}`);
            console.log(`   Failed: ${this.stats.failed}`);
            console.log(`   Duplicates removed: ${this.stats.duplicates}`);
            console.log(`   Total in database: ${totalVenues}`);

            console.log(`\n✅ Next step: Run Perplexity scraper on all venues:`);
            console.log(`   PERPLEXITY_API_KEY="..." node ai-scraper-memory-enabled.js`);
            console.log(`\n📚 Then train Ollama:`);
            console.log(`   node ollama-agent-learner.js\n`);

            this.db.close();
        } catch (error) {
            console.error('Fatal error:', error);
            this.db.close();
            process.exit(1);
        }
    }
}

// Run the discovery
const discovery = new PerplexityVenueDiscovery();
discovery.run().catch(console.error);
