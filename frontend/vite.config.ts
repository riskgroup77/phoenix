import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      test: {
        environment: 'node',
        include: ['**/*.{test,spec}.{ts,tsx}'],
      },
      server: {
        port: 3000,
        strictPort: true,
        host: '0.0.0.0',
        fs: {
          // Allow serving files from one level up to the project root
          allow: ['..']
        },
        watch: {
          // Reduce file watching overhead
          usePolling: false,
          interval: 100
        }
      },
      plugins: [react()],
      // Maxfiy kalitlar brauzer bundle ga kiritilmasin — Gemini faqat backend .env da
      define: {
        'process.env.NODE_ENV': JSON.stringify(mode),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'components': path.resolve(__dirname, './components'),
        },
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json']
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', 'lucide-react']
      },
      build: {
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: false, // Keep console.error and console.warn for debugging
            drop_debugger: isProduction,
            pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : []
          }
        },
        sourcemap: !isProduction, // Only generate sourcemaps in development
        chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              if (!id.includes('node_modules')) return undefined;
              // Og'ir kutubxonalar faqat ularni ishlatadigan sahifa (lazy chunk) bilan yuklanadi —
              // ular vendor'ni import qiladi, vendor ularni emas (aylanma bog'liqlik yo'q).
              if (/[\\/]node_modules[\\/](xlsx|docx|jszip|file-saver|recharts|recharts-scale|victory-vendor|d3-[^\\/]+|internmap|decimal\.js-light|@sentry|@google)[\\/]/.test(id)) {
                return undefined;
              }
              // Qolgan node_modules (React va boshqalar) bitta vendor chunkda (React forwardRef xatosini oldini olish)
              return 'vendor';
            }
          }
        }
      }
    };
});
