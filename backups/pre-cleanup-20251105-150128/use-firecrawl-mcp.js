#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const IMAGES_DIR = path.join(__dirname, 'public/images/venues');
const FIRECRAWL_API_KEY = 'fc-a0cc106a4ab3406f80cfabf625b75f53';

// Venues to scrape
const venues = [
  { id: 3, name: 'Museum of the Gulf Coast', city: 'Port Arthur', url: 'https://www.gulfcoastmuseum.org' },
  { id: 5, name: 'Beaumont Civic Centre', city: 'Beaumont', url: 'https://beaumontciviccentre.com' },
  { id: 10, name: 'Art Museum of Southeast Texas', city: 'Beaumont', url: 'https://www.amset.org' },
  { id: 14, name: 'The Laurels', city: 'Beaumont', url: 'https://www.thelaurelsbeaumont.com' },
  { id: 24, name: 'Port Arthur Public Library', city: 'Port Arthur', url: 'https://portarthurtx.gov' },
  { id: 41, name: 'Shangri La Botanical Gardens', city: 'Orange', url: 'https://www.shangrilabotanicalgardens.com' },
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

function scrapeWithFirecrawl(url) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      url: url,
      formats: ['markdown', 'links'],
      includeImages: true
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
            // Look for image URLs in the content
            const content = json.markdown || '';
            const imageUrls = [];

            // Extract image URLs from markdown
            const imgRegex = /!\[.*?\]\((https?:\/\/[^\)]+\.(?:jpg|jpeg|png|gif|webp))\)/gi;
            let match;
            while ((match = imgRegex.exec(content)) !== null) {
              imageUrls.push(match[1]);
            }

            resolve(imageUrls);
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
  if (fs.existsSync(path.join(IMAGES_DIR, `venue-${venue.id}.jpg`))) {
    console.log(`[${venue.id}] ${venue.name} - Already exists`);
    return true;
  }

  process.stdout.write(`[${venue.id}] ${venue.name}... `);

  try {
    const imageUrls = await scrapeWithFirecrawl(venue.url);

    if (imageUrls.length === 0) {
      console.log('❌ No images found');
      return false;
    }

    // Try each image URL
    for (const imgUrl of imageUrls) {
      const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
      const success = await downloadImage(imgUrl, filepath);

      if (success) {
        const size = fs.statSync(filepath).size;
        console.log(`✅ (${size} bytes)`);
        return true;
      }
    }

    console.log('❌ All images failed to download');
    return false;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔥 FIRECRAWL VENUE SCRAPER\n');

  let success = 0;
  let fail = 0;

  for (const venue of venues) {
    const result = await processVenue(venue);
    if (result) success++;
    else fail++;
    await new Promise(r => setTimeout(r, 2000));
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
