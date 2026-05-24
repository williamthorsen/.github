---
'templates.github': minor
---

Add optional `setup-command` input to `code-quality-pnpm-workflow.yaml`. Consumers can pass a shell command (e.g., `sudo apt-get update -qq && sudo apt-get install -y -qq ripgrep`) that runs before the check command, eliminating the need to mix install steps into `check-command`. The consumer is responsible for `sudo`, package-manager flags, and any necessary index updates.
