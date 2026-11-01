#!/usr/bin/env bash
set -euo pipefail

# check-changelog.sh: Fails when a change to a reusable workflow does not also change CHANGELOG.md.
#
# Compares the head commit with its merge base with the base commit, as a pull request's diff does. A reusable workflow
# is a YAML file under .github/workflows/ that declares the workflow_call trigger, read at the head commit, or at the
# base commit for a file that the change deletes. CI skips the check for a pull request labelled skip-changelog.
#
# Usage:
#   check-changelog.sh <base> <head>
#   check-changelog.sh --help

PROG="$(basename "$0")"
readonly PROG
readonly CHANGELOG_PATH=CHANGELOG.md
readonly SKIP_LABEL=skip-changelog
readonly WORKFLOWS_DIR=.github/workflows

# Main flow
main() {
  # Validate arguments
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    show_usage 0
  fi
  if [[ $# -ne 2 ]]; then
    echo "$PROG: Expected 2 arguments, got $#" >&2
    show_usage
  fi
  local base="$1" head="$2"

  # Check dependencies
  if ! command -v git &>/dev/null; then
    echo "$PROG: Required command 'git' not found" >&2
    exit 127
  fi

  # List the changed files
  local merge_base changed
  merge_base=$(git merge-base "$base" "$head") || die "Could not find a merge base of $base and $head"
  changed=$(git diff --name-only --no-renames "$merge_base" "$head") ||
    die "Could not list the files changed between $merge_base and $head"

  # Find the reusable workflows among them
  local -a reusable=()
  local file
  while IFS= read -r file; do
    [[ "$file" == "$WORKFLOWS_DIR"/*.yaml || "$file" == "$WORKFLOWS_DIR"/*.yml ]] || continue
    if declares_workflow_call "$head" "$file" || declares_workflow_call "$merge_base" "$file"; then
      reusable+=("$file")
    fi
  done <<<"$changed"

  # Decide
  if ((${#reusable[@]} == 0)); then
    echo "No reusable workflow changed; $CHANGELOG_PATH is not required."
    exit 0
  fi
  if grep --quiet --line-regexp --fixed-strings "$CHANGELOG_PATH" <<<"$changed"; then
    echo "$CHANGELOG_PATH changed with the reusable workflows."
    exit 0
  fi
  {
    echo "$PROG: These reusable workflows changed, but $CHANGELOG_PATH did not:"
    printf '  %s\n' "${reusable[@]}"
    echo "Add an entry under the current major's section, or label the pull request $SKIP_LABEL when callers cannot" \
      "observe the change."
  } >&2
  exit 1
}

# region | Helper functions

# Succeeds when the file exists at the commit and declares the workflow_call trigger.
declares_workflow_call() {
  local content
  content=$(git show "$1:$2" 2>/dev/null) || return 1
  grep --quiet --extended-regexp \
    '^on:.*\bworkflow_call\b|^[[:space:]]+(-[[:space:]]*)?workflow_call[[:space:]]*(:|$)' <<<"$content"
}

# Prints an error message and exits with status 1.
die() {
  echo "$PROG: $*" >&2
  exit 1
}

# Displays command-line syntax: to stdout for a help request (exit 0), to stderr otherwise.
show_usage() {
  local code="${1:-2}" fd=2
  ((code == 0)) && fd=1
  cat >&"$fd" <<USAGE
Fails when a change to a reusable workflow does not also change $CHANGELOG_PATH.

Usage:
  $PROG <base> <head>
  $PROG --help

Arguments:
  base         The commit that the change is compared against, such as a pull request's base
  head         The commit that contains the change

Options:
  -h, --help   Show this help

Exit codes:
  0            No reusable workflow changed, or $CHANGELOG_PATH changed with them
  1            A reusable workflow changed without $CHANGELOG_PATH, or git failed
  2            Invalid arguments

Dependencies:
  git          Lists the changed files and reads each workflow
USAGE
  exit "$code"
}
# endregion | Helper functions

main "$@"
