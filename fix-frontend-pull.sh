#!/bin/bash
# Fix frontend git pull issue with node_modules/.package-lock.json

cd /phonix/frontend

# Stash local changes (including node_modules/.package-lock.json)
echo "Stashing local changes..."
git stash

# Pull latest changes
echo "Pulling latest changes..."
git pull origin master

# If stash was successful, drop it (we don't need these changes)
echo "Dropping stashed changes..."
git stash drop 2>/dev/null || true

echo "✅ Frontend updated successfully!"
