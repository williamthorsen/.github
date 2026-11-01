# Agent guidance

## Releasing a reusable workflow

Callers pin the reusable workflows, the files under `.github/workflows/` that declare `on: workflow_call`, by major tag, so a change to one reaches them only when the tag includes it. Give every ticket that changes a reusable workflow two acceptance criteria: an entry in [CHANGELOG.md](CHANGELOG.md) under the section of the major that the change ships in, and its release, which moves the current major tag or, for a breaking change, opens the next one. [Releasing](docs/releasing.md) describes the changelog check and both releases.

The release step runs after the pull request merges, and only on the developer's authorization, because it writes a tag that every caller reads. The developer runs it as `scripts/move-major-tag.sh`.

Other changes do not need a tag move: Callers reach the readyup kit and the docs from `main`.
