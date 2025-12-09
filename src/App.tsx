/**
 * @fileoverview App.tsx
 * @file /Volumes/DreamZero/code/project/bytedance-canvas/src/App.tsx
 * 
 * @description 应用程序根组件
 * 
 * 该文件是整个画布应用的根组件，负责：
 * - 提供全局状态管理（通过 CanvasProvider）
 * - 组织应用的整体布局结构
 * - 协调各个功能区域的显示
 * 
 * 应用采用经典的设计工具布局：
 * - 顶部：工具栏（TopBar）- 包含主要操作按钮和工具
 * - 左侧：工具面板（LeftPanel）- 包含形状、文本等创建工具
 * - 中间：画布区域（CanvasArea）- 主要的编辑工作区
 * - 右侧：属性面板（RightPanel）- 显示和编辑选中元素的属性
 * 
 * @author Canvas Team
 * @created 2023-11-01
 * @modified 2023-11-15
 * 
 * @version 1.0.0
 */

import { lazy, Suspense } from "react"
import { CanvasProvider } from "./store/CanvasProvider"
// 🚀 LCP 优化：TopBar 是 LCP 元素，不使用懒加载
import { TopBar } from "./components/layout/TopBar"

// 懒加载非关键组件 - 优化首屏加载时间
const LeftPanel = lazy(() => import("./components/panels/LeftPanel").then(m => ({ default: m.LeftPanel })))
// 🚀 LCP 优化：预加载 CanvasArea（可能是 LCP 元素）
const CanvasArea = lazy(() => {
  // 使用 requestIdleCallback 在空闲时预加载
  const modulePromise = import("./components/layout/CanvasArea")
  return modulePromise.then(m => ({ default: m.CanvasArea }))
})
const RightPanel = lazy(() => import("./components/panels/RightPanel").then(m => ({ default: m.RightPanel })))

// 加载占位组件 - 减少 CLS
const PanelSkeleton = ({ width }: { width: string }) => (
  <div className={`${width} bg-white/60 animate-pulse`} />
)

const CanvasSkeleton = () => (
  <div className="flex-1 bg-slate-100 animate-pulse flex items-center justify-center">
    <div className="text-slate-400 text-sm">加载画布中...</div>
  </div>
)

/**
 * 应用程序根组件
 * 
 * @function App
 * 
 * @description 
 * 定义整个应用的结构和布局，作为 React 组件树的根节点。
 * 该组件本身是无状态的，主要负责：
 * 1. 包装 CanvasProvider 以提供全局状态管理
 * 2. 定义应用的 CSS 布局结构
 * 3. 组织各个功能区域的位置关系
 * 
 * @returns {JSX.Element} 返回应用程序的完整 JSX 结构
 * 
 * @example
 * ```tsx
 * // 在 index.tsx 中渲染
 * import { createRoot } from 'react-dom/client';
 * import App from './App';
 * 
 * const container = document.getElementById('root');
 * const root = createRoot(container);
 * root.render(<App />);
 * ```
 * 
 * @layout
 * 采用 Flexbox 布局系统：
 * - 外层容器：垂直方向的全屏布局
 * - 内层容器：水平方向的弹性布局
 * - 各区域使用 Tailwind CSS 类进行样式定义
 * 
 * @stateManagement
 * 通过 CanvasProvider 提供以下全局状态：
 * - 画布元素管理（增删改查）
 * - 选择状态管理
 * - 视图控制（缩放、平移）
 * - 历史记录（撤销/重做）
 * - 剪贴板操作
 */
const App = () => (
  <CanvasProvider>
    {/* 
      应用主容器：
      - flex: 使用 Flexbox 布局
      - h-screen: 占满整个屏幕高度
      - flex-col: 垂直方向排列子元素
      - bg-canvas-background: 应用画布背景色
      - text-slate-900: 设置默认文本颜色
    */}
    <div className="flex h-screen flex-col bg-canvas-background text-slate-900">
      {/* 
        顶部工具栏区域：
        - 包含文件操作、编辑工具、视图控制等
        - 固定在顶部，不随内容滚动
      */}
      <TopBar />
      
      {/* 
        主内容区域：
        - flex-1: 占据剩余的垂直空间
        - overflow-hidden: 防止内容溢出
        - flex: 水平方向排列子元素
      */}
      <div className="flex flex-1 overflow-hidden">
        {/* 
          左侧工具面板：
          - 包含形状工具、文本工具、图片工具等
          - 固定宽度，可折叠
        */}
        <Suspense fallback={<PanelSkeleton width="w-72" />}>
          <LeftPanel />
        </Suspense>
        
        {/* 
          画布区域：
          - 应用的核心工作区
          - 占据中间的主要空间
          - 包含 PIXI.js 渲染的画布
        */}
        <Suspense fallback={<CanvasSkeleton />}>
          <CanvasArea />
        </Suspense>
        
        {/* 
          右侧属性面板：
          - 显示和编辑选中元素的属性
          - 固定宽度，可折叠
        */}
        <Suspense fallback={<PanelSkeleton width="w-72" />}>
          <RightPanel />
        </Suspense>
      </div>
    </div>
  </CanvasProvider>
)

/**
 * 导出 App 组件作为应用程序的入口点
 * 
 * @description 
 * 将 App 组件导出为默认导出，使其可以在其他文件中导入和使用。
 * 这是 React 应用的标准导出模式。
 * 
 * @example
 * ```tsx
 * // 在其他文件中导入
 * import App from './App';
 * 
 * // 在测试中使用
 * import { render } from '@testing-library/react';
 * render(<App />);
 * ```
 */
export default App
