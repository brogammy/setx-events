/**
 * Image Filler - Adds real placeholder/fallback images to all events
 *
 * Simple solution:
 * 1. Gets events without images
 * 2. Generates category-appropriate image URLs
 * 3. Updates database with valid image URLs
 * 4. Works immediately, no external dependencies
 */

const sqlite3 = require('sqlite3').verbose();
const http = require('http');

const CONFIG = {
  DB_PATH: '/home/sauly/setx-events/database.sqlite',
  PORT: 3008,
  BATCH_SIZE: 50
};

const logger = {
  log: (level, msg, data) => {
    console.log(`[${new Date().toISOString()}] ${level}: ${msg}`, data || '');
  },
  info: (msg, data) => logger.log('INFO', msg, data),
  warn: (msg, data) => logger.log('WARN', msg, data),
  error: (msg, data) => logger.log('ERROR', msg, data),
  success: (msg, data) => logger.log('SUCCESS', msg, data)
};

const db = new sqlite3.Database(CONFIG.DB_PATH, (err) => {
  if (err) {
    logger.error('Database error', err.message);
    process.exit(1);
  }
  logger.info('Connected to database');
});

// Image URLs by category - using real, free image URLs
const imagesByCategory = {
  'Music': [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=300&fit=crop'
  ],
  'Theater': [
    'https://images.unsplash.com/photo-1485579149c0-123123d6ce6f?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop'
  ],
  'Sports': [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1624526267942-ab67cb38a19f?w=400&h=300&fit=crop'
  ],
  'Art': [
    'https://images.unsplash.com/photo-1561214115-6d2f1b0609fa?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=300&fit=crop'
  ],
  'Festival': [
    'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400&h=300&fit=crop'
  ],
  'Community': [
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop'
  ],
  'Food': [
    'https://images.unsplash.com/photo-1555939594-58d7cb561241?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=400&h=300&fit=crop'
  ],
  'Exhibition': [
    'https://images.unsplash.com/photo-1561214115-6d2f1b0609fa?w=400&h=300&fit=crop'
  ],
  'Show': [
    'https://images.unsplash.com/photo-1485579149c0-123123d6ce6f?w=400&h=300&fit=crop'
  ],
  'Concert': [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop'
  ]
};

// Default image if category not found
const defaultImages = [
  'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=400&h=300&fit=crop'
];

const getImageForEvent = (event) => {
  const category = event.category || 'Community';
  const categoryImages = imagesByCategory[category] || defaultImages;

  // Return a random image from the category
  return categoryImages[Math.floor(Math.random() * categoryImages.length)];
};

const fillImages = async () => {
  return new Promise((resolve, reject) => {
    logger.info('Starting image fill...');

    // Get ALL events without images
    db.all(
      'SELECT id, title, category FROM events WHERE image_url IS NULL LIMIT ?',
      [CONFIG.BATCH_SIZE],
      (err, events) => {
        if (err) {
          logger.error('Query error', err.message);
          return reject(err);
        }

        if (!events || events.length === 0) {
          logger.info('No events need images');
          return resolve({ processed: 0, successful: 0 });
        }

        logger.info(`Found ${events.length} events without images`);

        let successful = 0;

        const updateEvent = (index) => {
          if (index >= events.length) {
            logger.success(`Filled images for ${successful} events`);
            return resolve({ processed: events.length, successful });
          }

          const event = events[index];
          const imageUrl = getImageForEvent(event);

          db.run(
            'UPDATE events SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [imageUrl, event.id],
            function(err) {
              if (err) {
                logger.error(`Failed to update event ${event.id}`, err.message);
              } else {
                logger.success(`Added image to: "${event.title}"`);
                successful++;
              }
              updateEvent(index + 1);
            }
          );
        };

        updateEvent(0);
      }
    );
  });
};

// HTTP Server
const startServer = () => {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'image-filler' }));
      return;
    }

    if (req.url === '/fill' && req.method === 'POST') {
      try {
        const result = await fillImages();
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
    logger.success(`Image Filler running on port ${CONFIG.PORT}`);
    console.log(`
================================================================================
🖼️  IMAGE FILLER SERVICE
    Port: ${CONFIG.PORT}
    Health: http://localhost:${CONFIG.PORT}/health
    Fill Images: curl -X POST http://localhost:${CONFIG.PORT}/fill
================================================================================
    `);
  });
};

startServer();

// Run immediately on startup
setTimeout(async () => {
  await fillImages();
}, 500);

process.on('SIGINT', () => {
  logger.info('Shutting down...');
  db.close();
  process.exit(0);
});
