import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '../..'), '');
  const base = process.env.VITE_SUPPORT_CENTRE_BASE ?? (command === 'build' ? '/support-centre/' : '/');

  return {
    base,
    plugins: [
      vue(),
    ],
    server: {
      host: true,
      port: 5178,
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
      outDir: resolve(__dirname, '../../dist/support-centre'),
      emptyOutDir: true,
    },
  };
});
