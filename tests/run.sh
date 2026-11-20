#!/bin/sh
# tests/run.sh [layout.json ...]: rmp_ui.c (C) against rmpui.js render() (the designer's preview), pixel for pixel,
# over every page of each layout and 155 knob sets (0, 127, 127 + 127/128, 64, 63.99, 150 random with fractions).
# Always tests tests/all_types.json (every element type); add your own exported layouts as arguments.
# Needs node and a C compiler (cc, or CC=...).
set -eu
here=$(cd "$(dirname "$0")" && pwd); ui="$here/.."; t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
CC=${CC:-cc}; fail=0; i=0
for lay in "$here/all_types.json" "$@"; do
  i=$((i + 1)); d="$t/$i"; mkdir -p "$d"
  n=$(node "$here/gen.mjs" "$lay" "$d")
  "$CC" -std=c99 -O2 -Wall -Wextra -Werror -Wno-unused-function -I"$ui" -I"$d" -o "$d/h" "$here/harness.c" "$ui/rmp_ui.c"
  "$d/h" "$d/cases.bin" > "$d/actual.txt"
  if cmp -s "$d/expected.txt" "$d/actual.txt"; then echo "ok    $(basename "$lay"): $n identical"
  else echo "FAIL  $(basename "$lay"): $(diff "$d/expected.txt" "$d/actual.txt" | grep -c '^>') of $n differ"; fail=1; fi
done
exit $fail
