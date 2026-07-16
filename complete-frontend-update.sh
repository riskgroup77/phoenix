#!/bin/bash
# Complete frontend update: commit changes and rebuild

cd /phonix/frontend

# Commit the removal of node_modules/.package-lock.json
echo "Committing removal of node_modules/.package-lock.json..."
git commit -m "Remove node_modules/.package-lock.json from git tracking"

# Push to remote
echo "Pushing to remote..."
git push origin master

# Rebuild frontend
echo "Rebuilding frontend..."
npm install
npm run build

echo "✅ Frontend update complete!"
