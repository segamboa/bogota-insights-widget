import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BogotaInsights',
      fileName: (format) => `bogota-insights.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      output: {
        assetFileNames: 'bogota-insights.[ext]',
      },
    },
    copyPublicDir: false,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
});
