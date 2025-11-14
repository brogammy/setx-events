#!/bin/bash

# Script to check venue website status

echo "Checking venue websites..."

sqlite3 database.sqlite "SELECT id, name, website FROM venues;" | while IFS='|' read id name website; do
    if [ -z "$website" ] || [ "$website" = "Not listed in search results" ] || [ "$website" = "https://cloud-agent-test.com" ]; then
        echo "ID $id: $name - NO WEBSITE"
        continue
    fi
    echo -n "ID $id: $name ($website) - "
    status=$(curl -s -o /dev/null -w "%{http_code}" "$website" 2>/dev/null)
    if [ "$status" -eq 200 ]; then
        echo "ACTIVE"
    else
        echo "INACTIVE ($status)"
    fi
done