import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
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
              // Barcha node_modules bitta vendor chunkda (React forwardRef xatosini oldini olish)
              if (id.includes('node_modules')) {
                return 'vendor';
              }
            }
          }
        }
      }
    };
});
