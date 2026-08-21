# .github

Consumers pin the reusable workflows by major tag (`@v7`). A tag moves forward as non-breaking changes land, so a section grows after its tag is first cut; a breaking change opens the next tag instead.

## v7

### Features

- Added a `shellspec-version` input to the `code-quality-pnpm` workflow, installing shellspec for the check command. Callers with a hand-rolled installer should see [Migrating from a hand-rolled shellspec install](README.md#migrating-from-a-hand-rolled-shellspec-install).
- 🚨 Made the caller's `.tool-versions` the default Node version source; `node-version` remains as an override. See [Migrating from v6 to v7](README.md#migrating-from-v6-to-v7).

### Removed

- Removed the `sync-labels` workflow and its `labels.yaml` config.

### Dependencies

- Upgraded the pinned action versions and added dependabot to rotate them.

## v6

### Removed

- 🚨 Removed the built-in job-level `concurrency` group; concurrency is the caller's to declare. See [Migrating from v5 to v6](README.md#migrating-from-v5-to-v6).

## v5

### Features

- Added a `setup-command` input to the `code-quality-pnpm` workflow, for installing system dependencies before the checks run.
- Added an optional `bootstrap` step, run after dependency installation.
- Replaced `pnpm/action-setup` with corepack, so the pnpm version follows each consumer's `packageManager` field.

---

Releases below predate the tag-keyed scheme and were versioned as package semver, which nothing here publishes or consumes. The changesets that produced them were retired in `v7`.

## 1.2.0

### Features

- Made runtime versions optional and added fallbacks
- Added a schema for the `code-quality-pnpm` workflow

### Dependencies

- Added `@changesets/cli` to dev deps
