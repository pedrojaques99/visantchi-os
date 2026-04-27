#!/usr/bin/env bash
set -e

CLI_DIR="$(cd "$(dirname "$0")/packages/cli/visantchi/packages/cli" && pwd)"

echo "→ Building before publish..."
cd "$(dirname "$0")"
npm run build:cli

echo ""
echo "→ Entering CLI package: $CLI_DIR"
cd "$CLI_DIR"

echo ""
echo "→ npm login (enter your credentials)"
npm login

echo ""
echo "→ Publishing visantchi@$(node -p "require('./package.json').version")..."
npm publish --access public

echo ""
echo "✓ Published!"
