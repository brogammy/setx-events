#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'YOUR_API_KEY_HERE';
const IMAGES_DIR = path.join(__dirname, 'public/images/venues');

// Venues to download (skip 1, 2, 4, 22 which already exist)
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
          const stats = fs.statSync(filepath);
          resolve(stats.size > 5000);
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

function queryPerplexity(venue) {
  return new Promise((resolve) => {
    const query = `Find a direct downloadable image URL for ${venue.name} in ${venue.city}, Texas. Only respond with a single HTTP or HTTPS image URL (jpg or png). No explanation, just the URL.`;

    const payload = JSON.stringify({
      model: 'llama-2-7b-chat',
      messages: [
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: 200
    });

    const options = {
      hostname: 'api.perplexity.ai',
      path: '/openai/deployments/llama-2-7b-chat/chat/completions?api-version=2023-05-15',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
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
          const content = json.choices?.[0]?.message?.content || '';
          const urlMatch = content.match(/https?:\/\/[^\s"<>]+\.(jpg|jpeg|png|gif)/i);
          resolve(urlMatch ? urlMatch[0] : null);
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
  if (fs.existsSync(path.join(IMAGES_DIR, `venue-${venue.id}.jpg`))) {
    console.log(`[${venue.id}] ${venue.name} - Already exists`);
    return true;
  }

  process.stdout.write(`[${venue.id}] ${venue.name}... `);

  try {
    const imageUrl = await queryPerplexity(venue);

    if (!imageUrl) {
      console.log('❌ No URL found');
      return false;
    }

    console.log(`Found URL`);
    const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
    const success = await downloadImage(imageUrl, filepath);

    if (success) {
      console.log(`  ✅ Downloaded (${fs.statSync(filepath).size} bytes)`);
      return true;
    } else {
      console.log(`  ❌ Download failed`);
      return false;
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n📸 PERPLEXITY IMAGE FINDER\n');

  let success = 0;
  let fail = 0;

  for (const venue of venues) {
    const result = await processVenue(venue);
    if (result) success++;
    else fail++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${fail}`);
  console.log(`Total images: ${fs.readdirSync(IMAGES_DIR).filter(f => f.startsWith('venue-') && f.endsWith('.jpg')).length}`);
  console.log('='.repeat(50) + '\n');

  process.exit(0);
}

main();
