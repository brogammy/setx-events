# SETX Events - AI-Powered Scraper Setup Guide

## 🤖 What This Does

The AI scraper uses **Perplexity API** (included with your Pro plan) to:
- **Intelligently find real events** from venue websites
- **Extract structured data** automatically
- **Understand context** - no hardcoded selectors needed
- **Stay up-to-date** - searches live web data
- **Handle any website format** - adapts to different structures

---

## 🔑 Step 1: Get Your Perplexity API Key

### Option A: Use Perplexity API (Recommended)

1. Go to: https://www.perplexity.ai/settings/api
2. Create an API key
3. Copy the key (starts with `pplx-...`)

### Option B: Use Local Ollama (Free, No API Key)

If you don't want to use Perplexity API, you can use a local AI model:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1

# Run Ollama server
ollama serve
```

---

## 📦 Step 2: Install the AI Scraper

```bash
cd ~/setx-events

# Copy the ai-scraper.js file
# (paste the content from ai-scraper.js into this file)
nano ai-scraper.js

# Make it executable
chmod +x ai-scraper.js
```

---

## ⚙️ Step 3: Configure Your API Key

### Method 1: Environment Variable (Recommended)

```bash
# Set API key for current session
export PERPLEXITY_API_KEY="pplx-your-actual-key-here"

# Or add to ~/.bashrc for permanent use
echo 'export PERPLEXITY_API_KEY="pplx-your-actual-key-here"' >> ~/.bashrc
source ~/.bashrc
```

### Method 2: Edit the File Directly

```bash
nano ai-scraper.js

# Find this line:
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'YOUR_API_KEY_HERE';

# Replace YOUR_API_KEY_HERE with your actual key:
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'pplx-abc123...';

# Save: Ctrl+O, Enter, Ctrl+X
```

---

## 🚀 Step 4: Run the AI Scraper

```bash
cd ~/setx-events

# Make sure API server is running
curl http://localhost:3001/api/health

# Run the AI scraper
node ai-scraper.js
```

**What you'll see:**

```
🤖 Starting AI-powered event scraping...

📍 Processing: Julie Rogers Theatre (Beaumont)
   🤖 AI Response received
   ✅ Found 3 events
   💾 Saved: The Nutcracker Ballet
   💾 Saved: Symphony Orchestra Concert
   💾 Saved: Broadway Night

📍 Processing: The Logon Cafe (Beaumont)
   🤖 AI Response received
   ✅ Found 2 events
   💾 Saved: Live Jazz Night
   💾 Saved: Open Mic Monday

🎉 Scraping complete! Total new events: 5
```

---

## ⏰ Step 5: Automate Daily Scraping

```bash
# Edit crontab
crontab -e

# Add this line to run at midnight daily
0 0 * * * cd ~/setx-events && export PERPLEXITY_API_KEY="your-key" && node ai-scraper.js >> logs/ai-scrape.log 2>&1
```

---

## 💡 How It Works

1. **Loads venues** from your database
2. **For each venue**, asks Perplexity AI to:
   - Search the web for current events at that venue
   - Extract event details (title, date, time, description)
   - Return structured JSON data
3. **Validates** the data
4. **Saves** new events to your database
5. **Skips duplicates** automatically

---

## 🆚 AI Scraper vs Traditional Scraper

| Feature | Traditional Scraper | AI Scraper |
|---------|-------------------|-----------|
| **Setup** | Requires CSS selectors for each site | Just venue names and URLs |
| **Adaptability** | Breaks when sites change | Adapts automatically |
| **Accuracy** | Only works on predefined patterns | Understands context |
| **Coverage** | Limited to coded sites | Any website with events |
| **Maintenance** | High (update selectors often) | Low (AI adapts) |

---

## 📊 API Usage & Costs

**Perplexity API Pricing:**
- Included credits with Pro plan
- Additional usage: ~$0.001 per request
- Scraping 10 venues = ~$0.01

**Free Alternative:**
- Use Ollama locally (no API costs)
- Slower but completely free

---

## 🔧 Troubleshooting

### "API key not set" error
```bash
# Check if key is set
echo $PERPLEXITY_API_KEY

# If empty, set it:
export PERPLEXITY_API_KEY="your-key-here"
```

### "No events found"
- Check if venue websites are accessible
- Verify venue URLs in database
- Try running with verbose logging

### "API request failed"
- Check API key is valid
- Verify internet connection
- Check API quota limits

---

## 🎯 Next Steps

Once the AI scraper is working:

1. **Add more venues** to your database
2. **Customize the AI prompt** for better results
3. **Add image extraction** (AI can find event images too)
4. **Set up monitoring** to track scraping success

---

## 💬 Example Venues to Add

```sql
-- Add more Southeast Texas venues
INSERT INTO venues (name, city, category, website, priority) VALUES
('Jefferson Theatre', 'Beaumont', 'Performing Arts', 'http://www.jeffersontheatre.org/', 9),
('Tyrrell Park', 'Beaumont', 'Outdoor Events', 'https://www.beaumonttexas.gov/parks/', 7),
('Port Arthur Civic Center', 'Port Arthur', 'Convention Center', 'https://www.portarthurtx.gov/', 8);
```

---

**Ready to use AI-powered scraping? Just set your API key and run `node ai-scraper.js`!**
