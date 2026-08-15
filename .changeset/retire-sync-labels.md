---
'templates.github': minor
---

Remove `sync-labels.yaml` and the org label config it published. Label sync now runs from release-kit's flow in `node-monorepo-tools`, and no repository in the org calls the workflow this removes — which is why the removal takes a minor rather than a major.
