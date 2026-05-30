#!/usr/bin/env bash
set -euo pipefail

env_dump="$(supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY)=')"
eval "$env_dump"

: "${API_URL:?Local Supabase API_URL is unavailable. Run supabase start first.}"
: "${PUBLISHABLE_KEY:?Local Supabase PUBLISHABLE_KEY is unavailable. Run supabase start first.}"

export VITE_SUPABASE_URL="$API_URL"
export VITE_SUPABASE_ANON_KEY="$PUBLISHABLE_KEY"
export VITE_API_PROXY="${VITE_API_PROXY:-http://127.0.0.1:9}"

exec pnpm dev -- --host 127.0.0.1 --strictPort
