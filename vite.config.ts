import { defineConfig } from 'vite';

export default defineConfig({
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
