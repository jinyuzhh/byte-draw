/**
 * @fileoverview 资源预加载工具
 * @description 用于优化 LCP 和页面加载性能
 */

/**
 * 预加载关键模块
 * 在浏览器空闲时预加载非首屏但重要的模块
 */
export const preloadCriticalModules = () => {
  // 使用 requestIdleCallback 在空闲时预加载
  const preload = () => {
    // 预加载 CanvasArea（可能是 LCP 元素）
    import('../components/layout/CanvasArea')
    // 预加载 LeftPanel
    import('../components/panels/LeftPanel')
    // 预加载 RightPanel
    import('../components/panels/RightPanel')
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(preload, { timeout: 2000 })
  } else {
    // 降级方案：延迟 100ms 执行
    setTimeout(preload, 100)
  }
}

/**
 * 预加载图片资源
 * @param urls 图片 URL 数组
 */
export const preloadImages = (urls: string[]) => {
  urls.forEach(url => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = url
    document.head.appendChild(link)
  })
}

/**
 * 优化 LCP 的 fetchpriority 设置
 * 为关键图片设置高优先级
 */
export const setImagePriority = (selector: string, priority: 'high' | 'low' | 'auto' = 'high') => {
  const images = document.querySelectorAll<HTMLImageElement>(selector)
  images.forEach(img => {
    img.setAttribute('fetchpriority', priority)
    // 对于首屏图片，禁用懒加载
    if (priority === 'high') {
      img.loading = 'eager'
    }
  })
}
