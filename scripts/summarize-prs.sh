#!/bin/bash
set -euo pipefail

if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
  echo "Usage: $0 <start-date> <end-date> <mode> [output-file]"
  echo "  <start-date>, <end-date>  in YYYY-MM-DD format"
  echo "  <mode>                    all | daily"
  echo "    all    -> include all PRs in the range"
  echo "    daily  -> only the first PR per day"
  echo "  [output-file]             if provided, determines format by extension:"
  echo "                              *.csv -> CSV, otherwise TXT (tab-separated)"
  echo "Examples:"
  echo "  $0 2025-05-01 2025-07-23 all"
  echo "  $0 2025-05-01 2025-07-23 daily prs.csv"
  echo "  $0 2025-05-01 2025-07-23 all prs.txt"
  exit 1
fi

START_DATE="$1"
END_DATE="$2"
MODE="$3"      # all | daily
OUTFILE="${4:-}"

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

# Derive owner/repo from git remote origin
ORIGIN_URL="$(git remote get-url origin)"

REPO_PATH="$(
  printf '%s\n' "$ORIGIN_URL" \
  | sed -E 's#^git@github.com:##' \
  | sed -E 's#^https?://github.com/##' \
  | sed -E 's#\.git$##'
)"

run() {
  if [ "$FORMAT" = "csv" ]; then
    echo 'date,number,url,title'
  fi

  # NOTE: using closed date; change "closed:" to "created:" if you prefer created date
  raw=$(
    gh pr list \
      --repo "$REPO_PATH" \
      --state all \
      --search "closed:$START_DATE..$END_DATE" \
      --json number,title,url,closedAt \
      --jq '.[] | [.closedAt[0:10], ("#" + (.number|tostring)), .url, .title] | @tsv'
  )

  if [ "$MODE" = "daily" ]; then
    raw=$(printf '%s\n' "$raw" | awk -F'\t' '!seen[$1]++')
  fi

  printf '%s\n' "$raw" \
    | while IFS=$'\t' read -r date number url title; do
        if [ "$FORMAT" = "csv" ]; then
          esc_title=${title//\"/\"\"}
          printf '%s,%s,%s,"%s"\n' "$date" "$number" "$url" "$esc_title"
        else
          printf '%s\t%s\t%s\t%s\n' "$date" "$number" "$url" "$title"
        fi
      done
}

if [ -n "$OUTFILE" ]; then
  run > "$OUTFILE"
  echo "Wrote $MODE PRs in $FORMAT format to $OUTFILE"
else
  run
fi
