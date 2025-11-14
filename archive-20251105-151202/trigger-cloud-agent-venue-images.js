#!/usr/bin/env node

/**
 * TRIGGER CLOUD AGENT FOR VENUE IMAGE DISCOVERY
 *
 * Sends a task to the cloud-venue-discovery-agent to find and download
 * real venue images and store them locally
 */

const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const CLOUD_AGENT_PORT = 3006; // Cloud venue discovery agent port

const db = new sqlite3.Database(DB_PATH);

function sendToCloudAgent(task) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(task);

        const options = {
            hostname: 'localhost',
            port: CLOUD_AGENT_PORT,
            path: '/task',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            },
            timeout: 30000
        };

        const req = http.request(options, (res) => {
            let response = '';
            res.on('data', (chunk) => { response += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(response);
                    resolve(result);
                } catch (e) {
                    resolve({ status: 'sent', message: 'Task sent to cloud agent' });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.abort();
            reject(new Error('Cloud agent timeout'));
        });

        req.write(data);
        req.end();
    });
}

async function triggerImageDiscovery() {
    console.log('\n🚀 TRIGGERING CLOUD AGENT FOR VENUE IMAGES');
    console.log('==========================================\n');

    return new Promise((resolve) => {
        db.all(
            'SELECT id, name, city, category FROM venues WHERE is_active = 1 ORDER BY priority DESC',
            async (err, venues) => {
                if (err || !venues) {
                    console.error('Database error');
                    db.close();
                    return resolve();
                }

                console.log(`Found ${venues.length} venues to process\n`);

                const task = {
                    type: 'venue_image_discovery',
                    priority: 'high',
                    action: 'find_and_download_venue_images',
                    config: {
                        storage_type: 'local',
                        storage_path: '/home/sauly/setx-events/public/images/venues',
                        database_path: '/home/sauly/setx-events/database.sqlite',
                        image_format: 'jpg',
                        min_image_size: 5000, // bytes
                        max_parallel: 3
                    },
                    venues: venues.map(v => ({
                        id: v.id,
                        name: v.name,
                        city: v.city,
                        category: v.category
                    })),
                    callback_url: 'http://localhost:3001/api/admin/venue-images-completed',
                    timestamp: new Date().toISOString()
                };

                console.log('📤 Sending task to cloud agent...');
                console.log(`   Venues: ${venues.length}`);
                console.log(`   Action: Find and download real venue images locally\n`);

                try {
                    const response = await sendToCloudAgent(task);
                    console.log('✅ Task sent successfully');
                    console.log('   Cloud agent will:');
                    console.log('   1. Find real image URLs for each venue');
                    console.log('   2. Download images locally');
                    console.log('   3. Update database with local paths');
                    console.log('   4. Run in parallel for speed\n');
                } catch (err) {
                    console.log('⚠️  Cloud agent not responding');
                    console.log('   Make sure cloud-venue-discovery-agent.js is running');
                    console.log(`   On port ${CLOUD_AGENT_PORT}\n`);
                }

                db.close();
                resolve();
            }
        );
    });
}

triggerImageDiscovery().then(() => process.exit(0));
