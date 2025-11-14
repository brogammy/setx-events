const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function downloadVenueImage(id, name, city) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const searchQuery = `${name} ${city} Texas`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;

    console.log(`[${id}] Searching for ${name}...`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for images to load
    await page.waitForSelector('img.rg_i', { timeout: 5000 });

    // Click the first image
    const firstImage = await page.$('img.rg_i');
    if (!firstImage) {
      console.log(`  ❌ No images found`);
      await browser.close();
      return false;
    }

    await firstImage.click();

    // Wait for the image viewer to open
    await page.waitForTimeout(2000);

    // Take screenshot of just the image area
    const imageElement = await page.$('img.n3VNCb');
    if (imageElement) {
      const outputPath = path.join('/home/sauly/setx-events/public/images/venues', `venue-${id}.jpg`);
      await imageElement.screenshot({ path: outputPath });
      const stats = fs.statSync(outputPath);
      console.log(`  ✅ Saved (${stats.size} bytes)`);
      await browser.close();
      return true;
    } else {
      console.log(`  ❌ Could not find full image`);
      await browser.close();
      return false;
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    if (browser) await browser.close();
    return false;
  }
}

// Test with venue 3
downloadVenueImage(3, 'Museum of the Gulf Coast', 'Port Arthur');
