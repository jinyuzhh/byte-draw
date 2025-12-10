/**
 * @fileoverview 文本工具栏组件
 * 
 * @description 
 * 当文本框被选中后，在画布右上角显示一个竖向排列的操作面板，
 * 包含"基本"、"不透明度"、"排列"三个按钮，用于调节文本框的样式和属性。
 * 工具栏支持拖拽移动到画布任意位置。
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { useCanvas } from "../../store/CanvasProvider"
import type { TextElement } from "../../types/canvas"

type ToolbarTab = "basic" | "opacity" | "arrange"

// 预设字体列表
const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "思源黑体", label: "思源黑体" },
  { value: "思源宋体", label: "思源宋体" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Georgia", label: "Georgia" },
  { value: "Microsoft YaHei", label: "微软雅黑" },
  { value: "SimSun", label: "宋体" },
  { value: "SimHei", label: "黑体" },
]

// 预设字号列表
const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96]

// 拖拽图标组件
const DragIcon = () => (
  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 4h2v2H4V4zm3 0h2v2H7V4zm3 0h2v2h-2V4zM4 7h2v2H4V7zm3 0h2v2H7V7zm3 0h2v2h-2V7z"/>
  </svg>
)

// 重置图标组件
const ResetIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966a.25.25 0 0 1 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
  </svg>
)

// 可折叠区域组件
const CollapsibleSection = ({ 
  title, 
  children, 
  defaultOpen = false 
}: { 
  title: string
  children: React.ReactNode
  defaultOpen?: boolean 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <span>{title}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * 文本工具栏组件
 */
export const TextToolbar = () => {
  const { state, updateElement, bringToFront, sendToBack } = useCanvas()
  const [activeTab, setActiveTab] = useState<ToolbarTab | null>("basic") // 默认打开"基本"选项
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [showSizeDropdown, setShowSizeDropdown] = useState(false)

  // 拖拽相关状态
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null) // null 表示使用默认位置
  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  // 检查是否选中了单个文本元素
  const selectedElement = state.selectedIds.length === 1
    ? state.elements.find(
        (el) => el.id === state.selectedIds[0] && el.type === "text"
      ) as TextElement | undefined
    : undefined

  // 拖拽开始
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!toolbarRef.current) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const rect = toolbarRef.current.getBoundingClientRect()
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    setIsDragging(true)
  }, [])

  // 拖拽移动
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!toolbarRef.current) return
      
      const toolbarWidth = toolbarRef.current.offsetWidth
      const toolbarHeight = toolbarRef.current.offsetHeight
      
      // 计算新位置
      let newX = e.clientX - dragOffsetRef.current.x
      let newY = e.clientY - dragOffsetRef.current.y
      
      // 边界限制 - 不超出视口
      const padding = 8
      newX = Math.max(padding, Math.min(window.innerWidth - toolbarWidth - padding, newX))
      newY = Math.max(padding, Math.min(window.innerHeight - toolbarHeight - padding, newY))
      
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // 如果没有选中文本元素，不渲染工具栏
  if (!selectedElement) {
    return null
  }

  const handleTabClick = (tab: ToolbarTab) => {
    setActiveTab(activeTab === tab ? null : tab)
  }

  const handleOpacityChange = (opacity: number) => {
    updateElement(selectedElement.id, { opacity })
  }

  // 切换加粗
  const toggleBold = () => {
    const newWeight = selectedElement.fontWeight >= 700 ? 400 : 700
    updateElement(selectedElement.id, { fontWeight: newWeight })
  }

  // 切换斜体
  const toggleItalic = () => {
    updateElement(selectedElement.id, { italic: !selectedElement.italic })
  }

  // 切换下划线
  const toggleUnderline = () => {
    updateElement(selectedElement.id, { underline: !selectedElement.underline })
  }

  // 切换大小写
  const cycleTextTransform = () => {
    const transforms: Array<"none" | "uppercase" | "lowercase" | "capitalize"> = 
      ["none", "uppercase", "lowercase", "capitalize"]
    const currentIndex = transforms.indexOf(selectedElement.textTransform || "none")
    const nextIndex = (currentIndex + 1) % transforms.length
    updateElement(selectedElement.id, { textTransform: transforms[nextIndex] })
  }

  // 默认行高
  const defaultLineHeight = 1.5
  // 默认字间距
  const defaultLetterSpacing = 0

  // 计算工具栏样式
  const toolbarStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: position.x,
        top: position.y,
        right: 'auto',
      }
    : {
        position: 'absolute',
        top: 16,
        right: 16,
      }

  return (
    <div 
      ref={toolbarRef}
      className={`text-toolbar flex flex-col bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50 min-w-[280px] ${isDragging ? 'cursor-grabbing select-none' : ''}`}
      style={toolbarStyle}
    >
      {/* 拖拽区域 */}
      <div 
        className="flex items-center justify-center gap-1 px-3 py-1.5 bg-gray-50 border-b border-gray-200 cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
        onMouseDown={handleDragStart}
      >
        <DragIcon />
        <span className="text-xs text-gray-400 select-none">拖动工具栏</span>
        <DragIcon />
      </div>

      {/* 标签按钮 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => handleTabClick("basic")}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "basic"
              ? "bg-blue-500 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          基本
        </button>
        <button
          onClick={() => handleTabClick("opacity")}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "opacity"
              ? "bg-blue-500 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          不透明度
        </button>
        <button
          onClick={() => handleTabClick("arrange")}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "arrange"
              ? "bg-blue-500 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          排列
        </button>
      </div>

      {/* 展开的面板内容 */}
      {activeTab === "basic" && (
        <div className="max-h-[70vh] overflow-y-auto">
          {/* 1. 字体与字号 */}
          <div className="p-3 space-y-2">
            <div className="text-xs text-gray-500 font-medium">字体与字号</div>
            
            {/* 字体选择 */}
            <div className="relative">
              <button
                onClick={() => setShowFontDropdown(!showFontDropdown)}
                className="w-full px-3 py-2 text-left text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center justify-between"
              >
                <span>{selectedElement.fontFamily}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showFontDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {FONT_OPTIONS.map((font) => (
                    <button
                      key={font.value}
                      onClick={() => {
                        updateElement(selectedElement.id, { fontFamily: font.value })
                        setShowFontDropdown(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                        selectedElement.fontFamily === font.value ? 'bg-blue-50 text-blue-600' : ''
                      }`}
                      style={{ fontFamily: font.value }}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 字号选择 */}
            <div className="relative">
              <button
                onClick={() => setShowSizeDropdown(!showSizeDropdown)}
                className="w-full px-3 py-2 text-left text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center justify-between"
              >
                <span>{selectedElement.fontSize}px</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSizeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {FONT_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        updateElement(selectedElement.id, { fontSize: size })
                        setShowSizeDropdown(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                        selectedElement.fontSize === size ? 'bg-blue-50 text-blue-600' : ''
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. 文本样式按钮 */}
          <div className="px-3 pb-3">
            <div className="text-xs text-gray-500 font-medium mb-2">文本样式</div>
            <div className="flex items-center gap-1">
              {/* 颜色选择 */}
              <div className="relative">
                <input
                  type="color"
                  value={selectedElement.color}
                  onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                  title="字体颜色"
                />
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-600 pointer-events-none">A</span>
              </div>
              
              {/* 加粗 */}
              <button
                onClick={toggleBold}
                className={`w-8 h-8 flex items-center justify-center rounded border text-sm font-bold transition-colors ${
                  selectedElement.fontWeight >= 700
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
                title="加粗"
              >
                B
              </button>

              {/* 斜体 */}
              <button
                onClick={toggleItalic}
                className={`w-8 h-8 flex items-center justify-center rounded border text-sm italic transition-colors ${
                  selectedElement.italic
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
                title="斜体"
              >
                I
              </button>

              {/* 下划线 */}
              <button
                onClick={toggleUnderline}
                className={`w-8 h-8 flex items-center justify-center rounded border text-sm underline transition-colors ${
                  selectedElement.underline
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
                title="下划线"
              >
                U
              </button>

              {/* 大小写 */}
              <button
                onClick={cycleTextTransform}
                className={`w-8 h-8 flex items-center justify-center rounded border text-xs font-medium transition-colors ${
                  selectedElement.textTransform && selectedElement.textTransform !== 'none'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
                title="大小写转换"
              >
                Aa
              </button>
            </div>
          </div>

          {/* 3. 对齐方式 */}
          <div className="px-3 pb-3">
            <div className="text-xs text-gray-500 font-medium mb-2">对齐方式</div>
            <div className="flex items-center gap-1">
              {/* 水平对齐 */}
              {(["left", "center", "right", "justify"] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => updateElement(selectedElement.id, { align })}
                  className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
                    selectedElement.align === align
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                  title={align === 'left' ? '左对齐' : align === 'center' ? '居中' : align === 'right' ? '右对齐' : '两端对齐'}
                >
                  {align === 'left' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2 3h12v1H2V3zm0 3h8v1H2V6zm0 3h12v1H2V9zm0 3h8v1H2v-1z"/>
                    </svg>
                  )}
                  {align === 'center' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2 3h12v1H2V3zm2 3h8v1H4V6zm-2 3h12v1H2V9zm2 3h8v1H4v-1z"/>
                    </svg>
                  )}
                  {align === 'right' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2 3h12v1H2V3zm4 3h8v1H6V6zm-4 3h12v1H2V9zm4 3h8v1H6v-1z"/>
                    </svg>
                  )}
                  {align === 'justify' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2 3h12v1H2V3zm0 3h12v1H2V6zm0 3h12v1H2V9zm0 3h12v1H2v-1z"/>
                    </svg>
                  )}
                </button>
              ))}

              <div className="w-px h-6 bg-gray-300 mx-1" />

              {/* 垂直对齐 */}
              {(["top", "middle", "bottom"] as const).map((vAlign) => (
                <button
                  key={vAlign}
                  onClick={() => updateElement(selectedElement.id, { verticalAlign: vAlign })}
                  className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
                    (selectedElement.verticalAlign || 'top') === vAlign
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                  title={vAlign === 'top' ? '顶部对齐' : vAlign === 'middle' ? '垂直居中' : '底部对齐'}
                >
                  {vAlign === 'top' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2 2h12v1H2V2zm3 2h6v8H5V4z"/>
                    </svg>
                  )}
                  {vAlign === 'middle' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5 4h6v8H5V4zM2 7.5h2v1H2v-1zm10 0h2v1h-2v-1z"/>
                    </svg>
                  )}
                  {vAlign === 'bottom' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2 13h12v1H2v-1zm3-9h6v8H5V4z"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 间距 */}
          <div className="px-3 pb-3">
            <div className="text-xs text-gray-500 font-medium mb-2">间距</div>
            
            {/* 行距 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-600 w-14">行距</span>
              <input
                type="range"
                min={0.8}
                max={3}
                step={0.1}
                value={selectedElement.lineHeight}
                onChange={(e) => updateElement(selectedElement.id, { lineHeight: Number(e.target.value) })}
                className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <input
                type="number"
                value={selectedElement.lineHeight}
                onChange={(e) => updateElement(selectedElement.id, { lineHeight: Number(e.target.value) || 1.5 })}
                className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                step={0.1}
                min={0.8}
                max={3}
              />
              <button
                onClick={() => updateElement(selectedElement.id, { lineHeight: defaultLineHeight })}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="重置行距"
              >
                <ResetIcon />
              </button>
            </div>

            {/* 字间距 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-14">字间距</span>
              <input
                type="range"
                min={-5}
                max={20}
                step={0.5}
                value={selectedElement.letterSpacing || 0}
                onChange={(e) => updateElement(selectedElement.id, { letterSpacing: Number(e.target.value) })}
                className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <input
                type="number"
                value={selectedElement.letterSpacing || 0}
                onChange={(e) => updateElement(selectedElement.id, { letterSpacing: Number(e.target.value) })}
                className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                step={0.5}
              />
              <button
                onClick={() => updateElement(selectedElement.id, { letterSpacing: defaultLetterSpacing })}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="重置字间距"
              >
                <ResetIcon />
              </button>
            </div>
          </div>

          {/* 5. 样式扩展组 */}
          <CollapsibleSection title="背景">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-14">背景色</span>
              <input
                type="color"
                value={selectedElement.background === 'transparent' ? '#ffffff' : selectedElement.background}
                onChange={(e) => updateElement(selectedElement.id, { background: e.target.value })}
                className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
              />
              <button
                onClick={() => updateElement(selectedElement.id, { background: 'transparent' })}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  selectedElement.background === 'transparent'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
              >
                透明
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="阴影">
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedElement.textShadow?.enabled || false}
                  onChange={(e) => updateElement(selectedElement.id, { 
                    textShadow: { 
                      ...selectedElement.textShadow,
                      enabled: e.target.checked,
                      offsetX: selectedElement.textShadow?.offsetX || 2,
                      offsetY: selectedElement.textShadow?.offsetY || 2,
                      blur: selectedElement.textShadow?.blur || 4,
                      color: selectedElement.textShadow?.color || '#00000040'
                    }
                  })}
                  className="rounded"
                />
                <span className="text-xs text-gray-600">启用阴影</span>
              </label>
              {selectedElement.textShadow?.enabled && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14">颜色</span>
                    <input
                      type="color"
                      value={selectedElement.textShadow?.color?.slice(0, 7) || '#000000'}
                      onChange={(e) => updateElement(selectedElement.id, { 
                        textShadow: { ...selectedElement.textShadow!, color: e.target.value + '40' }
                      })}
                      className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14">模糊</span>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={selectedElement.textShadow?.blur || 4}
                      onChange={(e) => updateElement(selectedElement.id, { 
                        textShadow: { ...selectedElement.textShadow!, blur: Number(e.target.value) }
                      })}
                      className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-600 w-8 text-right">{selectedElement.textShadow?.blur || 4}</span>
                  </div>
                </>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="描边">
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedElement.textStroke?.enabled || false}
                  onChange={(e) => updateElement(selectedElement.id, { 
                    textStroke: { 
                      ...selectedElement.textStroke,
                      enabled: e.target.checked,
                      width: selectedElement.textStroke?.width || 1,
                      color: selectedElement.textStroke?.color || '#000000'
                    }
                  })}
                  className="rounded"
                />
                <span className="text-xs text-gray-600">启用描边</span>
              </label>
              {selectedElement.textStroke?.enabled && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14">颜色</span>
                    <input
                      type="color"
                      value={selectedElement.textStroke?.color || '#000000'}
                      onChange={(e) => updateElement(selectedElement.id, { 
                        textStroke: { ...selectedElement.textStroke!, color: e.target.value }
                      })}
                      className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14">宽度</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={selectedElement.textStroke?.width || 1}
                      onChange={(e) => updateElement(selectedElement.id, { 
                        textStroke: { ...selectedElement.textStroke!, width: Number(e.target.value) }
                      })}
                      className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-600 w-8 text-right">{selectedElement.textStroke?.width || 1}px</span>
                  </div>
                </>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="发光">
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedElement.textGlow?.enabled || false}
                  onChange={(e) => updateElement(selectedElement.id, { 
                    textGlow: { 
                      ...selectedElement.textGlow,
                      enabled: e.target.checked,
                      blur: selectedElement.textGlow?.blur || 10,
                      color: selectedElement.textGlow?.color || '#ffffff'
                    }
                  })}
                  className="rounded"
                />
                <span className="text-xs text-gray-600">启用发光</span>
              </label>
              {selectedElement.textGlow?.enabled && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14">颜色</span>
                    <input
                      type="color"
                      value={selectedElement.textGlow?.color || '#ffffff'}
                      onChange={(e) => updateElement(selectedElement.id, { 
                        textGlow: { ...selectedElement.textGlow!, color: e.target.value }
                      })}
                      className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14">强度</span>
                    <input
                      type="range"
                      min={5}
                      max={50}
                      value={selectedElement.textGlow?.blur || 10}
                      onChange={(e) => updateElement(selectedElement.id, { 
                        textGlow: { ...selectedElement.textGlow!, blur: Number(e.target.value) }
                      })}
                      className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-600 w-8 text-right">{selectedElement.textGlow?.blur || 10}</span>
                  </div>
                </>
              )}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {activeTab === "opacity" && (
        <div className="p-3">
          <div className="text-xs text-gray-500 font-medium mb-2">不透明度</div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={selectedElement.opacity * 100}
              onChange={(e) => handleOpacityChange(Number(e.target.value) / 100)}
              className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-600 w-10 text-right">
              {Math.round(selectedElement.opacity * 100)}%
            </span>
          </div>
        </div>
      )}

      {activeTab === "arrange" && (
        <div className="p-3">
          <div className="text-xs text-gray-500 font-medium mb-2">图层排列</div>
          <div className="flex gap-2">
            <button
              onClick={bringToFront}
              className="flex-1 px-3 py-2 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
            >
              移到最前
            </button>
            <button
              onClick={sendToBack}
              className="flex-1 px-3 py-2 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
            >
              移到最后
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
