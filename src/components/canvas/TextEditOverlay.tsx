/**
 * @fileoverview 文本编辑覆盖层组件
 * 
 * @description 
 * 当用户选中文本框后再次点击进入编辑模式时，
 * 在文本框位置显示一个可编辑的 textarea，允许用户直接修改文本内容。
 */

import { useEffect, useRef, useCallback } from "react"
import { useCanvas } from "../../store/CanvasProvider"
import type { TextElement } from "../../types/canvas"

interface TextEditOverlayProps {
  /** 滚动容器的引用，用于计算正确的位置 */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  /** 画布容器的引用 */
  canvasWrapperRef: React.RefObject<HTMLDivElement | null>
}

/**
 * 文本编辑覆盖层组件
 * 
 * @description 
 * 在画布上方显示一个与文本元素位置和样式匹配的 textarea，
 * 用户可以直接输入和修改文本内容。
 */
export const TextEditOverlay = ({
  scrollContainerRef,
  canvasWrapperRef,
}: TextEditOverlayProps) => {
  const { state, updateElement, stopEditingText } = useCanvas()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 获取当前正在编辑的文本元素
  const editingElement = state.editingTextId
    ? (state.elements.find(
        (el) => el.id === state.editingTextId && el.type === "text"
      ) as TextElement | undefined)
    : null

  // 当进入编辑模式时，聚焦到 textarea
  useEffect(() => {
    if (editingElement && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true })
      // 将光标移动到文本末尾
      textareaRef.current.selectionStart = textareaRef.current.value.length
      textareaRef.current.selectionEnd = textareaRef.current.value.length
    }
  }, [editingElement])

  // 处理文本变更
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (state.editingTextId) {
        updateElement(state.editingTextId, { text: e.target.value })
      }
    },
    [state.editingTextId, updateElement]
  )

  // 处理按键事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Escape 退出编辑模式
      if (e.key === "Escape") {
        e.preventDefault()
        stopEditingText()
      }
      // 阻止事件冒泡，防止触发画布的快捷键
      e.stopPropagation()
    },
    [stopEditingText]
  )

  // 处理失焦事件
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      // 检查焦点是否移动到了工具栏按钮，如果是则不退出编辑模式
      const relatedTarget = e.relatedTarget as HTMLElement | null
      if (relatedTarget?.closest('.text-toolbar')) {
        return
      }
      stopEditingText()
    },
    [stopEditingText]
  )

  // 如果没有正在编辑的元素，不渲染任何内容
  if (!editingElement) {
    return null
  }

  // 计算 textarea 在屏幕上的位置
  const scrollContainer = scrollContainerRef.current
  const canvasWrapper = canvasWrapperRef.current
  
  if (!scrollContainer || !canvasWrapper) {
    return null
  }

  const scrollLeft = scrollContainer.scrollLeft
  const scrollTop = scrollContainer.scrollTop
  const zoom = state.zoom

  // 元素在画布坐标系中的位置
  const elementX = editingElement.x
  const elementY = editingElement.y
  const elementWidth = editingElement.width
  const elementHeight = editingElement.height

  // 转换为屏幕坐标（考虑缩放和滚动）
  // 由于组件放在滚动容器外部，需要减去滚动位置
  const screenX = elementX * zoom - scrollLeft
  const screenY = elementY * zoom - scrollTop
  const screenWidth = elementWidth * zoom
  const screenHeight = elementHeight * zoom

  // 阻止鼠标事件冒泡到画布
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
  }

  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 100 }}
    >
      <div
        className="absolute pointer-events-auto"
        style={{
          left: screenX,
          top: screenY,
          width: screenWidth,
          height: screenHeight,
          transform: `rotate(${editingElement.rotation}deg)`,
          transformOrigin: "center center",
        }}
        onPointerDown={handlePointerDown}
      >
        <textarea
          ref={textareaRef}
          value={editingElement.text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full h-full resize-none border-2 border-blue-500 outline-none"
          style={{
            fontFamily: editingElement.fontFamily,
            fontSize: editingElement.fontSize * zoom,
            fontWeight: editingElement.fontWeight,
            color: editingElement.color,
            textAlign: editingElement.align,
            lineHeight: editingElement.lineHeight,
            padding: `${12 * zoom}px`,
            backgroundColor: editingElement.background !== "transparent" 
              ? editingElement.background 
              : "rgba(255, 255, 255, 0.95)",
            borderRadius: `${12 * zoom}px`,
          }}
        />
      </div>
    </div>
  )
}
