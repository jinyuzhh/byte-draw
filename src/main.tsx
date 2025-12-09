import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { preloadCriticalModules } from './utils/preload'

// 🚀 LCP 优化：在应用渲染后预加载其他模块
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 在首次渲染完成后预加载其他资源
preloadCriticalModules()
