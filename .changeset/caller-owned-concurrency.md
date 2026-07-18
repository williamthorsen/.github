---
'templates.github': major
---

Remove the built-in job-level `concurrency` group from `code-quality-pnpm-workflow.yaml`. Concurrency is now the caller's responsibility, declared at the caller's workflow level.

**Breaking:** consumers that relied on the workflow to auto-cancel superseded runs must add a workflow-level `concurrency` block to their caller (see the README's Concurrency section). In exchange, callers can now run the workflow across a matrix (e.g. multiple Node versions) with every leg running to completion — the job-level group previously shared across a caller's matrix legs, which silently cancelled all but one, is gone.
