#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = 'fc-a0cc106a4ab3406f80cfabf625b75f53';
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Venue websites to scrape
const venuesToScrape = [
  { id: 3, name: 'Museum of the Gulf Coast', url: 'https://www.gulfcoastmuseum.org' },
  { id: 10, name: 'Art Museum of Southeast Texas', url: 'https://www.amset.org' },
  { id: 14, name: 'The Laurels', url: 'https://www.thelaurelsbeaumont.com' },
  { id: 15, name: "Courville's", url: 'https://www.courvilles.com' },
  { id: 17, name: 'Holiday Inn Beaumont', url: 'https://www.ihg.com/holidayinn/hotels/us/en/beaumont/bpthi/hoteldetail' },
  { id: 18, name: 'Sonesta Essential Beaumont', url: 'https://www.sonesta.com' },
  { id: 21, name: 'Holiday Inn Port Arthur', url: 'https://www.ihg.com/holidayinn' },
  { id: 24, name: 'Port Arthur Public Library', url: 'https://www.ci.port-arthur.tx.us' },
  { id: 25, name: 'Port Arthur Civic Center', url: 'https://www.ci.port-arthur.tx.us/civic-center' },
  { id: 41, name: 'Shangri La Botanical Gardens', url: 'https://www.shangrilabotanicalgardens.com' },
];

function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : require('http');
    const file = fs.createWriteStream(filepath);

    const req = protocol.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (response) => {
      if (response.statusCode === 200 && response.headers['content-type'].includes('image')) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          try {
            const stats = fs.statSync(filepath);
            resolve(stats.size > 5000 ? stats.size : null);
          } catch (e) {
            resolve(null);
          }
        });
      } else {
        file.destroy();
        resolve(null);
      }
    });

    req.on('error', () => {
      file.destroy();
      resolve(null);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function scrapeVenueWebsite(url) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      url: url,
      formats: ['markdown'],
      timeout: 30000
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
      timeout: 35000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success && json.markdown) {
            // Extract all HTTP(S) image URLs from the markdown
            const imageUrls = new Set();

            // Pattern 1: ![alt](url)
            const imgPattern = /!\[.*?\]\((https?:\/\/[^\)]+\.(?:jpg|jpeg|png|gif|webp))\)/gi;
            let match;
            while ((match = imgPattern.exec(json.markdown)) !== null) {
              imageUrls.add(match[1]);
            }

            // Pattern 2: Standalone image URLs
            const urlPattern = /(https?:\/\/[^\s"<>]+\.(?:jpg|jpeg|png|gif|webp))/gi;
            while ((match = urlPattern.exec(json.markdown)) !== null) {
              imageUrls.add(match[1]);
            }

            resolve(Array.from(imageUrls));
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
    // Scrape the venue website
    const imageUrls = await scrapeVenueWebsite(venue.url);

    if (imageUrls.length === 0) {
      console.log('❌ No images found on website');
      return false;
    }

    // Try each image URL until one downloads successfully
    for (const imgUrl of imageUrls) {
      const bytes = await downloadImage(imgUrl, filepath);
      if (bytes) {
        console.log(`✅ (${(bytes / 1024).toFixed(1)}KB)`);
        return true;
      }
    }

    console.log('❌ All image URLs failed to download');
    return false;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔥 FIRECRAWL VENUE WEBSITE SCRAPER\n');
  console.log('Scraping official venue websites for images...\n');

  let success = 0;
  let fail = 0;

  for (const venue of venuesToScrape) {
    const result = await processVenue(venue);
    if (result) success++;
    else fail++;
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
