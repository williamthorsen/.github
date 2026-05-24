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
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v5
    with:
      check-command: 'pnpm run ci'
```

Install an apt package before running checks (e.g., `ripgrep`):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v5
    with:
      check-command: 'pnpm run ci'
      setup-command: 'sudo apt-get update -qq && sudo apt-get install -y -qq ripgrep'
```

Install a tool via vendor script (e.g., `shellspec`):

```yaml
jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v5
    with:
      check-command: 'pnpm run ci'
      setup-command: 'curl -fsSL https://raw.githubusercontent.com/shellspec/shellspec/master/install.sh | sh -s -- --yes'
```

The `setup-command` runs after dependencies are installed and the optional `bootstrap` script, and before `check-command`. The workflow does not run `apt-get update` or supply `sudo` on the consumer's behalf — include those in the command when needed.
