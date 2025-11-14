# AGENTS.md - Agent Guidelines for SETX Events

This document defines how ANY agent (Claude, other AI systems, humans, etc.) should interact with this codebase. Follow these guidelines strictly.

## Core Principles

1. **No Agent-Specific Code** - Never hardcode references to "Claude" or any specific agent
2. **Documentation First** - Always check AGENTS.md and CLAUDE.md BEFORE making changes
3. **Explicit Instructions** - If unclear, ask the user instead of assuming
4. **Transparent Failures** - Report failures immediately, don't hide them with workarounds
5. **No Bullshit** - Don't pretend scripts work when they don't; don't use fillers or placeholders
6. **Follow Project Patterns** - Use existing code patterns and architecture (see CLAUDE.md)
7. **Test Before Committing** - Always test API endpoints with curl and verify database changes

## File Hierarchy (Read in Order)

1. **AGENTS.md** (this file) - Guidelines for ANY agent using this repo
2. **CLAUDE.md** - Agent-agnostic project overview and architecture
3. **README.md** - User-facing documentation
4. **Code files** - Implementation details

## Task Execution Rules

### Before Starting Any Task
- [ ] Read AGENTS.md (this file)
- [ ] Read CLAUDE.md for project context
- [ ] Check if similar work has been done before
- [ ] Ask user if unclear about requirements

### During Task Execution
- [ ] Report progress transparently
- [ ] Stop immediately if something fails
- [ ] Do NOT use placeholders, fillers, or fake data
- [ ] Do NOT try to hide failures with workarounds
- [ ] Do NOT assume - ask the user
- [ ] Test changes with curl before claiming success
- [ ] Verify database changes directly when needed

### Reporting Results
- [ ] Show actual results, not expected results
- [ ] If failed, explain why and what didn't work
- [ ] Provide next steps for user to decide
- [ ] Never claim success if partially complete

## Key Restrictions

### NEVER DO:
- ❌ Use Unsplash/stock images as fallbacks
- ❌ Generate color placeholder images
- ❌ Create fake/dummy data to "complete" tasks
- ❌ Run scripts and ignore errors
- ❌ Assume workarounds are acceptable without asking
- ❌ Code features as "Claude-specific"
- ❌ Leave broken code/scripts running

### ALWAYS DO:
- ✅ Verify before claiming success
- ✅ Report actual errors with details
- ✅ Ask user before trying new approaches
- ✅ Document what worked and why
- ✅ Check previous work before redoing tasks
- ✅ Make code agent-agnostic
- ✅ Follow user instructions exactly

## Build/Lint/Test Commands

### Development Setup
```bash
# Install dependencies
npm install

# Start all services (API, frontend, n8n)
./restart-all.sh

# Check if services are running
curl http://localhost:3001/api/health

# Start individual services
node api-server.js                          # API server
cd public && python3 -m http.server 8081    # Frontend
node index.js                               # Ollama scraper
```

### Running Single Tests
```bash
# Test specific API endpoint
curl http://localhost:3001/api/health

# Test with filters
curl "http://localhost:3001/api/events?city=Beaumont&category=Music"

# Test POST request
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","date":"2025-12-01","city":"Beaumont","category":"Test"}'

# Run specific test scripts (find all with: ls test*.js)
node test-first-venue.js              # Tests Julie Rogers Theatre venue photo download
node test-real-websites.js            # Tests real website image scraping
node test-venue-image-download.js     # Tests venue image download process
node test-museum-venue.js             # Tests museum venue processing
node test-julie-rogers.js             # Tests Julie Rogers specific processing

# Check database directly
sqlite3 database.sqlite "SELECT COUNT(*) FROM events;"
```

### Linting & Formatting
```bash
# No specific linter configured - follow existing code style
# Check code style by examining existing files
# Manual code verification - run the service after changes
./restart-all.sh && curl http://localhost:3001/api/health
```

### Database Operations
```bash
# Backup database
cp database.sqlite database.sqlite.bak

# Inspect database
sqlite3 database.sqlite

# In sqlite3 shell:
# .tables                    # List tables
# .schema events             # Show table schema
# .schema venues             # Show venues schema
# SELECT COUNT(*) FROM events;  # Count records
# SELECT * FROM venues LIMIT 5; # View first 5 venues
# .quit                      # Exit
```

## Code Style Guidelines

### Imports and Dependencies
- Use CommonJS require() syntax (not ES6 imports)
- Group imports in order: node built-ins, npm packages, local files
- Only add dependencies that are actually used
- Check package.json before adding new dependencies

### Formatting
- Use 4 spaces for indentation (no tabs)
- Keep lines under 100 characters when possible
- Use consistent spacing around operators
- Add a newline at the end of each file

### Types and Variables
- Use const for variables that don't change
- Use let for variables that do change (avoid var)
- Use descriptive variable names
- Use camelCase for variables and functions
- Use PascalCase for classes and constructors

### Naming Conventions
- Functions: useVerbNoun() format (e.g., scrapeVenueWithOllama)
- Variables: descriptive names (e.g., apiUrl, venueId)
- Files: kebab-case for filenames (e.g., api-server.js)
- Classes: PascalCase (e.g., OllamaDailyScraper)

### Error Handling
- Always handle errors in callbacks
- Use try/catch for async operations
- Log errors with console.error()
- Return appropriate HTTP status codes (500 for server errors, 404 for not found, etc.)
- Validate input data before processing

### SQL Safety
- ALWAYS use parameterized queries
- NEVER concatenate user input into SQL strings
```javascript
// ✅ GOOD
db.get('SELECT * FROM events WHERE id = ?', [id], callback);

// ❌ BAD
db.get(`SELECT * FROM events WHERE id = '${id}'`, callback);
```

### API Design
- Follow RESTful conventions
- Use appropriate HTTP methods (GET, POST, PUT, DELETE)
- Return JSON responses with consistent structure
- Include error messages in { error: "message" } format
- Use consistent route naming (/api/resource)

### Async Operations
- Use async/await for asynchronous operations when possible
- Handle promises with .catch() or try/catch
- Avoid callback hell - flatten nested callbacks

### Comments and Documentation
- Use JSDoc-style comments for functions
- Comment complex logic or non-obvious code
- Update comments when code changes
- Remove outdated comments

## Common Tasks

### Testing Changes
- **API Testing**: Use curl to test endpoints before claiming success
  ```bash
  curl http://localhost:3001/api/health  # Health check
  curl http://localhost:3001/api/events   # Get events
  curl "http://localhost:3001/api/events?city=Beaumont"  # Filter
  curl "http://localhost:3001/api/venues" | jq  # List venues with formatting
  ```
- **Database Verification**: Check database directly when needed
  ```bash
  sqlite3 database.sqlite "SELECT COUNT(*) FROM events;"
  sqlite3 database.sqlite "SELECT * FROM events LIMIT 5;"
  sqlite3 database.sqlite "SELECT id, name, city, website FROM venues WHERE is_active = 1;"
  ```
- **Log Monitoring**: Monitor logs during testing
  ```bash
  tail -f logs/api-server.log
  tail -f logs/*.log             # Monitor all logs
  grep ERROR logs/api-server.log # Check for errors
  ```

### Downloading Images
- **Previous approach (FAILED)**: Automated scripts that created broken files
- **Current approach**: Use Firecrawl API with Node 22+ to scrape real images from Google Images
- **When it fails**: Stop, report the failure, ask user for next steps
- **Do NOT**: Use color backgrounds, Unsplash, or stock images as fallbacks

### Running Services
- **Check first**: `ps aux | grep node` to see what's running
- **Verify ports**: `lsof -i :3001` before starting
- **Monitor logs**: `tail -f logs/*.log` while services run
- **On failure**: Kill the process, report error, ask user

### Database Operations
- **Always backup**: `cp database.sqlite database.sqlite.bak` before schema changes
- **Test queries**: Verify with curl before claiming data is updated
- **Check results**: `sqlite3 database.sqlite` to inspect results

### API Testing
- **Test endpoints**: `curl http://localhost:3001/api/health` to verify
- **Check responses**: Inspect actual response, not expected response
- **Log results**: Show curl output to user for verification

## Environment Variables

These should be set by the user, not hardcoded:
```
FIRECRAWL_API_KEY=fc-...
PERPLEXITY_API_KEY=pplx-...
OLLAMA_URL=http://localhost:11434
PORT=3001
NODE_ENV=development
```

Never put API keys in code or commit history.

## Tools Available

### For Any Agent
- Bash: For system commands (not for code comments or communication)
- Read: For reading files
- Write/Edit: For modifying files (prefer Edit for existing files)
- Glob: For finding files
- Grep: For searching code

### For Specialized Tasks
- Task (with subagent_type): For complex multi-step research
- WebFetch: For fetching web content
- WebSearch: For searching the web

## When Something Fails

**DO THIS:**
1. Report the exact error message
2. Show what was attempted
3. Explain why it failed
4. Ask user for next steps
5. Wait for user direction

**DO NOT:**
- Try a different approach without asking
- Use a fallback/workaround without asking
- Claim partial success as full success
- Hide the failure and move on
- Run it again hoping it magically works

## Making Code Agent-Agnostic

**BAD:**
```javascript
// Claude-specific code
if (process.env.CLAUDE_MODE) {
  // do something
}

// Hardcoded agent-specific behavior
const useClaudeImagesDownloader = true;
if (useClaudeImagesDownloader) {
  // do something
}
```

**GOOD:**
```javascript
// Works for any agent
const shouldScrape = process.env.ENABLE_SCRAPING === 'true';
if (shouldScrape) {
  // do something
}

// Agent-agnostic configuration
const imageDownloaderConfig = {
  strategy: process.env.IMAGE_DOWNLOAD_STRATEGY || 'default',
  timeout: parseInt(process.env.DOWNLOAD_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3')
};
```

## When to Ask the User

- If requirements are unclear
- If multiple approaches are possible
- If a task has failed multiple times
- If you're about to do something destructive
- If you're unsure about the right approach
- If previous attempts didn't work
- If you're adding a new dependency
- If you're modifying database schema
- If you're changing environment variable usage
- If you're implementing something that may be agent-specific

## Success Criteria

A task is complete when:
1. All requirements are met (not partially)
2. Results are verified (not assumed)
3. User confirms it works
4. Documentation is updated if needed
5. Code is clean and agent-agnostic
6. Tests pass (run all relevant tests)
7. Service remains operational (health check passes)
8. Changes follow existing patterns and style

---
**Last Updated**: 2025-11-02
**Applies to**: All agents, all tasks