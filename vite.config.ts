import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      outDir: 'dist',
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SpectroViewer',
      formats: ['es', 'umd'],
      fileName: 'spectro-viewer',
    },
    sourcemap: true,
    minify: 'esbuild',
  },
});
