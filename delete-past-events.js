#!/usr/bin/env node

/**
 * This script deletes all past events from the database.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

async function deletePastEvents() {
    console.log('🗑️ Deleting past events...');

    const today = new Date().toISOString().slice(0, 10);

    db.run('DELETE FROM events WHERE date < ?', [today], function(err) {
        if (err) {
            console.error('Error deleting past events:', err.message);
        } else {
            console.log(`✅ Deleted ${this.changes} past events.`);
        }
        db.close();
    });
}

deletePastEvents();
