#!/bin/bash

# SETX Events - Quick Backup Integration
# Integrates files from "setx-events (Copy)" backup folder

echo "🔄 SETX Events - Backup Integration"
echo "===================================="
echo ""

BACKUP_DIR="$HOME/setx-events (Copy)"

# Check if backup exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup folder not found: $BACKUP_DIR"
    exit 1
fi

echo "📂 Using backup: $BACKUP_DIR"
echo ""

cd ~/setx-events

# Show what's in backup
echo "📋 Files in backup:"
ls -lh "$BACKUP_DIR" | head -20
echo ""

# Copy the uploaded n8n workflow file first
if [ -f "setx-events-workflow.json" ]; then
    echo "📥 Installing n8n workflow from current directory..."
    mkdir -p ~/setx-events/n8n-workflows
    cp setx-events-workflow.json ~/setx-events/n8n-workflows/
    echo "✅ n8n workflow installed"
fi

# Restore n8n workflow from backup if exists
if [ -f "$BACKUP_DIR/setx-events-workflow.json" ]; then
    echo "📥 Found n8n workflow in backup..."
    mkdir -p ~/setx-events/n8n-workflows
    cp "$BACKUP_DIR/setx-events-workflow.json" ~/setx-events/n8n-workflows/setx-events-workflow-backup.json
    echo "✅ Backup workflow saved as setx-events-workflow-backup.json"
fi

# Restore database if it has more data
if [ -f "$BACKUP_DIR/database.sqlite" ]; then
    echo ""
    echo "🗄️  Checking backup database..."
    BACKUP_EVENTS=$(sqlite3 "$BACKUP_DIR/database.sqlite" "SELECT COUNT(*) FROM events" 2>/dev/null || echo "0")
    CURRENT_EVENTS=$(sqlite3 "database.sqlite" "SELECT COUNT(*) FROM events" 2>/dev/null || echo "0")
    
    echo "   Backup has: $BACKUP_EVENTS events"
    echo "   Current has: $CURRENT_EVENTS events"
    
    if [ "$BACKUP_EVENTS" -gt "$CURRENT_EVENTS" ]; then
        echo "   📥 Merging database (keeping all events)..."
        cp database.sqlite database.sqlite.before-merge
        sqlite3 "$BACKUP_DIR/database.sqlite" ".dump events" | sqlite3 database.sqlite
        NEW_TOTAL=$(sqlite3 "database.sqlite" "SELECT COUNT(*) FROM events")
        echo "✅ Database merged - now have $NEW_TOTAL events"
    else
        echo "   ⏭️  Current database is up to date"
    fi
fi

# Restore any custom scripts from backup
echo ""
echo "🔍 Looking for custom scripts in backup..."
for script in "$BACKUP_DIR"/*.js "$BACKUP_DIR"/*.py "$BACKUP_DIR"/*.sh; do
    if [ -f "$script" ]; then
        filename=$(basename "$script")
        # Don't overwrite if file already exists in current
        if [ ! -f "$filename" ]; then
            echo "   📥 Copying: $filename"
            cp "$script" .
        else
            echo "   ⏭️  Already exists: $filename"
        fi
    fi
done

# Restore public files if they exist
if [ -d "$BACKUP_DIR/public" ]; then
    echo ""
    echo "📥 Checking public files..."
    if [ -d "public" ]; then
        cp -r "$BACKUP_DIR/public/"* public/ 2>/dev/null
        echo "✅ Public files merged"
    fi
fi

echo ""
echo "===================================="
echo "✨ Integration Complete!"
echo "===================================="
echo ""
echo "📊 Summary:"
TOTAL_EVENTS=$(sqlite3 database.sqlite "SELECT COUNT(*) FROM events" 2>/dev/null || echo "0")
TOTAL_VENUES=$(sqlite3 database.sqlite "SELECT COUNT(*) FROM venues" 2>/dev/null || echo "0")
echo "   📅 Events in database: $TOTAL_EVENTS"
echo "   🏢 Venues in database: $TOTAL_VENUES"
[ -f "n8n-workflows/setx-events-workflow.json" ] && echo "   ✅ n8n workflow ready to import"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. Start all services:"
echo "   chmod +x restart-all.sh"
echo "   ./restart-all.sh"
echo ""
echo "2. Import n8n workflow:"
echo "   - Open: http://localhost:5678"
echo "   - Import file: ~/setx-events/n8n-workflows/setx-events-workflow.json"
echo ""
echo "3. Access your system:"
echo "   - Admin Dashboard: http://100.104.226.70:3001/admin"
echo "   - Public Site: http://100.104.226.70:8081"
echo "   - n8n Workflows: http://localhost:5678"
echo ""
