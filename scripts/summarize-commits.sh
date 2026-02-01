#!/bin/bash
set -euo pipefail

if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
  echo "Usage: $0 <start-date> <end-date> <mode> [output-file]"
  echo "  <start-date>, <end-date>  in YYYY-MM-DD (git-compatible) format"
  echo "  <mode>                    all | daily"
  echo "    all    -> include all commits in the range"
  echo "    daily  -> only the first commit per day"
  echo "  [output-file]             if provided, determines format by extension:"
  echo "                              *.csv -> CSV, otherwise TXT (tab-separated)"
  echo "Examples:"
  echo "  $0 2025-05-01 2025-07-23 all"
  echo "  $0 2025-05-01 2025-07-23 daily commits.csv"
  echo "  $0 2025-05-01 2025-07-23 all commits.txt"
  exit 1
fi

START_DATE="$1"
END_DATE="$2"
MODE="$3"      # all | daily
OUTFILE="${4:-}"

# Validate mode
case "$MODE" in
  all|daily) ;;
  *)
    echo "Invalid mode: $MODE (use 'all' or 'daily')" >&2
    exit 1
    ;;
esac

# Decide format from output file extension
FORMAT="txt"
if [ -n "$OUTFILE" ]; then
  case "$OUTFILE" in
    *.csv) FORMAT="csv" ;;
    *)     FORMAT="txt" ;;
  esac
fi

# Derive the GitHub base URL from the 'origin' remote
ORIGIN_URL="$(git remote get-url origin)"

GITHUB_BASE_URL="$(
  printf '%s\n' "$ORIGIN_URL" \
  | sed -E 's#^git@github.com:#https://github.com/#' \
  | sed -E 's#\.git$##'
)"

run() {
  if [ "$FORMAT" = "csv" ]; then
    echo 'date,commit,url,message'
  fi

  base_log=$(
    git log \
      --since="$START_DATE" \
      --until="$END_DATE 23:59:59" \
      --format='%ad%x09%H%x09%s' \
      --date=short
  )

  if [ "$MODE" = "daily" ]; then
    # keep only first commit per date
    base_log=$(printf '%s\n' "$base_log" | awk -F'\t' '!seen[$1]++')
  fi

  printf '%s\n' "$base_log" \
    | while IFS=$'\t' read -r date sha msg; do
        url="$GITHUB_BASE_URL/commit/$sha"
        if [ "$FORMAT" = "csv" ]; then
          esc_msg=${msg//\"/\"\"}
          printf '%s,%s,%s,"%s"\n' "$date" "$sha" "$url" "$esc_msg"
        else
          printf '%s\t%s\t%s\t%s\n' "$date" "$sha" "$url" "$msg"
        fi
      done
}

if [ -n "$OUTFILE" ]; then
  run > "$OUTFILE"
  echo "Wrote $MODE commits in $FORMAT format to $OUTFILE"
else
  run
fi
