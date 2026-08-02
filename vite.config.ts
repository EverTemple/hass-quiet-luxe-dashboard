import { defineConfig } from 'vite';
import { inlineFontsPlugin } from './scripts/inline-fonts-plugin';

export default defineConfig({
  plugins: [inlineFontsPlugin()],
  build: {
    target: 'es2021',
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'quiet-luxe.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
