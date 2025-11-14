#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const FIRECRAWL_API_KEY = 'fc-a0cc106a4ab3406f80cfabf625b75f53';
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

const venues = [
  { id: 43, name: 'The Brown Estate', url: 'https://www.brownestateevents.com' },
  { id: 44, name: 'James Hall Event Center', url: 'https://www.jameshallnederland.com' },
  { id: 45, name: 'The Hidden Barn', url: 'https://www.hiddenbarnvenue.com' },
  { id: 46, name: 'Holiday Inn Nederland', url: 'https://www.ihg.com/holidayinn' },
  { id: 47, name: 'Evergreen Event Center', url: 'https://www.evergreeneventcenter.com' },
  { id: 48, name: 'The Plaza Event Center', url: 'https://www.plazaeventcenter.com' },
  { id: 49, name: 'The Oaks Event Center', url: 'https://www.oakseventcenter.com' },
  { id: 50, name: "Benoit's Louis Hall", url: 'https://www.benoitslouishall.com' },
  { id: 51, name: 'Honky Tonk Texas', url: 'https://www.honkytonktexas.com' },
  { id: 52, name: 'The Foundry Venue', url: 'https://www.foundryvenue.com' },
  { id: 53, name: 'Whispering Pines', url: 'https://www.whisperingpineseventcenter.com' },
  { id: 54, name: 'Cloud Agent Test', url: 'https://www.cloudagent.com' },
];

function downloadScreenshot(base64Data, filepath) {
  return new Promise((resolve) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filepath, buffer);
      const stats = fs.statSync(filepath);
      resolve(stats.size > 5000 ? stats.size : null);
    } catch (e) {
      resolve(null);
    }
  });
}

function scrapeWithScreenshot(url) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      url: url,
      formats: ['screenshot']
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
      timeout: 45000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success && json.data && json.data.screenshot) {
            resolve(json.data.screenshot);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
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
    const screenshotBase64 = await scrapeWithScreenshot(venue.url);
    if (!screenshotBase64) {
      console.log('❌ No screenshot');
      return false;
    }

    const bytes = await downloadScreenshot(screenshotBase64, filepath);
    if (bytes) {
      console.log(`✅ (${(bytes / 1024).toFixed(1)}KB)`);
      return true;
    } else {
      console.log('❌ Screenshot too small');
      return false;
    }
  } catch (err) {
    console.log(`❌ ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n📸 DOWNLOADING REMAINING VENUE IMAGES\n');

  let success = 0;
  let fail = 0;

  for (const venue of venues) {
    const result = await processVenue(venue);
    if (result) success++;
    else fail++;
    await new Promise(r => setTimeout(r, 3000));
  }

  const images = fs.readdirSync(IMAGES_DIR).filter(f => f.startsWith('venue-') && f.endsWith('.jpg'));
  console.log(`\n================================`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${fail}`);
  console.log(`Total images: ${images.length}/54`);
  console.log(`================================\n`);
  process.exit(0);
}

main();
