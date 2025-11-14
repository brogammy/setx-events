const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable ALL caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Serve venues.html from Express (with no-cache headers)
app.get('/venues', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/venues.html'));
});

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// ==================== ROOT & INFO ROUTES ====================

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SETX Events API</title>
            <style>
                body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
                h1 { color: #21808d; }
                .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 6px; }
                a { color: #21808d; text-decoration: none; font-weight: 600; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h1>🎉 SETX Events API</h1>
            <p><strong>Status:</strong> ✅ Running</p>
            <p><strong>Base URL:</strong> http://100.104.226.70:3001</p>
            
            <h2>Endpoints:</h2>
            <div class="endpoint">
                <strong>GET</strong> <a href="/api/events">/api/events</a> - Get all events (supports ?city=, ?category=, ?search=)
            </div>
            <div class="endpoint">
                <strong>POST</strong> /api/events - Create new event
            </div>
            <div class="endpoint">
                <strong>DELETE</strong> /api/events/:id - Delete event
            </div>
            <div class="endpoint">
                <strong>GET</strong> <a href="/api/venues">/api/venues</a> - Get all venues
            </div>
            <div class="endpoint">
                <strong>GET</strong> <a href="/api/health">/api/health</a> - Health check
            </div>
            <div class="endpoint">
                <strong>GET</strong> <a href="/api/admin/stats">/api/admin/stats</a> - Get statistics
            </div>
            <div class="endpoint">
                <strong>GET</strong> <a href="/admin">/admin</a> - 🎛️ Admin Dashboard
            </div>
        </body>
        </html>
    `);
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

// ==================== EVENT ROUTES ====================

app.get('/api/events', (req, res) => {
    const { city, category, search } = req.query;
    let query = `
        SELECT
            e.*,
            COALESCE(
                CASE
                    WHEN e.image_url IS NOT NULL AND e.image_url != ''
                         AND e.image_url NOT LIKE '%placehold%'
                    THEN e.image_url
                    WHEN v.cover_image_url IS NOT NULL AND v.cover_image_url != ''
                    THEN v.cover_image_url
                    WHEN v.logo_url IS NOT NULL AND v.logo_url != ''
                    THEN v.logo_url
                    ELSE e.image_url
                END,
                e.image_url
            ) as image_url
        FROM events e
        LEFT JOIN venues v ON e.venue_id = v.id
        WHERE e.date >= date('now')
    `;
    const params = [];

    if (city && city !== 'all') {
        query += ' AND e.city = ?';
        params.push(city);
    }
    if (category && category !== 'all') {
        query += ' AND e.category = ?';
        params.push(category);
    }
    if (search) {
        query += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }
    query += ' ORDER BY e.date ASC';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching events:', err.message);
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

app.get('/api/events/:id', (req, res) => {
    const { id } = req.params;
    db.get(`
        SELECT
            e.*,
            COALESCE(
                CASE
                    WHEN e.image_url IS NOT NULL AND e.image_url != ''
                         AND e.image_url NOT LIKE '%placehold%'
                    THEN e.image_url
                    WHEN v.cover_image_url IS NOT NULL AND v.cover_image_url != ''
                    THEN v.cover_image_url
                    WHEN v.logo_url IS NOT NULL AND v.logo_url != ''
                    THEN v.logo_url
                    ELSE e.image_url
                END,
                e.image_url
            ) as image_url
        FROM events e
        LEFT JOIN venues v ON e.venue_id = v.id
        WHERE e.id = ?
    `, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ error: 'Event not found' });
        } else {
            res.json(row);
        }
    });
});

app.post('/api/events', (req, res) => {
    const { title, date, time, location, city, category, description, source_url, featured, image_url, price, ticket_url, age_restriction, venue_id } = req.body;

    if (!title || !date || !city) {
        return res.status(400).json({ error: 'Title, date, and city are required' });
    }

    // Check for duplicates: (title, date, city)
    db.get(
        `SELECT id FROM events WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND date = ? AND city = ?`,
        [title, date, city],
        (err, existingEvent) => {
            if (err) {
                console.error('Error checking for duplicates:', err.message);
                return res.status(500).json({ error: 'Database error: ' + err.message });
            }

            if (existingEvent) {
                // Duplicate detected - return existing event instead of creating new one
                console.log(`⚠️  Duplicate event detected: ${title} on ${date} in ${city} (ID: ${existingEvent.id})`);
                return res.status(409).json({
                    id: existingEvent.id,
                    message: 'Event already exists (duplicate prevented)',
                    title: title,
                    isDuplicate: true
                });
            }

            // No duplicate - proceed with insert
            const stmt = db.prepare(`
                INSERT INTO events (title, date, time, location, city, category, description, source_url, featured, image_url, price, ticket_url, age_restriction, venue_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                title, date, time || '', location || '', city,
                category || 'Community Event', description || '',
                source_url || '', featured || 0,
                image_url || null, price || null, ticket_url || null, age_restriction || null, venue_id || null,
                function(err) {
                    if (err) {
                        console.error('Error creating event:', err.message);
                        res.status(500).json({ error: err.message });
                    } else {
                        console.log(`✅ Event created: ${title} (ID: ${this.lastID})`);
                        res.status(201).json({
                            id: this.lastID,
                            message: 'Event created successfully',
                            title: title
                        });
                    }
                }
            );
            stmt.finalize();
        }
    );
});

app.put('/api/events/:id', (req, res) => {
    const { id } = req.params;
    const { title, date, time, location, city, category, description, source_url, featured, image_url, price, ticket_url, age_restriction, venue_id } = req.body;

    const stmt = db.prepare(`
        UPDATE events
        SET title = ?, date = ?, time = ?, location = ?, city = ?,
            category = ?, description = ?, source_url = ?, featured = ?,
            image_url = ?, price = ?, ticket_url = ?, age_restriction = ?, venue_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    stmt.run(title, date, time, location, city, category, description, source_url, featured, image_url || null, price || null, ticket_url || null, age_restriction || null, venue_id || null, id,
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Event not found' });
            } else {
                res.json({ message: 'Event updated successfully' });
            }
        }
    );
    stmt.finalize();
});

app.delete('/api/events/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM events WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Event not found' });
        } else {
            console.log(`🗑️  Deleted event ID: ${id}`);
            res.json({ message: 'Event deleted successfully' });
        }
    });
});

// ==================== VENUE ROUTES ====================

app.get('/api/venues', (req, res) => {
    const { city, category, showAll } = req.query;
    
    // If showAll is true or specific filters are provided, show all matching venues
    if (showAll === 'true' || city || category) {
        let query = 'SELECT * FROM venues WHERE is_active = 1';
        const params = [];
        
        if (city) {
            query += ' AND city = ?';
            params.push(city);
        }
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        query += ' ORDER BY priority DESC, name ASC';
        
        db.all(query, params, (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    } else {
        // Default view - only show venues with upcoming events
        const query = `
            SELECT DISTINCT v.*, 
                   (SELECT COUNT(*) FROM events e2 WHERE e2.venue_id = v.id AND e2.date >= date('now')) as upcoming_event_count
            FROM venues v
            INNER JOIN events e ON v.id = e.venue_id
            WHERE v.is_active = 1 
            AND e.date >= date('now')
            ORDER BY v.priority DESC, v.name ASC
        `;
        
        db.all(query, [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        });
    }
});

app.get('/api/venues/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM venues WHERE id = ?', [id], (err, venue) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!venue) {
            res.status(404).json({ error: 'Venue not found' });
        } else {
            // Get upcoming events for this venue
            db.all(
                'SELECT * FROM events WHERE venue_id = ? AND date >= date("now") ORDER BY date ASC LIMIT 10',
                [id],
                (err, events) => {
                    venue.events = events || [];
                    res.json(venue);
                }
            );
        }
    });
});

app.get('/api/venues/:id/events', (req, res) => {
    const { id } = req.params;
    db.all(
        'SELECT * FROM events WHERE venue_id = ? ORDER BY date ASC',
        [id],
        (err, events) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(events || []);
            }
        }
    );
});

// ==================== PUBLIC PAGES ====================

app.get('/venues', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/venues.html'));
});

app.get('/venue/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/venue.html'));
});

app.get('/event/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/event.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

// ==================== ADMIN ROUTES ====================

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

app.get('/api/admin/stats', (req, res) => {
    const stats = {};
    
    // Get total events
    db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.totalEvents = row.count;
        
        // Get upcoming events (within next 90 days)
        const today = new Date().toISOString().split('T')[0];
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 90);
        const future = futureDate.toISOString().split('T')[0];
        
        db.get('SELECT COUNT(*) as count FROM events WHERE date >= ? AND date <= ?', [today, future], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.upcomingEvents = row.count;
            
            // Get total active venues
            db.get('SELECT COUNT(*) as count FROM venues WHERE is_active = 1', (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.totalVenues = row.count;
                
                // Get active venues (with upcoming events)
                db.get(`
                    SELECT COUNT(DISTINCT v.id) as count 
                    FROM venues v
                    INNER JOIN events e ON v.id = e.venue_id
                    WHERE v.is_active = 1 AND e.date >= date('now')
                `, [], (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    stats.activeVenues = row.count;
                    
                    // Get events by city
                    db.all(`
                        SELECT city, COUNT(*) as count 
                        FROM events 
                        WHERE date >= ? 
                        GROUP BY city 
                        ORDER BY count DESC
                        LIMIT 10
                    `, [today], (err, rows) => {
                        if (err) return res.status(500).json({ error: err.message });
                        stats.eventsByCity = rows;
                        
                        // Get events by category
                        db.all(`
                            SELECT category, COUNT(*) as count 
                            FROM events 
                            WHERE date >= ? 
                            GROUP BY category 
                            ORDER BY count DESC
                            LIMIT 10
                        `, [today], (err, rows) => {
                            if (err) return res.status(500).json({ error: err.message });
                            stats.eventsByCategory = rows;
                            
                            // Get recent events
                            db.all(`
                                SELECT * FROM events 
                                ORDER BY created_at DESC 
                                LIMIT 10
                            `, [], (err, rows) => {
                                if (err) return res.status(500).json({ error: err.message });
                                stats.recentEvents = rows;
                                res.json(stats);
                            });
                        });
                    });
                });
            });
        });
    });
});

// ==================== DASHBOARD ROUTES ====================

app.get('/api/dashboard/stats', (req, res) => {
    const stats = {};
    
    // Get total events
    db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.totalEvents = row.count;
        
        // Get upcoming events (within next 90 days)
        const today = new Date().toISOString().split('T')[0];
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 90);
        const future = futureDate.toISOString().split('T')[0];
        
        db.get('SELECT COUNT(*) as count FROM events WHERE date >= ? AND date <= ?', [today, future], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.upcomingEvents = row.count;
            
            // Get total active venues
            db.get('SELECT COUNT(*) as count FROM venues WHERE is_active = 1', (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.totalVenues = row.count;
                
                // Get active venues (with upcoming events)
                db.get(`
                    SELECT COUNT(DISTINCT v.id) as count 
                    FROM venues v
                    INNER JOIN events e ON v.id = e.venue_id
                    WHERE v.is_active = 1 AND e.date >= date('now')
                `, [], (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    stats.activeVenues = row.count;
                    
                    // Get events by city
                    db.all(`
                        SELECT city, COUNT(*) as count 
                        FROM events 
                        WHERE date >= ? 
                        GROUP BY city 
                        ORDER BY count DESC
                        LIMIT 10
                    `, [today], (err, rows) => {
                        if (err) return res.status(500).json({ error: err.message });
                        stats.eventsByCity = rows;
                        
                        // Get events by category
                        db.all(`
                            SELECT category, COUNT(*) as count 
                            FROM events 
                            WHERE date >= ? 
                            GROUP BY category 
                            ORDER BY count DESC
                            LIMIT 10
                        `, [today], (err, rows) => {
                            if (err) return res.status(500).json({ error: err.message });
                            stats.eventsByCategory = rows;
                            
                            // Get recent events
                            db.all(`
                                SELECT * FROM events 
                                ORDER BY created_at DESC 
                                LIMIT 10
                            `, [], (err, rows) => {
                                if (err) return res.status(500).json({ error: err.message });
                                stats.recentEvents = rows;
                                
                                // Get scraping activity
                                db.all(`
                                    SELECT * FROM scrape_log 
                                    ORDER BY scraped_at DESC 
                                    LIMIT 5
                                `, [], (err, rows) => {
                                    if (err) return res.status(500).json({ error: err.message });
                                    stats.recentScrapes = rows;
                                    res.json(stats);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// ==================== SERVER START ====================

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('✅ SETX Events API running');
    console.log(`   Local:  http://localhost:${PORT}`);
    console.log(`   Network: http://100.104.226.70:${PORT}`);
    console.log('========================================');
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});
