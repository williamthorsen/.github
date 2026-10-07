import { defineConfig } from '@williamthorsen/nmr/taze';

/** Dependency-upgrade configuration for this repo. */
export default defineConfig({
  // Hold packages that must track a particular version line, so that an upgrade pass never moves them past it.
  packageMode: {
    // Disallow major upgrades until the pinned Node.js version is changed; engines is set to >=24.
    '@types/node': 'minor',
  },
});
