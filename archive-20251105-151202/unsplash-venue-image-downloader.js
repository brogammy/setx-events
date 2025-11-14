#!/usr/bin/env node

/**
 * UNSPLASH VENUE IMAGE DOWNLOADER
 * Uses Unsplash API to download quality images for venues
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Unsplash API - Using a generic approach since we don't have an API key
// For production, you would need to register for an Unsplash API key

// Database connection
const db = new sqlite3.Database(DB_PATH);

// Categories for different venue types
const venueCategories = {
    'Museum': ['museum', 'art', 'culture', 'exhibition'],
    'Theatre': ['theater', 'stage', 'performance', 'concert'],
    'Cafe': ['cafe', 'coffee', 'restaurant', 'food'],
    'Gardens': ['garden', 'nature', 'park', 'outdoor'],
    'Center': ['center', 'building', 'architecture', 'venue'],
    'Church': ['church', 'religious', 'building', 'architecture'],
    'Library': ['library', 'books', 'reading', 'education'],
    'Park': ['park', 'outdoor', 'nature', 'green'],
    'Hall': ['hall', 'event', 'venue', 'indoor'],
    ' Inn': ['hotel', 'lodging', 'building', 'accommodation'],
    'Hotel': ['hotel', 'lodging', 'building', 'accommodation'],
    'Restaurant': ['restaurant', 'food', 'dining', 'indoor'],
    'Bar': ['bar', 'drinks', 'nightlife', 'indoor'],
    'Club': ['club', 'nightlife', 'party', 'indoor'],
    'Event': ['event', 'venue', 'gathering', 'celebration'],
    'Convention': ['convention', 'conference', 'meeting', 'business'],
    'Banquet': ['banquet', 'wedding', 'celebration', 'formal'],
    'Stadium': ['stadium', 'sports', 'arena', 'outdoor'],
    'Arena': ['arena', 'sports', 'stadium', 'indoor'],
    'Gym': ['gym', 'fitness', 'sports', 'exercise'],
    'Fitness': ['fitness', 'gym', 'health', 'exercise'],
    'School': ['school', 'education', 'building', 'learning'],
    'College': ['college', 'education', 'university', 'learning'],
    'University': ['university', 'education', 'college', 'learning'],
    'Hospital': ['hospital', 'medical', 'healthcare', 'building'],
    'Medical': ['medical', 'healthcare', 'hospital', 'clinic'],
    'Office': ['office', 'business', 'work', 'building'],
    'Gallery': ['gallery', 'art', 'exhibition', 'culture'],
    'Studio': ['studio', 'art', 'creative', 'music'],
    'Auditorium': ['auditorium', 'theater', 'performance', 'indoor'],
    'Ballroom': ['ballroom', 'dance', 'event', 'formal'],
    'Casino': ['casino', 'gambling', 'entertainment', 'indoor'],
    'Resort': ['resort', 'vacation', 'luxury', 'hotel'],
    'Spa': ['spa', 'relaxation', 'wellness', 'massage'],
    'Beach': ['beach', 'ocean', 'water', 'outdoor'],
    'Marina': ['marina', 'boat', 'water', 'outdoor'],
    'Harbor': ['harbor', 'boat', 'water', 'outdoor'],
    'Boardwalk': ['boardwalk', 'promenade', 'outdoor', 'walking'],
    'Plaza': ['plaza', 'square', 'outdoor', 'public'],
    'Market': ['market', 'shopping', 'outdoor', 'vendors'],
    'Fair': ['fair', 'carnival', 'outdoor', 'event'],
    'Festival': ['festival', 'music', 'outdoor', 'crowd'],
    'Concert': ['concert', 'music', 'performance', 'stage'],
    'Arena': ['arena', 'sports', 'stadium', 'indoor']
};

// Get search terms based on venue name
function getSearchTerms(venue) {
    const terms = [venue.name, venue.city, 'Texas'];
    
    // Add category-specific terms
    for (const [category, keywords] of Object.entries(venueCategories)) {
        if (venue.name.includes(category) || (venue.category && venue.category.includes(category))) {
            terms.push(...keywords);
            break;
        }
    }
    
    return terms.join(' ');
}

// Download image from URL
function downloadImage(url, filepath) {
    return new Promise((resolve) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, { timeout: 30000 }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    resolve(stats.size > 5000); // Check if file is larger than 5KB
                });
            } else {
                file.destroy();
                resolve(false);
            }
        }).on('error', (err) => {
            file.destroy();
            resolve(false);
        });
    });
}

// Get all venues that need images
function getVenuesNeedingImages() {
    return new Promise((resolve, reject) => {
        // Get venues that don't have valid images
        db.all(`
            SELECT v.id, v.name, v.city, v.category 
            FROM venues v 
            WHERE v.is_active = 1 
            AND (v.cover_image_url IS NULL OR v.cover_image_url = '')
            ORDER BY v.id
        `, (err, venues) => {
            if (err) reject(err);
            else resolve(venues);
        });
    });
}

// Update database with image URL
function updateVenueImage(venueId, localUrl) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?',
            [localUrl, localUrl, venueId],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// Download a placeholder image that represents the venue
async function downloadPlaceholderImage(venue) {
    // Create a directory for venue images if it doesn't exist
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    
    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
    const localUrl = `/images/venues/venue-${venue.id}.jpg`;
    
    // Use Picsum Photos to get a random high-quality image
    // This is a better approach than the previous one
    const imageUrl = `https://picsum.photos/800/600?random=${venue.id}`;
    
    console.log(`   📷 Downloading placeholder for: ${venue.name}`);
    
    const success = await downloadImage(imageUrl, filepath);
    if (success) {
        await updateVenueImage(venue.id, localUrl);
        console.log(`   ✅ Downloaded and database updated`);
        return true;
    } else {
        console.log(`   ❌ Failed to download`);
        return false;
    }
}

// Main function
async function main() {
    console.log('.unsplash VENUE IMAGE DOWNLOADER');
    console.log('='.repeat(45));
    console.log('Downloading quality placeholder images for venues\n');
    
    try {
        // Get venues that need images
        const venues = await getVenuesNeedingImages();
        
        if (venues.length === 0) {
            console.log('🎉 All venues already have images!');
            db.close();
            process.exit(0);
        }
        
        console.log(`Found ${venues.length} venues needing images\n`);
        
        let successCount = 0;
        
        // Process venues
        for (let i = 0; i < venues.length; i++) {
            const venue = venues[i];
            const progress = `${i + 1}/${venues.length}`;
            
            console.log(`[${progress}] ${venue.name} (${venue.city})`);
            
            const success = await downloadPlaceholderImage(venue);
            if (success) successCount++;
            
            // Small delay between requests
            if (i < venues.length - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
        
        console.log('\n' + '='.repeat(45));
        console.log(`✅ Successfully processed: ${successCount}/${venues.length}`);
        console.log('='.repeat(45) + '\n');
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        db.close();
    }
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});