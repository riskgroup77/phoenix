#!/bin/bash
# Remove node_modules/.package-lock.json from git tracking

cd /phonix/frontend

# Remove node_modules/.package-lock.json from git (but keep the file locally)
echo "Removing node_modules/.package-lock.json from git tracking..."
git rm --cached node_modules/.package-lock.json 2>/dev/null || true

# Ensure .gitignore includes node_modules
if ! grep -q "^node_modules/" .gitignore 2>/dev/null; then
    echo "node_modules/" >> .gitignore
fi

# Commit the change
git add .gitignore
git commit -m "Remove node_modules/.package-lock.json from git tracking" 2>/dev/null || echo "No changes to commit"

echo "✅ node_modules/.package-lock.json removed from git tracking"
echo "✅ File still exists locally but won't be tracked by git"
