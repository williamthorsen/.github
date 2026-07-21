# .github

Organization-wide workflows and default templates.

## Reusable workflows

### `code-quality-pnpm-workflow.yaml`

Runs code quality and build checks for pnpm-based projects on `ubuntu-latest`.

#### Inputs

| Name                | Type     | Required | Default          | Description                                                                                                                                                                                                                                                       |
| ------------------- | -------- | -------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-command`     | `string` | yes      | —                | Command to run code quality and build checks (e.g., `pnpm run ci`, `nmr ci`).                                                                                                                                                                                     |
| `node-version`      | `string` | no       | `''`             | Explicit Node.js version. Overrides `node-version-file`. Omit to use the version your repository already declares.                                                                                                                                                |
| `node-version-file` | `string` | no       | `.tool-versions` | Path to a file declaring the Node.js version, relative to the repository root. Ignored when `node-version` is supplied.                                                                                                                                           |
| `setup-command`     | `string` | no       | `''`             | Optional shell command to run after dependency installation and bootstrap, before the check command. Use for installing system dependencies. The consumer is responsible for sudo, package-manager flags, and any necessary index updates (e.g., apt-get update). |

#### Usage

Minimal caller:

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
    with:
      check-command: 'pnpm run ci'
```

The checks run on the Node version your repository's `.tool-versions` declares, so the caller names no version and there is nothing to keep in sync.

Install an apt package before running checks (e.g., `ripgrep`):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
    with:
      check-command: 'pnpm run ci'
      setup-command: 'sudo apt-get update -qq && sudo apt-get install -y -qq ripgrep'
```

Install a tool via vendor script (e.g., `shellspec`):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
    with:
      check-command: 'pnpm run ci'
      setup-command: 'curl -fsSL https://raw.githubusercontent.com/shellspec/shellspec/master/install.sh | sh -s -- --yes'
```

The `setup-command` runs after dependencies are installed and the optional `bootstrap` script, and before `check-command`. The workflow does not run `apt-get update` or supply `sudo` on the consumer's behalf — include those in the command when needed.

Run checks across a Node-version matrix:

```yaml
jobs:
  code-quality:
    strategy:
      fail-fast: false
      matrix:
        node-version: ['22.13.0', '24.18.0']
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
    with:
      node-version: ${{ matrix.node-version }}
      check-command: 'pnpm run ci'
```

The workflow declares no concurrency of its own, so the matrix fans out with nothing beyond the matrix itself required. `fail-fast: false` is recommended for a compatibility matrix: without it, the first leg to fail cancels the others, so you would see only one failing Node version instead of every affected one.

#### Node version

By default the workflow reads the Node version from your repository's `.tool-versions`, the same file your local toolchain uses. Declaring the version once is the point: there is no second copy in the workflow call to drift from it, and no consistency test needed to catch the drift.

Precedence follows `actions/setup-node`: an explicit `node-version` wins over the file, which is what makes the compatibility matrix above work. Point `node-version-file` elsewhere to read a different file, such as `.nvmrc` or `package.json`.

Two constraints on the file:

- It must exist. A repository with neither a `node-version` input nor the file fails with `The specified node version file at: ... does not exist`. Add `.tool-versions`, or pass `node-version` explicitly.
- The `nodejs` entry must carry a single version and no trailing whitespace. `nodejs 24.18.0` resolves; `nodejs 24.18.0 22.13.0` does not. Entries for other tools on their own lines are ignored, so a multi-tool `.tool-versions` is fine.

#### Concurrency

This workflow does not manage concurrency; that is the caller's responsibility. To cancel superseded runs (for example, when you push a new commit while checks from the previous one are still running), declare a **workflow-level** `concurrency` block in your caller — at the top of the workflow file, not inside the job that calls this workflow:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
    with:
      check-command: 'pnpm run ci'
```

Workflow-level concurrency cancels a superseded _run_ while leaving the current run's matrix legs intact, so it composes correctly with the matrix example above. A job-level group placed inside a matrixed caller would instead be shared across the legs and cancel them.

#### Migrating from v5 to v6

`v6` removes the built-in job-level `concurrency` group that earlier versions declared. If you relied on it to auto-cancel superseded runs, add the workflow-level `concurrency` block shown above to your caller. Callers that matrix over Node versions (or any other axis) no longer need a workaround — every leg now runs.

#### Migrating from v6 to v7

`v7` takes the Node version from your repository's `.tool-versions` instead of a version restated in the workflow call. Two steps:

1. Confirm `.tool-versions` declares a `nodejs` entry. Without one, and without an explicit `node-version`, the run fails with `The specified node version file at: ... does not exist`.
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
