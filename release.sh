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

echo "📍 Checking out $DEFAULT_BRANCH"
git checkout "$DEFAULT_BRANCH"

echo "⬇️  Pulling latest changes"
git pull origin "$DEFAULT_BRANCH"

echo "🧪 Running tests"
bun test

# Gather info for the confirmation prompt
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
COMMIT_SHA="$(git rev-parse --short HEAD)"
LATEST_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
LATEST_PKG_VERSION="$(node -p "require('./package.json').version")"

# Compute next version without modifying anything
NEXT_VERSION="$(node -e "
  const v = require('./package.json').version;
  let semver;
  try { semver = require('semver'); } catch (e) { semver = null; }
  if (!semver) {
    console.error('Missing dependency: semver (needed to preview next version).');
    process.exit(1);
  }
  const next = semver.inc(v, process.argv[1]);
  if (!next) process.exit(1);
  process.stdout.write(next);
" "$VERSION_TYPE")"

NEXT_TAG="v$NEXT_VERSION"

echo
echo "================= Release Preview ================="
echo "Branch:                   $BRANCH"
echo "Commit:                   $COMMIT_SHA"
echo "Latest git tag:           ${LATEST_TAG:-<none>}"
echo "package.json version:     $LATEST_PKG_VERSION"
echo "Bump type:                $VERSION_TYPE"
echo "Next version:             $NEXT_VERSION"
echo "Next tag:                 $NEXT_TAG"
echo "---------------------------------------------------"
echo "If you continue, the script will:"
echo "  1) npm version $VERSION_TYPE   (creates commit + tag)"
echo "  2) bun run build               (JS + d.ts)"
echo "  3) git push origin $DEFAULT_BRANCH"
echo "  4) git push origin $NEXT_TAG"
echo "==================================================="
echo

read -r -p "Continue? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "❌ Release aborted."
  exit 1
fi

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