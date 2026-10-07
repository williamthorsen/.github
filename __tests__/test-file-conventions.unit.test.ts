import { checkTestFileConventions } from '@williamthorsen/nmr/tests';

// eslint-disable-next-line vitest/require-hook -- the call declares the suite, whereas the rule reads it as setup work.
checkTestFileConventions();
