#!/usr/bin/env node

const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'public/images/venues');
const TIMEOUT = 30000;

// List of venues to download images for
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

// Download image from URL
function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;

    const file = fs.createWriteStream(filepath);
    protocol.get(url, { timeout: TIMEOUT }, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          const stats = fs.statSync(filepath);
          if (stats.size > 5000) {
            resolve(true);
          } else {
            fs.unlinkSync(filepath);
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

// Extract actual image URL from Google Images
async function extractImageUrl(page) {
  try {
    // Wait for image to load
    await page.waitForSelector('img.rg_i', { timeout: 5000 });

    // Click first image
    const firstImage = await page.$('img.rg_i');
    if (firstImage) {
      await firstImage.click();
      await page.waitForTimeout(1000);
    }

    // Try to get the actual image URL from the opened view
    const imageUrl = await page.evaluate(() => {
      // Method 1: Check for image in the lightbox viewer
      const viewer = document.querySelector('img.n3VNCb');
      if (viewer && viewer.src) {
        return viewer.src;
      }

      // Method 2: Check for all images and find the largest one
      const imgs = document.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.src || img.dataset.src;
        if (src && src.includes('http') && !src.includes('data:') && !src.includes('//ssl.gstatic.com')) {
          return src;
        }
      }

      return null;
    });

    return imageUrl;
  } catch (err) {
    return null;
  }
}

// Search and download image for a venue
async function downloadVenueImage(browser, venue) {
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    const searchQuery = `${venue.name} ${venue.city} Texas`;
    const googleImagesUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;

    console.log(`[${venue.id}] Searching: ${venue.name}...`);

    await page.goto(googleImagesUrl, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    // Extract image URL
    const imageUrl = await extractImageUrl(page);

    if (imageUrl) {
      const filepath = path.join(IMAGES_DIR, `venue-${venue.id}.jpg`);
      console.log(`  Found URL: ${imageUrl.substring(0, 80)}...`);

      const success = await downloadImage(imageUrl, filepath);
      if (success) {
        console.log(`  ✅ Downloaded successfully`);
        return true;
      } else {
        console.log(`  ❌ Download failed or file too small`);
        return false;
      }
    } else {
      console.log(`  ❌ Could not extract image URL`);
      return false;
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    return false;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

// Main function
async function main() {
  console.log('\n📸 GOOGLE IMAGES VENUE DOWNLOADER');
  console.log('='.repeat(50) + '\n');

  // Ensure images directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  let browser;
  let successCount = 0;
  let failCount = 0;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Process venues sequentially with delays
    for (const venue of venues) {
      const success = await downloadVenueImage(browser, venue);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }

  } catch (err) {
    console.error('Fatal error:', err.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Total downloaded: ${successCount}`);
  console.log('='.repeat(50) + '\n');

  process.exit(0);
}

main();
