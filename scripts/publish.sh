#!/usr/bin/env bash
set -euo pipefail

# Ensure we're running from the repo root
cd "$(dirname "$0")/.."

# Publish Zooid packages to npm
# Usage: ./scripts/publish.sh [patch|minor|major] [--only <pkg,pkg,...>] [--dry-run]
#
# Examples:
#   ./scripts/publish.sh                          # patch bump all, publish all, tag v0.0.19
#   ./scripts/publish.sh --only web               # patch bump+publish @zooid/web only
#   ./scripts/publish.sh minor --only web,server  # minor bump, publish both, one tag per package
#   ./scripts/publish.sh --only web --dry-run
#
# Publishes in dependency order (when publishing all):
#   @zooid/types → @zooid/ui → @zooid/sdk → @zooid/web → @zooid/server → zooid (CLI)
# Handles workspace:^ → real version replacement via pnpm publish

BUMP="patch"
DRY_RUN=""
ONLY_RAW=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    patch|minor|major) BUMP="$1"; shift ;;
    --dry-run) DRY_RUN="--dry-run"; shift ;;
    --only) ONLY_RAW="$2"; shift 2 ;;
    *) echo "✗ Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -n "$DRY_RUN" ]]; then
  echo "🏃 Dry run — no packages will be published."
  echo ""
fi

# All publishable packages, in dependency order
ALL_PACKAGES=("types" "ui" "sdk" "web" "server" "cli")

pkg_dir() { echo "packages/$1"; }

is_valid_pkg() {
  for p in "${ALL_PACKAGES[@]}"; do [[ "$p" == "$1" ]] && return 0; done
  return 1
}

# Resolve which packages to publish
if [[ -n "$ONLY_RAW" ]]; then
  IFS=',' read -ra PACKAGES <<< "$ONLY_RAW"
  for pkg in "${PACKAGES[@]}"; do
    if ! is_valid_pkg "$pkg"; then
      echo "✗ Unknown package: $pkg"
      echo "  Valid packages: ${ALL_PACKAGES[*]}"
      exit 1
    fi
  done
  echo "📦 Publishing: ${PACKAGES[*]}"
  echo ""
else
  PACKAGES=("${ALL_PACKAGES[@]}")
fi

# --- Preflight checks ---

echo "📋 Preflight checks..."

# Must be on main
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
  echo "✗ Must be on main branch (currently on $BRANCH)"
  exit 1
fi

# Must be clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ Working directory is not clean. Commit or stash changes first."
  exit 1
fi

# Must be up to date with remote
git fetch origin main --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "✗ Local main is not up to date with origin. Pull first."
  exit 1
fi

# Must be logged into npm
if ! npm whoami &>/dev/null; then
  echo "✗ Not logged into npm. Run: npm login"
  exit 1
fi

echo "✓ On main, clean, up to date, npm authenticated"
echo ""

# --- Format check ---

echo "🎨 Checking formatting..."
pnpm format:check
echo "✓ Formatting OK"
echo ""

# --- Duplication check ---

echo "🔍 Checking for code duplication..."
npx jscpd packages/cli/src packages/sdk/src --min-lines 8 --min-tokens 100 --threshold 5 --reporters console --ignore "**/*.test.ts" 2>&1
echo "✓ Duplication check passed"
echo ""

# --- Run tests ---

echo "🧪 Running tests..."
if [[ -n "$ONLY_RAW" ]]; then
  for pkg in "${PACKAGES[@]}"; do
    dir="$(pkg_dir "$pkg")"
    name=$(node -p "require('./$dir/package.json').name")
    if node -e "const p = require('./$dir/package.json'); if (!p.scripts?.test) process.exit(1)" 2>/dev/null; then
      pnpm --filter="$name" test
    else
      echo "  (no test script for $name, skipping)"
    fi
  done
else
  pnpm --filter=@zooid/types --filter=@zooid/sdk --filter=@zooid/server --filter=zooid test
fi
echo "✓ Tests passed"
echo ""

# --- Build ---

echo "🔨 Building packages..."
if [[ -n "$ONLY_RAW" ]]; then
  for pkg in "${PACKAGES[@]}"; do
    dir="$(pkg_dir "$pkg")"
    name=$(node -p "require('./$dir/package.json').name")
    if node -e "const p = require('./$dir/package.json'); if (!p.scripts?.build) process.exit(1)" 2>/dev/null; then
      pnpm --filter="$name" build
    else
      echo "  (no build script for $name, skipping)"
    fi
  done
else
  pnpm --filter=@zooid/sdk build
  pnpm --filter=@zooid/web build
  pnpm --filter=zooid build
fi
echo "✓ Build complete"
echo ""

# --- Bump version ---

# Read current version from the first target package (or types as source of truth for all)
if [[ -n "$ONLY_RAW" ]]; then
  CURRENT=$(node -p "require('./$(pkg_dir "${PACKAGES[0]}")/package.json').version")
else
  CURRENT=$(node -p "require('./packages/types/package.json').version")
fi
echo "📦 Current version: $CURRENT"

# Calculate next version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$BUMP" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  *)
    echo "✗ Invalid bump type: $BUMP (use patch, minor, or major)"
    exit 1
    ;;
esac
NEXT="$MAJOR.$MINOR.$PATCH"
echo "📦 Next version: $NEXT ($BUMP)"
echo ""

# Update version in target package(s)
BUMPED_FILES=()
for pkg in "${PACKAGES[@]}"; do
  dir="$(pkg_dir "$pkg")"
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$dir/package.json', 'utf-8'));
    pkg.version = '$NEXT';
    fs.writeFileSync('$dir/package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  BUMPED_FILES+=("$dir/package.json")
  echo "  $dir → $NEXT"
done
echo ""

# --- Publish ---

echo "🚀 Publishing..."
echo ""

for pkg in "${PACKAGES[@]}"; do
  dir="$(pkg_dir "$pkg")"
  name=$(node -p "require('./$dir/package.json').name")

  echo "  Publishing $name@$NEXT..."

  # pnpm publish handles workspace:^ → real version replacement automatically
  (cd "$dir" && pnpm publish --access public --no-git-checks $DRY_RUN)

  echo "  ✓ $name@$NEXT published"
  echo ""
done

# --- Git tag + push ---

if [[ -z "$DRY_RUN" ]]; then
  git add "${BUMPED_FILES[@]}"

  if [[ -n "$ONLY_RAW" ]]; then
    # Build commit message and tags for each package
    TAGS=()
    TAG_NAMES=()
    for pkg in "${PACKAGES[@]}"; do
      dir="$(pkg_dir "$pkg")"
      name=$(node -p "require('./$dir/package.json').name")
      TAGS+=("$name@$NEXT")
      TAG_NAMES+=("$name")
    done

    COMMIT_MSG="release: $(IFS=', '; echo "${TAGS[*]}")"
    git commit -m "$COMMIT_MSG"

    for tag in "${TAGS[@]}"; do
      git tag "$tag"
      echo "🏷️  Tagged $tag"
    done
  else
    git commit -m "release: v$NEXT"
    git tag "v$NEXT"
    echo "🏷️  Tagged v$NEXT"
  fi

  git push origin main --tags
  echo "✓ Pushed"
else
  if [[ -n "$ONLY_RAW" ]]; then
    for pkg in "${PACKAGES[@]}"; do
      dir="$(pkg_dir "$pkg")"
      name=$(node -p "require('./$dir/package.json').name")
      echo "🏷️  Would tag $name@$NEXT (skipped in dry run)"
    done
  else
    echo "🏷️  Would tag v$NEXT (skipped in dry run)"
  fi
  # Revert version bumps in dry run
  git checkout -- "${BUMPED_FILES[@]}"
  echo "  Reverted version bumps"
fi

echo ""
echo "🪸 Done!"
