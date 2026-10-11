# .github

Consumers pin the reusable workflows by major tag (`@v8`). A tag moves forward as non-breaking changes land, so a section grows after its tag is first cut; a breaking change opens the next tag instead. Entries marked 🚨 break consumers moving to that tag.

## v8

### Features

- 🚨 Added actionlint to the `code-quality-pnpm` workflow, linting the caller's `.github/workflows` on every run; the `lint-workflows` input turns it off. See [Migrating from v7 to v8](README.md#migrating-from-v7-to-v8).
- Added a `check-commands` input to the `code-quality-pnpm` workflow, running each entry as its own job on its own runner. `check-command` is now optional and keeps its single `Code quality` job. See [Fanning checks out across runners](README.md#fanning-checks-out-across-runners).
- Added a readyup kit that checks a caller of the `code-quality-pnpm` workflow against the current major, run with `rdy run --from github:williamthorsen/.github`. See [Checking a caller](README.md#checking-a-caller).
- Added runner selection to the `code-quality-pnpm` workflow, through a `CI_RUNS_ON` configuration variable or a `runs-on` input; the default stays `ubuntu-latest`. See [Runner](README.md#runner).
- Replaced corepack with `pnpm/setup` in the `code-quality-pnpm` workflow, so that a runner without Node.js installs pnpm; the pnpm version still follows each consumer's `packageManager` field, which must name pnpm 11 or later.

## v7

### Features

- Added a `shellspec-version` input to the `code-quality-pnpm` workflow, installing shellspec for the check command. Callers with a hand-rolled installer should see [Migrating from a hand-rolled shellspec install](README.md#migrating-from-a-hand-rolled-shellspec-install).
- 🚨 Made the caller's `.tool-versions` the default Node version source; `node-version` remains as an override. See [Migrating from v6 to v7](README.md#migrating-from-v6-to-v7).

### Removed

- 🚨 Removed the `sync-labels` workflow and its `labels.yaml` config. It declared `on: workflow_call`, so a caller pinned to it has no replacement and must drop the job.

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
