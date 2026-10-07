/**
 * Checks a caller of the reusable `code-quality-pnpm-workflow.yaml` against the workflow's current major.
 *
 * Heuristics:
 * - Version floor (severity 'warn') when the caller pins a major below the target.
 * - Structural signal (regex on the caller) for wiring that a major requires, skip-gated on the major
 *   that introduced it so it applies from that major onward.
 * - Skip-gates mean "not applicable" (requirement not yet in force), never "behind"; being behind is
 *   what the warn-level target check reports.
 *
 * Nest only a genuine precondition: the file must exist before its contents can be checked. Version
 * applicability is a skip-gate, not a nesting level.
 *
 * Keep each check to one predicate with a one-sentence fix. A check name must carry its meaning
 * alone: the fleet sweep table prints names, never detail. Detail belongs in a migration guide;
 * end every upgrade-class fix with `-- migration: <URL>`.
 */
import { defineRdyKit, type RdyChecklist } from 'readyup';
import { fileDoesNotContain, fileExists, readFile } from 'readyup/check-utils';

// Path to the code-quality workflow caller, checked by the code-quality checklist.
const CODE_QUALITY_WORKFLOW = '.github/workflows/code-quality.yaml';

// The reusable code-quality workflow major the kit targets, and the guide for moving to it. Each
// structural check declares the major that introduced it, so raising this constant does not silently
// retire the earlier ones.
const CODE_QUALITY_TARGET_MAJOR = 8;
const CODE_QUALITY_TARGET_MIGRATION_URL = 'https://github.com/williamthorsen/.github#migrating-from-v7-to-v8';

// Migration guides linked from the fix messages of checks that an earlier major introduced.
const CODE_QUALITY_V6_MIGRATION_URL = 'https://github.com/williamthorsen/.github#migrating-from-v5-to-v6';
const CODE_QUALITY_V7_MIGRATION_URL = 'https://github.com/williamthorsen/.github#migrating-from-v6-to-v7';

// -- Checklists --

const codeQuality: RdyChecklist = {
  name: 'code-quality',
  checks: [
    {
      name: 'code-quality.yaml workflow exists',
      check: () => fileExists(CODE_QUALITY_WORKFLOW),
      fix: 'Add .github/workflows/code-quality.yaml using the code-quality workflow template',
      checks: [
        {
          name: `code-quality workflow references code-quality-pnpm-workflow.yaml@v${String(CODE_QUALITY_TARGET_MAJOR)}`,
          severity: 'warn',
          check: workflowPinsTargetMajor,
          fix: `Update code-quality.yaml to reference code-quality-pnpm-workflow.yaml@v${String(CODE_QUALITY_TARGET_MAJOR)} -- migration: ${CODE_QUALITY_TARGET_MIGRATION_URL}`,
        },
        {
          name: 'code-quality workflow declares a workflow-level concurrency block',
          severity: 'warn',
          skip: skipUnlessWorkflowPinnedAtLeast(6),
          check: () => workflowHasWorkflowLevelConcurrency(readFile(CODE_QUALITY_WORKFLOW) ?? ''),
          fix: `Add a workflow-level concurrency block to code-quality.yaml, since v6 makes concurrency caller-owned -- migration: ${CODE_QUALITY_V6_MIGRATION_URL}`,
        },
        {
          name: 'code-quality workflow does not reference pnpm-version',
          skip: skipUnlessWorkflowPinnedAtLeast(6),
          check: () => fileDoesNotContain(CODE_QUALITY_WORKFLOW, /pnpm-version/),
          fix: 'Remove pnpm-version from code-quality.yaml, since the v6 workflow infers the version from packageManager',
        },
        {
          name: 'code-quality workflow does not reference node-version',
          skip: skipUnlessWorkflowPinnedAtLeast(7),
          check: () => !callerDeclaresNodeVersionInput(readFile(CODE_QUALITY_WORKFLOW) ?? ''),
          fix: `Remove node-version from code-quality.yaml, since the v7 workflow reads the version from .tool-versions -- migration: ${CODE_QUALITY_V7_MIGRATION_URL}`,
        },
        {
          name: 'code-quality workflow does not reference GH_PACKAGES_TOKEN',
          check: () => fileDoesNotContain(CODE_QUALITY_WORKFLOW, /GH_PACKAGES_TOKEN/),
          fix: 'Remove all references to GH_PACKAGES_TOKEN from code-quality.yaml',
        },
      ],
    },
  ],
};

export default defineRdyKit({
  checklists: [codeQuality],
  // The check-utils API against which the kit is written: from 0.38.0, a content check accepts a string pattern.
  minReadyupVersion: '0.38.0',
});

/** True if the caller supplies an explicit `node-version` input, which @v7 supersedes. The distinct `node-version-file` input stays valid at @v7 and does not match. */
export function callerDeclaresNodeVersionInput(content: string): boolean {
  return /node-version\s*:/.test(content);
}

/**
 * True if a pinned major meets a required floor. Undefined (an unrecognized pin) never meets one,
 * so every version-gated check reads a SHA-pinned caller as "not yet there" rather than as migrated.
 */
export function pinMeetsFloor(pinned: number | undefined, floor: number): boolean {
  return pinned !== undefined && pinned >= floor;
}

/**
 * The reusable code-quality workflow major the caller pins, or undefined when it pins nothing
 * recognizable: an absent `uses:` line, or a commit SHA. Undefined reads as "not yet at any major",
 * so an unrecognized pin fails the target check and skips every version-gated check rather than
 * asserting a migration is complete on evidence the kit does not have.
 */
export function pinnedWorkflowMajor(content: string): number | undefined {
  const major = /uses:\s*williamthorsen\/\.github\/\.github\/workflows\/code-quality-pnpm-workflow\.yaml@v(\d+)/.exec(
    content,
  )?.[1];
  return major === undefined ? undefined : Number(major);
}

/** True if the workflow declares a workflow-level (top-level) concurrency block, distinct from a job-level one. */
export function workflowHasWorkflowLevelConcurrency(content: string): boolean {
  return /^concurrency:/m.test(content);
}

// region | Helpers

/** Describe the caller's pin for a skip reason, naming the major or the absence of a recognizable one. */
function describePin(pinned: number | undefined): string {
  return pinned === undefined ? 'no recognized workflow version' : `@v${String(pinned)}`;
}

/** Skip a check that a workflow major introduced until the caller pins that major or later. */
function skipUnlessWorkflowPinnedAtLeast(major: number): () => false | string {
  return () => {
    const pinned = pinnedWorkflowMajor(readFile(CODE_QUALITY_WORKFLOW) ?? '');
    if (pinMeetsFloor(pinned, major)) return false;
    return `code-quality.yaml pins ${describePin(pinned)}; this requirement arrives at @v${String(major)}`;
  };
}

/** Read the code-quality caller and report whether it pins the major the kit targets. */
function workflowPinsTargetMajor(): boolean {
  return pinMeetsFloor(pinnedWorkflowMajor(readFile(CODE_QUALITY_WORKFLOW) ?? ''), CODE_QUALITY_TARGET_MAJOR);
}

// endregion | Helpers
