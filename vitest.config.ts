import { defineConfig } from 'vitest/config';
import { inlineFontsPlugin } from './scripts/inline-fonts-plugin';

export default defineConfig({
  plugins: [inlineFontsPlugin()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    /**
     * Vitest's 5s default is a latency assertion nothing here means to make.
     *
     * Every test in this suite renders Lit components and settles microtasks;
     * the slowest finishes in single-digit milliseconds on an idle machine. On
     * a machine whose cores are already spoken for — CI, or a laptop running
     * several suites at once — a heavy render can be descheduled past 5s and
     * the run fails with "Test timed out in 5000ms" on whichever test happened
     * to be in flight. Reproduced deliberately: 24 busy loops on 10 cores fails
     * roughly one run in two, and lands on a different test each time.
     *
     * 30s is far beyond anything a correct test needs here, so a genuine hang
     * still fails the run — it just no longer fails for want of a CPU.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
