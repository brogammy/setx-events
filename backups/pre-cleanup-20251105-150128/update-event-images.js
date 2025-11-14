const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('Connected to database');
});

// Color palette for different categories
const categoryColors = {
    'Food & Drink': 'FFA500',
    'Music': 'FF6B6B',
    'Theater': '4ECDC4',
    'Festival': 'FFE66D',
    'Sports': '95E1D3',
    'Museum': '5D5B8C',
    'Arts & Entertainment': 'FF6B6B',
    'Performing Arts': '4ECDC4',
    'Convention Center': '9B59B6',
    'Hotel': 'E67E22',
    'Music Venue': 'FF6B6B',
    'Community Event': '3498DB',
    'Cultural Event': '1ABC9C',
    'Outdoor Venue': '2ECC71',
    'Event Venue / Banquet Hall': 'E74C3C',
};

// Get random color for category
function getColorForCategory(category) {
    return categoryColors[category] || 'cccccc';
}

db.all('SELECT id, title, category FROM events', (err, events) => {
    if (err) {
        console.error('Error getting events:', err.message);
        db.close();
        process.exit(1);
    }

    if (!events || events.length === 0) {
        console.log('No events found');
        db.close();
        process.exit(0);
    }

    console.log(`Found ${events.length} events`);

    let updated = 0;

    events.forEach(event => {
        // Use placeholder.com which is more reliable
        const color = getColorForCategory(event.category);
        const imageUrl = `https://placehold.co/400x300/${color}/ffffff?text=${encodeURIComponent(event.title.substring(0, 30))}`;

        db.run(
            'UPDATE events SET image_url = ? WHERE id = ?',
            [imageUrl, event.id],
            (updateErr) => {
                if (updateErr) {
                    console.error(`Error updating event ${event.id}:`, updateErr.message);
                } else {
                    updated++;
                    console.log(`✓ Updated: ${event.title.substring(0, 40)}`);
                }

                if (updated === events.length) {
                    console.log(`\n✅ Successfully updated ${updated} event image URLs`);
                    db.close();
                    process.exit(0);
                }
            }
        );
    });
});
