#!/usr/bin/env sh
set -e

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

echo "Starting API and worker..."
node "$repo_root/api/server.js" &
node "$repo_root/worker/worker.js" &

echo "API: http://localhost:3185"
echo "Press Ctrl+C to stop."
wait
