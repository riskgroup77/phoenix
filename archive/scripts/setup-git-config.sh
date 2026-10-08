#!/bin/bash
# Setup git config for server

cd /phonix/frontend

# Set git config (local repository only)
git config user.email "admin@ilmiyfaoliyat.uz"
git config user.name "Phoenix Admin"

echo "✅ Git config set successfully!"

# Check if node_modules/.package-lock.json exists in git
if git ls-files --error-unmatch node_modules/.package-lock.json >/dev/null 2>&1; then
    echo "Removing node_modules/.package-lock.json from git..."
    git rm --cached node_modules/.package-lock.json
else
    echo "✅ node_modules/.package-lock.json is not tracked by git (good!)"
fi

# Ensure .gitignore is correct
if ! grep -q "^node_modules/" .gitignore 2>/dev/null; then
    echo "node_modules/" >> .gitignore
    git add .gitignore
fi

# Commit if there are changes
if [ -n "$(git status --porcelain)" ]; then
    git commit -m "Remove node_modules/.package-lock.json from git tracking"
    echo "✅ Changes committed"
else
    echo "✅ No changes to commit"
fi
