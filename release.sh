#!/bin/bash
set -eu

DEFAULT_BRANCH="main"
VERSION_TYPE="${1:-}"

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major>"
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo "❌ Error: You have uncommitted changes. Commit or stash them first."
  exit 1
fi

echo "⚠️  You are about to release a *$VERSION_TYPE* version from '$DEFAULT_BRANCH'."
read -r -p "Continue? [y/N] " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "❌ Release aborted."
  exit 1
fi

echo "📍 Checking out $DEFAULT_BRANCH"
git checkout "$DEFAULT_BRANCH"

echo "⬇️  Pulling latest changes"
git pull origin "$DEFAULT_BRANCH"

echo "🧪 Running tests"
bun test

echo "🔖 Bumping version: $VERSION_TYPE"
NEW_TAG="$(npm version "$VERSION_TYPE")"
echo "📝 Created tag: $NEW_TAG"

# Verify tag and package.json match
PKG_VERSION=$(node -p "require('./package.json').version")
TAG_VERSION="${NEW_TAG#v}"

if [ "$PKG_VERSION" != "$TAG_VERSION" ]; then
  echo "❌ Version mismatch: package.json=$PKG_VERSION tag=$TAG_VERSION"
  exit 1
fi

echo "🏗️  Building (JS + d.ts)"
bun run build

echo "⬆️  Pushing commit and tag"
git push origin "$DEFAULT_BRANCH"
git push origin "$NEW_TAG"

echo "✅ Done!"
echo "📦 GitHub Actions should now publish to npm and create a GitHub Release for $NEW_TAG"