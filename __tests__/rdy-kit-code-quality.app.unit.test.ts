import { describe, expect, it } from 'vitest';

import {
  callerDeclaresNodeVersionInput,
  pinMeetsFloor,
  pinnedWorkflowMajor,
  workflowHasWorkflowLevelConcurrency,
} from '../.readyup/kits/default.ts';

/**
 * Fixtures representing the code-quality workflow caller in each migration state the kit
 * distinguishes: behind at @v5, on @v6 with and without a concurrency block, on @v7 with and
 * without a leftover node-version input, at the @v8 target, and pinned to something the kit cannot
 * read as a major.
 */
const V5_CALLER = `name: Code quality checks

on:
  push:
    branches: [main]

jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v5
    with:
      check-command: pnpm exec nmr check
`;

const V6_CALLER_WITHOUT_CONCURRENCY = `name: Code quality checks

on:
  push:
    branches: [main]

jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v6
    with:
      check-command: pnpm exec nmr check
      node-version: '24.18.0'
`;

const V6_CALLER_WITH_WORKFLOW_CONCURRENCY = `name: Code quality checks

on:
  push:
    branches: [main]

concurrency:
  group: code-quality-checks
  cancel-in-progress: true

jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v6
`;

const V6_CALLER_WITH_JOB_LEVEL_CONCURRENCY = `name: Code quality checks

on:
  push:
    branches: [main]

jobs:
  code-quality:
    concurrency:
      group: code-quality-checks
      cancel-in-progress: true
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v6
`;

const V7_CALLER = `name: Code quality checks

on:
  push:
    branches: [main]

concurrency:
  group: code-quality-checks
  cancel-in-progress: true

jobs:
  code-quality:
    uses: williamthorsen/.github/.github/workflows/code-quality-pnpm-workflow.yaml@v7
    with:
      check-command: pnpm exec nmr check
`;

const V8_CALLER = V7_CALLER.replace('@v7', '@v8');

const V7_CALLER_WITH_VERSION_FILE = `${V7_CALLER}      node-version-file: .nvmrc\n`;

const V7_PATCH_PINNED_CALLER = V7_CALLER.replace('@v7', '@v7.1.0');

const SHA_PINNED_CALLER = V7_CALLER.replace('@v7', '@d6cd1f2a0b7c4e8f9a3b5c7d1e2f4a6b8c0d2e4f');

const CALLER_WITHOUT_USES = `name: Code quality checks

on:
  push:
    branches: [main]

jobs:
  code-quality:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm exec nmr check
`;

describe('pinnedWorkflowMajor', () => {
  it('reads the pinned major, so a repo behind the target is flagged to bump', () => {
    expect(pinnedWorkflowMajor(V5_CALLER)).toBe(5);
    expect(pinnedWorkflowMajor(V6_CALLER_WITHOUT_CONCURRENCY)).toBe(6);
    expect(pinnedWorkflowMajor(V7_CALLER)).toBe(7);
    expect(pinnedWorkflowMajor(V8_CALLER)).toBe(8);
  });

  it('reads the major from a patch-level tag, which pins the same workflow', () => {
    expect(pinnedWorkflowMajor(V7_PATCH_PINNED_CALLER)).toBe(7);
  });

  it('is undefined for a SHA pin, so an unreadable pin never asserts a migration is complete', () => {
    expect(pinnedWorkflowMajor(SHA_PINNED_CALLER)).toBeUndefined();
  });

  it('is undefined when the caller does not use the reusable workflow at all', () => {
    expect(pinnedWorkflowMajor(CALLER_WITHOUT_USES)).toBeUndefined();
  });
});

describe('workflowHasWorkflowLevelConcurrency', () => {
  it('is false when no concurrency block is declared, so a v6 consumer is flagged to add one', () => {
    expect(workflowHasWorkflowLevelConcurrency(V6_CALLER_WITHOUT_CONCURRENCY)).toBe(false);
  });

  it('is false when concurrency is declared only at job level', () => {
    expect(workflowHasWorkflowLevelConcurrency(V6_CALLER_WITH_JOB_LEVEL_CONCURRENCY)).toBe(false);
  });

  it('is true when a workflow-level concurrency block is declared', () => {
    expect(workflowHasWorkflowLevelConcurrency(V6_CALLER_WITH_WORKFLOW_CONCURRENCY)).toBe(true);
  });
});

describe('pinMeetsFloor', () => {
  it('is true only at or above the floor, so a v6 repo keeps the v6 requirements and not the v7 ones', () => {
    expect(pinMeetsFloor(6, 6)).toBe(true);
    expect(pinMeetsFloor(6, 7)).toBe(false);
    expect(pinMeetsFloor(7, 6)).toBe(true);
    expect(pinMeetsFloor(5, 6)).toBe(false);
  });

  it('is false for an unrecognized pin, so a SHA-pinned caller is never read as migrated', () => {
    expect(pinMeetsFloor(undefined, 6)).toBe(false);
    expect(pinMeetsFloor(undefined, 7)).toBe(false);
  });

  it('is true for a v8 caller and false for a v7 caller at the v8 target, so only a v7 caller is flagged to bump', () => {
    expect(pinMeetsFloor(pinnedWorkflowMajor(V8_CALLER), 8)).toBe(true);
    expect(pinMeetsFloor(pinnedWorkflowMajor(V7_CALLER), 8)).toBe(false);
  });
});

describe('callerDeclaresNodeVersionInput', () => {
  it('is true for a leftover node-version input, which @v7 supersedes', () => {
    expect(callerDeclaresNodeVersionInput(V6_CALLER_WITHOUT_CONCURRENCY)).toBe(true);
  });

  it('is false for node-version-file, a distinct input that stays valid at @v7', () => {
    expect(callerDeclaresNodeVersionInput(V7_CALLER_WITH_VERSION_FILE)).toBe(false);
  });

  it('is false for a migrated caller that names no version', () => {
    expect(callerDeclaresNodeVersionInput(V7_CALLER)).toBe(false);
  });
});
