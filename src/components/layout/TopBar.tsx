import { useState, useCallback, type ReactNode } from "react"
import { useCanvas } from "../../store/CanvasProvider"
import { ExportMenu } from "./ExportMenu"
import {
  MousePointer2,
  Move,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

const ControlButton = ({
  active,
  label,
  icon,
  onClick,
}: {
  active?: boolean
  label: string
  icon?: ReactNode
  onClick?: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition text-sm font-medium ${
      active
        ? "bg-canvas-accent text-white border-canvas-accent shadow-sm"
        : "border-canvas-border bg-white hover:bg-slate-50"
    }`}
  >
    {icon}
    {label}
  </button>
)

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

  const [isExporting, setIsExporting] = useState(false)


  const handleExport = useCallback(async (options: {
    format: 'jpg' | 'png' | 'jpeg' 
    quality: number
    scale: number
  }) => {
    setIsExporting(true)

    try {
      // 获取画布的 Data URL
      const dataUrl = await exportAsImage(options)
      if (!dataUrl) {
        alert("导出失败，请重试")
        return
      }

      // 创建临时下载链接
      const anchor = document.createElement("a")
      anchor.href = dataUrl

      // 根据格式设置文件名
      const timestamp = Date.now()
      const fileName = `canvas-${timestamp}.${options.format === 'jpg' ? 'jpeg' : options.format}`
      anchor.download = fileName

      // 触发下载
      anchor.click()
    } catch (error) {
      alert("导出失败，请重试")
    } finally {
      setIsExporting(false)
    }
  }, [exportAsImage])

  return (
    <header className="flex items-center justify-between border-b border-canvas-border bg-white/90 px-6 py-3 backdrop-blur">
      {/* 左侧：应用标题区域 */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MVP DEMO
        </p>
        <h1 className="text-lg font-semibold text-slate-900">
         My · Draw
        </h1>
      </div>

      {/* 中间：交互控制和历史操作区域 */}
      <div className="flex items-center gap-2">
        {/* 交互模式切换按钮 */}
        <ControlButton
          label="选择"
          icon={<MousePointer2 size={16} />}
          active={canvasState.interactionMode === "select"}
          onClick={() => setInteractionMode("select")}
        />
        <ControlButton
          label="移动"
          icon={<Move size={16} />}
          active={canvasState.interactionMode === "pan"}
          onClick={() => setInteractionMode("pan")}
        />
        {/* 历史操作按钮 */}
        <ControlButton label="撤销" icon={<Undo2 size={16} />} onClick={undo} />
        <ControlButton label="重做" icon={<Redo2 size={16} />} onClick={redo} />
      </div>

      {/* 右侧：缩放控制和导出区域 */}
      <div className="flex items-center gap-3">
        {/* 缩放控制组件 */}
        <div className="flex items-center gap-2 rounded-full border border-canvas-border bg-white px-3 py-1.5 text-sm">
          {/* 缩小按钮 */}
          <button
            type="button"
            onClick={() => setZoom(canvasState.zoom - 0.1)}
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ZoomOut size={16} />
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
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ZoomIn size={16} />
          </button>
          {/* 缩放比例显示 */}
          <span className="font-semibold text-slate-700">
            {(canvasState.zoom * 100).toFixed(0)}%
          </span>
        </div>

        {/* 导出按钮 */}
        <div className="relative">
          <ExportMenu onExport={handleExport} />
          {isExporting && (
            <div className="absolute top-full mt-2 text-xs text-blue-600">
              正在导出...
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
