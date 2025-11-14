# GEMINI.md: Your AI Assistant's Guide to the SETX Events Project

This document provides a comprehensive overview of the SETX Events project, designed to be used as a primary context source for AI assistants.

## Project Overview

The SETX Events project is a full-stack application designed to aggregate and display event information for the Southeast Texas area. It automatically scrapes event data from various sources, processes and stores it in a local SQLite database, and exposes it through a RESTful API. A user-friendly web interface allows users to browse, search, and filter events.

The project is built with Node.js and Express.js for the backend, and vanilla HTML, CSS, and JavaScript for the frontend. It employs a variety of data scraping techniques, including traditional web scraping with Cheerio, and more advanced AI-powered scraping using the Perplexity AI API and a local Ollama instance. The entire system is orchestrated with a series of shell scripts and n8n workflows.

## Key Technologies

- **Backend:**
  - Node.js
  - Express.js (^5.1.0)
  - Axios (^1.13.1)
  - cors (^2.8.5)
  - dotenv (^17.2.3)
- **Frontend:** HTML, CSS, JavaScript
- **Database:** SQLite (sqlite3 ^5.1.7)
- **Scraping:**
  - Cheerio (^1.1.2)
  - Puppeteer (^24.27.0)
  - Perplexity AI
  - Ollama
- **Automation:**
  - n8n
  - Shell Scripts

## Architecture

The application follows a classic multi-tier architecture:

- **Presentation Layer:** A responsive web interface (`public/index.html`) provides the user-facing experience.
- **Application Layer:** An Express.js server (`api-server.js`) handles API requests, business logic, and data access.
- **Data Layer:** A SQLite database (`database.sqlite`) stores all event and venue information.
- **Scraping Layer:** A collection of scripts and workflows (`ai-scraper.js`, `index.js`, `venue-scraper.js`, `n8n-workflows/`) are responsible for gathering event data from external sources.
- **Validation Layer:** An event validator microservice (`event-validator.js`) uses a local Ollama model to clean and enrich event data.

## Building and Running

### Prerequisites

- **Node.js and npm:** Install from [https://nodejs.org/](https://nodejs.org/)
- **Ollama:** Install from [https://ollama.ai/](https://ollama.ai/) and run `ollama pull llama3.1` and `ollama pull gpt-oss:20b-cloud`
- **Perplexity AI API Key:** Get a key from [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)

### Installation

```bash
npm install
```

### Running the Application

The primary script for running the application is `start-all.sh`. This script starts the API server and the n8n workflow service.

**`start-all.sh`:**
```bash
#!/bin/bash
# Start both n8n and API server

# Start API server in background
cd ~/setx-events
node api-server.js &
API_PID=$!
echo "API Server started (PID: $API_PID)"

# Start n8n service
sudo systemctl start setx-events

echo "✅ All services started!"
echo "🌐 n8n: http://localhost:5678"
echo "🔌 API: http://localhost:3000/api/events"
```

**Note:** The `start-all.sh` script uses `sudo systemctl start setx-events` to start the n8n service. This assumes that a systemd service named `setx-events` has been configured for n8n.

To run the application, execute the following command:

```bash
./start-all.sh
```

The application will be available at the following endpoints:

- **Web App:** http://localhost:8081
- **API Docs:** http://localhost:3001
- **Admin Dashboard:** http://localhost:3001/admin
- **Workflows:** http://localhost:5678

### Running Scrapers

The project includes several scrapers that can be run manually:

- **Ollama Scraper:** `node index.js`
- **Perplexity AI Scraper:** `PERPLEXITY_API_KEY="your-key" node ai-scraper.js`
- **Venue Scraper:** `node venue-scraper.js`

## Development Conventions

- **Code Style:** The JavaScript code follows a consistent style, with 2-space indentation and a focus on clarity and readability. For example, in `api-server.js`, routes are grouped by functionality and use clear, descriptive variable names.
- **Modularity:** The application is well-structured, with different functionalities separated into distinct modules. For example, the `ai-scraper.js` file contains all the logic for the Perplexity AI scraper, `index.js` contains the logic for the Ollama scraper, and `venue-scraper.js` contains the logic for the traditional web scraper.
- **Configuration:** Configuration is managed through a combination of environment variables (for sensitive information like API keys) and hard-coded constants within the relevant files.
- **Scripts:** A collection of shell scripts is used to automate common development tasks, such as starting the application, running scrapers, and managing the database.
- **Documentation:** The project is well-documented, with a `README.md` file that provides a high-level overview, and more detailed documentation in the `ARCHITECTURE.md`, `SYSTEM-MAP.md`, and `VENUE-SYSTEM-GUIDE.md` files. The `CLAUDE.md` file also provides valuable insights into the development workflow.
- **SQL Safety:** The application uses parameterized queries to prevent SQL injection attacks.

## Key Components

### API Server (`api-server.js`)

The API server is the heart of the application. It's an Express.js application that provides a RESTful API for managing events and venues. It also serves the admin dashboard and the API documentation.

### Ollama Scraper (`index.js`)

The Ollama scraper uses a local Ollama instance to generate event data. This is a great feature for users who want to avoid API costs. The scraper is context-aware, and it uses a prompt that is tailored to the specific venue being scraped.

### Perplexity AI Scraper (`ai-scraper.js`)

The Perplexity AI scraper uses the Perplexity AI API to extract event information from venue websites and social media pages. This is a powerful scraper that can extract data from a wide variety of sources.

### Venue Scraper (`venue-scraper.js`)

The venue scraper is a more traditional web scraper that uses Cheerio to extract data from venue websites. It also has some interesting features, such as the ability to discover new venue sources and to learn the best scraping strategy for each source.

### Event Validator (`event-validator.js`)

The event validator is a microservice that validates and enriches event data. It uses a slim local Ollama model to remove spam, fill in missing data, and deduplicate similar entries. This is a great example of how AI can be used to improve data quality.
