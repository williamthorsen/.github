# Agent guidance

## Releasing a reusable workflow

Callers pin the reusable workflows, the files under `.github/workflows/` that declare `on: workflow_call`, by major tag, so a change to one reaches them only when the tag includes it. Give every ticket that changes a reusable workflow an acceptance criterion for its release: moving the current major tag, or opening the next one for a breaking change. [Releasing](docs/releasing.md) describes both.

The release step runs after the pull request merges, from `main`, and only on the developer's authorization, because it writes a tag that every caller reads.

Other changes do not need a tag move: Callers reach the readyup kit and the docs from `main`.
