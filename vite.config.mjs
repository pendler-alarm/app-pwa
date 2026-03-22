import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue2';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const localWorkflowTarget = env.VITE_LOCAL_WORKFLOW_TARGET;

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 8080,
      proxy: localWorkflowTarget
        ? {
            '/api/workflow': {
              target: localWorkflowTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api\/workflow/, '/workflow'),
            },
          }
        : undefined,
    },
  };
});
