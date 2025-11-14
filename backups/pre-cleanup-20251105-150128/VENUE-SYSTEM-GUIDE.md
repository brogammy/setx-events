# VENUE MANAGEMENT SYSTEM - COMPLETE GUIDE

## Overview

Complete venue management system with contact data, images, event associations, and admin panel.

---

## Features

### ✅ Complete Venue Data
- **Basic Info:** Name, address, city, category
- **Contact:** Phone, email, website
- **Social Media:** Facebook, Instagram URLs
- **Media:** Logo and cover images
- **Details:** Description, priority level
- **Status:** Active/inactive tracking

### ✅ Event Integration
- Link events to specific venues
- Show upcoming events for each venue
- Event count tracking per venue
- Filter by venue

### ✅ Admin Panel
- Dashboard with statistics
- Create, read, update, delete venues
- Search and filter venues
- Bulk import from JSON
- Export all venues
- Full CRUD operations

### ✅ Navigation Links
- Direct website links
- Google Maps directions
- Phone numbers for calling
- Email for contact
- Social media integration

### ✅ Image Management
- Logo URL storage
- Cover image URL storage
- Image URLs for frontend display
- Placeholders for missing images

---

## Database Schema

### Venues Table
```sql
CREATE TABLE venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT NOT NULL,
    category TEXT,
    website TEXT,
    facebook_url TEXT,
    instagram_url TEXT,
    phone TEXT,
    email TEXT,
    description TEXT,
    logo_url TEXT,
    cover_image_url TEXT,
    is_active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Associations
- **Events.venue_id** → Venues.id (links events to venues)
- All fields optional except name and city

---

## API Endpoints

### List & Discovery

**GET /api/venues**
- Returns all active venues with event counts
- Query params: `city`, `category`, `search`
- Response: `{ count: N, venues: [...] }`

**GET /api/venues/top**
- Returns venues with most upcoming events
- Query params: `limit` (default 10)
- Response: Sorted by event count

**GET /api/venues/search**
- Search by name, category, description
- Query param: `q` (search term, min 2 chars)
- Response: Matching venues

**GET /api/venues/categories**
- Get all unique venue categories
- Response: Array of category names

**GET /api/venues/stats**
- Overall system statistics
- Response: `{ total_venues, cities_covered, categories, upcoming_events }`

**GET /api/venues/by-city**
- Venues grouped by city
- Response: `{ city: { venue_count, event_count }, ... }`

### Single Venue

**GET /api/venues/:id**
- Complete venue profile with upcoming events
- Response: Venue object + upcoming_events array

**GET /api/venues/:id/events**
- All events at venue
- Query param: `past=true` to include past events
- Response: `{ venue_id, event_count, events: [...] }`

**GET /api/venues/:id/navigate**
- Navigation information
- Response: Navigation links, directions URL, contact info

### Management

**POST /api/venues**
- Create new venue
- Body: Venue object (name, city required)
- Response: Created venue with ID

**PUT /api/venues/:id**
- Update venue information
- Body: Partial or complete venue object
- Response: Updated venue

**DELETE /api/venues/:id**
- Soft delete (sets is_active=0)
- Response: Confirmation

**PUT /api/venues/:id/images**
- Update venue images
- Body: `{ logo_url, cover_image_url }`
- Response: Updated URLs

### Bulk Operations

**POST /api/venues/import**
- Bulk import venues from JSON array
- Body: `{ venues: [{ name, city, ...}, ...] }`
- Response: `{ imported, failed, errors }`

**GET /api/venues/export**
- Export all venues as JSON download
- Response: JSON file download

---

## Admin Panel

### Accessing the Panel
```
http://localhost:3001/venue-admin.html
```

### Dashboard
- Total venues count
- Cities covered
- Categories available
- Upcoming events total
- Recent venues list

### All Venues Section
- View all venues
- Search by name/category
- Quick edit/delete buttons
- View detailed information
- Contact information display

### Add Venue Section
- Complete form with all fields
- City dropdown (6 SETX cities)
- Category input
- Priority level (1-10)
- All contact information
- Image URLs
- Full description

### Bulk Import Section
- Paste JSON array of venues
- Import multiple venues at once
- Error reporting
- Validation feedback

### Export Section
- Download all venues as JSON
- JSON preview in browser
- Formatted and ready to use
- Backup capability

---

## Using the Venue Service (Programmatic)

### Import the Service
```javascript
const VenueService = require('./venue-service');
const venueService = new VenueService();
```

### Get All Venues
```javascript
const venues = await venueService.getAllVenues({
    city: 'Beaumont',
    category: 'Music Venue',
    search: 'jazz'
});
```

### Get Venue with Events
```javascript
const venue = await venueService.getVenueWithEvents(venueId);
// Returns: {
//   id, name, address, city, ...
//   upcoming_events: [...]
// }
```

### Create Venue
```javascript
const newVenue = await venueService.createVenue({
    name: 'New Venue',
    city: 'Beaumont',
    category: 'Music Venue',
    phone: '409-123-4567',
    website: 'https://venue.com'
});
```

### Update Venue
```javascript
const updated = await venueService.updateVenue(venueId, {
    phone: '409-987-6543',
    description: 'Updated description'
});
```

### Search Venues
```javascript
const results = await venueService.searchVenues('jazz');
```

### Get Venue Stats
```javascript
const stats = await venueService.getVenueStats();
// Returns: {
//   total_venues: 50,
//   cities_covered: 6,
//   categories: 15,
//   upcoming_events: 200
// }
```

### Bulk Import
```javascript
const result = await venueService.bulkImportVenues([
    {
        name: 'Venue 1',
        city: 'Beaumont',
        category: 'Theater',
        phone: '409-111-1111'
    },
    // ... more venues
]);
// Returns: { imported: 50, failed: 2, errors: [...] }
```

---

## Integration with Scrapers

### Update Perplexity Scraper

In `ai-scraper-memory-enabled.js`, add venue association:

```javascript
async scrapeVenueWithAI(venue) {
    // ... existing scraping code ...

    for (const event of events) {
        event.venue_id = venue.id;  // ADD THIS LINE
        await this.saveEvent(event, venue);
    }
}
```

### Update Ollama Scraper

In `ollama-agent-learner.js`, add venue association:

```javascript
for (const event of events) {
    event.venue_id = venue.id;  // ADD THIS LINE
    const saved = await this.saveEvent(event, venue);
}
```

### Update API Event Creation

In API `/api/events` POST handler, accept venue_id:

```javascript
const { title, date, time, location, city, category,
        description, source_url, venue_id } = req.body;

// Then in INSERT:
INSERT INTO events (..., venue_id)
VALUES (..., ?)
```

---

## Bulk Venue Import Format

### JSON Structure
```json
[
  {
    "name": "Julie Rogers Theatre",
    "address": "750 Main Street",
    "city": "Beaumont",
    "category": "Performing Arts",
    "website": "https://www.julierogerstheatre.com",
    "facebook_url": "https://www.facebook.com/JulieRogersTheatre",
    "instagram_url": "@julierogerstheatre",
    "phone": "409-838-3435",
    "email": "info@julierogerstheatre.com",
    "description": "Historic theater featuring Broadway shows, concerts, and local performances",
    "logo_url": "https://example.com/logo.png",
    "cover_image_url": "https://example.com/cover.jpg",
    "priority": 9
  }
]
```

### Import Steps
1. Open admin panel: `/venue-admin.html`
2. Go to "Bulk Import" section
3. Paste JSON array into textarea
4. Click "Import Venues"
5. See results with import count and any errors

---

## Frontend Integration

### Display Venue Info in Event Details
```html
<div class="event-venue">
    <h3>{{event.venue_name}}</h3>
    <p>{{event.location}}</p>
    {{#if event.phone}}
        <a href="tel:{{event.phone}}">📞 {{event.phone}}</a>
    {{/if}}
    {{#if event.website}}
        <a href="{{event.website}}" target="_blank">🔗 Website</a>
    {{/if}}
</div>
```

### Show Venues Directory
```javascript
// Fetch all venues
fetch('/api/venues')
    .then(r => r.json())
    .then(data => {
        // Group by city
        const byCity = {};
        data.venues.forEach(v => {
            if (!byCity[v.city]) byCity[v.city] = [];
            byCity[v.city].push(v);
        });

        // Display grouped venues
        Object.entries(byCity).forEach(([city, venues]) => {
            console.log(`${city}: ${venues.length} venues`);
        });
    });
```

### Display Venue with Events
```javascript
fetch(`/api/venues/5`)  // Get venue 5
    .then(r => r.json())
    .then(venue => {
        console.log(venue.name);
        console.log(venue.phone);
        console.log(venue.upcoming_events);  // All events at this venue
    });
```

---

## Best Practices

### Adding Venues
1. ✅ Use all REQUIRED fields (name, city)
2. ✅ Set correct category
3. ✅ Provide contact information
4. ✅ Add website and social links
5. ✅ Include description
6. ✅ Set priority (1-10, higher = more important)

### Maintaining Data
1. ✅ Keep contact info current
2. ✅ Update images periodically
3. ✅ Remove inactive venues (soft delete)
4. ✅ Regular exports for backup
5. ✅ Monitor priority levels

### Using Admin Panel
1. ✅ Dashboard first (check statistics)
2. ✅ Search before adding (avoid duplicates)
3. ✅ Bulk import for large datasets
4. ✅ Regular exports for backup
5. ✅ Use edit function for corrections

---

## Common Tasks

### Add a Single Venue
1. Go to Admin Panel → Add Venue
2. Fill in all fields
3. Click Create Venue
4. Verify in All Venues section

### Add Multiple Venues
1. Prepare JSON array
2. Go to Admin Panel → Bulk Import
3. Paste JSON
4. Click Import

### Update Venue Info
1. Go to Admin Panel → All Venues
2. Find venue and click Edit
3. Update fields
4. Save Changes

### Get Venues in a City
```
GET /api/venues?city=Beaumont
```

### Find Venues with Events
```
GET /api/venues/top?limit=20
```

### Search for Venue
```
GET /api/venues/search?q=theater
```

### Get Navigation Info
```
GET /api/venues/5/navigate
```

---

## Statistics & Monitoring

### Dashboard Metrics
- **Total Venues:** Active venue count
- **Cities Covered:** How many SETX cities
- **Categories:** Unique venue types
- **Upcoming Events:** Total events across all venues

### Per-City Statistics
```
GET /api/venues/by-city
```

Returns venue and event counts per city.

### Venue-Specific Stats
```
GET /api/venues/:id
```

Includes `upcoming_events` array count.

---

## Troubleshooting

### Venue Not Showing Up
- Check `is_active = 1` in database
- Verify city is correct (case-sensitive)
- Ensure name is not empty

### Events Not Linked to Venue
- Set `venue_id` in event creation
- Make sure venue exists
- Check event API payload

### Images Not Displaying
- Verify URL format (http:// or https://)
- Check URL is accessible
- Use absolute URLs, not relative

### Bulk Import Failing
- Validate JSON syntax (use JSON validator)
- Ensure required fields present
- Check for duplicate venues

---

## Setup Checklist

- [ ] Venue service (`venue-service.js`) added
- [ ] API routes (`venue-api-routes.js`) integrated into api-server.js
- [ ] Admin panel (`venue-admin.html`) accessible at `/venue-admin.html`
- [ ] Test creating a venue via admin panel
- [ ] Test importing venues via bulk import
- [ ] Test all API endpoints
- [ ] Update scrapers to use venue_id
- [ ] Export initial venue data for backup
- [ ] Train Perplexity on full venue database
- [ ] Train Ollama with learned venue patterns

---

## Next Steps

1. **Populate Venues:** Add 50-70 venues across SE Texas
2. **Train System:** Run Perplexity scraper on all venues
3. **Scrape Events:** Generate 300+ events from venues
4. **Train Ollama:** Let Ollama learn from Perplexity's output
5. **Display Events:** Show events grouped by venue
6. **Monitor:** Track venue coverage and event counts

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/venues` | GET | List all venues |
| `/api/venues/search` | GET | Search venues |
| `/api/venues/top` | GET | Top venues by events |
| `/api/venues/categories` | GET | Get categories |
| `/api/venues/stats` | GET | System statistics |
| `/api/venues/:id` | GET | Get venue with events |
| `/api/venues/:id/events` | GET | Get venue events |
| `/api/venues/:id/navigate` | GET | Get navigation links |
| `/api/venues` | POST | Create venue |
| `/api/venues/:id` | PUT | Update venue |
| `/api/venues/:id` | DELETE | Delete venue |
| `/api/venues/import` | POST | Bulk import |
| `/api/venues/export` | GET | Export venues |

---

## Complete System Architecture

```
┌─────────────────────────────────────┐
│     VENUE MANAGEMENT SYSTEM         │
├─────────────────────────────────────┤
│                                     │
│  Admin Panel (venue-admin.html)    │
│  ├─ Dashboard                      │
│  ├─ All Venues (CRUD)             │
│  ├─ Add Venue                      │
│  ├─ Bulk Import                    │
│  └─ Export                         │
│           ↓                         │
│  Venue API Routes                  │
│  ├─ List/Search                    │
│  ├─ Get Single                     │
│  ├─ Get With Events                │
│  ├─ Navigation Info                │
│  └─ Management (CRUD)              │
│           ↓                         │
│  Venue Service                     │
│  ├─ Database Access                │
│  ├─ Business Logic                 │
│  ├─ Bulk Operations                │
│  └─ Statistics                     │
│           ↓                         │
│  SQLite Database                   │
│  ├─ Venues Table                   │
│  ├─ Events Table (with venue_id)   │
│  └─ Supporting Tables              │
│                                     │
└─────────────────────────────────────┘
```

---

You now have a complete, professional-grade venue management system with full CRUD operations, image handling, contact information, event associations, and a beautiful admin panel!
