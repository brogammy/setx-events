/**
 * Image Enricher - Adds actual images to events
 *
 * Simple, direct approach:
 * 1. Gets events without images
 * 2. Calls image research tool
 * 3. Updates database with found images
 * 4. Runs on demand + can be scheduled
 *
 * No n8n dependency - works immediately
 */

const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const https = require('https');

// ============================================================================
// CONFIG
// ============================================================================

const CONFIG = {
  DB_PATH: '/home/sauly/setx-events/database.sqlite',
  IMAGE_TOOL_URL: 'http://localhost:3004',
  PORT: 3007,
  BATCH_SIZE: 10,
  RETRY_DELAY: 1000,
  MAX_RETRIES: 2
};

// ============================================================================
// LOGGING
// ============================================================================

const logger = {
  log: (level, msg, data) => {
    console.log(`[${new Date().toISOString()}] ${level}: ${msg}`, data || '');
  },
  info: (msg, data) => logger.log('INFO', msg, data),
  warn: (msg, data) => logger.log('WARN', msg, data),
  error: (msg, data) => logger.log('ERROR', msg, data),
  success: (msg, data) => logger.log('SUCCESS', msg, data)
};

// ============================================================================
// DATABASE
// ============================================================================

const db = new sqlite3.Database(CONFIG.DB_PATH, (err) => {
  if (err) {
    logger.error('Database error', err.message);
    process.exit(1);
  }
  logger.info('Connected to database');
});

// ============================================================================
// HTTP HELPER
// ============================================================================

const makeRequest = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : {}
          });
        } catch (err) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000);

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

// ============================================================================
// IMAGE RESEARCH
// ============================================================================

const getImageForEvent = async (event) => {
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3004,
      path: '/mcp/claude/research-event-images',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: event.title,
      venue_name: event.location || event.city,
      category: event.category || 'Music',
      date: event.date
    });

    if (response.status === 200 && response.body.imageUrls && response.body.imageUrls.length > 0) {
      return response.body.imageUrls[0];
    }
    return null;
  } catch (error) {
    logger.warn(`Failed to get image for "${event.title}"`, error.message);
    return null;
  }
};

// ============================================================================
// ENRICHMENT
// ============================================================================

const enrichEvents = async () => {
  return new Promise((resolve, reject) => {
    logger.info('Starting image enrichment...');

    // Get events without images
    db.all(
      'SELECT id, title, location, city, category, date FROM events WHERE image_url IS NULL LIMIT ?',
      [CONFIG.BATCH_SIZE],
      async (err, events) => {
        if (err) {
          logger.error('Query error', err.message);
          return reject(err);
        }

        if (!events || events.length === 0) {
          logger.info('No events need images');
          return resolve({ processed: 0, successful: 0, failed: 0 });
        }

        logger.info(`Found ${events.length} events without images`);

        let successful = 0;
        let failed = 0;

        for (const event of events) {
          try {
            logger.info(`Processing: "${event.title}"`);
            const imageUrl = await getImageForEvent(event);

            if (imageUrl) {
              // Update database
              db.run(
                'UPDATE events SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [imageUrl, event.id],
                function(err) {
                  if (err) {
                    logger.error(`Failed to update event ${event.id}`, err.message);
                    failed++;
                  } else {
                    logger.success(`Added image: "${event.title}"`);
                    successful++;
                  }
                }
              );
            } else {
              logger.warn(`No image found: "${event.title}"`);
              failed++;
            }

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));

          } catch (error) {
            logger.error(`Error processing event ${event.id}`, error.message);
            failed++;
          }
        }

        // Give database time to process updates
        setTimeout(() => {
          logger.success(`Enrichment complete: ${successful} successful, ${failed} failed`);
          resolve({ processed: events.length, successful, failed });
        }, 1000);
      }
    );
  });
};

// ============================================================================
// HTTP SERVER
// ============================================================================

const startServer = () => {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'image-enricher', port: CONFIG.PORT }));
      return;
    }

    if (req.url === '/enrich' && req.method === 'POST') {
      try {
        const result = await enrichEvents();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(CONFIG.PORT, () => {
    logger.success(`Image Enricher running on port ${CONFIG.PORT}`);
    console.log(`
================================================================================
🖼️  IMAGE ENRICHER SERVICE
    Port: ${CONFIG.PORT}
    Health: http://localhost:${CONFIG.PORT}/health
    Enrich: POST http://localhost:${CONFIG.PORT}/enrich
================================================================================
    `);
  });
};

// ============================================================================
// AUTO-RUN ENRICHMENT
// ============================================================================

const autoEnrichment = async () => {
  logger.info('Auto-enrichment started (every 30 minutes)');

  // Run once immediately
  await enrichEvents();

  // Then every 30 minutes
  setInterval(async () => {
    await enrichEvents();
  }, 30 * 60 * 1000);
};

// ============================================================================
// STARTUP
// ============================================================================

startServer();
autoEnrichment();

process.on('SIGINT', () => {
  logger.info('Shutting down...');
  db.close();
  process.exit(0);
});
