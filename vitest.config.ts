import { defineVitestConfig } from '@williamthorsen/nmr/vitest';

// Serves a bare `vitest` run, such as an IDE's; `nmr test` reads `vitest.root.config.ts` instead.
export default defineVitestConfig();
