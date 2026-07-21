---
'templates.github': major
---

Take the Node version for `code-quality-pnpm-workflow.yaml` from the calling repository's `.tool-versions` instead of a version restated in the workflow call. Callers name no version, so there is no second copy to drift and no consistency test needed to catch the drift.

`node-version` remains available as an explicit override and takes precedence over the file, so a Node-compatibility matrix works unchanged. The new `node-version-file` input retargets which file is read, defaulting to `.tool-versions`.

**Breaking:** a caller with neither a `node-version` input nor a `.tool-versions` file now fails with `The specified node version file at: ... does not exist`, where it previously fell back to a built-in `24.14.1` default. Add `.tool-versions`, or pass `node-version` explicitly. See the README's "Migrating from v6 to v7" section.
