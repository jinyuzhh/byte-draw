import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 React 相关库分离
          'react-vendor': ['react', 'react-dom'],
          // 将 Pixi.js 单独分离（体积较大）
          'pixi': ['pixi.js'],
          // 将图标库分离
          'icons': ['lucide-react'],
        },
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 设置 chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'pixi.js', 'lucide-react'],
  },
  // 消除未使用的代码
  esbuild: {
    drop: ['console', 'debugger'], // 生产构建时移除 console 和 debugger
  },
})
