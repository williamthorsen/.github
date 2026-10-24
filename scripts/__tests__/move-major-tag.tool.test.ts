import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.join(import.meta.dirname, '..', 'move-major-tag.sh');

/** Paths that the hooks set up and the helpers read. */
const fixture = { gitConfigPath: '', keyDirectory: '', workspace: '' };

describe('move-major-tag.sh', () => {
  beforeAll(() => {
    fixture.keyDirectory = mkdtempSync(path.join(tmpdir(), 'move-major-tag-key-'));
    const keyPath = path.join(fixture.keyDirectory, 'signing-key');
    execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'test', '-f', keyPath]);
    fixture.gitConfigPath = path.join(fixture.keyDirectory, 'gitconfig');
    writeFileSync(
      fixture.gitConfigPath,
      [
        '[user]',
        '  name = Test',
        '  email = test@example.com',
        `  signingKey = ${keyPath}`,
        '[gpg]',
        '  format = ssh',
        '[init]',
        '  defaultBranch = main',
        '',
      ].join('\n'),
    );
  });

  afterEach(() => {
    if (fixture.workspace !== '') rmSync(fixture.workspace, { force: true, recursive: true });
    fixture.workspace = '';
  });

  afterAll(() => {
    rmSync(fixture.keyDirectory, { force: true, recursive: true });
  });

  it('when the kit targets the current major, moves the signed tag to the head of main', () => {
    const repos = createRepos({ kitMajor: 1 });

    const result = runScript(repos.clone, 'y\n');

    expect(result.status).toBe(0);
    expect(readRemotePeel(repos.remote, 'v1')).toBe(readMainId(repos.remote));
    expect(git(repos.remote, ['cat-file', 'tag', 'v1'])).toContain('-----BEGIN SSH SIGNATURE-----');
  });

  it('when the kit targets the next major, creates that tag and leaves the current one unchanged', () => {
    const repos = createRepos({ changelogHeadings: ['v2', 'v1'], kitMajor: 2 });
    const currentTagId = git(repos.remote, ['rev-parse', 'refs/tags/v1']);

    const result = runScript(repos.clone, 'y\n');

    expect(result.status).toBe(0);
    expect(readRemotePeel(repos.remote, 'v2')).toBe(readMainId(repos.remote));
    expect(git(repos.remote, ['rev-parse', 'refs/tags/v1'])).toBe(currentTagId);
  });

  it('when the tag already points to main, exits 0 without prompting', () => {
    const repos = createRepos({ commitsAfterTag: 0, kitMajor: 1 });
    const tagsBefore = listRemoteTags(repos.remote);

    const result = runScript(repos.clone, '');

    expect(result.status).toBe(0);
    expect(listRemoteTags(repos.remote)).toBe(tagsBefore);
  });

  it.each([
    { answer: 'n\n', case: 'the confirmation is declined', options: { kitMajor: 1 } },
    { answer: '', case: 'stdin ends before an answer', options: { kitMajor: 1 } },
    { answer: 'y\n', case: 'the remote has no major tag', options: { kitMajor: 1, majorTags: [] } },
    {
      answer: 'y\n',
      case: 'the kit targets two majors ahead',
      options: { changelogHeadings: ['v3', 'v1'], kitMajor: 3 },
    },
    { answer: 'y\n', case: 'main does not descend from the tag to move', options: { kitMajor: 1, tagOffMain: true } },
    {
      answer: 'y\n',
      case: 'main does not descend from the tag before a new major',
      options: { changelogHeadings: ['v2', 'v1'], kitMajor: 2, tagOffMain: true },
    },
    { answer: 'y\n', case: 'the changelog lacks the target section', options: { changelogHeadings: [], kitMajor: 1 } },
  ])('if $case, exits 1 and leaves the remote tags unchanged', ({ answer, options }) => {
    const repos = createRepos(options);
    const tagsBefore = listRemoteTags(repos.remote);

    const result = runScript(repos.clone, answer);

    expect(result.status).toBe(1);
    expect(listRemoteTags(repos.remote)).toBe(tagsBefore);
  });

  it('if the local tag is rewritten after its creation, exits 1 without pushing', () => {
    const repos = createRepos({ kitMajor: 1 });
    const tagsBefore = listRemoteTags(repos.remote);
    // Resets the new tag to its previous object as soon as the script creates it, standing in for a concurrent
    // `git fetch --tags --force`. The variable stops the hook's own `update-ref` from firing it again.
    const hookPath = path.join(repos.clone, '.git', 'hooks', 'reference-transaction');
    writeFileSync(
      hookPath,
      [
        '#!/bin/sh',
        '[ "$1" = committed ] || exit 0',
        '[ -n "$REWRITE_DONE" ] && exit 0',
        'while read -r old new ref; do',
        '  if [ "$ref" = refs/tags/v1 ] && [ "$(git rev-parse "$new^{commit}")" = "$EXPECTED_MAIN" ]; then',
        '    REWRITE_DONE=1 git update-ref "$ref" "$old"',
        '  fi',
        'done',
        '',
      ].join('\n'),
    );
    chmodSync(hookPath, 0o755);

    const result = runScript(repos.clone, 'y\n', { EXPECTED_MAIN: readMainId(repos.remote) });

    expect(result.status).toBe(1);
    expect(listRemoteTags(repos.remote)).toBe(tagsBefore);
  });

  it('if the remote tag moves while the script waits at the prompt, exits 1 and keeps the remote value', async () => {
    const repos = createRepos({ kitMajor: 1 });
    const concurrentId = readMainId(repos.remote);

    const status = await runScriptAtPrompt(repos.clone, () => {
      git(repos.remote, ['update-ref', 'refs/tags/v1', concurrentId]);
    });

    expect(status).toBe(1);
    expect(git(repos.remote, ['rev-parse', 'refs/tags/v1'])).toBe(concurrentId);
  });
});

// region | Helpers

interface RepoOptions {
  changelogHeadings?: string[];
  commitsAfterTag?: number;
  kitMajor: number;
  majorTags?: number[];
  tagOffMain?: boolean;
}

/** Builds a bare remote seeded with the kit, the changelog, and the major tags, and a clone of it. */
function createRepos({
  changelogHeadings = ['v1'],
  commitsAfterTag = 1,
  kitMajor,
  majorTags = [1],
  tagOffMain = false,
}: RepoOptions): { clone: string; remote: string } {
  const workspace = mkdtempSync(path.join(tmpdir(), 'move-major-tag-'));
  fixture.workspace = workspace;
  const remote = path.join(workspace, 'remote.git');
  const seed = path.join(workspace, 'seed');
  const clone = path.join(workspace, 'clone');
  git(workspace, ['init', '--quiet', '--bare', remote]);
  git(workspace, ['init', '--quiet', seed]);

  writeSeedFile(seed, '.readyup/kits/default.ts', `const CODE_QUALITY_TARGET_MAJOR = ${String(kitMajor)};\n`);
  writeSeedFile(seed, 'CHANGELOG.md', changelogHeadings.map((heading) => `## ${heading}\n`).join('\n'));
  commit(seed, 'Initial');

  if (tagOffMain) {
    git(seed, ['checkout', '--quiet', '--detach']);
    commit(seed, 'Side');
  }
  for (const major of majorTags) {
    git(seed, ['tag', '--annotate', '--message', `v${String(major)}`, `v${String(major)}`]);
  }
  if (tagOffMain) git(seed, ['checkout', '--quiet', 'main']);
  for (let index = 0; index < commitsAfterTag; index++) {
    commit(seed, `Change ${String(index)}`);
  }

  git(seed, ['push', '--quiet', remote, 'main', '--tags']);
  git(workspace, ['clone', '--quiet', remote, clone]);
  return { clone, remote };
}

/** Commits every change in the seed repository, allowing a commit without changes. */
function commit(cwd: string, message: string): void {
  git(cwd, ['add', '--all']);
  git(cwd, ['commit', '--quiet', '--allow-empty', '--message', message]);
}

/** Runs git under the fixture's global config and returns its trimmed stdout. */
function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: buildEnv() }).trim();
}

/** Returns the process environment with git pointed at the fixture's global config. */
function buildEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, GIT_CONFIG_GLOBAL: fixture.gitConfigPath, ...extra };
}

/** Returns every tag ref on the remote with its object ID. */
function listRemoteTags(remote: string): string {
  return git(remote, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/tags']);
}

/** Returns the commit at the head of the remote's main. */
function readMainId(remote: string): string {
  return git(remote, ['rev-parse', 'refs/heads/main']);
}

/** Returns the commit that a remote tag names. */
function readRemotePeel(remote: string, tag: string): string {
  return git(remote, ['rev-parse', `refs/tags/${tag}^0`]);
}

/** Runs the script in the clone with the given stdin, capturing its output. */
function runScript(cwd: string, input: string, extraEnv: Record<string, string> = {}) {
  return spawnSync(SCRIPT_PATH, [], { cwd, encoding: 'utf8', env: buildEnv(extraEnv), input });
}

/** Runs the script in the clone, calls `atPrompt` once the confirmation prompt appears, then answers yes. */
function runScriptAtPrompt(cwd: string, atPrompt: () => void): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(SCRIPT_PATH, [], { cwd, env: buildEnv(), stdio: ['pipe', 'pipe', 'ignore'] });
    let output = '';
    let hasAnswered = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      if (hasAnswered || !output.includes('[y/N]')) return;
      hasAnswered = true;
      atPrompt();
      child.stdin.end('y\n');
    });
    child.on('error', reject);
    child.on('close', resolve);
  });
}

/** Writes a file under the seed repository, creating its directories. */
function writeSeedFile(seed: string, relativePath: string, content: string): void {
  const filePath = path.join(seed, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

// endregion | Helpers
