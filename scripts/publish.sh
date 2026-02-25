#!/usr/bin/env bash
set -euo pipefail

# Ensure we're running from the repo root
cd "$(dirname "$0")/.."

# Publish Zooid packages to npm
# Usage: ./scripts/publish.sh [--only <pkg,pkg,...>] [--dry-run]
#
# Examples:
#   ./scripts/publish.sh                          # interactive bump, publish all
#   ./scripts/publish.sh --only web               # interactive bump, publish @zooid/web only
#   ./scripts/publish.sh --only web,server        # interactive bump, publish both
#   ./scripts/publish.sh --only web --dry-run
#
# Publishes in dependency order (when publishing all):
#   @zooid/types → @zooid/ui → @zooid/sdk → @zooid/web → @zooid/server → zooid (CLI)
# Handles workspace:^ → real version replacement via pnpm publish

DRY_RUN=""
ONLY_RAW=""

while [[ $# -gt 0 ]]; do
  case "$1" in
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

pkg_name() {
  local dir
  dir="$(pkg_dir "$1")"
  node -p "require('./$dir/package.json').name"
}

pkg_version() {
  local dir
  dir="$(pkg_dir "$1")"
  node -p "require('./$dir/package.json').version"
}

is_valid_pkg() {
  for p in "${ALL_PACKAGES[@]}"; do [[ "$p" == "$1" ]] && return 0; done
  return 1
}

bump_version() {
  local version="$1" bump="$2"
  local major minor patch
  IFS='.' read -r major minor patch <<< "$version"
  case "$bump" in
    patch) patch=$((patch + 1)) ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    major) major=$((major + 1)); minor=0; patch=0 ;;
  esac
  echo "$major.$minor.$patch"
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
else
  PACKAGES=("${ALL_PACKAGES[@]}")
fi

# --- Show current versions and prompt for bump type ---

echo "📦 Current versions:"
echo ""
printf "  %-20s %s\n" "Package" "Version"
printf "  %-20s %s\n" "───────" "───────"
for pkg in "${PACKAGES[@]}"; do
  name=$(pkg_name "$pkg")
  version=$(pkg_version "$pkg")
  printf "  %-20s %s\n" "$name" "$version"
done
echo ""

# Show what each bump type would produce
echo "  Bump options:"
echo ""
printf "  %-4s %-20s" "" "Package"
printf "%-12s %-12s %-12s\n" "patch" "minor" "major"
printf "  %-4s %-20s" "" "───────"
printf "%-12s %-12s %-12s\n" "─────" "─────" "─────"
for pkg in "${PACKAGES[@]}"; do
  name=$(pkg_name "$pkg")
  version=$(pkg_version "$pkg")
  p=$(bump_version "$version" patch)
  mi=$(bump_version "$version" minor)
  ma=$(bump_version "$version" major)
  printf "  %-4s %-20s" "" "$name"
  printf "%-12s %-12s %-12s\n" "$p" "$mi" "$ma"
done
echo ""

# Prompt for bump type
while true; do
  read -rp "  Bump type [patch/minor/major]: " BUMP
  case "$BUMP" in
    patch|minor|major) break ;;
    p) BUMP="patch"; break ;;
    mi) BUMP="minor"; break ;;
    ma) BUMP="major"; break ;;
    *) echo "  ✗ Please enter patch, minor, or major" ;;
  esac
done
echo ""

# Calculate per-package next versions and show summary
declare -a NEXT_VERSIONS=()
echo "  Will publish:"
echo ""
for i in "${!PACKAGES[@]}"; do
  pkg="${PACKAGES[$i]}"
  name=$(pkg_name "$pkg")
  current=$(pkg_version "$pkg")
  next=$(bump_version "$current" "$BUMP")
  NEXT_VERSIONS+=("$next")
  printf "  %-20s %s → %s\n" "$name" "$current" "$next"
done
echo ""

# Confirm
read -rp "  Proceed? [y/N]: " CONFIRM
case "$CONFIRM" in
  y|Y|yes|Yes) ;;
  *) echo "  Aborted."; exit 0 ;;
esac
echo ""

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
    name=$(pkg_name "$pkg")
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
    name=$(pkg_name "$pkg")
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

BUMPED_FILES=()
for i in "${!PACKAGES[@]}"; do
  pkg="${PACKAGES[$i]}"
  dir="$(pkg_dir "$pkg")"
  next="${NEXT_VERSIONS[$i]}"
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$dir/package.json', 'utf-8'));
    pkg.version = '$next';
    fs.writeFileSync('$dir/package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  BUMPED_FILES+=("$dir/package.json")
  echo "  $dir → $next"
done
echo ""

# --- Publish ---

echo "🚀 Publishing..."
echo ""

for i in "${!PACKAGES[@]}"; do
  pkg="${PACKAGES[$i]}"
  dir="$(pkg_dir "$pkg")"
  name=$(pkg_name "$pkg")
  next="${NEXT_VERSIONS[$i]}"

  echo "  Publishing $name@$next..."

  # pnpm publish handles workspace:^ → real version replacement automatically
  (cd "$dir" && pnpm publish --access public --no-git-checks $DRY_RUN)

  echo "  ✓ $name@$next published"
  echo ""
done

# --- Git tag + push ---

if [[ -z "$DRY_RUN" ]]; then
  git add "${BUMPED_FILES[@]}"

  # Build commit message and tags
  TAGS=()
  for i in "${!PACKAGES[@]}"; do
    pkg="${PACKAGES[$i]}"
    name=$(pkg_name "$pkg")
    next="${NEXT_VERSIONS[$i]}"
    TAGS+=("$name@$next")
  done

  COMMIT_MSG="release: $(IFS=', '; echo "${TAGS[*]}")"
  git commit -m "$COMMIT_MSG"

  for tag in "${TAGS[@]}"; do
    git tag "$tag"
    echo "🏷️  Tagged $tag"
  done

  git push origin main --tags
  echo "✓ Pushed"
else
  for i in "${!PACKAGES[@]}"; do
    pkg="${PACKAGES[$i]}"
    name=$(pkg_name "$pkg")
    next="${NEXT_VERSIONS[$i]}"
    echo "🏷️  Would tag $name@$next (skipped in dry run)"
  done
  # Revert version bumps in dry run
  git checkout -- "${BUMPED_FILES[@]}"
  echo "  Reverted version bumps"
fi

echo ""
echo "🪸 Done!"
