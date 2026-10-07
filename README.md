<!-- readme-type: config -->

# .github

Organization-wide workflows and default templates.

## Reusable workflows

### `code-quality-pnpm-workflow.yaml`

Runs code quality and build checks for pnpm-based projects on `ubuntu-latest`.

#### Inputs

| Name                | Type      | Required | Default          | Description                                                                                                                                                                                                                                                       |
| ------------------- | --------- | -------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-command`     | `string`  | no       | `''`             | Command to run code quality and build checks in one job named `Code quality` (e.g., `pnpm run ci`, `nmr ci`). Pass this or `check-commands`, not both.                                                                                                            |
| `check-commands`    | `string`  | no       | `''`             | JSON array of `{ "name": ..., "command": ... }` entries, each run as its own job on its own runner. Pass this or `check-command`, not both. See [Fanning checks out across runners](#fanning-checks-out-across-runners).                                          |
| `lint-workflows`    | `boolean` | no       | `true`           | Lint the repository's `.github/workflows` with actionlint. Set to `false` to skip the step. See [Workflow linting](#workflow-linting).                                                                                                                            |
| `node-version`      | `string`  | no       | `''`             | Explicit Node.js version. Overrides `node-version-file`. Omit to use the version your repository already declares.                                                                                                                                                |
| `node-version-file` | `string`  | no       | `.tool-versions` | Path to a file declaring the Node.js version, relative to the repository root. Ignored when `node-version` is supplied.                                                                                                                                           |
| `setup-command`     | `string`  | no       | `''`             | Optional shell command to run after dependency installation and bootstrap, before the check command. Use for installing system dependencies. The consumer is responsible for sudo, package-manager flags, and any necessary index updates (e.g., apt-get update). |
| `shellspec-version` | `string`  | no       | `''`             | Shellspec release to install before the checks run (e.g., `0.28.1`). Omit to install nothing. The installer comes from the named release's own tag.                                                                                                               |

#### Usage

Minimal caller:

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v8
    with:
      check-command: 'pnpm run ci'
```

The checks run on the Node version your repository's `.tool-versions` declares, so the caller names no version and there is nothing to keep in sync.

Install an apt package before running checks (e.g., `ripgrep`):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v8
    with:
      check-command: 'pnpm run ci'
      setup-command: 'sudo apt-get update -qq && sudo apt-get install -y -qq ripgrep'
```

The `setup-command` runs after dependencies are installed and the optional `bootstrap` script, and before `check-command`. The workflow does not run `apt-get update` or supply `sudo` on the consumer's behalf — include those in the command when needed.

Run shell tests (e.g., `shellspec`):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v8
    with:
      check-command: 'pnpm run ci'
      shellspec-version: '0.28.1'
```

Run checks across a Node-version matrix:

```yaml
jobs:
  code-quality:
    strategy:
      fail-fast: false
      matrix:
        node-version: ['22.13.0', '24.18.0']
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v8
    with:
      node-version: ${{ matrix.node-version }}
      check-command: 'pnpm run ci'
```

The workflow declares no concurrency of its own, so the matrix fans out with nothing beyond the matrix itself required. `fail-fast: false` is recommended for a compatibility matrix: without it, the first leg to fail cancels the others, so you would see only one failing Node version instead of every affected one.

Fan checks out across runners (see [Fanning checks out across runners](#fanning-checks-out-across-runners)):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v8
    with:
      check-commands: >-
        [
          { "name": "test", "command": "nmr test" },
          { "name": "lint", "command": "nmr lint" },
          { "name": "static", "command": "nmr typecheck && nmr fmt:check && pnpm run check:strict:post" }
        ]
```

#### Checking a caller

This repository publishes a [readyup](https://www.npmjs.com/package/readyup) kit that checks a caller against the workflow's current major: whether it pins that major, and whether it has made the changes that each major requires. Each failing check prints its fix, which links to a migration guide when one covers the change.

```shell
pnpm dlx readyup run --from github:williamthorsen/.github
```

A repository that already has readyup installed runs `rdy run --from github:williamthorsen/.github`.

The kit reads `.github/workflows/code-quality.yaml`, so a caller under another filename fails its first check. It runs from this repository's `main`, so it checks against the latest major. [Releasing](docs/releasing.md) describes how the kit follows each new major.

#### Fanning checks out across runners

`check-commands` runs each entry as its own job, on its own runner, so the checks run in parallel instead of one after another. The workflow builds the matrix, so the caller lists the legs and nothing more. The input is a JSON string because reusable-workflow inputs are scalars; it takes at least one entry, and each entry needs a non-empty `name` and `command`.

- Each leg is a separate check named after its entry (`code-quality / test`, `code-quality / lint`, ...), so branch protection names each leg instead of `Code quality`.
- `fail-fast` is off: a failing leg does not cancel the others, so one run reports every failing check.
- Every leg checks out, installs, bootstraps, and runs `setup-command` on its own. A leg whose command needs a build output includes the build in its command.
- A command that splits a composite script into legs no longer fires that script's nmr `:post` hook. Name the hook's step in the leg that replaces it, as the `static` leg above does with `pnpm run check:strict:post`.
- actionlint runs in one leg only, since every leg would lint the same files.
- An invalid or non-array `check-commands` fails with GitHub's own expression error before any leg starts.

With `check-command` instead, the workflow runs one job named `Code quality`, as it always has.

#### Node version

By default the workflow reads the Node version from your repository's `.tool-versions`, the same file your local toolchain uses. Declaring the version once is the point: there is no second copy in the workflow call to drift from it, and no consistency test needed to catch the drift.

Precedence follows `actions/setup-node`: an explicit `node-version` wins over the file, which is what makes the compatibility matrix above work. Point `node-version-file` elsewhere to read a different file, such as `.nvmrc` or `package.json`.

Three constraints on the file, each failing differently:

- It must exist. A repository with neither a `node-version` input nor the file fails with `The specified node version file at: ... does not exist`. Add `.tool-versions`, or pass `node-version` explicitly.
- It must declare a `nodejs` entry. A file present without one resolves to its own contents as the requested version, and the run fails with `Unable to find Node version '<contents>' for platform linux and architecture x64.` A polyglot `.tool-versions` kept for python or awscli alone lands here.
- The `nodejs` entry must carry a single version and no trailing whitespace. `nodejs 24.18.0` resolves; `nodejs 24.18.0 22.13.0` does not, and fails the same way as a missing entry. Entries for other tools on their own lines are ignored, so a multi-tool `.tool-versions` is fine.

#### Shell tests

`shellspec` is not in Ubuntu's apt repositories, and it runs the shell tests rather than being a subject of them, so the workflow provisions it the way it provisions Node and pnpm. Set `shellspec-version` to the release you want and `shellspec` is on `PATH` for the check command; leave it unset and no installer is fetched at all.

The input takes a concrete release, not a `latest` token. Every other version this workflow touches is pinned, and a floating one would let a shellspec release change your gate with no commit in either repository to explain it. Naming the release also fixes where the installer comes from: that release's own tag, so no moving branch reaches the shell.

Tools the code under test consumes, such as `rg` or `jq`, are a different kind of dependency and stay in `setup-command`.

#### Workflow linting

After the check command, the workflow runs [actionlint](https://github.com/rhysd/actionlint) over the calling repository's `.github/workflows`, so a workflow that GitHub would reject fails the pull request rather than its first run after merge. A `${{ runner.temp }}` in a job-level `env:`, for example, is accepted by YAML but rejected by GitHub. The step runs even when the check command fails, so one run reports both results.

actionlint runs with its default checks, which include shellcheck on `run:` scripts. To configure them, such as declaring self-hosted runner labels or ignoring a finding by pattern, add a [`.github/actionlint.yaml`](https://github.com/rhysd/actionlint/blob/main/docs/config.md) to the calling repository, which actionlint reads from there. To skip the step entirely, set `lint-workflows: false`.

#### Concurrency

This workflow does not manage concurrency; that is the caller's responsibility. To cancel superseded runs (for example, when you push a new commit while checks from the previous one are still running), declare a **workflow-level** `concurrency` block in your caller — at the top of the workflow file, not inside the job that calls this workflow:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v8
    with:
      check-command: 'pnpm run ci'
```

Workflow-level concurrency cancels a superseded _run_ while leaving the current run's matrix legs intact, so it composes correctly with the matrix example above and with the legs of `check-commands`. A job-level group placed inside a matrixed caller would instead be shared across the legs and cancel them.

#### Migrating from v5 to v6

`v6` removes the built-in job-level `concurrency` group that earlier versions declared. If you relied on it to auto-cancel superseded runs, add the workflow-level `concurrency` block shown above to your caller. Callers that matrix over Node versions (or any other axis) no longer need a workaround — every leg now runs.

#### Migrating from v6 to v7

`v7` takes the Node version from your repository's `.tool-versions` instead of a version restated in the workflow call. Two steps:

1. Confirm `.tool-versions` exists and declares a `nodejs` entry. Both are required, and an absent file and a present file without the entry fail with different messages — see [Node version](#node-version) for both.
2. Delete the `node-version` input from your caller.

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
    with:
      check-command: 'pnpm run ci'
      node-version: '24.18.0' # delete this line
```

Any test that guards against the two copies diverging (for example one built on `checkNodeVersionConsistency`) has nothing left to compare and can be deleted with it.

Keep `node-version` only where you mean to override the file, such as a compatibility matrix. It still takes precedence when supplied, so a matrixed caller needs no change beyond the tag.

#### Migrating from a hand-rolled shellspec install

Before this input existed, callers installed shellspec themselves through `setup-command`. Delete that entry and set `shellspec-version` instead:

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
    with:
      check-command: 'pnpm run ci'
      shellspec-version: '0.28.1'
```

Delete it rather than leaving it alongside the input. The installer defaults to the same prefix this workflow installs into, and it aborts when its installation directory already exists, so a caller that sets both fails the run.

The input is additive, so `v7` carries it without a tag bump.

#### Migrating from v7 to v8

`v8` lints the caller's workflows with actionlint on every run, so a caller whose workflows already contain an error starts failing. Before moving the tag, run actionlint in the calling repository (`brew install actionlint`, then `actionlint` from the repository root) and fix what it reports, or configure the checks as described in [Workflow linting](#workflow-linting). To keep `v7` behavior instead, set `lint-workflows: false`:

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v8
    with:
      check-command: 'pnpm run ci'
      lint-workflows: false
```
