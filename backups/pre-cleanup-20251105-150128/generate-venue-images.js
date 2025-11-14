const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const imagesDir = path.join(__dirname, 'public/images/venues');

// Create images directory if it doesn't exist
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('Connected to database');
});

// Generate a simple SVG image for a venue
function generateVenueImage(venueName, venuePath) {
    // Use venue name to generate consistent colors
    const hash = venueName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    const saturation = 70 + (hash % 30);
    const lightness = 50 + (hash % 20);

    const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const textColor = lightness > 60 ? '#000' : '#fff';

    // Truncate venue name for display
    const displayName = venueName.length > 20 ? venueName.substring(0, 20) + '...' : venueName;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="400" fill="${bgColor}"/>
    <text x="400" y="150" font-size="48" font-weight="bold" text-anchor="middle" fill="${textColor}" font-family="Arial, sans-serif">
        ${escapeXml(displayName)}
    </text>
    <text x="400" y="280" font-size="32" text-anchor="middle" fill="${textColor}" font-family="Arial, sans-serif" opacity="0.8">
        SETX Events
    </text>
    <rect x="350" y="320" width="100" height="4" fill="${textColor}" opacity="0.5"/>
</svg>`;

    fs.writeFileSync(venuePath, svg);
    return true;
}

function escapeXml(str) {
    return String(str).replace(/[<>&'"]/g, function(c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// Get all venues and generate images
db.all('SELECT id, name FROM venues WHERE is_active = 1', (err, venues) => {
    if (err) {
        console.error('Error getting venues:', err.message);
        db.close();
        process.exit(1);
    }

    if (!venues || venues.length === 0) {
        console.log('No venues found');
        db.close();
        process.exit(0);
    }

    console.log(`Found ${venues.length} venues`);

    let updated = 0;

    venues.forEach(venue => {
        const imageFilename = `venue-${venue.id}-cover.svg`;
        const imagePath = path.join(imagesDir, imageFilename);
        const imageUrl = `/images/venues/${imageFilename}`;

        try {
            generateVenueImage(venue.name, imagePath);

            // Update database
            db.run(
                'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
                [imageUrl, imageUrl, venue.id],
                (updateErr) => {
                    if (updateErr) {
                        console.error(`Error updating venue ${venue.id}:`, updateErr.message);
                    } else {
                        updated++;
                        console.log(`✓ Generated image for: ${venue.name}`);
                    }

                    if (updated === venues.length) {
                        console.log(`\n✅ Successfully generated ${updated} venue images`);
                        db.close();
                        process.exit(0);
                    }
                }
            );
        } catch (e) {
            console.error(`Error generating image for venue ${venue.id}:`, e.message);
        }
    });
});
