#!/usr/bin/env sh
# Design-token contract gate.
#
# App code styles ONLY through semantic tokens (bg-background, text-success,
# bg-brand, …) — never raw Tailwind palette classes. This single rule is what
# keeps "a theme is just a CSS file of token values" true: as long as it
# holds, multi-theme support and full redesigns never touch components.
#
# Exempt: vendored shadcn primitives (src/shared/components/ui — replaced
# wholesale on `shadcn add`), tests, and fixtures.
#
# Run from project root: pnpm validate:tokens

cd "$(dirname "$0")/../.."

PALETTE='red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone'
PREFIX='bg|text|border|from|via|to|fill|stroke|ring|outline|shadow|decoration|divide|accent|caret'

VIOLATIONS=$(grep -rEn "(^|[\"'[:space:]:!])(${PREFIX})-((${PALETTE})-[0-9]{2,3}|white|black)([\"'[:space:]/]|$)" src \
  --include='*.ts' --include='*.tsx' \
  | grep -v '^src/shared/components/ui/' \
  | grep -v '\.test\.' \
  | grep -v '\.fixtures\.ts' \
  || true)

if [ -n "$VIOLATIONS" ]; then
  echo "Design-token contract violation(s) — raw palette classes in app code:"
  echo "$VIOLATIONS" | sed 's/^/  /'
  echo ""
  echo "Use semantic tokens instead (background/foreground, primary, success,"
  echo "warning, info, destructive, brand, sidebar-*, chart-*) — defined in"
  echo "src/index.css. Add a new token there if none fits."
  exit 1
fi

echo "Design tokens OK — no raw palette classes outside vendored ui/."
