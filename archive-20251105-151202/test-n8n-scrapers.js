#!/usr/bin/env node

// Test n8n workflow scrapers individually

const axios = require('axios');

async function testScraper(name, url, parser) {
    console.log(`\n🔍 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    
    try {
        const response = await axios.get(url);
        console.log(`   ✅ Website accessible (${response.data.length} bytes)`);
        
        const events = parser(response.data);
        console.log(`   📊 Found ${events.length} events`);
        
        if (events.length > 0) {
            console.log(`   📋 First event:`);
            console.log(`      Title: ${events[0].title}`);
            console.log(`      Date: ${events[0].date}`);
            console.log(`      City: ${events[0].city}`);
        } else {
            console.log(`   ⚠️  No events found - HTML structure may have changed`);
            console.log(`   First 500 chars of HTML:`);
            console.log(`   ${response.data.substring(0, 500)}`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
}

// Orange parser from your n8n workflow
function parseOrangeEvents(html) {
    const events = [];
    const eventPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    
    while ((match = eventPattern.exec(html)) !== null) {
        const eventHtml = match[1];
        
        // Extract event name
        const titleMatch = /<td[^>]*>([^<]+)<\/td>/i.exec(eventHtml);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract date
        const dateMatch = /<td[^>]*>([0-9\/]+)<\/td>/i.exec(eventHtml);
        const date = dateMatch ? dateMatch[1] : '';
        
        if (title && title.length > 3) {
            events.push({
                title: title,
                date: date,
                time: '',
                location: 'Orange Recreation Center',
                city: 'Orange',
                category: 'Sports & Recreation',
                description: title,
                source_url: 'https://orangetexas.gov/499/Upcoming-Events'
            });
        }
    }
    
    return events;
}

// Beaumont parser
function parseBeaumontEvents(html) {
    const events = [];
    const eventPattern = /<div class="event-item"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    
    while ((match = eventPattern.exec(html)) !== null) {
        const eventHtml = match[1];
        
        const titleMatch = /<h[23][^>]*>([^<]+)<\/h[23]>/i.exec(eventHtml);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        const dateMatch = /<time[^>]*datetime="([^"]+)"/i.exec(eventHtml);
        const date = dateMatch ? dateMatch[1] : '';
        
        if (title && date) {
            events.push({
                title: title,
                date: date,
                city: 'Beaumont',
                category: 'Community Event',
                source_url: 'https://www.beaumontcvb.com/events/'
            });
        }
    }
    
    return events;
}

// Port Arthur parser
function parsePortArthurEvents(html) {
    const events = [];
    const eventPattern = /<div class="event"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    
    while ((match = eventPattern.exec(html)) !== null) {
        const eventHtml = match[1];
        
        const titleMatch = /<h[23][^>]*>([^<]+)<\/h[23]>/i.exec(eventHtml);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        if (title) {
            events.push({
                title: title,
                date: new Date().toISOString().split('T')[0],
                city: 'Port Arthur',
                category: 'Cultural Event',
                source_url: 'https://visitportarthurtx.com/annual-events/'
            });
        }
    }
    
    return events;
}

// Run tests
(async () => {
    console.log('🤖 n8n Workflow Scraper Tester');
    console.log('================================\n');
    
    await testScraper(
        'Beaumont CVB',
        'https://www.beaumontcvb.com/events/',
        parseBeaumontEvents
    );
    
    await testScraper(
        'Port Arthur Events',
        'https://visitportarthurtx.com/annual-events/',
        parsePortArthurEvents
    );
    
    await testScraper(
        'Orange Events',
        'https://orangetexas.gov/499/Upcoming-Events',
        parseOrangeEvents
    );
    
    console.log('\n================================');
    console.log('✅ Testing complete!');
    console.log('\nIf a scraper shows 0 events, the HTML structure has changed.');
    console.log('Update the parser in your n8n workflow to match the new structure.');
})();
