#!/bin/bash
# MongoDB Backup Script for ThanniCanuuu
# Schedule with: crontab -e → 0 2 * * * /home/ubuntu/ThanniCanuuu/scripts/backup-mongo.sh >> /home/ubuntu/backup.log 2>&1

BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="thanni_canuuu_backup_$DATE"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup (update MONGO_URL if using authentication)
# For authenticated MongoDB:
# mongodump --uri="mongodb://thanni_app:YOUR_PASSWORD@localhost:27017/thanni_canuuu" --out="$BACKUP_DIR/$BACKUP_NAME" --gzip
# For unauthenticated MongoDB (development):
mongodump --db=thanni_canuuu --out="$BACKUP_DIR/$BACKUP_NAME" --gzip

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "thanni_canuuu_backup_*" -mtime +7 -exec rm -rf {} \;

echo "[$(date)] Backup completed: $BACKUP_NAME"
