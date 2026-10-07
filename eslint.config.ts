import baseConfig, { commonIgnores, createConfig, toolIgnores } from '@williamthorsen/eslint-config-typescript';
import { defineConfig, globalIgnores } from 'eslint/config';

const config = defineConfig([
  ...baseConfig,
  globalIgnores([...commonIgnores, ...toolIgnores, '.readyup/kits/*.js']),
  {
    files: ['**/*.ts', '**/*.mts'],
    languageOptions: {
      parserOptions: {
        // Point the project service (enabled by the base config) at the repo root.
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...defineConfig({
    extends: [await createConfig.vitest()],
    files: ['**/*.test.ts'],
  }),
]);

export default config;
