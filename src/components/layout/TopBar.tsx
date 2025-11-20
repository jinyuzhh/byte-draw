/**
 * @fileoverview 顶部工具栏组件
 * @file /Volumes/DreamZero/code/project/bytedance-canvas/src/components/layout/TopBar.tsx
 * 
 * @description 
 * 顶部工具栏组件，提供画布编辑器的全局控制功能。
 * 该组件提供以下功能：
 * 1. 显示应用标题和版本信息
 * 2. 提供交互模式切换（选择/移动）
 * 3. 提供撤销/重做操作
 * 4. 提供画布缩放控制
 * 5. 提供画布导出为PNG图片功能
 * 
 * @author Canvas Team
 * @version 1.0.0
 */

import { useCallback } from "react"
import { useCanvas } from "../../store/CanvasProvider"

/**
 * 控制按钮组件
 * 
 * @component ControlButton
 * 
 * @description 
 * 顶部工具栏中的通用控制按钮，支持激活状态显示。
 * 根据激活状态应用不同的样式，提供视觉反馈。
 * 
 * @param {Object} props - 组件属性
 * @param {boolean} [props.active=false] - 按钮是否处于激活状态
 * @param {string} props.label - 按钮显示的文本标签
 * @param {Function} [props.onClick] - 按钮点击事件处理函数
 * 
 * @returns {JSX.Element} 返回控制按钮组件
 * 
 * @example
 * ```tsx
 * // 使用示例
 * <ControlButton 
 *   active={isActive} 
 *   label="选择" 
 *   onClick={handleSelect} 
 * />
 * ```
 */
const ControlButton = ({
  active,
  label,
  onClick,
}: {
  active?: boolean
  label: string
  onClick?: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-md border transition text-sm font-medium ${
      active
        ? "bg-canvas-accent text-white border-canvas-accent shadow-sm"
        : "border-canvas-border bg-white hover:bg-slate-50"
    }`}
  >
    {label}
  </button>
)

/**
 * 顶部工具栏组件
 * 
 * @component TopBar
 * 
 * @description 
 * 画布编辑器的顶部工具栏，提供全局控制功能。
 * 包含应用标题、交互模式切换、撤销/重做操作、缩放控制和导出功能。
 * 
 * @returns {JSX.Element} 返回顶部工具栏组件
 * 
 * @example
 * ```tsx
 * // 使用示例
 * <TopBar />
 * ```
 */
export const TopBar = () => {
  // 从画布状态管理中获取所需的状态和方法
  const {
    state: canvasState,
    setZoom,
    setInteractionMode,
    undo,
    redo,
    exportAsImage,
  } = useCanvas()

  /**
   * 处理画布导出为PNG图片
   * 
   * @function handleExport
   * 
   * @description 
   * 将当前画布内容导出为PNG图片并自动下载。
   * 该函数执行以下步骤：
   * 1. 调用 exportAsImage 方法获取画布的 Data URL
   * 2. 创建临时下载链接元素
   * 3. 设置下载文件名（包含时间戳）
   * 4. 触发下载操作
   * 
   * @returns {void} 无返回值
   */
  const handleExport = useCallback(() => {
    // 获取画布的 Data URL
    const dataUrl = exportAsImage()
    if (!dataUrl) return
    
    // 创建临时下载链接并设置属性
    const anchor = document.createElement("a")
    anchor.href = dataUrl
    // 使用时间戳确保文件名唯一
    anchor.download = `canvas-${Date.now()}.png`
    
    // 触发下载
    anchor.click()
  }, [exportAsImage])

  return (
    <header className="flex items-center justify-between border-b border-canvas-border bg-white/90 px-6 py-3 backdrop-blur">
      {/* 左侧：应用标题区域 */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MVP DEMO
        </p>
        <h1 className="text-lg font-semibold text-slate-900">
          即梦画布 · 团队协作稿
        </h1>
      </div>

      {/* 中间：交互控制和历史操作区域 */}
      <div className="flex items-center gap-2">
        {/* 交互模式切换按钮 */}
        <ControlButton
          label="选择"
          active={canvasState.interactionMode === "select"}
          onClick={() => setInteractionMode("select")}
        />
        <ControlButton
          label="移动"
          active={canvasState.interactionMode === "pan"}
          onClick={() => setInteractionMode("pan")}
        />
        {/* 历史操作按钮 */}
        <ControlButton label="撤销" onClick={undo} />
        <ControlButton label="重做" onClick={redo} />
      </div>

      {/* 右侧：缩放控制和导出区域 */}
      <div className="flex items-center gap-3">
        {/* 缩放控制组件 */}
        <div className="flex items-center gap-2 rounded-full border border-canvas-border bg-white px-3 py-1.5 text-sm">
          {/* 缩小按钮 */}
          <button
            type="button"
            onClick={() => setZoom(canvasState.zoom - 0.1)}
            className="text-slate-500 hover:text-slate-900"
          >
            -
          </button>
          {/* 缩放滑块 */}
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.05}
            value={canvasState.zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1 w-24 accent-canvas-accent"
          />
          {/* 放大按钮 */}
          <button
            type="button"
            onClick={() => setZoom(canvasState.zoom + 0.1)}
            className="text-slate-500 hover:text-slate-900"
          >
            +
          </button>
          {/* 缩放比例显示 */}
          <span className="font-semibold text-slate-700">
            {(canvasState.zoom * 100).toFixed(0)}%
          </span>
        </div>

        {/* 导出按钮 */}
        <button
          type="button"
          onClick={handleExport}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-slate-800"
        >
          导出 PNG
        </button>
      </div>
    </header>
  )
}
