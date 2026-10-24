import { defineConfig } from '@williamthorsen/nmr/taze';

/** Dependency-upgrade configuration for this repo. */
export default defineConfig({
  // Hold nmr at 0.46.1: from 0.46.2 on, it imports `vitest/suite`, which Vitest 5 does not export.
  // Remove once williamthorsen/node-monorepo-tools#1098 ships.
  exclude: ['@williamthorsen/nmr'],
  // Hold packages that must track a particular version line, so that an upgrade pass never moves them past it.
  packageMode: {
    // Disallow major upgrades until the pinned Node.js version is changed; engines is set to >=24.
    '@types/node': 'minor',
    // Hold typescript at v6 until v7 supports type-aware linting.
    typescript: 'minor',
  },
});
