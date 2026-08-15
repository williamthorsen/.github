---
'templates.github': minor
---

Upgrade `actions/checkout` and `actions/setup-node` to v7 in `code-quality-pnpm-workflow.yaml`. No input changed across the intervening majors, and the workflow's explicit `cache: 'pnpm'` is unaffected by v6's narrowing of automatic caching to npm. The `v7` pointer tag moves to this change, so callers already at `@v7` pick it up without retagging.
