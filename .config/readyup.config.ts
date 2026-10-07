import { defineRdyConfig } from 'readyup';

/** Repo-level readyup settings. */
export default defineRdyConfig({
  compile: {
    srcDir: '.readyup/kits',
    outDir: '.readyup/kits',
  },
});
