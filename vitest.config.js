import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js', 'tests/edge/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Only files that are unit-testable (logic modules with pure helpers).
      // UI modules (account.js, marketplace.js, etc.) depend on the DOM and are
      // covered by E2E/crawler tests instead, so we exclude them from coverage gates.
      // helpers.js is the only module imported directly by unit tests.
      // Other modules (ical_parser, i18n, vacation) are tested via inlined
      // copies (see tests/unit/*.test.js) or via E2E.
      include: ['helpers.js'],
      exclude: ['sw.js', 'supabase_config.js', 'tests/**', 'node_modules/**', '*.config.js'],
      // CI gate: fails if coverage drops below these thresholds.
      // Numbers are intentionally conservative — raise them as the suite grows.
      thresholds: {
        lines: 80,
        functions: 90,
        branches: 70,
        statements: 80,
      },
    },
  },
});
