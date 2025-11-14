#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = 'fc-a0cc106a4ab3406f80cfabf625b75f53';
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Real venue websites that should have images
const venues = [
  { id: 3, name: 'Museum of the Gulf Coast', websites: ['https://www.gulfcoastmuseum.org'] },
  { id: 10, name: 'AMSET', websites: ['https://www.amset.org'] },
  { id: 24, name: 'Port Arthur Library', websites: ['https://portarthurtexas.gov'] },
  { id: 25, name: 'Port Arthur Civic Center', websites: ['https://portarthurtexas.gov'] },
  { id: 41, name: 'Shangri La Gardens', websites: ['https://www.shangrilabotanicalgardens.com'] },
];

function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, { timeout: 15000 }, (response) => {
      if (response.statusCode === 200 && response.headers['content-type']?.includes('image')) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          const stats = fs.statSync(filepath);
          resolve(stats.size > 5000 ? stats.size : null);
        });
      } else {
        file.destroy();
        resolve(null);
      }
    }).on('error', () => {
      file.destroy();
      resolve(null);
    });
  });
}

async function getImageUrlsFromWebsite(url) {
  return new Promise((resolve) => {
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
      timeout: 35000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success && json.markdown) {
            const urls = [];
            const regex = /(https?:\/\/[^\s"<>]+\.(?:jpg|jpeg|png|gif|webp))/gi;
            let match;
            while ((match = regex.exec(json.markdown)) !== null) {
              urls.push(match[1]);
            }
            console.log(`  Found ${urls.length} image URLs`);
            resolve(urls);
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

  console.log(`[${venue.id}] ${venue.name}`);

  for (const website of venue.websites) {
    process.stdout.write(`  Scraping ${website}... `);
    const imageUrls = await getImageUrlsFromWebsite(website);

    if (imageUrls.length > 0) {
      for (const imgUrl of imageUrls) {
        const bytes = await downloadImage(imgUrl, filepath);
        if (bytes) {
          console.log(`✅ Downloaded (${(bytes / 1024).toFixed(1)}KB)`);
          return true;
        }
      }
      console.log('URLs found but download failed');
    } else {
      console.log('No URLs found');
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`  ❌ No images found`);
  return false;
}

async function main() {
  console.log('\n🔥 SCRAPING REAL VENUE WEBSITES FOR IMAGES\n');

  let success = 0;
  let fail = 0;

  for (const venue of venues) {
    const result = await processVenue(venue);
    if (result) success++;
    else fail++;
    await new Promise(r => setTimeout(r, 2000));
  }

  const images = fs.readdirSync(IMAGES_DIR).filter(f => f.startsWith('venue-') && f.endsWith('.jpg'));
  console.log(`\n✅ Success: ${success}/${venues.length}`);
  console.log(`Total images: ${images.length}/54\n`);
  process.exit(0);
}

main();
