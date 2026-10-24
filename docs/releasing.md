# Releasing

Consumers pin the reusable workflows by major tag (`@v8`). A non-breaking change moves the current tag forward; a breaking change opens the next one. [CHANGELOG.md](../CHANGELOG.md) records each tag's changes.

## Moving the current major

A non-breaking change reaches callers only when the current major tag moves to include it. Once the change's pull request merges, run the script from any branch or worktree of this repository:

```sh
scripts/move-major-tag.sh
```

The script needs bash, git, and a signing key configured for git. It fetches `main` and the tags from `origin` and takes the current major from the highest `v<N>` tag there. It refuses to run when `origin` does not have a major tag, when `main` does not descend from that tag, when `CODE_QUALITY_TARGET_MAJOR` in the readyup kit at `origin/main` is neither the current major nor the next one, or when [CHANGELOG.md](../CHANGELOG.md) at `origin/main` lacks a section for the tag.

Before it changes any tag, the script lists the commits that the move publishes and asks for confirmation. Confirm only when every listed commit belongs in the current major and the changelog section lists the change. The script then re-creates the tag as a signed annotated tag at the head of `main`, pushes that tag object, and checks that `origin` now has it. The script exits 0 only when `origin`'s tag is the new tag object at `main`; a failed run exits non-zero and names what it found. A rerun after a move that succeeded reports that nothing moves.

Tag only merged commits on `main`, never a branch commit: Callers run whatever the tag names as soon as it moves.

## A new major

The readyup kit in `.readyup/kits/default.ts` checks callers against the current major, so a new major changes the kit in the same pull request, and the new tag follows its merge:

1. Raise `CODE_QUALITY_TARGET_MAJOR` to the new major, and point `CODE_QUALITY_TARGET_MIGRATION_URL` at the new major's migration guide in the README.
2. For each change that the new major requires of a caller and that a check of `code-quality.yaml` can detect, add a check gated with `skipUnlessWorkflowPinnedAtLeast(<new major>)`. Never move an existing check's floor: It records the major that introduced the requirement.
3. Recompile the kit with `pnpm exec rdy compile`, and commit the bundle and manifest with the source. CI fails when they do not reproduce from it.
4. Once the pull request merges, run `scripts/move-major-tag.sh`, as [Moving the current major](#moving-the-current-major) describes. Because the kit at `origin/main` names the next major, the script creates that tag rather than moving the current one, and every commit that it lists belongs in the new major.

`rdy run --from github:williamthorsen/.github` serves the kit from `main`, so callers see the new target as soon as the pull request merges.
