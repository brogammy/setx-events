const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    let query = 'SELECT * FROM events WHERE 1=1';
    const params = [];
    
    if (city && city !== 'all') {
        query += ' AND city = ?';
        params.push(city);
    }
    if (category && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
    }
    if (search) {
        query += ' AND (title LIKE ? OR description LIKE ? OR location LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }
    query += ' ORDER BY date ASC';
    
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
    db.get('SELECT * FROM events WHERE id = ?', [id], (err, row) => {
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
    const { title, date, time, location, city, category, description, source_url, featured } = req.body;
    
    if (!title || !date || !city) {
        return res.status(400).json({ error: 'Title, date, and city are required' });
    }
    
    const stmt = db.prepare(`
        INSERT INTO events (title, date, time, location, city, category, description, source_url, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
        title, date, time || '', location || '', city, 
        category || 'Community Event', description || '', 
        source_url || '', featured || 0,
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
});

app.put('/api/events/:id', (req, res) => {
    const { id } = req.params;
    const { title, date, time, location, city, category, description, source_url, featured } = req.body;
    
    const stmt = db.prepare(`
        UPDATE events 
        SET title = ?, date = ?, time = ?, location = ?, city = ?, 
            category = ?, description = ?, source_url = ?, featured = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    
    stmt.run(title, date, time, location, city, category, description, source_url, featured, id,
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
    const { city, category } = req.query;
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

// ==================== ADMIN ROUTES ====================

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/admin/stats', (req, res) => {
    const stats = {};
    
    db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        stats.totalEvents = row ? row.count : 0;
        
        db.get('SELECT COUNT(*) as count FROM events WHERE date >= date("now")', (err, row) => {
            stats.upcomingEvents = row ? row.count : 0;
            
            db.get('SELECT COUNT(*) as count FROM venues WHERE is_active = 1', (err, row) => {
                stats.activeVenues = row ? row.count : 0;
                
                db.all('SELECT city, COUNT(*) as count FROM events WHERE date >= date("now") GROUP BY city ORDER BY count DESC LIMIT 5', (err, rows) => {
                    stats.eventsByCity = rows || [];
                    
                    db.all('SELECT category, COUNT(*) as count FROM events WHERE date >= date("now") GROUP BY category ORDER BY count DESC LIMIT 5', (err, rows) => {
                        stats.eventsByCategory = rows || [];
                        
                        db.all('SELECT * FROM events WHERE date >= date("now") ORDER BY date ASC LIMIT 10', (err, rows) => {
                            stats.recentEvents = rows || [];
                            res.json(stats);
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
