# Releasing

Consumers pin the reusable workflows by major tag (`@v8`). A non-breaking change moves the current tag forward; a breaking change opens the next one. [CHANGELOG.md](../CHANGELOG.md) records each tag's changes.

## Moving the current major

A non-breaking change reaches callers only when the current major tag moves to include it. Move the tag once the change's pull request merges, substituting the current major for `v8`:

1. Fetch `main` and the remote tags, so that the local `v8` matches the remote's:

   ```sh
   git fetch --tags --force origin
   ```

2. Check that every commit listed by `git log v8..origin/main` belongs in the current major, because the move publishes all of them, and that [CHANGELOG.md](../CHANGELOG.md) lists the change under the current tag's section.
3. Re-create the tag at the head of `main`, which contains the merge commit, and push it:

   ```sh
   git tag --force --sign --message v8 v8 origin/main
   git push --force origin refs/tags/v8
   ```

   `--sign` creates an annotated tag signed with the configured key, and the message is the tag's own name, as on every major tag from `v6` on. The full ref in the push prevents a match with a branch of the same name.

4. Confirm that `git ls-remote origin 'refs/tags/v8^{}'` reports the same commit as `git rev-parse origin/main`.

Tag only merged commits on `main`, never a branch commit: Callers run whatever the tag names as soon as it moves.

## A new major

The readyup kit in `.readyup/kits/default.ts` checks callers against the current major, so a new major changes the kit in the same pull request, and the new tag follows its merge:

1. Raise `CODE_QUALITY_TARGET_MAJOR` to the new major, and point `CODE_QUALITY_TARGET_MIGRATION_URL` at the new major's migration guide in the README.
2. For each change that the new major requires of a caller and that a check of `code-quality.yaml` can detect, add a check gated with `skipUnlessWorkflowPinnedAtLeast(<new major>)`. Never move an existing check's floor: It records the major that introduced the requirement.
3. Recompile the kit with `pnpm exec rdy compile`, and commit the bundle and manifest with the source. CI fails when they do not reproduce from it.
4. Once the pull request merges, create the new tag as [Moving the current major](#moving-the-current-major) describes, with the new major's name and without `--force` on the tag or the push. Skip the `git log` check: Every commit since the previous major's tag belongs in the new major.

`rdy run --from github:williamthorsen/.github` serves the kit from `main`, so callers see the new target as soon as the pull request merges.
