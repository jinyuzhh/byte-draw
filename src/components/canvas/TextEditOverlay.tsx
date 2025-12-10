/**
 * @fileoverview 文本编辑覆盖层组件
 * 
 * @description 
 * 当用户点击已选中的文本框进入编辑模式时，
 * 在文本框位置显示一个 contentEditable 的 div，实现类似 Figma 的原生编辑体验。
 * 文本保持原位，光标直接出现在画布上的文字中，边框变为编辑态样式。
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
 * 在画布上方显示一个与文本元素位置和样式完全匹配的 contentEditable div，
 * 实现类似 Figma 的原生文本编辑体验：
 * - 文本保持原位
 * - 光标直接出现在画布上的文字中
 * - 边框变为编辑态样式（蓝色高亮）
 * - 支持键盘输入、文本选中等功能
 * - 正确处理中文输入（IME Composition）
 */
export const TextEditOverlay = ({
  scrollContainerRef,
  canvasWrapperRef,
}: TextEditOverlayProps) => {
  const { state, updateElement, stopEditingText } = useCanvas()
  const editorRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false) // 标记是否正在进行 IME 输入
  const lastEditingIdRef = useRef<string | null>(null) // 记录上次编辑的元素ID

  // 获取当前正在编辑的文本元素
  const editingElement = state.editingTextId
    ? (state.elements.find(
        (el) => el.id === state.editingTextId && el.type === "text"
      ) as TextElement | undefined)
    : null

  // 当进入编辑模式时，初始化编辑器内容并聚焦
  useEffect(() => {
    if (editingElement && editorRef.current) {
      const editor = editorRef.current
      
      // 只在切换到新的编辑元素时初始化内容
      if (lastEditingIdRef.current !== editingElement.id) {
        // 设置初始文本内容
        editor.innerText = editingElement.text
        lastEditingIdRef.current = editingElement.id
      }
      
      // 聚焦并将光标移动到文本末尾
      editor.focus({ preventScroll: true })
      
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false) // collapse to end
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
    
    // 当退出编辑模式时，重置状态
    if (!editingElement) {
      lastEditingIdRef.current = null
    }
  }, [editingElement?.id])

  // 处理输入事件 - 只在非 IME 输入时更新
  const handleInput = useCallback(() => {
    // 如果正在进行 IME 输入，不处理
    if (isComposingRef.current) {
      return
    }
    
    if (state.editingTextId && editorRef.current) {
      const newText = editorRef.current.innerText
      updateElement(state.editingTextId, { text: newText })
    }
  }, [state.editingTextId, updateElement])

  // IME 输入开始
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  // IME 输入结束
  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false
    
    // IME 输入完成后，更新文本
    if (state.editingTextId && editorRef.current) {
      const newText = editorRef.current.innerText
      updateElement(state.editingTextId, { text: newText })
    }
  }, [state.editingTextId, updateElement])

  // 处理按键事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Escape 退出编辑模式
      if (e.key === "Escape") {
        e.preventDefault()
        stopEditingText()
        return
      }
      // 阻止事件冒泡，防止触发画布的快捷键
      e.stopPropagation()
    },
    [stopEditingText]
  )

  // 处理失焦事件
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      // 检查焦点是否移动到了工具栏按钮，如果是则不退出编辑模式
      const relatedTarget = e.relatedTarget as HTMLElement | null
      if (relatedTarget?.closest('.text-toolbar')) {
        // 稍后恢复焦点到编辑器
        setTimeout(() => {
          editorRef.current?.focus({ preventScroll: true })
        }, 0)
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

  // 计算编辑器在屏幕上的位置
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
  const screenX = elementX * zoom - scrollLeft
  const screenY = elementY * zoom - scrollTop
  const screenWidth = elementWidth * zoom
  const screenHeight = elementHeight * zoom

  // 计算内边距（与 Pixi 渲染一致，Pixi 中 text.position.set(12, 12)）
  const padding = 12 * zoom

  // 阻止鼠标事件冒泡到画布
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
  }

  // 计算与 Pixi 渲染一致的行高
  // Pixi 中使用: lineHeight: element.fontSize * element.lineHeight
  const computedLineHeight = editingElement.fontSize * editingElement.lineHeight * zoom

  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 100 }}
    >
      {/* 编辑态边框容器 */}
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
        {/* 编辑态边框 - 蓝色高亮 */}
        <div 
          className="absolute inset-0 border-2 border-blue-500 pointer-events-none"
          style={{ 
            boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3)',
            borderRadius: `${12 * zoom}px`,
          }}
        />
        
        {/* 四个角的编辑态手柄 */}
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm" />
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm" />
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm" />
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm" />
        
        {/* 背景层 - 与 Pixi 渲染保持一致 */}
        {editingElement.background !== "transparent" && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: editingElement.background,
              opacity: 0.8,
              borderRadius: `${12 * zoom}px`,
            }}
          />
        )}
        
        {/* contentEditable 文本编辑器 */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="absolute inset-0 outline-none overflow-hidden"
          style={{
            padding: `${padding}px`,
            fontFamily: editingElement.fontFamily,
            fontSize: `${editingElement.fontSize * zoom}px`,
            fontWeight: editingElement.fontWeight,
            fontStyle: editingElement.italic ? 'italic' : 'normal',
            textDecoration: editingElement.underline ? 'underline' : 'none',
            textTransform: editingElement.textTransform || 'none',
            letterSpacing: editingElement.letterSpacing !== undefined 
              ? `${editingElement.letterSpacing * zoom}px` 
              : 'normal',
            color: editingElement.color,
            textAlign: editingElement.align,
            lineHeight: `${computedLineHeight}px`,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            caretColor: '#3b82f6', // 蓝色光标
          }}
        />
      </div>
    </div>
  )
}
