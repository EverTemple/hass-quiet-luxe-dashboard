import { defineConfig } from 'vitest/config';
import { inlineFontsPlugin } from './scripts/inline-fonts-plugin';

export default defineConfig({
  plugins: [inlineFontsPlugin()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
