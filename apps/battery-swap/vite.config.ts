import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '../..'), '');
  const base = process.env.VITE_BATTERY_SWAP_BASE ?? (command === 'build' ? '/battery-swap/' : '/');

  return {
    base,
    plugins: [
      vue(),
    ],
    server: {
      port: 5177,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${process.env.API_PORT || 9310}`,
          changeOrigin: true,
        },
      },
    },
    esbuild: {
      supported: {
        destructuring: true,
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      outDir: resolve(__dirname, '../../dist/battery-swap'),
      emptyOutDir: true,
    },
  };
});
