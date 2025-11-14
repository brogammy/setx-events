#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = 'fc-a0cc106a4ab3406f80cfabf625b75f53';
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Venues with their website URLs
const venues = [
  { id: 3, name: 'Museum of the Gulf Coast', city: 'Port Arthur', search: 'Museum of the Gulf Coast Port Arthur' },
  { id: 5, name: 'Beaumont Civic Centre', city: 'Beaumont', search: 'Beaumont Civic Centre' },
  { id: 6, name: 'Tevis Room', city: 'Beaumont', search: 'Tevis Room Beaumont' },
  { id: 7, name: 'Julie Rogers Theatre', city: 'Beaumont', search: 'Julie Rogers Theatre Beaumont' },
  { id: 8, name: 'Jefferson Theatre', city: 'Beaumont', search: 'Jefferson Theatre Beaumont' },
  { id: 9, name: 'Downtown Event Centre', city: 'Beaumont', search: 'Downtown Event Centre Beaumont' },
  { id: 10, name: 'Art Museum of Southeast Texas', city: 'Beaumont', search: 'Art Museum Southeast Texas' },
  { id: 11, name: 'Ford Park Entertainment Complex', city: 'Beaumont', search: 'Ford Park Beaumont' },
  { id: 12, name: 'The Venue at Belle Oaks', city: 'Beaumont', search: 'The Venue Belle Oaks Beaumont' },
  { id: 13, name: 'Be308', city: 'Beaumont', search: 'Be308 Beaumont' },
  { id: 14, name: 'The Laurels', city: 'Beaumont', search: 'The Laurels Beaumont' },
  { id: 15, name: "Courville's", city: 'Beaumont', search: "Courville's Beaumont" },
  { id: 16, name: 'Cattail Marsh', city: 'Beaumont', search: 'Cattail Marsh Beaumont' },
  { id: 17, name: 'Holiday Inn Beaumont', city: 'Beaumont', search: 'Holiday Inn Beaumont' },
  { id: 18, name: 'Sonesta Essential Beaumont', city: 'Beaumont', search: 'Sonesta Beaumont' },
  { id: 19, name: 'Quality Inn and Suites', city: 'Beaumont', search: 'Quality Inn Beaumont' },
  { id: 20, name: 'The Venue at Max Bowl', city: 'Port Arthur', search: 'The Venue Max Bowl Port Arthur' },
  { id: 21, name: 'Holiday Inn Port Arthur', city: 'Port Arthur', search: 'Holiday Inn Port Arthur' },
  { id: 23, name: 'Rose Hill Manor', city: 'Port Arthur', search: 'Rose Hill Manor Port Arthur' },
  { id: 24, name: 'Port Arthur Public Library', city: 'Port Arthur', search: 'Port Arthur Public Library' },
  { id: 25, name: 'Port Arthur Civic Center', city: 'Port Arthur', search: 'Port Arthur Civic Center' },
  { id: 26, name: 'PACE', city: 'Port Arthur', search: 'PACE Port Arthur' },
  { id: 27, name: "St. John's Catholic Church", city: 'Port Arthur', search: "St John's Church Port Arthur" },
  { id: 28, name: 'St. James Kirwin Hall', city: 'Port Arthur', search: 'St James Kirwin Hall Port Arthur' },
  { id: 29, name: 'Port Arthur Little Theatre', city: 'Port Arthur', search: 'Port Arthur Little Theatre' },
  { id: 30, name: 'Knights of Columbus', city: 'Port Arthur', search: 'Knights of Columbus Port Arthur' },
  { id: 31, name: "Wellborn's", city: 'Port Arthur', search: "Wellborn's Port Arthur" },
  { id: 32, name: 'Ramada Inn Port Arthur', city: 'Port Arthur', search: 'Ramada Inn Port Arthur' },
  { id: 33, name: 'Department Club', city: 'Port Arthur', search: 'Department Club Port Arthur' },
  { id: 34, name: 'Riverfront Boardwalk', city: 'Orange', search: 'Riverfront Boardwalk Orange Texas' },
  { id: 35, name: 'Riverside Pavilion', city: 'Orange', search: 'Riverside Pavilion Orange Texas' },
  { id: 36, name: 'City of Orange Boat Ramp', city: 'Orange', search: 'City of Orange Boat Ramp' },
  { id: 37, name: "Isabella's Banquet Hall", city: 'Orange', search: "Isabella's Banquet Hall Orange" },
  { id: 38, name: 'SureStay by Best Western', city: 'Orange', search: 'SureStay Best Western Orange' },
  { id: 39, name: 'The Neches Room', city: 'Orange', search: 'The Neches Room Orange' },
  { id: 40, name: 'Angel Gardens', city: 'Orange', search: 'Angel Gardens Orange Texas' },
  { id: 41, name: 'Shangri La Botanical Gardens', city: 'Orange', search: 'Shangri La Botanical Gardens Orange' },
  { id: 42, name: 'The Garden District', city: 'Orange', search: 'The Garden District Orange' },
  { id: 43, name: 'The Brown Estate', city: 'Orange', search: 'The Brown Estate Orange' },
  { id: 44, name: 'James Hall Event Center', city: 'Nederland', search: 'James Hall Event Center Nederland' },
  { id: 45, name: 'The Hidden Barn', city: 'Nederland', search: 'The Hidden Barn Nederland' },
  { id: 46, name: 'Holiday Inn Nederland', city: 'Nederland', search: 'Holiday Inn Nederland' },
  { id: 47, name: 'Evergreen Event Center', city: 'Vidor', search: 'Evergreen Event Center Vidor' },
  { id: 48, name: 'The Plaza Event Center', city: 'Vidor', search: 'The Plaza Event Center Vidor' },
  { id: 49, name: 'The Oaks Event Center', city: 'Vidor', search: 'The Oaks Event Center Vidor' },
  { id: 50, name: "Benoit's Louis Hall", city: 'Vidor', search: "Benoit's Louis Hall Vidor" },
  { id: 51, name: 'Honky Tonk Texas', city: 'Silsbee', search: 'Honky Tonk Texas Silsbee' },
  { id: 52, name: 'The Foundry Venue', city: 'Silsbee', search: 'The Foundry Venue Silsbee' },
  { id: 53, name: 'Whispering Pines Event Center', city: 'Silsbee', search: 'Whispering Pines Event Center Silsbee' },
  { id: 54, name: 'Cloud Agent Test Venue', city: 'Beaumont', search: 'Cloud Agent Test Venue Beaumont' },
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
    }).on('error', (err) => {
      file.destroy();
      fs.unlink(filepath, () => {});
      resolve(false);
    });
  });
}

function firecraylScrape(searchQuery) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`,
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
          // Extract image URLs from the markdown content
          const content = json.markdown || '';
          const urls = content.match(/https?:\/\/[^\s"<>]+\.(jpg|jpeg|png|gif|webp)/gi) || [];
          resolve(urls);
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
  if (fs.existsSync(path.join(IMAGES_DIR, `venue-${venue.id}.jpg`))) {
    console.log(`[${venue.id}] ${venue.name} - Already exists`);
    return true;
  }

  process.stdout.write(`[${venue.id}] ${venue.name}... `);

  try {
    const searchQuery = `${venue.search} image`;
    const imageUrls = await firecraylScrape(searchQuery);

    if (imageUrls.length === 0) {
      console.log('❌ No URLs found');
      return false;
    }

    // Try each URL until one downloads successfully
    for (const url of imageUrls) {
      const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
      const success = await downloadImage(url, filepath);

      if (success) {
        const size = fs.statSync(filepath).size;
        console.log(`✅ (${size} bytes)`);
        return true;
      }
    }

    console.log('❌ All URLs failed');
    return false;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔥 FIRECRAWL IMAGE DOWNLOADER\n');

  let success = 0;
  let fail = 0;

  for (const venue of venues) {
    const result = await processVenue(venue);
    if (result) success++;
    else fail++;
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${fail}`);
  const images = fs.readdirSync(IMAGES_DIR).filter(f => f.startsWith('venue-') && f.endsWith('.jpg'));
  console.log(`Total images: ${images.length}`);
  console.log('='.repeat(50) + '\n');

  process.exit(0);
}

main();
