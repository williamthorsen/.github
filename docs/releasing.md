# Releasing

Consumers pin the reusable workflows by major tag (`@v8`). A non-breaking change moves the current tag forward; a breaking change opens the next one. [CHANGELOG.md](../CHANGELOG.md) records each tag's changes.

## A new major

The readyup kit in `.readyup/kits/default.ts` checks callers against the current major, so a new major changes the kit in the same pull request:

1. Raise `CODE_QUALITY_TARGET_MAJOR` to the new major, and point `CODE_QUALITY_TARGET_MIGRATION_URL` at the new major's migration guide in the README.
2. For each change that the new major requires of a caller and that a check of `code-quality.yaml` can detect, add a check gated with `skipUnlessWorkflowPinnedAtLeast(<new major>)`. Never move an existing check's floor: It records the major that introduced the requirement.
3. Recompile the kit with `pnpm exec rdy compile`, and commit the bundle and manifest with the source. CI fails when they do not reproduce from it.

`rdy run --from github:williamthorsen/.github` serves the kit from `main`, so callers see the new target as soon as the pull request merges.
