import { defineConfig } from '@williamthorsen/release-kit/config';

export default defineConfig({
  repoLabels: {
    extends: ['common'],
    labels: {
      'scope:root': { color: '00ff96' },
      'scope:workflows': { color: '00ff96' },
      'skip-changelog': {
        color: 'cccccc',
        description: 'Changes a reusable workflow in a way that callers cannot observe, so needs no changelog entry',
      },
    },
  },
});
