import { defineConfig }           from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// see https://vitejs.dev/config
export default defineConfig({
    server: {
        port: 3000,
        proxy: {
            // 代理 API 请求到后端
            '/api': {
                target: 'http://127.0.0.1:8090',
                changeOrigin: true,
            },
        },
    },
    envPrefix: 'PB',
    // 统一使用 /_/ 前缀，开发和生产保持一致
    base: '/_/',
    build: {
        chunkSizeWarningLimit: 1000,
        reportCompressedSize: false,
    },
    plugins: [
        svelte({
            preprocess: [vitePreprocess()],
            onwarn: (warning, handler) => {
                if (warning.code.startsWith('a11y-')) {
                    return; // silence a11y warnings
                }
                handler(warning);
            },
        }),
    ],
    resolve: {
        alias: {
            '@': __dirname + '/src',
        }
    },
})
