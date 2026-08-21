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
| `shellspec-version` | `string` | no       | `''`             | Shellspec release to install before the checks run (e.g., `0.28.1`). Omit to install nothing. The installer comes from the named release's own tag.                                                                                                               |

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

The `setup-command` runs after dependencies are installed and the optional `bootstrap` script, and before `check-command`. The workflow does not run `apt-get update` or supply `sudo` on the consumer's behalf — include those in the command when needed.

Run shell tests (e.g., `shellspec`):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
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
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
    with:
      node-version: ${{ matrix.node-version }}
      check-command: 'pnpm run ci'
```

The workflow declares no concurrency of its own, so the matrix fans out with nothing beyond the matrix itself required. `fail-fast: false` is recommended for a compatibility matrix: without it, the first leg to fail cancels the others, so you would see only one failing Node version instead of every affected one.

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
