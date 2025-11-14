#!/usr/bin/env node

/**
 * This script cleans up the dates in the events table of the database.
 * It reads all the events, parses the date field, and updates the database with the corrected date.
 * For date ranges, it creates a new event for each date in the range.
 * Events with un-parseable dates are deleted.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

function parseDate(dateStr) {
    if (!dateStr) {
        return null;
    }

    if (dateStr.includes(' to ')) {
        const [startDateStr, endDateStr] = dateStr.split(' to ');
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        const dates = [];
        for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d).toISOString().slice(0, 10));
        }
        return dates;
    }

    if (dateStr.includes('(specific date not provided)')) {
        return null;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString().slice(0, 10);
}

async function cleanupDates() {
    console.log('🧹 Starting date cleanup...');

    db.all('SELECT * FROM events', async (err, events) => {
        if (err) {
            console.error('Error reading events:', err.message);
            return;
        }

        for (const event of events) {
            const parsedDate = parseDate(event.date);

            if (Array.isArray(parsedDate)) {
                // Date range
                console.log(`🔄️ Processing date range for event: ${event.title}`);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                for (let i = 0; i < parsedDate.length; i++) {
                    const date = parsedDate[i];
                    const eventDate = new Date(date);
                    if (eventDate < today) {
                        continue;
                    }
                    if (i === 0) {
                        // Update the original event with the first date
                        db.run('UPDATE events SET date = ? WHERE id = ?', [date, event.id], (err) => {
                            if (err) {
                                console.error(`Error updating event ${event.id}:`, err.message);
                            }
                        });
                    } else {
                        // Create new events for the rest of the dates
                        const newEvent = { ...event };
                        delete newEvent.id;
                        newEvent.date = date;
                        db.run(
                            `INSERT INTO events (title, date, time, location, city, category, description, source_url, featured, image_url, price, ticket_url, age_restriction, venue_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [newEvent.title, newEvent.date, newEvent.time, newEvent.location, newEvent.city, newEvent.category, newEvent.description, newEvent.source_url, newEvent.featured, newEvent.image_url, newEvent.price, newEvent.ticket_url, newEvent.age_restriction, newEvent.venue_id],
                            (err) => {
                                if (err) {
                                    console.error('Error creating new event:', err.message);
                                }
                            }
                        );
                    }
                }
            } else if (parsedDate) {
                // Valid date
                if (event.date !== parsedDate) {
                    console.log(`✨ Updating date for event: ${event.title}`);
                    db.run('UPDATE events SET date = ? WHERE id = ?', [parsedDate, event.id], (err) => {
                        if (err) {
                            console.error(`Error updating event ${event.id}:`, err.message);
                        }
                    });
                }
            } else {
                // Invalid date
                console.log(`🗑️ Deleting event with invalid date: ${event.title} (${event.date})`);
                db.run('DELETE FROM events WHERE id = ?', [event.id], (err) => {
                    if (err) {
                        console.error(`Error deleting event ${event.id}:`, err.message);
                    }
                });
            }
        }

        console.log('✅ Date cleanup complete!');
        db.close();
    });
}

cleanupDates();
