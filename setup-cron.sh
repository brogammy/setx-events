#!/bin/bash

# This script sets up a cron job to delete past events from the database every day at midnight.

CRON_JOB="0 0 * * * $(pwd)/delete-past-events.js"

(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Cron job set up successfully."
echo "Past events will be deleted from the database every day at midnight."
