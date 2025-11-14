/**
 * VENUE API ROUTES - Enhanced Venue Management
 *
 * Comprehensive endpoints for venue discovery and management:
 * - GET /api/venues - List all venues with filters
 * - GET /api/venues/top - Top venues by events
 * - GET /api/venues/search - Search venues
 * - GET /api/venues/:id - Full venue profile with events
 * - GET /api/venues/:id/events - Upcoming events at venue
 * - GET /api/venues/:id/navigate - Navigation info & directions
 * - POST /api/venues - Create new venue
 * - PUT /api/venues/:id - Update venue
 * - DELETE /api/venues/:id - Delete venue
 * - GET /api/venues/categories - Get all categories
 * - GET /api/venue-stats - Venue statistics
 * - POST /api/venues/import - Bulk import venues
 */

const VenueService = require('./venue-service');

function setupVenueRoutes(app) {
    const venueService = new VenueService();

    // ==================== LIST & DISCOVERY ====================

    /**
     * GET /api/venues
     * List all venues with optional filters
     * Query params: city, category, search
     */
    app.get('/api/venues', async (req, res) => {
        try {
            const { city, category, search } = req.query;
            const filters = {};
            if (city) filters.city = city;
            if (category) filters.category = category;
            if (search) filters.search = search;

            const venues = await venueService.getAllVenues(filters);
            res.json({
                count: venues.length,
                venues: venues
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/venues/by-city
     * Group venues by city
     */
    app.get('/api/venues/by-city', async (req, res) => {
        try {
            const stats = await venueService.getStatsByCity();
            const cities = {};

            for (const stat of stats) {
                cities[stat.city] = {
                    venue_count: stat.venue_count,
                    event_count: stat.event_count
                };
            }

            res.json(cities);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/venues/top
     * Get top venues by number of upcoming events
     * Query params: limit (default 10)
     */
    app.get('/api/venues/top', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const venues = await venueService.getTopVenues(limit);
            res.json({
                count: venues.length,
                venues: venues
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/venues/search
     * Search venues by name, category, or description
     * Query params: q (search term)
     */
    app.get('/api/venues/search', async (req, res) => {
        try {
            const searchTerm = req.query.q;
            if (!searchTerm || searchTerm.length < 2) {
                return res.status(400).json({
                    error: 'Search term must be at least 2 characters'
                });
            }

            const venues = await venueService.searchVenues(searchTerm);
            res.json({
                search_term: searchTerm,
                count: venues.length,
                venues: venues
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/venues/categories
     * Get all unique venue categories
     */
    app.get('/api/venues/categories', async (req, res) => {
        try {
            const categories = await venueService.getCategories();
            res.json({
                count: categories.length,
                categories: categories
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/venues/stats
     * Get overall venue statistics
     */
    app.get('/api/venues/stats', async (req, res) => {
        try {
            const stats = await venueService.getVenueStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ==================== SINGLE VENUE DETAIL ====================

    /**
     * GET /api/venues/:id
     * Get complete venue profile with upcoming events
     */
    app.get('/api/venues/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const venue = await venueService.getVenueWithEvents(id);

            if (!venue) {
                return res.status(404).json({ error: 'Venue not found' });
            }

            res.json(venue);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/venues/:id/events
     * Get all upcoming events at a specific venue
     * Query params: past (true to include past events)
     */
    app.get('/api/venues/:id/events', async (req, res) => {
        try {
            const { id } = req.params;
            const includePast = req.query.past === 'true';
            const events = await venueService.getVenueEvents(id, !includePast);

            res.json({
                venue_id: id,
                event_count: events.length,
                events: events
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/venues/:id/navigate
     * Get navigation links and directions for venue
     */
    app.get('/api/venues/:id/navigate', async (req, res) => {
        try {
            const { id } = req.params;
            const navigation = await venueService.getVenueNavigation(id);

            if (!navigation) {
                return res.status(404).json({ error: 'Venue not found' });
            }

            res.json(navigation);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ==================== VENUE MANAGEMENT ====================

    /**
     * POST /api/venues
     * Create new venue
     */
    app.post('/api/venues', async (req, res) => {
        try {
            const { name, address, city, category, website, facebook_url,
                    instagram_url, phone, email, description, logo_url, cover_image_url } = req.body;

            if (!name || !city) {
                return res.status(400).json({
                    error: 'Name and city are required'
                });
            }

            const venue = await venueService.createVenue({
                name, address, city, category, website, facebook_url,
                instagram_url, phone, email, description, logo_url, cover_image_url
            });

            res.status(201).json({
                message: 'Venue created successfully',
                venue: venue
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * PUT /api/venues/:id
     * Update venue information
     */
    app.put('/api/venues/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            const venue = await venueService.updateVenue(id, updates);

            res.json({
                message: 'Venue updated successfully',
                venue: venue
            });
        } catch (error) {
            if (error.message === 'Venue not found') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });

    /**
     * DELETE /api/venues/:id
     * Delete venue (soft delete)
     */
    app.delete('/api/venues/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await venueService.deleteVenue(id);

            res.json({
                message: 'Venue deleted successfully',
                venue_id: id
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * PUT /api/venues/:id/images
     * Update venue images
     */
    app.put('/api/venues/:id/images', async (req, res) => {
        try {
            const { id } = req.params;
            const { logo_url, cover_image_url } = req.body;

            const result = await venueService.updateVenueImages(id, logo_url, cover_image_url);

            res.json({
                message: 'Images updated successfully',
                result: result
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ==================== BULK OPERATIONS ====================

    /**
     * POST /api/venues/import
     * Bulk import venues from JSON array
     * Body: { venues: [...] }
     */
    app.post('/api/venues/import', async (req, res) => {
        try {
            const { venues } = req.body;

            if (!Array.isArray(venues)) {
                return res.status(400).json({
                    error: 'Venues must be an array'
                });
            }

            const result = await venueService.bulkImportVenues(venues);

            res.json({
                message: `Imported ${result.imported} venues`,
                imported: result.imported,
                failed: result.failed,
                errors: result.errors
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/venues/export
     * Export all venues as JSON
     */
    app.get('/api/venues/export', async (req, res) => {
        try {
            const venues = await venueService.exportVenues();

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=venues.json');
            res.json({
                exported_at: new Date().toISOString(),
                count: venues.length,
                venues: venues
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return venueService;
}

module.exports = setupVenueRoutes;
