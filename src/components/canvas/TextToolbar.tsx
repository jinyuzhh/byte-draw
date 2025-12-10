/**
 * @fileoverview 文本工具栏组件
 * 
 * @description 
 * 当文本框被选中后，在画布右上角显示一个竖向排列的操作面板，
 * 包含"基本"、"不透明度"、"排列"三个按钮，用于调节文本框的样式和属性。
 */

import { useState } from "react"
import { useCanvas } from "../../store/CanvasProvider"
import type { TextElement } from "../../types/canvas"

type ToolbarTab = "basic" | "opacity" | "arrange"

/**
 * 文本工具栏组件
 * 
 * @description 
 * 竖向排列的小工具栏，当文本元素被选中时显示在画布右上角。
 * 提供基本属性、不透明度和排列的快捷调整功能。
 */
export const TextToolbar = () => {
  const { state, updateElement, bringToFront, sendToBack } = useCanvas()
  const [activeTab, setActiveTab] = useState<ToolbarTab | null>(null)

  // 检查是否选中了单个文本元素
  const selectedElement = state.selectedIds.length === 1
    ? state.elements.find(
        (el) => el.id === state.selectedIds[0] && el.type === "text"
      ) as TextElement | undefined
    : undefined

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

  return (
    <div className="text-toolbar absolute top-4 right-4 flex flex-col gap-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
      {/* 基本按钮 */}
      <button
        onClick={() => handleTabClick("basic")}
        className={`px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === "basic"
            ? "bg-blue-500 text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        基本
      </button>

      {/* 不透明度按钮 */}
      <button
        onClick={() => handleTabClick("opacity")}
        className={`px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === "opacity"
            ? "bg-blue-500 text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        不透明度
      </button>

      {/* 排列按钮 */}
      <button
        onClick={() => handleTabClick("arrange")}
        className={`px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === "arrange"
            ? "bg-blue-500 text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        排列
      </button>

      {/* 展开的面板内容 */}
      {activeTab && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          {activeTab === "basic" && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 mb-2">字体设置</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-12">字号</label>
                <input
                  type="number"
                  value={selectedElement.fontSize}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      fontSize: Number(e.target.value) || 16,
                    })
                  }
                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                  min={8}
                  max={200}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-12">颜色</label>
                <input
                  type="color"
                  value={selectedElement.color}
                  onChange={(e) =>
                    updateElement(selectedElement.id, { color: e.target.value })
                  }
                  className="w-8 h-6 border border-gray-300 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-12">对齐</label>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() =>
                        updateElement(selectedElement.id, { align })
                      }
                      className={`px-2 py-1 text-xs rounded ${
                        selectedElement.align === align
                          ? "bg-blue-500 text-white"
                          : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {align === "left" ? "左" : align === "center" ? "中" : "右"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "opacity" && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 mb-2">不透明度</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedElement.opacity * 100}
                  onChange={(e) =>
                    handleOpacityChange(Number(e.target.value) / 100)
                  }
                  className="flex-1"
                />
                <span className="text-xs text-gray-600 w-10 text-right">
                  {Math.round(selectedElement.opacity * 100)}%
                </span>
              </div>
            </div>
          )}

          {activeTab === "arrange" && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 mb-2">图层排列</div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={bringToFront}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
                >
                  移到最前
                </button>
                <button
                  onClick={sendToBack}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
                >
                  移到最后
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
