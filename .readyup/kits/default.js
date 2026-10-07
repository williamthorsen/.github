/** @noformat -- @generated. Do not edit. Compiled by rdy. */
/* eslint-disable */
export const __readyupVersion = "0.39.0";


// .readyup/kits/default.ts
import { defineRdyKit } from "readyup";
import { fileDoesNotContain, fileExists, readFile } from "readyup/check-utils";
var CODE_QUALITY_WORKFLOW = ".github/workflows/code-quality.yaml";
var CODE_QUALITY_TARGET_MAJOR = 8;
var CODE_QUALITY_TARGET_MIGRATION_URL = "https://github.com/williamthorsen/.github#migrating-from-v7-to-v8";
var CODE_QUALITY_V6_MIGRATION_URL = "https://github.com/williamthorsen/.github#migrating-from-v5-to-v6";
var CODE_QUALITY_V7_MIGRATION_URL = "https://github.com/williamthorsen/.github#migrating-from-v6-to-v7";
var codeQuality = {
  name: "code-quality",
  checks: [
    {
      name: "code-quality.yaml workflow exists",
      check: () => fileExists(CODE_QUALITY_WORKFLOW),
      fix: "Add .github/workflows/code-quality.yaml using the code-quality workflow template",
      checks: [
        {
          name: `code-quality workflow references code-quality-pnpm-workflow.yaml@v${String(CODE_QUALITY_TARGET_MAJOR)}`,
          severity: "warn",
          check: workflowPinsTargetMajor,
          fix: `Update code-quality.yaml to reference code-quality-pnpm-workflow.yaml@v${String(CODE_QUALITY_TARGET_MAJOR)} -- migration: ${CODE_QUALITY_TARGET_MIGRATION_URL}`
        },
        {
          name: "code-quality workflow declares a workflow-level concurrency block",
          severity: "warn",
          skip: skipUnlessWorkflowPinnedAtLeast(6),
          check: () => workflowHasWorkflowLevelConcurrency(readFile(CODE_QUALITY_WORKFLOW) ?? ""),
          fix: `Add a workflow-level concurrency block to code-quality.yaml, since v6 makes concurrency caller-owned -- migration: ${CODE_QUALITY_V6_MIGRATION_URL}`
        },
        {
          name: "code-quality workflow does not reference pnpm-version",
          skip: skipUnlessWorkflowPinnedAtLeast(6),
          check: () => fileDoesNotContain(CODE_QUALITY_WORKFLOW, /pnpm-version/),
          fix: "Remove pnpm-version from code-quality.yaml, since the v6 workflow infers the version from packageManager"
        },
        {
          name: "code-quality workflow does not reference node-version",
          skip: skipUnlessWorkflowPinnedAtLeast(7),
          check: () => !callerDeclaresNodeVersionInput(readFile(CODE_QUALITY_WORKFLOW) ?? ""),
          fix: `Remove node-version from code-quality.yaml, since the v7 workflow reads the version from .tool-versions -- migration: ${CODE_QUALITY_V7_MIGRATION_URL}`
        },
        {
          name: "code-quality workflow does not reference GH_PACKAGES_TOKEN",
          check: () => fileDoesNotContain(CODE_QUALITY_WORKFLOW, /GH_PACKAGES_TOKEN/),
          fix: "Remove all references to GH_PACKAGES_TOKEN from code-quality.yaml"
        }
      ]
    }
  ]
};
var default_default = defineRdyKit({
  checklists: [codeQuality],
  // The check-utils API against which the kit is written: from 0.38.0, a content check accepts a string pattern.
  minReadyupVersion: "0.38.0"
});
function callerDeclaresNodeVersionInput(content) {
  return /node-version\s*:/.test(content);
}
function pinMeetsFloor(pinned, floor) {
  return pinned !== void 0 && pinned >= floor;
}
function pinnedWorkflowMajor(content) {
  const major = /uses:\s*williamthorsen\/\.github\/\.github\/workflows\/code-quality-pnpm-workflow\.yaml@v(\d+)/.exec(
    content
  )?.[1];
  return major === void 0 ? void 0 : Number(major);
}
function workflowHasWorkflowLevelConcurrency(content) {
  return /^concurrency:/m.test(content);
}
function describePin(pinned) {
  return pinned === void 0 ? "no recognized workflow version" : `@v${String(pinned)}`;
}
function skipUnlessWorkflowPinnedAtLeast(major) {
  return () => {
    const pinned = pinnedWorkflowMajor(readFile(CODE_QUALITY_WORKFLOW) ?? "");
    if (pinMeetsFloor(pinned, major)) return false;
    return `code-quality.yaml pins ${describePin(pinned)}; this requirement arrives at @v${String(major)}`;
  };
}
function workflowPinsTargetMajor() {
  return pinMeetsFloor(pinnedWorkflowMajor(readFile(CODE_QUALITY_WORKFLOW) ?? ""), CODE_QUALITY_TARGET_MAJOR);
}
export {
  callerDeclaresNodeVersionInput,
  default_default as default,
  pinMeetsFloor,
  pinnedWorkflowMajor,
  workflowHasWorkflowLevelConcurrency
};
