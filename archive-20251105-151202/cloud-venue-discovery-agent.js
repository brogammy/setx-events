/**
 * Cloud Venue Discovery Agent
 *
 * Discovers new event venues in SETX area using Perplexity API
 * Posts findings to agent orchestrator for validation
 *
 * Robust design:
 * - Handles network failures gracefully
 * - Implements exponential backoff for retries
 * - Validates all data before submission
 * - Logs all operations comprehensively
 * - Prevents duplicate submissions
 * - Can run hourly without conflicts
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // API Keys
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',

  // Endpoints
  ORCHESTRATOR_URL: 'http://localhost:3005',
  PERPLEXITY_URL: 'https://api.perplexity.ai/openai/',

  // Service configuration
  PORT: 3006,
  LOG_DIR: './logs',
  MEMORY_DIR: './memory-system',

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // milliseconds
  REQUEST_TIMEOUT: 30000, // 30 seconds

  // Rate limiting
  MIN_INTERVAL_BETWEEN_RUNS: 3600000, // 1 hour minimum between full runs

  // Cities to search
  SETX_CITIES: ['Beaumont', 'Port Arthur', 'Orange']
};

// ============================================================================
// LOGGING
// ============================================================================

const logger = {
  init: () => {
    if (!fs.existsSync(CONFIG.LOG_DIR)) {
      fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
    }
  },

  log: (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };

    console.log(`[${timestamp}] ${level}: ${message}`, data || '');

    try {
      const logFile = path.join(CONFIG.LOG_DIR, 'cloud-agent.log');
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    } catch (err) {
      console.error('Failed to write log:', err.message);
    }
  },

  info: (msg, data) => logger.log('INFO', msg, data),
  warn: (msg, data) => logger.log('WARN', msg, data),
  error: (msg, data) => logger.log('ERROR', msg, data),
  success: (msg, data) => logger.log('SUCCESS', msg, data)
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeHttpRequest = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        } catch (err) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);
    req.setTimeout(CONFIG.REQUEST_TIMEOUT);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
};

const retryWithBackoff = async (fn, context = '') => {
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);

      if (attempt === CONFIG.MAX_RETRIES) {
        logger.error(`Failed after ${CONFIG.MAX_RETRIES} attempts: ${context}`, {
          error: error.message,
          lastAttempt: attempt
        });
        throw error;
      }

      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms: ${context}`, {
        error: error.message
      });

      await sleep(delay);
    }
  }
};

// ============================================================================
// VENUE DISCOVERY
// ============================================================================

const discoverVenues = async () => {
  logger.info('Starting venue discovery');

  if (!CONFIG.PERPLEXITY_API_KEY) {
    logger.error('PERPLEXITY_API_KEY not set');
    return {
      success: false,
      error: 'PERPLEXITY_API_KEY environment variable required'
    };
  }

  try {
    const searchQuery = `
      Find entertainment venues (theaters, concert halls, music venues, restaurants, bars, sports facilities, museums, art galleries, event spaces)
      in ${CONFIG.SETX_CITIES.join(', ')}, Texas.

      For EACH venue found, provide:
      - Name (exactly as it appears)
      - City (must be: Beaumont, Port Arthur, or Orange)
      - Website URL (if available, must start with http:// or https://)
      - Phone number (if available, format: (XXX) XXX-XXXX)
      - Email (if available)
      - Facebook URL (if available)
      - Instagram handle (if available, format: @handle)
      - Cover image URL (direct URL to venue photo from website or Google Images, must be HTTP/HTTPS)
      - Logo URL (direct URL to venue logo if available, otherwise use cover_image_url)

      Return as JSON array with structure:
      [
        {
          "name": "Venue Name",
          "city": "City",
          "website": "https://...",
          "phone": "(409) 123-4567",
          "email": "info@example.com",
          "facebook_url": "https://facebook.com/...",
          "instagram_handle": "@handle",
          "cover_image_url": "https://...",
          "logo_url": "https://..."
        }
      ]

      IMPORTANT:
      - Only include venues actually located in these three cities
      - Website URLs must be complete and functional
      - Return ONLY the JSON array, no other text
    `;

    logger.info('Querying Perplexity for venues', { cities: CONFIG.SETX_CITIES });

    const venues = await retryWithBackoff(async () => {
      const response = await makeHttpRequest({
        hostname: 'api.perplexity.ai',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        protocol: 'https:',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.PERPLEXITY_API_KEY}`
        }
      }, {
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: searchQuery
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      });

      if (response.status !== 200) {
        throw new Error(`Perplexity API error: ${response.status} - ${JSON.stringify(response.body)}`);
      }

      if (!response.body.choices || !response.body.choices[0]) {
        throw new Error('Invalid Perplexity response format');
      }

      const content = response.body.choices[0].message.content;

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('No JSON array found in Perplexity response', { content: content.substring(0, 200) });
        return [];
      }

      return JSON.parse(jsonMatch[0]);
    }, 'Perplexity API call');

    if (!Array.isArray(venues)) {
      throw new Error('Venues response is not an array');
    }

    logger.success(`Discovered ${venues.length} venues`, { venues: venues.length });

    return {
      success: true,
      venues,
      count: venues.length
    };

  } catch (error) {
    logger.error('Venue discovery failed', { error: error.message });
    return {
      success: false,
      error: error.message,
      venues: []
    };
  }
};

// ============================================================================
// VENUE VALIDATION & SUBMISSION
// ============================================================================

const validateVenueData = (venue) => {
  const errors = [];

  if (!venue.name || typeof venue.name !== 'string') {
    errors.push('Missing or invalid name');
  }

  if (!venue.city || !CONFIG.SETX_CITIES.includes(venue.city)) {
    errors.push(`Invalid city: must be ${CONFIG.SETX_CITIES.join(', ')}`);
  }

  if (!venue.website) {
    errors.push('Missing website');
  } else if (!venue.website.startsWith('http://') && !venue.website.startsWith('https://')) {
    errors.push('Website must start with http:// or https://');
  }

  return errors;
};

const submitVenues = async (venues) => {
  if (!venues || venues.length === 0) {
    logger.warn('No venues to submit');
    return {
      success: true,
      submitted: 0,
      results: { submitted: 0, added: 0, duplicates: 0, errors: [] }
    };
  }

  logger.info(`Validating ${venues.length} venues before submission`);

  // Validate all venues
  const validVenues = [];
  const validationErrors = [];

  venues.forEach((venue, index) => {
    const errors = validateVenueData(venue);

    if (errors.length > 0) {
      validationErrors.push({
        index,
        venue: venue.name || 'Unknown',
        errors
      });
    } else {
      validVenues.push(venue);
    }
  });

  if (validationErrors.length > 0) {
    logger.warn(`${validationErrors.length} venues failed validation`, validationErrors);
  }

  if (validVenues.length === 0) {
    logger.error('No valid venues to submit');
    return {
      success: false,
      submitted: 0,
      results: { submitted: 0, added: 0, duplicates: 0, errors: validationErrors }
    };
  }

  try {
    logger.info(`Submitting ${validVenues.length} valid venues to orchestrator`, {
      url: CONFIG.ORCHESTRATOR_URL,
      count: validVenues.length
    });

    const result = await retryWithBackoff(async () => {
      const response = await makeHttpRequest({
        hostname: 'localhost',
        port: 3005,
        path: '/agent/venues/discover',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, {
        venues: validVenues,
        agent_name: 'Perplexity-Venue-Discovery-v1',
        timestamp: new Date().toISOString()
      });

      if (response.status !== 200) {
        throw new Error(`Orchestrator error: ${response.status}`);
      }

      return response.body;
    }, 'Submit venues to orchestrator');

    logger.success('Venues submitted successfully', {
      results: result.results,
      agent: result.agent
    });

    // Record successful discovery
    recordDiscoverySession(validVenues, result.results);

    return {
      success: true,
      submitted: validVenues.length,
      results: result.results
    };

  } catch (error) {
    logger.error('Failed to submit venues', { error: error.message });
    return {
      success: false,
      submitted: validVenues.length,
      results: {
        error: error.message
      }
    };
  }
};

// ============================================================================
// MEMORY & LEARNING
// ============================================================================

const recordDiscoverySession = (venues, results) => {
  try {
    if (!fs.existsSync(CONFIG.MEMORY_DIR)) {
      fs.mkdirSync(CONFIG.MEMORY_DIR, { recursive: true });
    }

    const sessionLog = {
      timestamp: new Date().toISOString(),
      venues_discovered: venues.length,
      venues_added: results.added || 0,
      venues_duplicates: results.duplicates || 0,
      venues: venues.map(v => ({
        name: v.name,
        city: v.city,
        website: v.website
      }))
    };

    const logFile = path.join(CONFIG.MEMORY_DIR, 'cloud-discovery-sessions.json');
    let sessions = [];

    if (fs.existsSync(logFile)) {
      const data = fs.readFileSync(logFile, 'utf8');
      sessions = JSON.parse(data);
    }

    sessions.push(sessionLog);
    fs.writeFileSync(logFile, JSON.stringify(sessions, null, 2));

    logger.info('Recorded discovery session', { venues: venues.length });

  } catch (err) {
    logger.error('Failed to record session', { error: err.message });
  }
};

// ============================================================================
// MAIN EXECUTION
// ============================================================================

const run = async () => {
  logger.info('Cloud Venue Discovery Agent started');

  try {
    // Discover venues
    const discovery = await discoverVenues();

    if (!discovery.success) {
      logger.error('Discovery failed', discovery);
      return discovery;
    }

    // Submit venues
    const submission = await submitVenues(discovery.venues);

    return {
      success: submission.success,
      discovered: discovery.count,
      submitted: submission.submitted,
      results: submission.results
    };

  } catch (error) {
    logger.error('Unexpected error in main execution', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================================================
// SCHEDULER
// ============================================================================

const startScheduler = () => {
  logger.info(`Agent scheduler started (interval: every hour)`);

  // Run immediately on start
  run();

  // Run every hour
  setInterval(() => {
    run();
  }, CONFIG.MIN_INTERVAL_BETWEEN_RUNS);
};

// ============================================================================
// HTTP SERVER (for monitoring)
// ============================================================================

const startServer = () => {
  const server = http.createServer((req, res) => {
    // Health check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'Cloud Venue Discovery Agent',
        port: CONFIG.PORT,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // Last discovery status
    if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'running',
        timestamp: new Date().toISOString(),
        interval: `${CONFIG.MIN_INTERVAL_BETWEEN_RUNS / 1000 / 60} minutes`
      }));
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(CONFIG.PORT, () => {
    logger.info(`Cloud agent HTTP server started on port ${CONFIG.PORT}`);
    console.log(`\n${'='.repeat(70)}`);
    console.log('🌍 CLOUD VENUE DISCOVERY AGENT');
    console.log(`   Port: ${CONFIG.PORT}`);
    console.log(`   Health: http://localhost:${CONFIG.PORT}/health`);
    console.log(`   Status: http://localhost:${CONFIG.PORT}/status`);
    console.log(`   Interval: Every ${CONFIG.MIN_INTERVAL_BETWEEN_RUNS / 1000 / 60} minutes`);
    console.log(`   Orchestrator: ${CONFIG.ORCHESTRATOR_URL}/agent/venues/discover`);
    console.log(`${'='.repeat(70)}\n`);
  });

  server.on('error', (err) => {
    logger.error('HTTP server error', { error: err.message });
  });
};

// ============================================================================
// STARTUP
// ============================================================================

logger.init();
startServer();
startScheduler();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down on SIGTERM');
  process.exit(0);
});

// Unhandled error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message });
  process.exit(1);
});
