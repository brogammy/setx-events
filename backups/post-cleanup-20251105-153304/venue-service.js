#!/usr/bin/env node

/**
 * VENUE SERVICE - Comprehensive Venue Management
 *
 * Handles:
 * - Complete venue data (contact, images, events)
 * - Event associations
 * - Image uploads/management
 * - Venue search and filtering
 * - Navigation links
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');

class VenueService {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
    }

    // ==================== VENUE RETRIEVAL ====================

    /**
     * Get complete venue profile with all upcoming events
     */
    getVenueWithEvents(venueId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM venues WHERE id = ?`,
                [venueId],
                (err, venue) => {
                    if (err) return reject(err);
                    if (!venue) return resolve(null);

                    // Get upcoming events for this venue
                    this.db.all(
                        `SELECT * FROM events
                         WHERE venue_id = ? AND date >= date('now')
                         ORDER BY date ASC`,
                        [venueId],
                        (err, events) => {
                            if (err) return reject(err);
                            venue.upcoming_events = events || [];
                            resolve(venue);
                        }
                    );
                }
            );
        });
    }

    /**
     * Get all venues by city with event counts
     */
    getVenuesByCity(city) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT v.*,
                        COUNT(e.id) as upcoming_event_count
                 FROM venues v
                 LEFT JOIN events e ON v.id = e.venue_id AND e.date >= date('now')
                 WHERE v.is_active = 1 AND v.city = ?
                 GROUP BY v.id
                 ORDER BY v.priority DESC, v.name ASC`,
                [city],
                (err, venues) => {
                    if (err) return reject(err);
                    resolve(venues || []);
                }
            );
        });
    }

    /**
     * Get all venues with event summaries
     */
    getAllVenues(filters = {}) {
        return new Promise((resolve, reject) => {
            let query = `SELECT v.*,
                                COUNT(e.id) as upcoming_event_count
                         FROM venues v
                         LEFT JOIN events e ON v.id = e.venue_id AND e.date >= date('now')
                         WHERE v.is_active = 1`;

            const params = [];

            if (filters.city) {
                query += ` AND v.city = ?`;
                params.push(filters.city);
            }

            if (filters.category) {
                query += ` AND v.category = ?`;
                params.push(filters.category);
            }

            if (filters.search) {
                query += ` AND (v.name LIKE ? OR v.description LIKE ?)`;
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm);
            }

            query += ` GROUP BY v.id ORDER BY v.priority DESC, v.name ASC`;

            this.db.all(query, params, (err, venues) => {
                if (err) return reject(err);
                resolve(venues || []);
            });
        });
    }

    /**
     * Get venues with highest upcoming events
     */
    getTopVenues(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT v.*,
                        COUNT(e.id) as upcoming_event_count
                 FROM venues v
                 LEFT JOIN events e ON v.id = e.venue_id AND e.date >= date('now')
                 WHERE v.is_active = 1
                 GROUP BY v.id
                 HAVING upcoming_event_count > 0
                 ORDER BY upcoming_event_count DESC, v.priority DESC
                 LIMIT ?`,
                [limit],
                (err, venues) => {
                    if (err) return reject(err);
                    resolve(venues || []);
                }
            );
        });
    }

    // ==================== VENUE MANAGEMENT ====================

    /**
     * Create new venue
     */
    createVenue(venueData) {
        return new Promise((resolve, reject) => {
            const {
                name, address, city, category, website, facebook_url,
                instagram_url, phone, email, description, logo_url, cover_image_url
            } = venueData;

            const stmt = this.db.prepare(`
                INSERT INTO venues (
                    name, address, city, category, website, facebook_url,
                    instagram_url, phone, email, description, logo_url, cover_image_url,
                    is_active, priority
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 5)
            `);

            stmt.run(
                name, address, city, category, website, facebook_url,
                instagram_url, phone, email, description, logo_url, cover_image_url,
                function(err) {
                    if (err) return reject(err);
                    resolve({ id: this.lastID, ...venueData });
                }
            );
            stmt.finalize();
        });
    }

    /**
     * Update venue
     */
    updateVenue(venueId, venueData) {
        return new Promise((resolve, reject) => {
            const fields = Object.keys(venueData);
            const values = Object.values(venueData);
            values.push(venueId);

            const setClause = fields.map(f => `${f} = ?`).join(', ');
            const query = `UPDATE venues SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

            this.db.run(query, values, function(err) {
                if (err) return reject(err);
                if (this.changes === 0) return reject(new Error('Venue not found'));
                resolve({ id: venueId, ...venueData });
            });
        });
    }

    /**
     * Delete venue (soft delete)
     */
    deleteVenue(venueId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE venues SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [venueId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ id: venueId, deleted: true });
                }
            );
        });
    }

    // ==================== VENUE-EVENT ASSOCIATION ====================

    /**
     * Associate event with venue (update event's venue_id)
     */
    associateEventWithVenue(eventId, venueId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE events SET venue_id = ? WHERE id = ?`,
                [venueId, eventId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ event_id: eventId, venue_id: venueId });
                }
            );
        });
    }

    /**
     * Get events at a venue
     */
    getVenueEvents(venueId, futureOnly = true) {
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM events WHERE venue_id = ?`;
            const params = [venueId];

            if (futureOnly) {
                query += ` AND date >= date('now')`;
            }

            query += ` ORDER BY date ASC`;

            this.db.all(query, params, (err, events) => {
                if (err) return reject(err);
                resolve(events || []);
            });
        });
    }

    // ==================== SEARCH & DISCOVERY ====================

    /**
     * Search venues by name, category, or description
     */
    searchVenues(searchTerm) {
        return new Promise((resolve, reject) => {
            const term = `%${searchTerm}%`;
            this.db.all(
                `SELECT v.*,
                        COUNT(e.id) as upcoming_event_count
                 FROM venues v
                 LEFT JOIN events e ON v.id = e.venue_id AND e.date >= date('now')
                 WHERE v.is_active = 1 AND (
                    v.name LIKE ? OR
                    v.description LIKE ? OR
                    v.category LIKE ?
                 )
                 GROUP BY v.id
                 ORDER BY v.priority DESC, v.name ASC`,
                [term, term, term],
                (err, venues) => {
                    if (err) return reject(err);
                    resolve(venues || []);
                }
            );
        });
    }

    /**
     * Get venues by category
     */
    getVenuesByCategory(category) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT v.*,
                        COUNT(e.id) as upcoming_event_count
                 FROM venues v
                 LEFT JOIN events e ON v.id = e.venue_id AND e.date >= date('now')
                 WHERE v.is_active = 1 AND v.category = ?
                 GROUP BY v.id
                 ORDER BY v.priority DESC, v.name ASC`,
                [category],
                (err, venues) => {
                    if (err) return reject(err);
                    resolve(venues || []);
                }
            );
        });
    }

    /**
     * Get all unique categories
     */
    getCategories() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT DISTINCT category FROM venues
                 WHERE is_active = 1 AND category IS NOT NULL
                 ORDER BY category ASC`,
                (err, rows) => {
                    if (err) return reject(err);
                    const categories = rows.map(r => r.category);
                    resolve(categories);
                }
            );
        });
    }

    // ==================== STATISTICS ====================

    /**
     * Get venue statistics
     */
    getVenueStats() {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT
                    COUNT(DISTINCT v.id) as total_venues,
                    COUNT(DISTINCT v.city) as cities_covered,
                    COUNT(DISTINCT v.category) as categories,
                    COUNT(DISTINCT e.id) as upcoming_events
                 FROM venues v
                 LEFT JOIN events e ON v.id = e.venue_id AND e.date >= date('now')
                 WHERE v.is_active = 1`,
                (err, stats) => {
                    if (err) return reject(err);
                    resolve(stats);
                }
            );
        });
    }

    /**
     * Get venue stats by city
     */
    getStatsByCity() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT v.city,
                        COUNT(v.id) as venue_count,
                        COUNT(DISTINCT e.id) as event_count
                 FROM venues v
                 LEFT JOIN events e ON v.id = e.venue_id AND e.date >= date('now')
                 WHERE v.is_active = 1
                 GROUP BY v.city
                 ORDER BY venue_count DESC`,
                (err, stats) => {
                    if (err) return reject(err);
                    resolve(stats || []);
                }
            );
        });
    }

    // ==================== NAVIGATION HELPERS ====================

    /**
     * Get venue navigation info
     */
    getVenueNavigation(venueId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT id, name, city, website, phone, email, facebook_url, instagram_url
                 FROM venues WHERE id = ?`,
                [venueId],
                (err, venue) => {
                    if (err) return reject(err);
                    if (!venue) return resolve(null);

                    const navigation = {
                        id: venue.id,
                        name: venue.name,
                        city: venue.city,
                        links: {
                            website: venue.website || null,
                            facebook: venue.facebook_url || null,
                            instagram: venue.instagram_url || null,
                            phone: venue.phone || null,
                            email: venue.email || null
                        },
                        directions_url: `https://www.google.com/maps/search/${encodeURIComponent(venue.name + ' ' + venue.city + ' TX')}`
                    };

                    resolve(navigation);
                }
            );
        });
    }

    // ==================== IMAGE MANAGEMENT ====================

    /**
     * Update venue images
     */
    updateVenueImages(venueId, logoUrl, coverImageUrl) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE venues
                 SET logo_url = ?, cover_image_url = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [logoUrl, coverImageUrl, venueId],
                function(err) {
                    if (err) return reject(err);
                    resolve({
                        id: venueId,
                        logo_url: logoUrl,
                        cover_image_url: coverImageUrl
                    });
                }
            );
        });
    }

    // ==================== EXPORT/IMPORT ====================

    /**
     * Export all venues as JSON
     */
    exportVenues() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM venues WHERE is_active = 1 ORDER BY city, name`,
                (err, venues) => {
                    if (err) return reject(err);
                    resolve(venues || []);
                }
            );
        });
    }

    /**
     * Bulk import venues
     */
    bulkImportVenues(venuesArray) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO venues (
                    name, address, city, category, website, facebook_url,
                    instagram_url, phone, email, description, logo_url,
                    cover_image_url, is_active, priority
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `);

            let imported = 0;
            let errors = [];

            venuesArray.forEach((venue, index) => {
                stmt.run(
                    venue.name,
                    venue.address || '',
                    venue.city,
                    venue.category || 'Community Venue',
                    venue.website || '',
                    venue.facebook_url || '',
                    venue.instagram_url || '',
                    venue.phone || '',
                    venue.email || '',
                    venue.description || '',
                    venue.logo_url || '',
                    venue.cover_image_url || '',
                    venue.priority || 5,
                    (err) => {
                        if (err) {
                            errors.push({ index, venue: venue.name, error: err.message });
                        } else {
                            imported++;
                        }

                        // After all imports
                        if (index === venuesArray.length - 1) {
                            stmt.finalize(() => {
                                resolve({
                                    imported,
                                    failed: errors.length,
                                    errors: errors.length > 0 ? errors : null
                                });
                            });
                        }
                    }
                );
            });
        });
    }

    // ==================== CLEANUP ====================

    closeDatabase() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) console.error('Error closing database:', err);
                resolve();
            });
        });
    }
}

module.exports = VenueService;
