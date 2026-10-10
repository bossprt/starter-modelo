import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // test/: testes do projeto. scripts/test/: testes do starter.
    include: ['test/**/*.test.{js,mjs,ts}', 'scripts/test/**/*.test.mjs'],
    passWithNoTests: false,
  },
});
