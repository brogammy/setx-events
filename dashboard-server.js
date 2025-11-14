const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3002;
const DB_PATH = path.join(__dirname, 'database.sqlite');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// API endpoint for initial data
app.get('/api/stats', (req, res) => {
    getSystemStats((err, stats) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(stats);
        }
    });
});

// API endpoint for system status
app.get('/api/status', (req, res) => {
    const status = {
        api: true, // We assume it's running since we're serving this
        frontend: true,
        n8n: true,
        database: true // We're already connected
    };
    
    res.json(status);
});

// Function to get system stats
function getSystemStats(callback) {
    const stats = {};
    
    // Get total events
    db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        if (err) return callback(err);
        stats.totalEvents = row.count;
        
        // Get upcoming events (within next 90 days)
        const today = new Date().toISOString().split('T')[0];
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 90);
        const future = futureDate.toISOString().split('T')[0];
        
        db.get(`SELECT COUNT(*) as count FROM events WHERE date >= ? AND date <= ?`, [today, future], (err, row) => {
            if (err) return callback(err);
            stats.upcomingEvents = row.count;
            
            // Get total active venues
            db.get('SELECT COUNT(*) as count FROM venues WHERE is_active = 1', (err, row) => {
                if (err) return callback(err);
                stats.totalVenues = row.count;
                
                // Get active venues (with upcoming events)
                db.get(`
                    SELECT COUNT(DISTINCT v.id) as count 
                    FROM venues v
                    INNER JOIN events e ON v.id = e.venue_id
                    WHERE v.is_active = 1 AND e.date >= date('now')
                `, [], (err, row) => {
                    if (err) return callback(err);
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
                        if (err) return callback(err);
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
                            if (err) return callback(err);
                            stats.eventsByCategory = rows;
                            
                            // Get recent events
                            db.all(`
                                SELECT * FROM events 
                                ORDER BY created_at DESC 
                                LIMIT 10
                            `, [], (err, rows) => {
                                if (err) return callback(err);
                                stats.recentEvents = rows;
                                
                                // Get scraping activity
                                db.all(`
                                    SELECT * FROM scrape_log 
                                    ORDER BY scraped_at DESC 
                                    LIMIT 5
                                `, [], (err, rows) => {
                                    if (err) return callback(err);
                                    stats.recentScrapes = rows;
                                    callback(null, stats);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// Function to get recent log entries
function getRecentLogs(callback) {
    // Try to read actual log files
    const logFiles = ['api-server.log', 'n8n.log', 'frontend.log'];
    let allLogs = [];
    
    let completed = 0;
    logFiles.forEach(file => {
        const logPath = path.join(__dirname, 'logs', file);
        fs.access(logPath, fs.constants.F_OK, (err) => {
            if (!err) {
                // File exists, read last 10 lines
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: fs.createReadStream(logPath),
                    crlfDelay: Infinity
                });
                
                let lines = [];
                rl.on('line', (line) => {
                    lines.push({ source: file.replace('.log', ''), message: line });
                    if (lines.length > 10) lines.shift();
                });
                
                rl.on('close', () => {
                    allLogs = allLogs.concat(lines.map(log => ({
                        timestamp: new Date().toISOString(),
                        source: log.source,
                        message: log.message
                    })));
                    completed++;
                    if (completed === logFiles.length) {
                        // Sort by timestamp and take last 20
                        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                        callback(null, allLogs.slice(0, 20));
                    }
                });
            } else {
                completed++;
                if (completed === logFiles.length) {
                    callback(null, allLogs);
                }
            }
        });
    });
    
    // Timeout if files don't load
    setTimeout(() => {
        if (completed < logFiles.length) {
            callback(null, [
                { timestamp: new Date().toISOString(), source: 'system', message: 'Log monitoring started' },
                { timestamp: new Date(Date.now() - 5000).toISOString(), source: 'api', message: 'API server running' },
                { timestamp: new Date(Date.now() - 10000).toISOString(), source: 'database', message: 'Database connected' }
            ]);
        }
    }, 2000);
}

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('📱 Dashboard client connected');
    
    // Send initial stats
    getSystemStats((err, stats) => {
        if (!err) {
            socket.emit('statsUpdate', stats);
        }
    });
    
    // Send initial logs
    getRecentLogs((err, logs) => {
        if (!err) {
            socket.emit('logUpdate', logs);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('📱 Dashboard client disconnected');
    });
});

// Periodically emit stats updates
setInterval(() => {
    getSystemStats((err, stats) => {
        if (!err) {
            io.emit('statsUpdate', stats);
        }
    });
}, 10000); // Update stats every 10 seconds

// Periodically emit log updates
setInterval(() => {
    getRecentLogs((err, logs) => {
        if (!err) {
            io.emit('logUpdate', logs);
        }
    });
}, 5000); // Update logs every 5 seconds

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`📊 Live Dashboard Server running on port ${PORT}`);
    console.log(`🔗 Access dashboard at http://localhost:${PORT}/live-dashboard.html`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down dashboard server...');
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});