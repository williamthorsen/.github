import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.join(import.meta.dirname, '..', 'check-changelog.sh');

const REUSABLE_WORKFLOW = 'on:\n  workflow_call:\n    inputs: {}\n';
const CALLER_WORKFLOW = 'on:\n  pull_request:\n';

/** The repository that each test builds, removed after the test. */
const fixture = { workspace: '' };

describe('check-changelog.sh', () => {
  afterEach(() => {
    if (fixture.workspace !== '') rmSync(fixture.workspace, { force: true, recursive: true });
    fixture.workspace = '';
  });

  it('if a reusable workflow changes without the changelog, exits 1 and names the workflow', () => {
    const repo = createRepo();
    writeRepoFile(repo, '.github/workflows/reusable.yaml', `${REUSABLE_WORKFLOW}# changed\n`);
    commit(repo, 'Change');

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.github/workflows/reusable.yaml');
  });

  it('when a reusable workflow changes with the changelog, exits 0', () => {
    const repo = createRepo();
    writeRepoFile(repo, '.github/workflows/reusable.yaml', `${REUSABLE_WORKFLOW}# changed\n`);
    writeRepoFile(repo, 'CHANGELOG.md', '## v1\n\n- Changed the workflow.\n');
    commit(repo, 'Change');

    expect(runScript(repo).status).toBe(0);
  });

  it('when only a workflow without workflow_call changes, exits 0', () => {
    const repo = createRepo();
    writeRepoFile(repo, '.github/workflows/caller.yaml', `${CALLER_WORKFLOW}# changed\n`);
    commit(repo, 'Change');

    expect(runScript(repo).status).toBe(0);
  });

  it.each([
    { case: 'a flow sequence', content: 'on: [push, workflow_call]\n' },
    { case: 'a block sequence', content: 'on:\n  - push\n  - workflow_call\n' },
    { case: 'a scalar', content: 'on: workflow_call\n' },
    { case: 'a mapping key without a value', content: 'on:\n  workflow_call:\n' },
  ])('if a new workflow declares workflow_call as $case without the changelog, exits 1', ({ content }) => {
    const repo = createRepo();
    writeRepoFile(repo, '.github/workflows/new.yml', content);
    commit(repo, 'Add');

    expect(runScript(repo).status).toBe(1);
  });

  it('if a reusable workflow is deleted without the changelog, exits 1', () => {
    const repo = createRepo();
    rmSync(path.join(repo, '.github/workflows/reusable.yaml'));
    commit(repo, 'Delete');

    expect(runScript(repo).status).toBe(1);
  });

  it('if only the base changes the changelog after the branch point, exits 1', () => {
    const repo = createRepo();
    writeRepoFile(repo, '.github/workflows/reusable.yaml', `${REUSABLE_WORKFLOW}# changed\n`);
    commit(repo, 'Change');
    git(repo, ['checkout', '--quiet', 'main']);
    writeRepoFile(repo, 'CHANGELOG.md', '## v1\n\n- Another change.\n');
    commit(repo, 'Base change');

    expect(runScript(repo, 'main', 'feature').status).toBe(1);
  });

  it('if the argument count is wrong, exits 2', () => {
    const repo = createRepo();

    const result = spawnSync(SCRIPT_PATH, ['main'], { cwd: repo, encoding: 'utf8', env: buildEnv() });

    expect(result.status).toBe(2);
  });
});

// region | Helpers

/** Builds a repository whose main has a reusable workflow, a caller workflow, and a changelog, on a feature branch. */
function createRepo(): string {
  const workspace = mkdtempSync(path.join(tmpdir(), 'check-changelog-'));
  fixture.workspace = workspace;
  writeFileSync(
    path.join(workspace, 'gitconfig'),
    ['[user]', '  name = Test', '  email = test@example.com', '[init]', '  defaultBranch = main', ''].join('\n'),
  );
  const repo = path.join(workspace, 'repo');
  git(workspace, ['init', '--quiet', repo]);
  writeRepoFile(repo, '.github/workflows/reusable.yaml', REUSABLE_WORKFLOW);
  writeRepoFile(repo, '.github/workflows/caller.yaml', CALLER_WORKFLOW);
  writeRepoFile(repo, 'CHANGELOG.md', '## v1\n');
  commit(repo, 'Initial');
  git(repo, ['checkout', '--quiet', '-b', 'feature']);
  return repo;
}

/** Returns the process environment with git pointed at the fixture's global config. */
function buildEnv(): NodeJS.ProcessEnv {
  return { ...process.env, GIT_CONFIG_GLOBAL: path.join(fixture.workspace, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' };
}

/** Commits every change in the repository. */
function commit(cwd: string, message: string): void {
  git(cwd, ['add', '--all']);
  git(cwd, ['commit', '--quiet', '--message', message]);
}

/** Runs git under the fixture's global config and returns its trimmed stdout. */
function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: buildEnv() }).trim();
}

/** Runs the script in the repository, comparing the head with the base. */
function runScript(cwd: string, base = 'main', head = 'HEAD') {
  return spawnSync(SCRIPT_PATH, [base, head], { cwd, encoding: 'utf8', env: buildEnv() });
}

/** Writes a file under the repository, creating its directories. */
function writeRepoFile(repo: string, relativePath: string, content: string): void {
  const filePath = path.join(repo, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

// endregion | Helpers
