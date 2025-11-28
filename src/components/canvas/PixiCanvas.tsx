/**
 * @fileoverview Pixi 画布渲染组件
 * @file /Volumes/DreamZero/code/project/bytedance-canvas/src/components/canvas/PixiCanvas.tsx
 * 
 * @description 
 * 基于 PixiJS 的画布渲染组件，负责渲染和管理画布中的所有元素。
 * 该组件提供以下功能：
 * 1. 初始化和管理 PixiJS 应用实例
 * 2. 渲染各种类型的画布元素（形状、文本、图像）
 * 3. 处理元素的交互（选择、移动、调整大小）
 * 4. 实现画布的缩放和平移
 * 5. 提供区域选择功能
 * 6. 管理元素的选中状态和视觉反馈
 * 
 * @author Canvas Team
 * @version 1.0.0
 */

import { useEffect, useRef, useCallback, useState } from "react"
import {
  Application,
  Container,
  Graphics,
  FederatedPointerEvent,
  Rectangle,
} from "pixi.js"
import { useCanvas } from "../../store/CanvasProvider"
import type { CanvasElement, GroupElement } from "../../types/canvas"
import {
  MIN_ELEMENT_SIZE,
  SELECTION_COLOR,
  SNAP_ANGLE,
  type ResizeDirection,
} from "./pixiConstants"
import {
  cloneElement,
  cloneElements,
  getBoundingBox,
} from "./pixiUtils"
import { calculateSnap, type GuideLine } from "./snapUtils"
import {
  createBoundsHandlesLayer,
  // createMultiSelectionBox,
  createResizeHandlesLayer,
  createSelectionOutline,
  createShape,
  createSolidBoundsOutline,
  createRotateTooltip
} from "./pixiRenderers"
import { RightClickMenu } from "./RightClickMenu"

/**
 * PixiCanvas 画布组件
 * 
 * @component PixiCanvas
 * @description 
 * 基于 PixiJS 实现的画布渲染组件，负责：
 * 1. 初始化和管理 PixiJS 应用实例
 * 2. 渲染和管理画布元素（形状、文本、图像）
 * 3. 处理用户交互（选择、移动、调整大小、平移）
 * 4. 管理画布缩放和视口
 * 5. 实现区域选择功能
 */
export const PixiCanvas = () => {
  // 在组件顶部声明全局变量，确保在所有作用域内可用
  let handleGlobalWheel: ((event: WheelEvent) => void) | null = null;
  let preventContextMenu: ((e: Event) => void) | null = null;

  // 从 Canvas Context 获取状态和方法
  const {
    state,              // 画布状态（元素列表、选中项、缩放等）
    isInitialized,      // 获取初始状态
    setSelection,       // 设置选中元素
    clearSelection,     // 清除选中状态
    mutateElements,     // 修改元素属性
    panBy,              // 平移画布
    registerApp,        // 注册 PixiJS 应用实例
    setZoom,
    groupElements,      // 打组功能
    ungroupElements,    // 解组功能
  } = useCanvas()

  // DOM 和 PixiJS 对象引用
  const wrapperRef = useRef<HTMLDivElement | null>(null)      // 画布容器 DOM 元素引用
  const appRef = useRef<Application | null>(null)              // PixiJS 应用实例引用
  const contentRef = useRef<Container | null>(null)            // 内容容器引用（存放所有元素）
  const backgroundRef = useRef<Graphics | null>(null)          // 背景图形对象引用
  const guidesRef = useRef<Graphics | null>(null)              // 辅助线图形对象引用
  const currentGuidesRef = useRef<GuideLine[]>([])             // 当前辅助线数据

  //rotateRef 用于追踪旋转状态
  const rotateRef = useRef<{
    id: string
    startRotation: number    // 初始元素角度
    centerX: number          // 旋转中心 X (全局坐标)
    centerY: number          // 旋转中心 Y (全局坐标)
    startAngle: number       // 鼠标初始相对于中心的角度
    snapshot: CanvasElement[]  // 用于撤销的快照
    tooltip: Container | null // 角度提示对象引用
    
  } | null>(null)

  // 交互状态引用
  const dragRef = useRef<{
    ids: string[]                                    // 正在拖动的元素 ID 列表
    startPointer: { x: number; y: number }          // 拖动开始时的指针位置
    snapshot: Record<string, CanvasElement>         // 拖动开始时的元素快照
    historySnapshot: CanvasElement[]                // 拖动开始时的历史记录快照
    moved: boolean                                  // 是否已移动（用于区分点击和拖动）
  } | null>(null)                                    // 拖动操作状态引用


  const toRad = (deg: number) => deg * (Math.PI / 180);
  const toDeg = (rad: number) => rad * (180 / Math.PI);

  const handleRotateStart = useCallback((event: FederatedPointerEvent, id: string) => {
    event.stopPropagation()
    const content = contentRef.current
    if (!content) return

    const element = stateRef.current.elements.find(el => el.id === id)
    if (!element) return

    // 获取鼠标在 content 容器中的位置
    const localPoint = event.getLocalPosition(content)

    const rotationRad = toRad(element.rotation)
    
    const w2 = element.width / 2
    const h2 = element.height / 2
    const cos = Math.cos(rotationRad)
    const sin = Math.sin(rotationRad)
    
    const centerX = element.x + w2 * cos - h2 * sin
    const centerY = element.y + w2 * sin + h2 * cos

    // 计算鼠标相对于中心的初始角度
    const startMouseAngle = Math.atan2(localPoint.y - centerY, localPoint.x - centerX)

    rotateRef.current = {
      id,
      startRotation: element.rotation,
      centerX,
      centerY,
      startAngle: startMouseAngle,
      snapshot: cloneElements(stateRef.current.elements), 
      tooltip: null
    }
  }, [])

  const resizeRef = useRef<{
    ids: string[]                                                           // 正在调整大小的元素 ID
    direction: ResizeDirection                                              // 调整大小的方向
    startPointer: { x: number; y: number }                                  // 调整开始时的指针位置
    startElements: Record<string, CanvasElement>                            // 调整开始时的元素状态
    startBounds: { x: number; y: number; width: number; height: number }
    historySnapshot: CanvasElement[]                                        // 调整开始时的历史记录快照
    moved: boolean                                                          // 是否已调整大小
  } | null>(null)
  const panRef = useRef<{ lastPointer: { x: number; y: number } } | null>(null)
  const stateRef = useRef(state)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const selectionBoxRef = useRef<Graphics | null>(null) // reference to the selection box graphics object
  const isSelectedRef = useRef(false); // reference to the selection state, default as false 
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null); // reference to the start point of the selection box

  const [renderPage, setRenderPage] = useState(0); // 用于触发页面渲染
  const [hasInitialized, setHasInitialized] = useState(false); // 用于判断是否已经初始化

  // 右键菜单状态
  const [rightClickMenu, setRightClickMenu] = useState({
    isVisible: false,
    x: 0,
    y: 0,
  })

  useEffect(() => {
    if (isInitialized && !hasInitialized && state.elements.length > 0) {
      // 初始化成功，进行渲染
      setHasInitialized(true); // 已经初始化的，就不要再重复渲染了；尤其是新增元素时
      setRenderPage(prev => prev + 1);
    }
  }, [isInitialized, hasInitialized, state.elements.length])

  // 同步状态到引用，确保在回调中获取最新状态
  useEffect(() => {
    stateRef.current = state
  }, [state])

  /**
   * 执行元素调整大小操作
   * 
   * @function performResize
   * @param {Object} info - 调整大小信息
   * @param {string} info.id - 要调整大小的元素 ID
   * @param {ResizeDirection} info.direction - 调整大小的方向
   * @param {CanvasElement} info.startElement - 调整开始时的元素状态
   * @param {number} dx - 水平方向上的移动距离
   * @param {number} dy - 垂直方向上的移动距离
   * 
   * @description 
   * 根据调整方向和移动距离计算元素的新尺寸和位置：
   * - 东(e)/西(w)：调整宽度
   * - 南(s)/北(n)：调整高度
   * - 西(w)/北(n)：同时调整位置以保持对边不动
   */
  const performResize = useCallback(
    (
      info: {
        ids: string[]
        direction: ResizeDirection
        startElements: Record<string, CanvasElement>
        startBounds: { x: number; y: number; width: number; height: number }
      },
      dx: number,
      dy: number
    ) => {
      const { direction, startElements, startBounds, ids } = info

      // 计算新的包围盒
      const newBounds = { ...startBounds }

      if (direction.includes("e")) {
        newBounds.width = Math.max(MIN_ELEMENT_SIZE, startBounds.width + dx)
      }
      // 南方向：调整下边界
      if (direction.includes("s")) {
        newBounds.height = Math.max(MIN_ELEMENT_SIZE, startBounds.height + dy)
      }
      // 西方向：调整左边界，同时移动位置
      if (direction.includes("w")) {
        const updatedWidth = Math.max(MIN_ELEMENT_SIZE, startBounds.width - dx)
        const delta = startBounds.width - updatedWidth
        newBounds.width = updatedWidth
        newBounds.x = startBounds.x + delta
      }
      // 北方向：调整上边界，同时移动位置
      if (direction.includes("n")) {
        const updatedHeight = Math.max(MIN_ELEMENT_SIZE, startBounds.height - dy)
        const delta = startBounds.height - updatedHeight
        newBounds.height = updatedHeight
        newBounds.y = startBounds.y + delta
      }

      // 计算缩放比例
      const scaleX = startBounds.width > 0 ? newBounds.width / startBounds.width : 1
      const scaleY = startBounds.height > 0 ? newBounds.height / startBounds.height : 1

      // 应用新的尺寸和位置
      mutateElements(
        (elements) =>
          elements.map((el) => {
            if (!ids.includes(el.id)) return el
            const startEl = startElements[el.id]
            if (!startEl) return el

            // 计算新位置和大小
            const newX = newBounds.x + (startEl.x - startBounds.x) * scaleX
            const newY = newBounds.y + (startEl.y - startBounds.y) * scaleY
            const newWidth = Math.max(MIN_ELEMENT_SIZE, startEl.width * scaleX)
            const newHeight = Math.max(MIN_ELEMENT_SIZE, startEl.height * scaleY)

            // 处理组元素，更新其内部子元素
            if (el.type === 'group' && 'children' in el && Array.isArray(el.children)) {
              const startGroup = startEl as typeof el;
              if (startGroup.children) {
                // 缩放组内子元素
                const scaledChildren = startGroup.children.map(child => ({
                  ...child,
                  x: child.x * scaleX,
                  y: child.y * scaleY,
                  width: Math.max(MIN_ELEMENT_SIZE, child.width * scaleX),
                  height: Math.max(MIN_ELEMENT_SIZE, child.height * scaleY)
                }));
                
                return { 
                  ...el, 
                  x: newX, 
                  y: newY, 
                  width: newWidth, 
                  height: newHeight,
                  children: scaledChildren
                };
              }
            }

            return { ...el, x: newX, y: newY, width: newWidth, height: newHeight }
          }) as CanvasElement[],
        { recordHistory: false }
      )
    },
    [mutateElements]
  )

  /**
 * 初始化 PixiJS 应用和设置事件监听器
 * 
 * @description 
 * 这个 useEffect 负责：
 * 1. 创建和初始化 PixiJS 应用实例
 * 2. 设置背景层和内容层
 * 3. 配置事件监听器（指针按下、移动、释放）
 * 4. 设置容器大小变化观察器
 * 5. 在组件卸载时清理资源
 */
  useEffect(() => {
    let destroyed = false

    // 更新背景层大小和交互区域
    const updateBackground = () => {
      const app = appRef.current
      const background = backgroundRef.current
      if (!app || !background) return
      background.clear()
      background.rect(0, 0, app.screen.width, app.screen.height)
      background.fill({ color: 0xffffff, alpha: 0 })
      background.hitArea = app.screen
    }

    // 初始化 PixiJS 应用
    const setup = async () => {
      if (!wrapperRef.current) return
      const app = new Application()
      await app.init({
        antialias: true,                    // 启用抗锯齿
        backgroundAlpha: 0,                  // 透明背景
        resolution: window.devicePixelRatio || 1,  // 设备像素比
        resizeTo: wrapperRef.current,       // 自动调整大小到容器
      })
      if (destroyed) {
        app.destroy()
        return
      }

      // 将画布添加到 DOM
      wrapperRef.current.appendChild(app.canvas)

      // 设置舞台交互模式
      app.stage.eventMode = "static"
      app.stage.hitArea = app.screen

      // 创建背景层（用于处理画布点击和平移）
      const background = new Graphics()
      background.alpha = 0
      background.eventMode = "static"
      background.cursor = "default"
      background.hitArea = app.screen
      app.stage.addChild(background)

      // 创建内容层（用于存放所有画布元素）
      const content = new Container()
      content.eventMode = "static"
      app.stage.addChild(content)

      // 保存引用
      appRef.current = app
      contentRef.current = content
      backgroundRef.current = background
      registerApp(app)

      // 立即渲染现有元素
      if (stateRef.current.elements.length > 0) {
        renderElements(content, stateRef.current.elements, stateRef.current)
      }

      // 设置容器大小变化观察器
      const resizeObserver = new ResizeObserver(() => {
        app.resize()
        updateBackground()
      })
      resizeObserver.observe(wrapperRef.current)
      resizeObserverRef.current = resizeObserver

      // 背景层指针按下事件处理
      background.on("pointerdown", (event: FederatedPointerEvent) => {
        // 处理右键点击
        if (event.originalEvent && (event.originalEvent as any).button === 2) {
          event.preventDefault();
          return;
        }

        // 平移模式：初始化平移状态
        if (stateRef.current.interactionMode === "pan") {
          panRef.current = {
            lastPointer: { x: event.global.x, y: event.global.y },
          }
          background.cursor = "grabbing"
        }
        // 选择模式：处理区域选择
        else if (stateRef.current.interactionMode === "select") {
          const nativeEvent = event.originalEvent as unknown as MouseEvent;
          // 只有在没有修饰键且点击的是背景时才开始区域选择
          if (!(nativeEvent.shiftKey || nativeEvent.metaKey || nativeEvent.ctrlKey) && event.target === background) {
            // 记录选择开始位置
            const localPos = event.getLocalPosition(content);
            selectionStartRef.current = { x: localPos.x, y: localPos.y };
            isSelectedRef.current = true;

            // 创建选择框
            const selectionBox = new Graphics();
            selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
            selectionBox.fill({ color: SELECTION_COLOR, alpha: 0.1 });
            selectionBox.zIndex = 100;
            content.addChild(selectionBox);
            selectionBoxRef.current = selectionBox;
          }
        } else {
          // 其他模式：清除选择
          clearSelection()
        }
      })

      // 定义阻止浏览器默认右键菜单的函数
      preventContextMenu = (e: Event) => {
        e.preventDefault();
      };

      // 处理右键菜单
      const handleRightClick = (event: FederatedPointerEvent) => {
        event.preventDefault();

        // 只有在选择模式下才显示右键菜单
        if (stateRef.current.interactionMode !== "select") {
          return;
        }

        // 获取事件的屏幕坐标
        const originalEvent = event.originalEvent as any;
        const x = originalEvent.clientX;
        const y = originalEvent.clientY;

        setRightClickMenu({
          isVisible: true,
          x,
          y
        });
      };

      // 为舞台添加右键事件监听器
      app.stage.on("rightclick", handleRightClick);

      // 在canvas元素上添加contextmenu事件监听器，完全阻止浏览器默认右键菜单
      if (appRef.current && appRef.current.canvas) {
        appRef.current.canvas.addEventListener('contextmenu', preventContextMenu);
      }

      // 定义滚轮事件处理函数
      const handleGlobalWheel = (event: WheelEvent) => {
        // 检查是否按下了ctrl键或meta键（Mac）
        if (event.ctrlKey || event.metaKey) {
          // 无论鼠标是否在画布上，都阻止浏览器默认缩放行为
          event.preventDefault();
          event.stopPropagation();

          // 获取画布元素
          const canvas = app.canvas;
          const rect = canvas.getBoundingClientRect();

          // 检查鼠标是否在画布范围内
          const isMouseInCanvas = (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );

          // 只有当鼠标在画布上时，才进行画布缩放
          if (isMouseInCanvas) {
            // 根据滚轮方向调整缩放比例
            const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = stateRef.current.zoom * zoomFactor;

            // 使用setZoom方法设置新的缩放级别
            setZoom(newZoom);
          }
          // 如果鼠标不在画布上，不执行任何缩放操作，但仍然阻止浏览器的默认缩放行为
        }
      };

      // 添加全局滚轮事件监听器
      window.addEventListener('wheel', handleGlobalWheel, { passive: false });

      // 舞台指针移动事件处理
      app.stage.on("pointermove", (event: FederatedPointerEvent) => {
        const content = contentRef.current
        if (!content) return

        // 区域选择处理：更新选择框大小
        if (isSelectedRef.current && selectionStartRef.current && selectionBoxRef.current) {
          const localPos = event.getLocalPosition(content);
          const start = selectionStartRef.current;

          // 计算选择框的位置和尺寸
          const x = Math.min(start.x, localPos.x);
          const y = Math.min(start.y, localPos.y);
          const width = Math.abs(start.x - localPos.x);
          const height = Math.abs(start.y - localPos.y);

          // 绘制选择框
          const selectionBox = selectionBoxRef.current;
          selectionBox.clear();
          selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
          selectionBox.beginFill(SELECTION_COLOR, 0.1);
          selectionBox.fill({ color: SELECTION_COLOR, alpha: 0.1 });
          selectionBox.drawRect(x, y, width, height);
          selectionBox.endFill();
          return;
        }

        // 调整大小处理：更新元素尺寸
        if (resizeRef.current) {
          const current = resizeRef.current
          const local = event.getLocalPosition(content)
          const dx = local.x - current.startPointer.x
          const dy = local.y - current.startPointer.y
          current.moved = true
          performResize(current, dx, dy)
          return
        }
        
        // 旋转处理逻辑
        if (rotateRef.current) {
          const { centerX, centerY, startAngle, startRotation, id } = rotateRef.current
          const local = event.getLocalPosition(content)
          
          // 1. 计算当前鼠标相对于中心的角度
          const currentMouseAngle = Math.atan2(local.y - centerY, local.x - centerX)
          
          // 2. 计算角度差
          let deltaRad = currentMouseAngle - startAngle
          let newRotationDeg = startRotation + toDeg(deltaRad)

          // 3. 处理 Shift 键吸附 (或者默认吸附，按住 Shift 微调)
          // 支持吸附 (如每15度)，Shift 可控制。
          // 假设：默认吸附，按住 Shift 取消吸附 (或者反之，看交互习惯，Figma是按住Shift吸附)
          // 按住 Shift 键时启用 15度 吸附。
          if (event.shiftKey) {
            newRotationDeg = Math.round(newRotationDeg / SNAP_ANGLE) * SNAP_ANGLE
          }

          // 4. 更新元素 (预览效果)
          // 此时不记录历史，只更新视觉
          const newRotationRad = toRad(newRotationDeg)
          const newCos = Math.cos(newRotationRad)
          const newSin = Math.sin(newRotationRad)
          mutateElements(
            (elements) => elements.map(el => {
              if (el.id !== id) return el           
              const elW2 = el.width / 2
              const elH2 = el.height / 2
              
              const newX = centerX - elW2 * newCos + elH2 * newSin
              const newY = centerY - elW2 * newSin - elH2 * newCos
              return {
                ...el,
                rotation: newRotationDeg,
                x: newX,
                y: newY
              }
            }),
            { recordHistory: false }
          )
          
          return // 结束处理，防止与其他事件冲突
        }

        // 拖动处理：更新元素位置
        if (dragRef.current) {
          const current = dragRef.current
          const local = event.getLocalPosition(content)
          const dx = local.x - current.startPointer.x
          const dy = local.y - current.startPointer.y
          // 只有移动距离足够大才认为是拖动（避免误触）
          if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
            current.moved = true
            mutateElements(
              (elements) =>
                elements.map((el) => {
                  if (!current.ids.includes(el.id)) return el
                  const base = current.snapshot[el.id] ?? el
                  return { ...el, x: base.x + dx, y: base.y + dy }
                }) as CanvasElement[],
              { recordHistory: false }
            )
          }
          return
        }

        // 平移处理：更新画布视口
        if (panRef.current) {
          const last = panRef.current.lastPointer
          const dx = event.global.x - last.x
          const dy = event.global.y - last.y
          panRef.current.lastPointer = { x: event.global.x, y: event.global.y }
          panBy({ x: dx, y: dy })
        }
      })

      // if (rotateRef.current && contentRef.current) {
      //   const el = state.elements.find(e => e.id === rotateRef.current?.id)
      //   if (el) {
      //     // 如果 tooltip 已存在，销毁旧的（为了简单，或者更新文字）
      //     if (rotateRef.current.tooltip) {
      //       rotateRef.current.tooltip.destroy()
      //     }
          
      //     // 创建新的 tooltip 并添加
      //     // 注意：这里需要传入 zoom 来抵消缩放
      //     const tooltip = createRotateTooltip(el, state.zoom)
      //     // 修正位置：放到元素中心下方
      //     const w2 = el.width / 2
      //     const h2 = el.height / 2
      //     const cos = Math.cos(el.rotation)
      //     const sin = Math.sin(el.rotation)
      //     const cx = el.x + w2 * cos - h2 * sin
      //     const cy = el.y + w2 * sin + h2 * cos
          
      //     // Tooltip 位置：中心点往下偏移一定距离 (例如 60px)
      //     tooltip.position.set(cx, cy + 60)
          
      //     contentRef.current.addChild(tooltip)
      //     rotateRef.current.tooltip = tooltip
      //   }
      // }

      // 停止所有交互操作
    const stopInteractions = () => {
      if (rotateRef.current) {
          // 1. 记录历史
          mutateElements(
          (elements) => elements, 
          { 
            // 使用开始时的快照作为历史记录的前一个状态
            historySnapshot: rotateRef.current.snapshot
          }
        )
        
        // 2. 清理 Tooltip
        if (rotateRef.current.tooltip) {
          //rotateRef.current.tooltip.destroy()
          rotateRef.current.tooltip = null
        }
        
        rotateRef.current = null
      }
        // 区域选择完成处理
        if (isSelectedRef.current && selectionBoxRef.current && selectionStartRef.current) {
          const selectionBox = selectionBoxRef.current;
          // 获取选择框的边界
          const bounds = selectionBox.getBounds();
          const selectionRect = new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);

          // 找出与选择框相交的所有元素
          const selectedElements = stateRef.current.elements.filter(elem => {
            const elemRect = new Rectangle(elem.x, elem.y, elem.width, elem.height);
            return selectionRect.intersects(elemRect); // 检查元素是否与选择框相交
          });

          // 更新选择状态
          if (selectedElements.length > 0) {
            setSelection(selectedElements.map((el) => el.id));
          } else {
            clearSelection();
          }

          // 清除选择框
          selectionBox.destroy();
          selectionBoxRef.current = null;
        }

        // 重置区域选择状态
        isSelectedRef.current = false;
        selectionStartRef.current = null;

        // 重置平移光标
        const background = backgroundRef.current
        if (panRef.current && background) {
          background.cursor = "default"
        }

        // 记录拖动操作的历史
        if (dragRef.current?.moved) {
          mutateElements(
            (elements) => elements,
            {
              historySnapshot: dragRef.current.historySnapshot,
            }
          )
        }

        // 记录调整大小操作的历史
        if (resizeRef.current?.moved) {
          mutateElements(
            (elements) => elements,
            {
              historySnapshot: resizeRef.current.historySnapshot,
            }
          )
        }

        // 清除所有交互状态
        dragRef.current = null
        resizeRef.current = null
        panRef.current = null
      }

      app.stage.on("pointerup", stopInteractions)
      app.stage.on("pointerupoutside", stopInteractions)
    }

    setup()

    return () => {
      destroyed = true
      resizeObserverRef.current?.disconnect()
      const app = appRef.current
      app?.stage.removeAllListeners()
      app?.destroy(true)
      registerApp(null)
      appRef.current = null
      contentRef.current = null
      backgroundRef.current = null
      // 移除全局滚轮事件监听器
      if (handleGlobalWheel) {
        window.removeEventListener('wheel', handleGlobalWheel)
        handleGlobalWheel = null
      }
    }
  }, [clearSelection, mutateElements, panBy, registerApp, performResize, setSelection, renderPage])

  /**
 * 处理元素指针按下事件
 * 
 * @function handleElementPointerDown
 * @param {FederatedPointerEvent} event - 指针事件对象
 * @param {string} elementId - 被点击的元素 ID
 * 
 * @description 
 * 处理元素点击和拖动开始：
 * 1. 根据修饰键决定是添加到选择还是替换选择
 * 2. 更新选择状态
 * 3. 初始化拖动状态
 */
  const handleElementPointerDown = useCallback(
    (event: FederatedPointerEvent, elementId: string) => {
      event.stopPropagation()
      if (stateRef.current.interactionMode !== "select") return
      const { selectedIds, elements } = stateRef.current
      const nativeEvent = event.originalEvent as unknown as
        | {
          shiftKey?: boolean
          metaKey?: boolean
          ctrlKey?: boolean
        }
        | undefined
      // 检查是否按下了修饰键（Shift/Ctrl/Cmd），用于多选
      const additive = Boolean(
        nativeEvent?.shiftKey || nativeEvent?.metaKey || nativeEvent?.ctrlKey
      )
      // 计算新的选择状态
      const selection = additive
        ? Array.from(new Set([...selectedIds, elementId]))  // 添加到现有选择
        : selectedIds.includes(elementId)
          ? selectedIds                                      // 已选中则保持不变
          : [elementId]                                      // 否则只选中当前元素
      setSelection(selection)
      const content = contentRef.current
      if (!content) return
      const local = event.getLocalPosition(content)
      // 创建选中元素的快照，用于拖动时的位置计算
      const snapshot: Record<string, CanvasElement> = {}
      elements.forEach((el) => {
        if (selection.includes(el.id)) {
          snapshot[el.id] = cloneElement(el)
        }
      })
      // 初始化拖动状态
      dragRef.current = {
        ids: selection,
        startPointer: local,
        snapshot,
        historySnapshot: cloneElements(elements),
        moved: false,
      }
    }, [setSelection])

  /**
 * 处理调整大小开始事件
 * 
 * @function handleResizeStart
 * @param {FederatedPointerEvent} event - 指针事件对象
 * @param {string} elementId - 要调整大小的元素 ID
 * @param {ResizeDirection} direction - 调整大小的方向
 * 
 * @description 
 * 初始化元素调整大小操作：
 * 1. 验证当前是否为选择模式
 * 2. 查找目标元素
 * 3. 记录初始状态和指针位置
 */
  const handleResizeStart = useCallback(
    (event: FederatedPointerEvent, ids: string[], direction: ResizeDirection) => {
      event.stopPropagation()
      if (stateRef.current.interactionMode !== "select") return
      const content = contentRef.current
      if (!content) return

      const elements = stateRef.current.elements.filter(el => ids.includes(el.id))
      if (elements.length === 0) return

      const startElements: Record<string, CanvasElement> = {}
      elements.forEach(el => {
        startElements[el.id] = cloneElement(el)
      })

      const bounds = getBoundingBox(elements)
      if (!bounds) return

      const local = event.getLocalPosition(content)
      // 初始化调整大小状态
      resizeRef.current = {
        ids,
        direction,
        startPointer: local,
        startElements,
        startBounds: bounds,
        historySnapshot: cloneElements(stateRef.current.elements),
        moved: false,
      }
    },
    []
  )

  // 添加 renderElements 函数
  const renderElements = useCallback((
    content: Container,
    elements: CanvasElement[],
    currentState: typeof state
  ) => {
    content.removeChildren().forEach((child) => child.destroy({ children: true }))
    // 启用子元素排序（用于控制柄层级）
    content.sortableChildren = true

    // 为每个元素创建可视化表示

    elements.forEach(async (element) => {
      const selected = state.selectedIds.includes(element.id)
      const node = await createShape(element, state.interactionMode, (event) =>
        handleElementPointerDown(event, element.id)
      )
      node.zIndex = 1
      content.addChild(node)

      // 处理选中状态的调整手柄
      // 为选中的单个元素添加调整大小控制柄
      if (
        selected &&
        currentState.selectedIds.length === 1 &&
        currentState.interactionMode === "select"
      ) {
        const handlesLayer = createResizeHandlesLayer(
          element,
          currentState.zoom,
          resizeRef.current?.direction ?? null,
          state.selectedIds,
          handleResizeStart
        )
        content.addChild(handlesLayer)
      }
    })
  }, [handleElementPointerDown, handleResizeStart, state.interactionMode, state.selectedIds])

  const handleSelectionBoxPointerDown = useCallback(
    (event: FederatedPointerEvent) => {
      event.stopPropagation()
      if (stateRef.current.interactionMode !== "select") return

      const { selectedIds, elements } = stateRef.current
      const content = contentRef.current
      if (!content) return

      const local = event.getLocalPosition(content)
      const snapshot: Record<string, CanvasElement> = {}
      elements.forEach((el) => {
        if (selectedIds.includes(el.id)) {
          snapshot[el.id] = cloneElement(el)
        }
      })

      dragRef.current = {
        ids: selectedIds,
        startPointer: local,
        snapshot,
        historySnapshot: cloneElements(elements),
        moved: false,
      }
    },
    []
  )


  useEffect(() => {
    const content = contentRef.current
    const app = appRef.current
    if (!content || !app) return

    // 0. 渲染页面，并且是立即渲染，而不是用户交互触发的
    // renderElements(content, state.elements, state)

    content.removeChildren().forEach((child) => child.destroy({ children: true }))
    content.sortableChildren = true

    // 1. 渲染所有元素和单选框
    state.elements.forEach(async (element) => {
      const selected = state.selectedIds.includes(element.id)
      const node = await createShape(element, state.interactionMode, (event) =>
        handleElementPointerDown(event, element.id)
      )
      node.zIndex = 1
      content.addChild(node)

      if (selected) {
        const outline = createSelectionOutline(element)
        content.addChild(outline)
      }
    })

    // 2. 渲染控制点和多选包围盒
    if (
      state.interactionMode === "select" &&
      state.selectedIds.length > 0
    ) {
      // 获取所有选中的元素对象
      const selectedElements = state.elements.filter((el) => 
        state.selectedIds.includes(el.id)
      )

      // 处理多选情况（统一包围盒）
      if (selectedElements.length > 1) {
        // 计算整体包围盒
        const bounds = getBoundingBox(selectedElements)
        
        if (bounds) {
          // 2.1 绘制统一的外接框 (样式与单选一致)
          // 多选包围盒通常不旋转，rotation 设为 0
          const globalOutline = createSolidBoundsOutline({ ...bounds, rotation: 0 })
          content.addChild(globalOutline)

          // 2.2 绘制统一的控制点 (非拖动状态下)
          if (!dragRef.current?.moved) {
            const handlesLayer = createBoundsHandlesLayer({
              bounds: { ...bounds, rotation: 0 },
              zoom: state.zoom,
              activeDirection: resizeRef.current?.direction ?? null,
              isMultiSelection: false,
              selectedIds: state.selectedIds, // 传入所有ID，以便 resize 时同时操作它们
              handleResizeStart,
            })
            content.addChild(handlesLayer)
          }
        }
      } 
      // 处理单选情况 
      else if (selectedElements.length === 1) {
        const element = selectedElements[0]
        // 单选时，createShape 循环里已经画了虚线框，这里只负责画 ResizeHandles (控制点)
        if (!dragRef.current?.moved) {
          const handlesLayer = createResizeHandlesLayer(
            element,
            state.zoom,
            resizeRef.current?.direction ?? null,
            state.selectedIds,
            handleResizeStart
          )
          content.addChild(handlesLayer)
        }
      }
    }
  }, [
    state,
    state.elements,
    state.selectedIds,
    state.interactionMode,
    state.zoom,
    handleElementPointerDown,
    handleResizeStart,
    handleSelectionBoxPointerDown,
    renderElements,
    renderPage,
  ])

  // 更新画布内容的位置和缩放
  useEffect(() => {
    const content = contentRef.current
    const guides = guidesRef.current
    if (!content) return
    // 根据平移和缩放状态更新内容容器的变换
    content.position.set(state.pan.x, state.pan.y)
    content.scale.set(state.zoom)
    
    if (guides) {
      guides.position.set(state.pan.x, state.pan.y)
      guides.scale.set(state.zoom)
    }
  }, [state.pan, state.zoom])

  // 更新背景光标样式
  useEffect(() => {
    const background = backgroundRef.current
    if (!background) return
    // 根据交互模式设置光标样式：平移模式显示抓手光标
    background.cursor = state.interactionMode === "pan" ? "grab" : "default"
  }, [state.interactionMode])

  // 检查选中元素是否为组
  const isGroupSelected = state.selectedIds.length === 1 &&
    state.elements.find(el => el.id === state.selectedIds[0] && el.type === 'group') as GroupElement;

  // 处理键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否按下了Ctrl或Cmd键
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // 打组快捷键: Ctrl+G
      if (isCtrlOrCmd && event.key.toLowerCase() === 'g' && !event.shiftKey) {
        event.preventDefault();
        // 只有选中至少两个元素时才执行打组
        if (state.selectedIds.length >= 2) {
          groupElements();
        }
      }

      // 解组快捷键: Ctrl+Shift+G
      if (isCtrlOrCmd && event.key.toLowerCase() === 'g' && event.shiftKey) {
        event.preventDefault();
        // 只有选中一个组时才执行解组
        if (isGroupSelected) {
          ungroupElements();
        }
      }
    };

    // 添加键盘事件监听器
    document.addEventListener('keydown', handleKeyDown);

    // 清理事件监听器
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.selectedIds, isGroupSelected, groupElements, ungroupElements])

  /**
 * 初始化 PixiJS 应用和设置事件监听器
 * 
 * @description 
 * 这个 useEffect 负责：
 * 1. 创建和初始化 PixiJS 应用实例
 * 2. 设置背景层和内容层
 * 3. 配置事件监听器（指针按下、移动、释放）
 * 4. 设置容器大小变化观察器
 * 5. 在组件卸载时清理资源
 */
  useEffect(() => {
    let destroyed = false

    // 更新背景层大小和交互区域
    const updateBackground = () => {
      const app = appRef.current
      const background = backgroundRef.current
      if (!app || !background) return
      background.clear()
      background.rect(0, 0, app.screen.width, app.screen.height)
      background.fill({ color: 0xffffff, alpha: 0 })
      background.hitArea = app.screen
    }

    // 初始化 PixiJS 应用
    const setup = async () => {
      if (!wrapperRef.current) return
      const app = new Application()
      await app.init({
        antialias: true,                    // 启用抗锯齿
        backgroundAlpha: 0,                  // 透明背景
        resolution: window.devicePixelRatio || 1,  // 设备像素比
        resizeTo: wrapperRef.current,       // 自动调整大小到容器
      })
      if (destroyed) {
        app.destroy()
        return
      }

      // 将画布添加到 DOM
      wrapperRef.current.appendChild(app.canvas)

      // 设置舞台交互模式
      app.stage.eventMode = "static"
      app.stage.hitArea = app.screen
      app.stage.sortableChildren = true // 启用子元素排序

      // 创建背景层（用于处理画布点击和平移）
      const background = new Graphics()
      background.alpha = 0
      background.eventMode = "static"
      background.cursor = "default"
      background.hitArea = app.screen
      app.stage.addChild(background)

      // 创建内容层（用于存放所有画布元素）
      const content = new Container()
      content.eventMode = "static"
      app.stage.addChild(content)

      // 创建辅助线层
      const guides = new Graphics()
      guides.eventMode = "none" // 不参与交互
      guides.zIndex = 9999 // 确保在最上层
      app.stage.addChild(guides)
      guidesRef.current = guides

      // 保存引用
      appRef.current = app
      contentRef.current = content
      backgroundRef.current = background
      registerApp(app)

      // 立即渲染现有元素
      if (stateRef.current.elements.length > 0) {
        renderElements(content, stateRef.current.elements, stateRef.current)
      }

      // 设置容器大小变化观察器
      const resizeObserver = new ResizeObserver(() => {
        app.resize()
        updateBackground()
      })
      resizeObserver.observe(wrapperRef.current)
      resizeObserverRef.current = resizeObserver

      // 背景层指针按下事件处理
      background.on("pointerdown", (event: FederatedPointerEvent) => {
        // 处理右键点击
        if (event.originalEvent && (event.originalEvent as any).button === 2) {
          event.preventDefault();
          return;
        }

        // 平移模式：初始化平移状态
        if (stateRef.current.interactionMode === "pan") {
          panRef.current = {
            lastPointer: { x: event.global.x, y: event.global.y },
          }
          background.cursor = "grabbing"
        }
        // 选择模式：处理区域选择
        else if (stateRef.current.interactionMode === "select") {
          const nativeEvent = event.originalEvent as unknown as MouseEvent;
          // 只有在没有修饰键且点击的是背景时才开始区域选择
          if (!(nativeEvent.shiftKey || nativeEvent.metaKey || nativeEvent.ctrlKey) && event.target === background) {
            // 记录选择开始位置
            const localPos = event.getLocalPosition(content);
            selectionStartRef.current = { x: localPos.x, y: localPos.y };
            isSelectedRef.current = true;

            // 创建选择框
            const selectionBox = new Graphics();
            selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
            selectionBox.fill({ color: SELECTION_COLOR, alpha: 0.1 });
            selectionBox.zIndex = 100;
            content.addChild(selectionBox);
            selectionBoxRef.current = selectionBox;
          }
        } else {
          // 其他模式：清除选择
          clearSelection()
        }
      })

      // 定义阻止浏览器默认右键菜单的函数
      preventContextMenu = (e: Event) => {
        e.preventDefault();
      };

      // 处理右键菜单
      const handleRightClick = (event: FederatedPointerEvent) => {
        event.preventDefault();

        // 只有在选择模式下才显示右键菜单
        if (stateRef.current.interactionMode !== "select") {
          return;
        }

        // 获取事件的屏幕坐标
        const originalEvent = event.originalEvent as any;
        const x = originalEvent.clientX;
        const y = originalEvent.clientY;

        setRightClickMenu({
          isVisible: true,
          x,
          y
        });
      };

      // 为舞台添加右键事件监听器
      app.stage.on("rightclick", handleRightClick);

      // 在canvas元素上添加contextmenu事件监听器，完全阻止浏览器默认右键菜单
      if (appRef.current && appRef.current.canvas) {
        appRef.current.canvas.addEventListener('contextmenu', preventContextMenu);
      }

      // 定义滚轮事件处理函数
      const handleGlobalWheel = (event: WheelEvent) => {
        // 检查是否按下了ctrl键或meta键（Mac）
        if (event.ctrlKey || event.metaKey) {
          // 无论鼠标是否在画布上，都阻止浏览器默认缩放行为
          event.preventDefault();
          event.stopPropagation();

          // 获取画布元素
          const canvas = app.canvas;
          const rect = canvas.getBoundingClientRect();

          // 检查鼠标是否在画布范围内
          const isMouseInCanvas = (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );

          // 只有当鼠标在画布上时，才进行画布缩放
          if (isMouseInCanvas) {
            // 根据滚轮方向调整缩放比例
            const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = stateRef.current.zoom * zoomFactor;

            // 使用setZoom方法设置新的缩放级别
            setZoom(newZoom);
          }
          // 如果鼠标不在画布上，不执行任何缩放操作，但仍然阻止浏览器的默认缩放行为
        }
      };

      // 添加全局滚轮事件监听器
      window.addEventListener('wheel', handleGlobalWheel, { passive: false });

      // 舞台指针移动事件处理
      app.stage.on("pointermove", (event: FederatedPointerEvent) => {
        const content = contentRef.current
        if (!content) return

        // 区域选择处理：更新选择框大小
        if (isSelectedRef.current && selectionStartRef.current && selectionBoxRef.current) {
          const localPos = event.getLocalPosition(content);
          const start = selectionStartRef.current;

          // 计算选择框的位置和尺寸
          const x = Math.min(start.x, localPos.x);
          const y = Math.min(start.y, localPos.y);
          const width = Math.abs(start.x - localPos.x);
          const height = Math.abs(start.y - localPos.y);

          // 绘制选择框
          const selectionBox = selectionBoxRef.current;
          selectionBox.clear();
          selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
          selectionBox.beginFill(SELECTION_COLOR, 0.1);
          selectionBox.fill({ color: SELECTION_COLOR, alpha: 0.1 });
          selectionBox.drawRect(x, y, width, height);
          selectionBox.endFill();
          return;
        }

        // 调整大小处理：更新元素尺寸
        if (resizeRef.current) {
          const current = resizeRef.current
          const local = event.getLocalPosition(content)
          const dx = local.x - current.startPointer.x
          const dy = local.y - current.startPointer.y
          current.moved = true
          performResize(current, dx, dy)
          return
        }

        // 拖动处理：更新元素位置
        if (dragRef.current) {
          const current = dragRef.current
          const local = event.getLocalPosition(content)
          const dx = local.x - current.startPointer.x
          const dy = local.y - current.startPointer.y

          // Calculate snap
          const movingElements = stateRef.current.elements.filter(el => current.ids.includes(el.id));
          const zoom = stateRef.current.zoom;
          const { dx: snappedDx, dy: snappedDy, guides } = calculateSnap(
            movingElements,
            stateRef.current.elements,
            dx,
            dy,
            current.snapshot,
            5 / zoom // Adjust threshold based on zoom
          );
          
          currentGuidesRef.current = guides;

          // Draw guides immediately
          if (guidesRef.current) {
            const g = guidesRef.current;
            g.clear();
            if (guides.length > 0) {
              // Use a fixed width of at least 1px to ensure visibility
              const lineWidth = Math.max(1, 1 / zoom);
              
              const app = appRef.current;
              if (app) {
                const pan = stateRef.current.pan;
                const screen = app.screen;
                // Calculate visible bounds in local coordinates
                // Add extra padding to ensure lines go off-screen
                const padding = 5000 / zoom; 
                const minX = (-pan.x / zoom) - padding;
                const maxX = ((screen.width - pan.x) / zoom) + padding;
                const minY = (-pan.y / zoom) - padding;
                const maxY = ((screen.height - pan.y) / zoom) + padding;

                guides.forEach(guide => {
                  if (guide.type === 'horizontal') {
                    g.moveTo(minX, guide.coor);
                    g.lineTo(maxX, guide.coor);
                  } else {
                    g.moveTo(guide.coor, minY);
                    g.lineTo(guide.coor, maxY);
                  }
                });
                // PixiJS v8 way to stroke the path
                g.stroke({ width: lineWidth, color: 0x947eec, alpha: 1 });
              }
            }
          }

          // 只有移动距离足够大才认为是拖动（避免误触）
          if (Math.abs(snappedDx) > 0.01 || Math.abs(snappedDy) > 0.01) {
            current.moved = true
            mutateElements(
              (elements) =>
                elements.map((el) => {
                  if (!current.ids.includes(el.id)) return el
                  const base = current.snapshot[el.id] ?? el
                  return { ...el, x: base.x + snappedDx, y: base.y + snappedDy }
                }) as CanvasElement[],
              { recordHistory: false }
            )
          }
          return
        }
      } 
      // 处理单选情况 
      else if (selectedElements.length === 1) {
        const element = selectedElements[0]
        // 单选时，createShape 循环里已经画了虚线框，这里只负责画 ResizeHandles (控制点)
        if (!dragRef.current?.moved) {
          const handlesLayer = createResizeHandlesLayer(
            element,
            state.zoom,
            resizeRef.current?.direction ?? null,
            state.selectedIds,
            handleResizeStart,
            handleRotateStart
          )
          content.addChild(handlesLayer)
        }
      }
    }
    if (rotateRef.current) {
      const el = state.elements.find(e => e.id === rotateRef.current?.id)
      if (el) {
        // 创建新的 tooltip
        const tooltip = createRotateTooltip(el, state.zoom)
        
        // 确保 Tooltip 在最上层
        tooltip.zIndex = 100 
        content.addChild(tooltip)
        
        // 更新引用以便销毁（虽然在 removeChildren 中会被自动销毁，但保持引用是个好习惯）
        rotateRef.current.tooltip = tooltip
      }
    }


  }, [
    state,
    state.elements,
    state.selectedIds,
    state.interactionMode,
    state.zoom,
    handleElementPointerDown,
    handleResizeStart,
    handleSelectionBoxPointerDown,
    renderElements,
    renderPage,
  ])

      // 停止所有交互操作
      const stopInteractions = () => {
        // 区域选择完成处理
        if (isSelectedRef.current && selectionBoxRef.current && selectionStartRef.current) {
          const selectionBox = selectionBoxRef.current;
          // 获取选择框的边界
          const bounds = selectionBox.getBounds();
          const selectionRect = new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);

          // 找出与选择框相交的所有元素
          const selectedElements = stateRef.current.elements.filter(elem => {
            const elemRect = new Rectangle(elem.x, elem.y, elem.width, elem.height);
            return selectionRect.intersects(elemRect); // 检查元素是否与选择框相交
          });

          // 更新选择状态
          if (selectedElements.length > 0) {
            setSelection(selectedElements.map((el) => el.id));
          } else {
            clearSelection();
          }

          // 清除选择框
          selectionBox.destroy();
          selectionBoxRef.current = null;
        }

        // 重置区域选择状态
        isSelectedRef.current = false;
        selectionStartRef.current = null;

        // 重置平移光标
        const background = backgroundRef.current
        if (panRef.current && background) {
          background.cursor = "default"
        }

        // 记录拖动操作的历史
        if (dragRef.current?.moved) {
          currentGuidesRef.current = [];
          if (guidesRef.current) {
            guidesRef.current.clear();
          }
          mutateElements(
            (elements) => elements,
            {
              historySnapshot: dragRef.current.historySnapshot,
            }
          )
        }

        // 记录调整大小操作的历史
        if (resizeRef.current?.moved) {
          mutateElements(
            (elements) => elements,
            {
              historySnapshot: resizeRef.current.historySnapshot,
            }
          )
        }

        // 清除所有交互状态
        dragRef.current = null
        resizeRef.current = null
        panRef.current = null
      }

      app.stage.on("pointerup", stopInteractions)
      app.stage.on("pointerupoutside", stopInteractions)
    }

    setup()

    return () => {
      destroyed = true
      resizeObserverRef.current?.disconnect()
      const app = appRef.current
      app?.stage.removeAllListeners()
      app?.destroy(true)
      registerApp(null)
      appRef.current = null
      contentRef.current = null
      backgroundRef.current = null
      // 移除全局滚轮事件监听器
      if (handleGlobalWheel) {
        window.removeEventListener('wheel', handleGlobalWheel)
        handleGlobalWheel = null
      }
    }
  }, [clearSelection, mutateElements, panBy, registerApp, performResize, setSelection, renderPage])

  // 准备右键菜单项
  const menuItems = [
    // 打组选项 - 只有选中多个元素时才可用
    {
      label: '打组 (Ctrl+G)',
      onClick: () => {
        if (state.selectedIds.length >= 2) {
          groupElements();
          setRightClickMenu({ isVisible: false, x: 0, y: 0 });
        }
      },
      disabled: state.selectedIds.length < 2
    },
    // 解组选项 - 只有选中一个组时才可用
    {
      label: '解组 (Ctrl+Shift+G)',
      onClick: () => {
        if (isGroupSelected) {
          ungroupElements();
          setRightClickMenu({ isVisible: false, x: 0, y: 0 });
        }
      },
      disabled: !isGroupSelected
    }
  ];

  // 渲染画布容器和右键菜单
  return (
    <div className="relative h-full w-full">
      <div ref={wrapperRef} className="h-full w-full rounded-[32px]" />
      <RightClickMenu
        items={menuItems}
        x={rightClickMenu.x}
        y={rightClickMenu.y}
        isVisible={rightClickMenu.isVisible}
        onClose={() => setRightClickMenu({ isVisible: false, x: 0, y: 0 })}
      />
    </div>
  )
}

