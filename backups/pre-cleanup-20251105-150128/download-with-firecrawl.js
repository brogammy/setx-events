#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = 'fc-a0cc106a4ab3406f80cfabf625b75f53';
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Venues with their best info for finding
const venues = [
  { id: 3, name: 'Museum of the Gulf Coast', city: 'Port Arthur' },
  { id: 5, name: 'Beaumont Civic Centre', city: 'Beaumont' },
  { id: 6, name: 'Tevis Room', city: 'Beaumont' },
  { id: 7, name: 'Julie Rogers Theatre', city: 'Beaumont' },
  { id: 8, name: 'Jefferson Theatre', city: 'Beaumont' },
  { id: 9, name: 'Downtown Event Centre', city: 'Beaumont' },
  { id: 10, name: 'Art Museum of Southeast Texas', city: 'Beaumont' },
  { id: 11, name: 'Ford Park Entertainment Complex', city: 'Beaumont' },
  { id: 12, name: 'The Venue at Belle Oaks', city: 'Beaumont' },
  { id: 13, name: 'Be308', city: 'Beaumont' },
  { id: 14, name: 'The Laurels', city: 'Beaumont' },
  { id: 15, name: "Courville's", city: 'Beaumont' },
  { id: 16, name: 'Cattail Marsh', city: 'Beaumont' },
  { id: 17, name: 'Holiday Inn Beaumont', city: 'Beaumont' },
  { id: 18, name: 'Sonesta Essential Beaumont', city: 'Beaumont' },
  { id: 19, name: 'Quality Inn and Suites', city: 'Beaumont' },
  { id: 20, name: 'The Venue at Max Bowl', city: 'Port Arthur' },
  { id: 21, name: 'Holiday Inn Port Arthur', city: 'Port Arthur' },
  { id: 23, name: 'Rose Hill Manor', city: 'Port Arthur' },
  { id: 24, name: 'Port Arthur Public Library', city: 'Port Arthur' },
  { id: 25, name: 'Port Arthur Civic Center', city: 'Port Arthur' },
  { id: 26, name: 'PACE', city: 'Port Arthur' },
  { id: 27, name: "St. John's Catholic Church", city: 'Port Arthur' },
  { id: 28, name: 'St. James Kirwin Hall', city: 'Port Arthur' },
  { id: 29, name: 'Port Arthur Little Theatre', city: 'Port Arthur' },
  { id: 30, name: 'Knights of Columbus', city: 'Port Arthur' },
  { id: 31, name: "Wellborn's", city: 'Port Arthur' },
  { id: 32, name: 'Ramada Inn Port Arthur', city: 'Port Arthur' },
  { id: 33, name: 'Department Club', city: 'Port Arthur' },
  { id: 34, name: 'Riverfront Boardwalk', city: 'Orange' },
  { id: 35, name: 'Riverside Pavilion', city: 'Orange' },
  { id: 36, name: 'City of Orange Boat Ramp', city: 'Orange' },
  { id: 37, name: "Isabella's Banquet Hall", city: 'Orange' },
  { id: 38, name: 'SureStay by Best Western', city: 'Orange' },
  { id: 39, name: 'The Neches Room', city: 'Orange' },
  { id: 40, name: 'Angel Gardens', city: 'Orange' },
  { id: 41, name: 'Shangri La Botanical Gardens', city: 'Orange' },
  { id: 42, name: 'The Garden District', city: 'Orange' },
  { id: 43, name: 'The Brown Estate', city: 'Orange' },
  { id: 44, name: 'James Hall Event Center', city: 'Nederland' },
  { id: 45, name: 'The Hidden Barn', city: 'Nederland' },
  { id: 46, name: 'Holiday Inn Nederland', city: 'Nederland' },
  { id: 47, name: 'Evergreen Event Center', city: 'Vidor' },
  { id: 48, name: 'The Plaza Event Center', city: 'Vidor' },
  { id: 49, name: 'The Oaks Event Center', city: 'Vidor' },
  { id: 50, name: "Benoit's Louis Hall", city: 'Vidor' },
  { id: 51, name: 'Honky Tonk Texas', city: 'Silsbee' },
  { id: 52, name: 'The Foundry Venue', city: 'Silsbee' },
  { id: 53, name: 'Whispering Pines Event Center', city: 'Silsbee' },
  { id: 54, name: 'Cloud Agent Test Venue', city: 'Beaumont' },
];

function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : require('http');
    const file = fs.createWriteStream(filepath);

    protocol.get(url, { timeout: 15000 }, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          try {
            const stats = fs.statSync(filepath);
            resolve(stats.size > 5000);
          } catch (e) {
            resolve(false);
          }
        });
      } else {
        file.destroy();
        resolve(false);
      }
    }).on('error', () => {
      file.destroy();
      resolve(false);
    });
  });
}

function scrapeWithFirecrawl(searchTerm) {
  return new Promise((resolve) => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}&tbm=isch`;

    const payload = JSON.stringify({
      url: url,
      formats: ['markdown']
    });

    const options = {
      hostname: 'api.firecrawl.dev',
      path: '/v0/scrape',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success) {
            const content = json.markdown || '';
            // Extract image URLs from the content
            const imageUrls = [];
            const urlRegex = /https?:\/\/[^\s"<>]+\.(?:jpg|jpeg|png|gif|webp)/gi;
            let match;
            while ((match = urlRegex.exec(content)) !== null) {
              imageUrls.push(match[0]);
            }
            resolve(imageUrls.slice(0, 5)); // Return first 5 URLs
          } else {
            resolve([]);
          }
        } catch (e) {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });

    req.write(payload);
    req.end();
  });
}

async function processVenue(venue) {
  const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
  if (fs.existsSync(filepath)) {
    console.log(`[${venue.id}] ${venue.name} - Already exists`);
    return true;
  }

  process.stdout.write(`[${venue.id}] ${venue.name}... `);

  try {
    const searchTerm = `${venue.name} ${venue.city} Texas`;
    const imageUrls = await scrapeWithFirecrawl(searchTerm);

    if (imageUrls.length === 0) {
      console.log('❌ No URLs found');
      return false;
    }

    // Try each image URL until one succeeds
    for (const imgUrl of imageUrls) {
      const success = await downloadImage(imgUrl, filepath);
      if (success) {
        const size = fs.statSync(filepath).size;
        console.log(`✅ (${(size / 1024).toFixed(1)}KB)`);
        return true;
      }
    }

    console.log('❌ Download failed');
    return false;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔥 FIRECRAWL VENUE IMAGE DOWNLOADER\n');
  console.log('Using Firecrawl to scrape Google Images for venue photos...\n');

  let success = 0;
  let fail = 0;

  for (const venue of venues) {
    const result = await processVenue(venue);
    if (result) success++;
    else fail++;
    // Delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${fail}`);
  const images = fs.readdirSync(IMAGES_DIR).filter(f => f.startsWith('venue-') && f.endsWith('.jpg'));
  console.log(`Total images: ${images.length}/54`);
  console.log('='.repeat(60) + '\n');

  process.exit(0);
}

main();
