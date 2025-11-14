/**
 * Agent Orchestrator - Universal MCP Service
 *
 * Central hub for all agents:
 * - Cloud agents discover venues
 * - Local agents validate
 * - n8n workflow scrapes
 * - Memory system learns
 *
 * Robust design: No crashes, no conflicts, handles failures gracefully
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = 3005;
const DB_PATH = '/home/sauly/setx-events/database.sqlite';
const MEMORY_DIR = '/home/sauly/setx-events/memory-system';

// Initialize memory system
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Agent Orchestrator connected to database');
    initializeDatabase();
  }
});

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

const initializeDatabase = () => {
  // Ensure venue table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      website TEXT,
      phone TEXT,
      email TEXT,
      facebook_url TEXT,
      instagram_handle TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      discovered_by TEXT,
      UNIQUE(name, city)
    )
  `);

  // Ensure events table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      location TEXT,
      city TEXT NOT NULL,
      category TEXT,
      description TEXT,
      venue_id INTEGER,
      source_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(title, date, city),
      FOREIGN KEY(venue_id) REFERENCES venues(id)
    )
  `);
};

// ============================================================================
// ENDPOINT 1: VENUE DISCOVERY
// ============================================================================

app.post('/agent/venues/discover', (req, res) => {
  const { venues, agent_name, timestamp } = req.body;

  if (!venues || !Array.isArray(venues)) {
    return res.status(400).json({ error: 'venues array required' });
  }

  const results = {
    submitted: venues.length,
    duplicates: 0,
    added: 0,
    errors: []
  };

  let processed = 0;

  const processVenue = (venue, index) => {
    // Validate required fields
    if (!venue.name || !venue.city || !venue.website) {
      results.errors.push({
        index,
        venue: venue.name || 'unknown',
        error: 'Missing required fields (name, city, website)'
      });
      processed++;
      if (processed === venues.length) respondWithResults();
      return;
    }

    // Check if venue already exists
    db.get(
      'SELECT id FROM venues WHERE LOWER(name) = LOWER(?) AND city = ?',
      [venue.name, venue.city],
      (err, row) => {
        if (err) {
          results.errors.push({
            index,
            venue: venue.name,
            error: err.message
          });
          processed++;
          if (processed === venues.length) respondWithResults();
          return;
        }

        if (row) {
          results.duplicates++;
          processed++;
          if (processed === venues.length) respondWithResults();
          return;
        }

        // Insert new venue
        db.run(
          `INSERT INTO venues (name, city, website, phone, email, facebook_url, instagram_url, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            venue.name,
            venue.city,
            venue.website,
            venue.phone || null,
            venue.email || null,
            venue.facebook_url || null,
            venue.instagram_url || null
          ],
          function(err) {
            if (err) {
              results.errors.push({
                index,
                venue: venue.name,
                error: err.message
              });
            } else {
              results.added++;
              recordVenueDiscovery(venue, agent_name);
            }

            processed++;
            if (processed === venues.length) respondWithResults();
          }
        );
      }
    );
  };

  const respondWithResults = () => {
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
      agent: agent_name || 'unknown'
    });
  };

  // Process all venues
  venues.forEach(processVenue);
});

// ============================================================================
// ENDPOINT 2: VENUE VALIDATION
// ============================================================================

app.post('/agent/venues/validate', (req, res) => {
  const { venues, check_duplicates = true, check_website = false } = req.body;

  if (!venues || !Array.isArray(venues)) {
    return res.status(400).json({ error: 'venues array required' });
  }

  const validated = [];

  const validateVenue = (venue) => {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!venue.name) errors.push('Missing name');
    if (!venue.city) errors.push('Missing city');
    if (!venue.website) errors.push('Missing website');

    // Format validation
    if (venue.website && !venue.website.startsWith('http')) {
      warnings.push('Website should start with http:// or https://');
    }

    // City validation
    const validCities = ['Beaumont', 'Port Arthur', 'Orange'];
    if (venue.city && !validCities.includes(venue.city)) {
      warnings.push(`City "${venue.city}" not in SETX area`);
    }

    // Check for duplicates
    if (check_duplicates) {
      db.get(
        'SELECT id FROM venues WHERE LOWER(name) = LOWER(?) AND city = ?',
        [venue.name, venue.city],
        (err, row) => {
          if (row) {
            errors.push('Venue already exists in database');
          }
        }
      );
    }

    validated.push({
      ...venue,
      validation: {
        is_valid: errors.length === 0,
        errors,
        warnings
      }
    });
  };

  venues.forEach(validateVenue);

  setTimeout(() => {
    res.json({
      success: true,
      total: venues.length,
      valid: validated.filter(v => v.validation.is_valid).length,
      invalid: validated.filter(v => !v.validation.is_valid).length,
      validated_venues: validated,
      timestamp: new Date().toISOString()
    });
  }, 100);
});

// ============================================================================
// ENDPOINT 3: EVENT VALIDATION
// ============================================================================

app.post('/agent/events/validate', (req, res) => {
  const { events, check_authenticity = true, check_relevance = true } = req.body;

  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'events array required' });
  }

  const validated = [];

  events.forEach(event => {
    const issues = {
      authenticity: [],
      relevance: [],
      spam_indicators: []
    };

    // AUTHENTICITY CHECKS
    if (check_authenticity) {
      if (event.date) {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(event.date)) {
          issues.authenticity.push('Invalid date format (use YYYY-MM-DD)');
        }

        const eventDate = new Date(event.date);
        const twoAgoDays = new Date();
        twoAgoDays.setDate(twoAgoDays.getDate() - 2);

        if (eventDate < twoAgoDays) {
          issues.relevance.push('Event date is in the past (>2 days)');
        }
      }

      if (!event.title || event.title.length < 3) {
        issues.authenticity.push('Title too short or missing');
      }

      if (!event.description || event.description.length < 10) {
        issues.authenticity.push('Description too short or missing');
      }
    }

    // RELEVANCE CHECKS
    if (check_relevance) {
      const spamKeywords = [
        'viagra', 'casino', 'lottery', 'loan', 'forex', 'crypto scam',
        'click here', 'buy now', 'limited offer', 'act fast',
        'free money', 'guaranteed', 'risk free'
      ];

      const titleLower = (event.title || '').toLowerCase();
      const descLower = (event.description || '').toLowerCase();
      const combined = titleLower + ' ' + descLower;

      spamKeywords.forEach(keyword => {
        if (combined.includes(keyword.toLowerCase())) {
          issues.spam_indicators.push(`Contains spam keyword: "${keyword}"`);
        }
      });

      const relevantCategories = ['Music', 'Theater', 'Sports', 'Art', 'Community', 'Food', 'Festival', 'Concert', 'Exhibition', 'Show'];
      if (event.category && !relevantCategories.includes(event.category)) {
        issues.relevance.push(`Category "${event.category}" may not be relevant`);
      }
    }

    const is_valid =
      issues.authenticity.length === 0 &&
      issues.spam_indicators.length === 0;

    const is_relevant = issues.relevance.length === 0;

    validated.push({
      ...event,
      validation: {
        is_valid,
        is_relevant,
        confidence: calculateConfidence(issues),
        issues
      }
    });

    recordEventValidation(event, is_valid, is_relevant);
  });

  res.json({
    success: true,
    total: events.length,
    valid: validated.filter(e => e.validation.is_valid).length,
    relevant: validated.filter(e => e.validation.is_relevant).length,
    suspicious: validated.filter(e => !e.validation.is_valid).length,
    validated_events: validated,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ENDPOINT 4: GET VENUES FOR n8n
// ============================================================================

app.get('/agent/venues/current', (req, res) => {
  db.all('SELECT * FROM venues WHERE is_active = 1 ORDER BY city, name', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      count: rows.length,
      venues: rows,
      timestamp: new Date().toISOString()
    });
  });
});

// ============================================================================
// ENDPOINT 5: AGENT PERFORMANCE
// ============================================================================

app.get('/agent/performance', (req, res) => {
  try {
    const perfFile = path.join(MEMORY_DIR, 'agent-performance.json');
    const performance = fs.existsSync(perfFile)
      ? JSON.parse(fs.readFileSync(perfFile, 'utf8'))
      : { agents: [] };

    res.json({
      success: true,
      performance,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ENDPOINT 6: LEARNING INSIGHTS
// ============================================================================

app.get('/agent/insights', (req, res) => {
  try {
    const insFile = path.join(MEMORY_DIR, 'learning-insights.json');
    const insights = fs.existsSync(insFile)
      ? JSON.parse(fs.readFileSync(insFile, 'utf8'))
      : { insights: [] };

    res.json({
      success: true,
      insights,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/agent/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'agent-orchestrator',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateConfidence(issues) {
  let confidence = 100;
  confidence -= issues.authenticity.length * 30;
  confidence -= issues.spam_indicators.length * 40;
  confidence -= issues.relevance.length * 15;
  return Math.max(0, confidence);
}

function recordVenueDiscovery(venue, agent_name) {
  try {
    const memFile = path.join(MEMORY_DIR, 'venue-discovery-log.json');
    let data = { venues: [] };

    if (fs.existsSync(memFile)) {
      data = JSON.parse(fs.readFileSync(memFile, 'utf8'));
    }

    data.venues.push({
      ...venue,
      discovered_by: agent_name || 'unknown',
      discovered_at: new Date().toISOString()
    });

    fs.writeFileSync(memFile, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error recording venue discovery:', err.message);
  }
}

function recordEventValidation(event, is_valid, is_relevant) {
  try {
    const memFile = path.join(MEMORY_DIR, 'event-validation-log.json');
    let data = { validations: [] };

    if (fs.existsSync(memFile)) {
      data = JSON.parse(fs.readFileSync(memFile, 'utf8'));
    }

    data.validations.push({
      event_title: event.title,
      is_valid,
      is_relevant,
      validated_at: new Date().toISOString()
    });

    fs.writeFileSync(memFile, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error recording event validation:', err.message);
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down agent orchestrator...');
  db.close(() => {
    console.log('Database closed');
    process.exit(0);
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🤖 AGENT ORCHESTRATOR - Universal MCP Service`);
  console.log(`   Listening on: http://localhost:${PORT}`);
  console.log(`\n📍 ENDPOINTS:`);
  console.log(`   POST   /agent/venues/discover ........... Cloud agent submits venues`);
  console.log(`   POST   /agent/venues/validate ........... Local agent validates venues`);
  console.log(`   POST   /agent/events/validate ........... Local agent validates events`);
  console.log(`   GET    /agent/venues/current ............ Get current venues for n8n`);
  console.log(`   GET    /agent/performance .............. Agent performance metrics`);
  console.log(`   GET    /agent/insights ................. Learning insights`);
  console.log(`   GET    /agent/health ................... Health check`);
  console.log(`${'='.repeat(70)}\n`);
});
