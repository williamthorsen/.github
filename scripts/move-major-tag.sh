#!/usr/bin/env bash
set -euo pipefail

# move-major-tag.sh: Moves the current major tag to the head of main, or creates the next one.
#
# Reads every input from origin rather than from the working tree, so it runs from any branch or worktree. The current
# major is the highest v<N> tag on origin. The readyup kit's CODE_QUALITY_TARGET_MAJOR at origin/main decides the mode:
# equal to the current major, the script moves that tag; one higher, it creates the new major tag; anything else, it
# refuses. It also refuses when main does not descend from the tag that it moves, or when CHANGELOG.md at origin/main
# lacks a section for the target tag.
#
# After confirmation, it creates a signed annotated tag at origin/main and pushes that tag object by its ID, leased
# against the remote value read before the prompt, then verifies that origin's tag is that object and peels to
# origin/main. A local rewrite of the tag or a concurrent remote move therefore fails the run instead of passing it.
#
# Usage:
#   move-major-tag.sh
#   move-major-tag.sh --help

PROG="$(basename "$0")"
readonly PROG
readonly REMOTE=origin
readonly CHANGELOG_PATH=CHANGELOG.md
readonly KIT_PATH=.readyup/kits/default.ts

# Main flow
main() {
  # Validate arguments
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    show_usage 0
  fi
  if [[ $# -gt 0 ]]; then
    echo "$PROG: Unexpected argument '$1'" >&2
    show_usage
  fi

  # Check dependencies
  if ! command -v git &>/dev/null; then
    echo "$PROG: Required command 'git' not found" >&2
    exit 127
  fi

  # Fetch main and the tags
  git fetch --quiet --force --tags "$REMOTE" "+refs/heads/main:refs/remotes/$REMOTE/main" ||
    die "Could not fetch main and the tags from $REMOTE"
  local main_id
  main_id=$(git rev-parse --verify --quiet "refs/remotes/$REMOTE/main^{commit}") ||
    die "Could not resolve $REMOTE/main after the fetch"

  # Read the remote's majors before the prompt, so that the lease covers a remote move during it
  local remote_tags current
  remote_tags=$(git ls-remote --tags "$REMOTE") || die "Could not list the tags on $REMOTE"
  current=$(list_majors "$remote_tags" | sort --numeric-sort | tail -n 1)
  [[ -n "$current" ]] || die "Could not find a major tag (v<N>) on $REMOTE"
  current=$((10#$current))

  # Read the kit's target major
  local kit_source target
  kit_source=$(git show "$main_id:$KIT_PATH") || die "Could not read $KIT_PATH at $REMOTE/main"
  target=$(sed -n 's/^const CODE_QUALITY_TARGET_MAJOR = \([0-9][0-9]*\);$/\1/p' <<<"$kit_source")
  [[ -n "$target" ]] || die "Could not read CODE_QUALITY_TARGET_MAJOR from $KIT_PATH at $REMOTE/main"
  target=$((10#$target))

  # Decide the mode
  local mode tag_name base_id lease_id=""
  if ((target == current)); then
    mode=move
  elif ((target == current + 1)); then
    mode=create
  else
    die "The kit targets v$target, but the current major on $REMOTE is v$current; expected v$current or v$((current + 1))"
  fi
  tag_name="v$target"
  base_id=$(peel_remote_tag "$remote_tags" "v$current")

  if [[ "$mode" == move ]]; then
    lease_id=$(find_remote_ref "$remote_tags" "refs/tags/$tag_name")
    if [[ "$base_id" == "$main_id" ]]; then
      echo "$tag_name already points to $REMOTE/main ($main_id); nothing to move."
      exit 0
    fi
    git merge-base --is-ancestor "$base_id" "$main_id" ||
      die "$REMOTE/main does not descend from $tag_name ($base_id); refusing to move the tag off its history"
  fi

  # Check the changelog section
  local changelog
  changelog=$(git show "$main_id:$CHANGELOG_PATH") || die "Could not read $CHANGELOG_PATH at $REMOTE/main"
  grep --quiet --line-regexp --fixed-strings "## $tag_name" <<<"$changelog" ||
    die "$CHANGELOG_PATH at $REMOTE/main lacks a '## $tag_name' section"

  # List the commits and confirm
  echo "Commits on $REMOTE/main since v$current:"
  git log --oneline "$base_id..$main_id"
  echo
  if [[ "$mode" == move ]]; then
    printf 'Move %s to %s? Check that each commit belongs in %s and that %s lists it. [y/N] ' \
      "$tag_name" "$main_id" "$tag_name" "$CHANGELOG_PATH"
  else
    printf 'Create %s at %s? Check that %s lists the new major. [y/N] ' "$tag_name" "$main_id" "$CHANGELOG_PATH"
  fi
  local answer
  read -r answer || answer=""
  if [[ "$answer" != y && "$answer" != yes ]]; then
    die "Declined; no tag changed"
  fi

  # Create the signed tag and pin its object
  local -a force=()
  [[ "$mode" == move ]] && force=(--force)
  git tag ${force[@]+"${force[@]}"} --sign --message "$tag_name" "$tag_name" "$main_id" ||
    die "Could not create the signed tag $tag_name"
  local tag_id
  tag_id=$(git rev-parse --verify --quiet "refs/tags/$tag_name") || die "Could not resolve the new tag $tag_name"
  if [[ "$(git cat-file -t "$tag_id")" != tag || "$(git rev-parse "$tag_id^{commit}")" != "$main_id" ]]; then
    die "The local $tag_name changed after its creation and no longer names a tag at $main_id; nothing was pushed, so rerun"
  fi

  # Push the tag object by its ID
  if [[ "$mode" == move ]]; then
    git push --quiet --force-with-lease="refs/tags/$tag_name:$lease_id" "$REMOTE" "$tag_id:refs/tags/$tag_name" ||
      die "Could not push $tag_name; $REMOTE may have moved it since the fetch"
  else
    git push --quiet "$REMOTE" "$tag_id:refs/tags/$tag_name" ||
      die "Could not push $tag_name; $REMOTE may have created it since the fetch"
  fi

  # Verify the remote
  local pushed_tags pushed_id pushed_peel
  pushed_tags=$(git ls-remote --tags "$REMOTE") || die "Could not list the tags on $REMOTE to verify the push"
  pushed_id=$(find_remote_ref "$pushed_tags" "refs/tags/$tag_name")
  pushed_peel=$(peel_remote_tag "$pushed_tags" "$tag_name")
  if [[ "$pushed_id" != "$tag_id" || "$pushed_peel" != "$main_id" ]]; then
    echo "$PROG: $REMOTE's $tag_name is $pushed_id, peeling to $pushed_peel;" \
      "expected $tag_id, peeling to $main_id" >&2
    exit 1
  fi
  echo "$tag_name on $REMOTE now points to $main_id."
}

# region | Helper functions

# Prints an error message and exits with status 1.
die() {
  echo "$PROG: $*" >&2
  exit 1
}

# Prints the object ID of a ref in `git ls-remote` output, or nothing when the ref is absent.
find_remote_ref() {
  awk -v ref="$2" '$2 == ref { print $1 }' <<<"$1"
}

# Prints the major number of each v<N> tag in `git ls-remote` output.
list_majors() {
  awk '$2 ~ /^refs\/tags\/v[0-9]+$/ { sub(/^refs\/tags\/v/, "", $2); print $2 }' <<<"$1"
}

# Prints the commit that a tag in `git ls-remote` output names, which is the ref itself for a lightweight tag.
peel_remote_tag() {
  local peeled
  peeled=$(find_remote_ref "$1" "refs/tags/$2^{}")
  if [[ -n "$peeled" ]]; then
    echo "$peeled"
  else
    find_remote_ref "$1" "refs/tags/$2"
  fi
}

# Displays command-line syntax: to stdout for a help request (exit 0), to stderr otherwise.
show_usage() {
  local code="${1:-2}" fd=2
  ((code == 0)) && fd=1
  cat >&"$fd" <<USAGE
Moves the current major tag to the head of main, or creates the next major tag when the readyup kit targets it.

Usage:
  $PROG
  $PROG --help

Options:
  -h, --help   Show this help

The script fetches from origin, lists the commits that the tag would publish, and asks for confirmation on stdin
before it changes any tag. It signs the tag with the key configured for git.

Dependencies:
  git          Fetches, signs, pushes, and verifies the tag
USAGE
  exit "$code"
}
# endregion | Helper functions

main "$@"
