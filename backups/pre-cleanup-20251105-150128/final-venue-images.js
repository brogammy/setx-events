#!/usr/bin/env node
const sqlite3 = require('sqlite3');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('/home/sauly/setx-events/database.sqlite');
const dir = '/home/sauly/setx-events/public/images/venues';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Real venue images discovered by direct search
const images = {
  2: 'https://logoncafe.net/wp-content/uploads/2018/10/The-HFAs-at-TLC.jpg',
  4: 'https://images.squarespace-cdn.com/content/v1/63a0befda10732040d5b2608/36c82dbf-494d-4e99-af67-bbffa45bc4fe/KBDSC04749e3.jpg',
  10: 'https://amset.org/wp-content/uploads/2025/10/AMSET75Header-1024x341.png'
};

// Unsplash fallback for others
const fallbacks = [
  'https://images.unsplash.com/photo-1485579149c0-123123d6ce6f?w=800',
  'https://images.unsplash.com/photo-1517457373614-b7152f800b45?w=800',
  'https://images.unsplash.com/photo-1591207922261-0a7dd67c0b98?w=800',
  'https://images.unsplash.com/photo-1579783902614-e3fb5141b0cb?w=800',
  'https://images.unsplash.com/photo-1519671482677-e02dc2cc639f?w=800',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  'https://images.unsplash.com/photo-1564399579883-451a5d44ec08?w=800',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
  'https://images.unsplash.com/photo-1576091160550-112173f7f869?w=800',
  'https://images.unsplash.com/photo-1507842217343-583f20270319?w=800',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
  'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=800'
];

async function dl(url, fp) {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(fp);
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redir = res.headers.location;
        const rproto = redir.startsWith('https') ? https : http;
        return rproto.get(redir, (res2) => { res2.pipe(file); file.on('finish', () => { file.close(); resolve(true); }); }).on('error', () => resolve(false));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', () => resolve(false));
  });
}

(async () => {
  console.log('Downloading 54 venue images...\n');
  let cnt = 0;

  db.all('SELECT id FROM venues WHERE is_active = 1 ORDER BY id', async (err, venues) => {
    if (!venues) { console.log('Error'); db.close(); process.exit(1); }

    for (const v of venues) {
      const url = images[v.id] || fallbacks[(v.id % fallbacks.length)];
      const fp = path.join(dir, `venue-${v.id}.jpg`);
      const ok = await dl(url, fp);

      if (ok) {
        db.run('UPDATE venues SET cover_image_url = ?, logo_url = ? WHERE id = ?', [`/images/venues/venue-${v.id}.jpg`, `/images/venues/venue-${v.id}.jpg`, v.id]);
        process.stdout.write('.');
        cnt++;
      } else {
        process.stdout.write('x');
      }
    }

    setTimeout(() => { console.log(`\n✅ ${cnt}/54 images downloaded\n`); db.close(); process.exit(0); }, 1000);
  });
})();
