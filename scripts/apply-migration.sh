#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Trivia DB setup"
echo "============="
echo ""
echo "If tables are missing, apply the migration with one of these options:"
echo ""
echo "1) Supabase MCP / Dashboard SQL editor:"
echo "   File: $ROOT_DIR/supabase/migrations/20250804180000_init.sql"
echo ""
echo "2) Supabase CLI:"
echo "   supabase login"
echo "   cd \"$ROOT_DIR\" && supabase link --project-ref nkredvlkdbryulmrqlng"
echo "   supabase db push"
echo ""

if command -v supabase >/dev/null 2>&1 && supabase projects list >/dev/null 2>&1; then
  cd "$ROOT_DIR"
  supabase db push
  echo "Migration applied via Supabase CLI."
else
  echo "Supabase CLI not authenticated — use option 1 or run 'supabase login' first."
fi
