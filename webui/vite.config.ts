import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  server: {
    port: 9000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
    },
  },
  envPrefix: 'PB',
  // 开发模式用 '/'，生产模式用 '/_/'（嵌入 PocketBase）
  base: command === 'serve' ? '/' : '/_/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 强制使用项目的 node_modules，避免多实例冲突
      // 注意：bun 使用根目录 node_modules
      'react': path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
      // 强制使用同一个 @codemirror/state 实例，避免多实例冲突
      '@codemirror/state': path.resolve(__dirname, '../node_modules/@codemirror/state'),
      '@codemirror/view': path.resolve(__dirname, '../node_modules/@codemirror/view'),
      '@codemirror/language': path.resolve(__dirname, '../node_modules/@codemirror/language'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 第三方库分离
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-slot'],
          'vendor-state': ['jotai'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    // 提高警告阈值
    chunkSizeWarningLimit: 600,
  },
}))
