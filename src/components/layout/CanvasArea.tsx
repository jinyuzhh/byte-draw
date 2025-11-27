/**
 * @fileoverview 画布区域组件
 * @file /Volumes/DreamZero/code/project/bytedance-canvas/src/components/layout/CanvasArea.tsx
 * 
 * @description 
 * 画布区域组件，负责渲染和管理画布的主要交互区域。
 * 该组件提供以下功能：
 * 1. 渲染 Pixi 画布实例
 * 2. 处理键盘快捷键（删除、复制、粘贴、空格键切换模式）
 * 3. 显示画布元素统计信息
 * 4. 管理交互模式的临时切换（按住空格键切换到移动模式）
 * 
 * @author Canvas Team
 * @version 1.0.0
 */

import { useEffect, useRef } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useCanvas } from "../../store/CanvasProvider"
import { PixiCanvas } from "../canvas/PixiCanvas"
import type { InteractionMode } from "../../types/canvas"

/**
 * 画布区域组件
 * 
 * @component CanvasArea
 * 
 * @description 
 * 画布编辑器的主要工作区域，包含 Pixi 画布实例和键盘交互处理。
 * 负责处理画布的核心交互逻辑，包括元素选择、编辑和快捷键操作。
 * 
 * @returns {JSX.Element} 返回画布区域组件
 * 
 */
export const CanvasArea = () => {
  // 从画布状态管理中获取所需的状态和方法
  const { state, setInteractionMode,copy,paste,deleteSelected } = useCanvas()
  
  // 存储按住空格键之前的交互模式，用于松开空格键后恢复
  const prevModeRef = useRef<InteractionMode | null>(null)

  useHotkeys('mod+c', (e) => {
    e.preventDefault()
    copy()
  }, [copy])

  useHotkeys('mod+v', (e) => {
    e.preventDefault()
    paste()
  }, [paste])

  useHotkeys('delete, backspace', (e) => {
    const activeTag = document.activeElement?.tagName.toLowerCase()
    if (activeTag === 'input' || activeTag === 'textarea') return
    
    e.preventDefault()
    deleteSelected()
  }, [deleteSelected])
  
  // 跟踪空格键是否被按下，防止重复触发
  const spacePressedRef = useRef(false)
  
  // 存储当前交互模式的引用，用于在事件处理中获取最新状态
  const modeRef = useRef<InteractionMode>(state.interactionMode)

  // 更新模式引用，确保在事件处理中能获取到最新的交互模式
  useEffect(() => {
    modeRef.current = state.interactionMode
  }, [state.interactionMode])

  // 键盘事件处理效果，处理快捷键和交互模式切换
  useEffect(() => {
    /**
     * 处理键盘按下事件
     * 
     * @function handleKeyDown
     * @param {KeyboardEvent} event - 键盘事件对象
     * 
     * @description 
     * 处理以下键盘操作：
     * 1. 按下空格键：临时切换到移动(Pan)模式
     * 2. 防止长按重复触发
     * *复制、粘贴、删除已通过 useHotkeys 钩子处理
     * 
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      // 处理空格键：临时切换到移动模式
      if (event.code !== "Space" || event.repeat) return

      const activeTag = document.activeElement?.tagName.toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea') return

      event.preventDefault()

      // 防止重复触发空格键事件
      if (spacePressedRef.current) return
      spacePressedRef.current = true
      
      // 如果当前不是移动模式，保存当前模式并切换到移动模式
      if (modeRef.current !== "pan") {
        prevModeRef.current = modeRef.current
        setInteractionMode("pan")
      } else {
        // 如果已经是移动模式，则不需要保存之前的模式
        prevModeRef.current = null
      }
    }

    /**
     * 处理键盘释放事件
     * 
     * @function handleKeyUp
     * @param {KeyboardEvent} event - 键盘事件对象
     * 
     * @description 
     * 处理空格键释放事件，恢复到之前的交互模式。
     * 当用户松开空格键时，如果之前保存了其他模式，则恢复到该模式。
     */
    const handleKeyUp = (event: KeyboardEvent) => {
      // 只处理空格键释放事件
      if (event.code !== "Space") return
      event.preventDefault()
      
      // 重置空格键按下状态
      spacePressedRef.current = false
      
      // 如果之前保存了其他模式，则恢复到该模式
      if (prevModeRef.current) {
        setInteractionMode(prevModeRef.current)
        prevModeRef.current = null
      }
    }

    // 添加全局键盘事件监听器
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    // 清理函数：移除事件监听器，防止内存泄漏
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [setInteractionMode]) // 依赖项：当这些方法改变时重新绑定事件

  return (
    // 画布区域主容器，占据剩余空间并设置背景样式
    <main className="relative flex-1 overflow-hidden bg-canvas-background">
      {/* 画布容器：包含网格背景和 Pixi 画布实例 */}
      <div className="canvas-grid absolute inset-3 rounded-[32px] border border-canvas-border bg-white/70 shadow-inner">
        <PixiCanvas />
      </div>
      
      {/* 画布状态信息栏：显示元素数量和选中状态 */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-3 rounded-full border border-canvas-border bg-white/70 px-4 py-2 text-xs font-medium text-slate-600 shadow-lg">
        <span>元素：{state.elements.length}</span>
        <span>已选：{state.selectedIds.length}</span>
      </div>
    </main>
  )
}
