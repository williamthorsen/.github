# .github

Organization-wide workflows and default templates.

## Reusable workflows

### `code-quality-pnpm-workflow.yaml`

Runs code quality and build checks for pnpm-based projects on `ubuntu-latest`.

#### Inputs

| Name            | Type     | Required | Default   | Description                                                                                                                                                                                                                                                       |
| --------------- | -------- | -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-command` | `string` | yes      | —         | Command to run code quality and build checks (e.g., `pnpm run ci`, `nmr ci`).                                                                                                                                                                                     |
| `node-version`  | `string` | no       | `24.14.1` | Node.js version.                                                                                                                                                                                                                                                  |
| `setup-command` | `string` | no       | `''`      | Optional shell command to run after dependency installation and bootstrap, before the check command. Use for installing system dependencies. The consumer is responsible for sudo, package-manager flags, and any necessary index updates (e.g., apt-get update). |

#### Usage

Minimal caller:

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v6
    with:
      check-command: 'pnpm run ci'
```

Install an apt package before running checks (e.g., `ripgrep`):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v6
    with:
      check-command: 'pnpm run ci'
      setup-command: 'sudo apt-get update -qq && sudo apt-get install -y -qq ripgrep'
```

Install a tool via vendor script (e.g., `shellspec`):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v6
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
        node-version: ['22.13.0', '24.14.1']
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v6
    with:
      node-version: ${{ matrix.node-version }}
      check-command: 'pnpm run ci'
```

The workflow declares no concurrency of its own, so the matrix fans out with nothing beyond the matrix itself required. `fail-fast: false` is recommended for a compatibility matrix: without it, the first leg to fail cancels the others, so you would see only one failing Node version instead of every affected one.

#### Concurrency

This workflow does not manage concurrency; that is the caller's responsibility. To cancel superseded runs (for example, when you push a new commit while checks from the previous one are still running), declare a **workflow-level** `concurrency` block in your caller — at the top of the workflow file, not inside the job that calls this workflow:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v6
    with:
      check-command: 'pnpm run ci'
```

Workflow-level concurrency cancels a superseded _run_ while leaving the current run's matrix legs intact, so it composes correctly with the matrix example above. A job-level group placed inside a matrixed caller would instead be shared across the legs and cancel them.

#### Migrating from v5 to v6

`v6` removes the built-in job-level `concurrency` group that earlier versions declared. If you relied on it to auto-cancel superseded runs, add the workflow-level `concurrency` block shown above to your caller. Callers that matrix over Node versions (or any other axis) no longer need a workaround — every leg now runs.
