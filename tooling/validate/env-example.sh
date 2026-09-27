#!/usr/bin/env sh
# Schema ↔ .env.example parity (delegates to sync-env-example.ts).
set -e
cd "$(dirname "$0")/../.."
pnpm exec tsx tooling/validate/sync-env-example.ts "$@"
