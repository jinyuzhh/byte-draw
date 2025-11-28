/**
 * @fileoverview Pixi 画布渲染组件
 * @file /src/components/canvas/PixiCanvas.tsx
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
  createResizeHandlesLayer,
  createSelectionOutline,
  createShape,
  createSolidBoundsOutline,
} from "./pixiRenderers"
import { RightClickMenu } from "./RightClickMenu"

export const PixiCanvas = () => {
  // --- 1. 全局变量声明 ---
  let handleGlobalWheel: ((event: WheelEvent) => void) | null = null;
  let preventContextMenu: ((e: Event) => void) | null = null;

  // --- 2. Hooks 和 状态获取 ---
  const {
    state,
    isInitialized,
    setSelection,
    clearSelection,
    mutateElements,
    panBy,
    registerApp,
    setZoom,
    groupElements,
    ungroupElements,
  } = useCanvas()

  // --- 3. Refs 定义 ---
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const contentRef = useRef<Container | null>(null)
  const backgroundRef = useRef<Graphics | null>(null)
  const guidesRef = useRef<Graphics | null>(null)
  const currentGuidesRef = useRef<GuideLine[]>([])

  const rotateRef = useRef<{
    id: string
    startRotation: number
    centerX: number
    centerY: number
    startAngle: number
    snapshot: CanvasElement[]
    tooltip: Container | null
  } | null>(null)

  const dragRef = useRef<{
    ids: string[]
    startPointer: { x: number; y: number }
    snapshot: Record<string, CanvasElement>
    historySnapshot: CanvasElement[]
    moved: boolean
  } | null>(null)

  const resizeRef = useRef<{
    ids: string[]
    direction: ResizeDirection
    startPointer: { x: number; y: number }
    startElements: Record<string, CanvasElement>
    startBounds: { x: number; y: number; width: number; height: number }
    historySnapshot: CanvasElement[]
    moved: boolean
  } | null>(null)

  const panRef = useRef<{ lastPointer: { x: number; y: number } } | null>(null)
  const stateRef = useRef(state)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const selectionBoxRef = useRef<Graphics | null>(null)
  const isSelectedRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  const [renderPage, setRenderPage] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [rightClickMenu, setRightClickMenu] = useState({
    isVisible: false,
    x: 0,
    y: 0,
  })

  // --- 4. 辅助函数 ---
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const toDeg = (rad: number) => rad * (180 / Math.PI);

  // --- 5. Effect: 初始化状态标记 ---
  useEffect(() => {
    if (isInitialized && !hasInitialized && state.elements.length > 0) {
      setHasInitialized(true);
      setRenderPage(prev => prev + 1);
    }
  }, [isInitialized, hasInitialized, state.elements.length])

  // --- 6. Effect: 同步 stateRef ---
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // --- 7. Callbacks: 交互逻辑 ---
  
  const handleRotateStart = useCallback((event: FederatedPointerEvent, id: string) => {
    event.stopPropagation()
    const content = contentRef.current
    if (!content) return

    const element = stateRef.current.elements.find(el => el.id === id)
    if (!element) return

    const localPoint = event.getLocalPosition(content)
    const rotationRad = toRad(element.rotation)
    const w2 = element.width / 2
    const h2 = element.height / 2
    const cos = Math.cos(rotationRad)
    const sin = Math.sin(rotationRad)
    const centerX = element.x + w2 * cos - h2 * sin
    const centerY = element.y + w2 * sin + h2 * cos
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

  const handleElementPointerDown = useCallback(
    (event: FederatedPointerEvent, elementId: string) => {
      event.stopPropagation()
      if (stateRef.current.interactionMode !== "select") return
      const { selectedIds, elements } = stateRef.current
      const nativeEvent = event.originalEvent as unknown as { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } | undefined
      const additive = Boolean(nativeEvent?.shiftKey || nativeEvent?.metaKey || nativeEvent?.ctrlKey)
      
      const selection = additive
        ? Array.from(new Set([...selectedIds, elementId]))
        : selectedIds.includes(elementId) ? selectedIds : [elementId]
      
      setSelection(selection)
      
      const content = contentRef.current
      if (!content) return
      const local = event.getLocalPosition(content)
      const snapshot: Record<string, CanvasElement> = {}
      elements.forEach((el) => {
        if (selection.includes(el.id)) {
          snapshot[el.id] = cloneElement(el)
        }
      })
      
      dragRef.current = {
        ids: selection,
        startPointer: local,
        snapshot,
        historySnapshot: cloneElements(elements),
        moved: false,
      }
    }, [setSelection])

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
      const newBounds = { ...startBounds }

      if (direction.includes("e")) newBounds.width = Math.max(MIN_ELEMENT_SIZE, startBounds.width + dx)
      if (direction.includes("s")) newBounds.height = Math.max(MIN_ELEMENT_SIZE, startBounds.height + dy)
      if (direction.includes("w")) {
        const updatedWidth = Math.max(MIN_ELEMENT_SIZE, startBounds.width - dx)
        const delta = startBounds.width - updatedWidth
        newBounds.width = updatedWidth
        newBounds.x = startBounds.x + delta
      }
      if (direction.includes("n")) {
        const updatedHeight = Math.max(MIN_ELEMENT_SIZE, startBounds.height - dy)
        const delta = startBounds.height - updatedHeight
        newBounds.height = updatedHeight
        newBounds.y = startBounds.y + delta
      }

      const scaleX = startBounds.width > 0 ? newBounds.width / startBounds.width : 1
      const scaleY = startBounds.height > 0 ? newBounds.height / startBounds.height : 1

      mutateElements(
        (elements) => elements.map((el) => {
            if (!ids.includes(el.id)) return el
            const startEl = startElements[el.id]
            if (!startEl) return el

            const newX = newBounds.x + (startEl.x - startBounds.x) * scaleX
            const newY = newBounds.y + (startEl.y - startBounds.y) * scaleY
            const newWidth = Math.max(MIN_ELEMENT_SIZE, startEl.width * scaleX)
            const newHeight = Math.max(MIN_ELEMENT_SIZE, startEl.height * scaleY)

            if (el.type === 'group' && 'children' in el && Array.isArray(el.children)) {
              const startGroup = startEl as typeof el;
              if (startGroup.children) {
                const scaledChildren = startGroup.children.map(child => ({
                  ...child,
                  x: child.x * scaleX,
                  y: child.y * scaleY,
                  width: Math.max(MIN_ELEMENT_SIZE, child.width * scaleX),
                  height: Math.max(MIN_ELEMENT_SIZE, child.height * scaleY)
                }));
                return { ...el, x: newX, y: newY, width: newWidth, height: newHeight, children: scaledChildren };
              }
            }
            return { ...el, x: newX, y: newY, width: newWidth, height: newHeight }
          }) as CanvasElement[],
        { recordHistory: false }
      )
    },
    [mutateElements]
  )

  // --- 8. renderElements 定义 (关键修复点：必须在 useEffect 之前) ---
  const renderElements = useCallback((
    content: Container,
    elements: CanvasElement[],
    currentState: typeof state
  ) => {
    content.removeChildren().forEach((child) => child.destroy({ children: true }))
    content.sortableChildren = true

    elements.forEach(async (element) => {
      const selected = state.selectedIds.includes(element.id)
      const node = await createShape(element, state.interactionMode, (event) =>
        handleElementPointerDown(event, element.id)
      )
      node.zIndex = 1
      content.addChild(node)

      if (selected && currentState.selectedIds.length === 1 && currentState.interactionMode === "select") {
        const handlesLayer = createResizeHandlesLayer(
          element,
          currentState.zoom,
          resizeRef.current?.direction ?? null,
          state.selectedIds,
          handleResizeStart,
          handleRotateStart
        )
        content.addChild(handlesLayer)
      }
    })
  }, [handleElementPointerDown, handleResizeStart, handleRotateStart, state.interactionMode, state.selectedIds])

  // --- 9. Effect: 主渲染循环 (监听 state 变化) ---
  useEffect(() => {
    const content = contentRef.current
    const app = appRef.current
    if (!content || !app) return

    content.removeChildren().forEach((child) => child.destroy({ children: true }))
    content.sortableChildren = true

    // 1. 渲染元素
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

    // 2. 渲染控制层
    if (state.interactionMode === "select" && state.selectedIds.length > 0) {
      const selectedElements = state.elements.filter((el) => state.selectedIds.includes(el.id))

      if (selectedElements.length > 1) {
        const bounds = getBoundingBox(selectedElements)
        if (bounds) {
          const globalOutline = createSolidBoundsOutline({ ...bounds, rotation: 0 })
          content.addChild(globalOutline)

          if (!dragRef.current?.moved) {
            const handlesLayer = createBoundsHandlesLayer({
              bounds: { ...bounds, rotation: 0 },
              zoom: state.zoom,
              activeDirection: resizeRef.current?.direction ?? null,
              isMultiSelection: false,
              selectedIds: state.selectedIds,
              handleResizeStart,
            })
            content.addChild(handlesLayer)
          }
        }
      } else if (selectedElements.length === 1) {
        const element = selectedElements[0]
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

    // 3. 渲染旋转提示
    if (rotateRef.current) {
      const el = state.elements.find(e => e.id === rotateRef.current?.id)
      if (el) {
        const tooltip = createRotateTooltip(el, state.zoom)
        tooltip.zIndex = 100 
        content.addChild(tooltip)
        rotateRef.current.tooltip = tooltip

        const w2 = el.width / 2
        const h2 = el.height / 2
        const rotationRad = toRad(el.rotation) 
        const cos = Math.cos(rotationRad)
        const sin = Math.sin(rotationRad)
        const cx = el.x + w2 * cos - h2 * sin
        const cy = el.y + w2 * sin + h2 * cos
        const boundsRadius = Math.sqrt(w2 * w2 + h2 * h2)
        const offset = boundsRadius + (20 / state.zoom)

        tooltip.position.set(cx, cy + offset)
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
    handleRotateStart,
    handleSelectionBoxPointerDown,
    // renderElements, // 可以不依赖这个，因为逻辑已经内联了
    renderPage,
  ])

  // --- 10. Effect: 视图变换同步 ---
  useEffect(() => {
    const content = contentRef.current
    const guides = guidesRef.current
    if (!content) return
    content.position.set(state.pan.x, state.pan.y)
    content.scale.set(state.zoom)
    
    if (guides) {
      guides.position.set(state.pan.x, state.pan.y)
      guides.scale.set(state.zoom)
    }
  }, [state.pan, state.zoom])

  // --- 11. Effect: 光标样式 ---
  useEffect(() => {
    const background = backgroundRef.current
    if (!background) return
    background.cursor = state.interactionMode === "pan" ? "grab" : "default"
  }, [state.interactionMode])

  // --- 12. Effect: 键盘快捷键 ---
  const isGroupSelected = state.selectedIds.length === 1 &&
    state.elements.find(el => el.id === state.selectedIds[0] && el.type === 'group') as GroupElement;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      // 打组快捷键: Ctrl+G
      if (isCtrlOrCmd && event.key.toLowerCase() === 'g' && !event.shiftKey) {
        event.preventDefault();
        if (state.selectedIds.length >= 2) {
          groupElements();
        }
      }
      // 解组快捷键: Ctrl+Shift+G
      if (isCtrlOrCmd && event.key.toLowerCase() === 'g' && event.shiftKey) {
        event.preventDefault();
        if (isGroupSelected) {
          ungroupElements();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (appRef.current && appRef.current.canvas && preventContextMenu) {
        appRef.current.canvas.removeEventListener('contextmenu', preventContextMenu);
        preventContextMenu = null;
      }
    };
  }, [state.selectedIds, isGroupSelected, groupElements, ungroupElements])

  // --- 13. Effect: 初始化 PixiJS (SETUP) ---
  useEffect(() => {
    let destroyed = false

    const updateBackground = () => {
      const app = appRef.current
      const background = backgroundRef.current
      if (!app || !background) return
      background.clear()
      background.rect(0, 0, app.screen.width, app.screen.height)
      background.fill({ color: 0xffffff, alpha: 0 })
      background.hitArea = app.screen
    }

    const setup = async () => {
      if (!wrapperRef.current) return
      const app = new Application()
      await app.init({
        antialias: true,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        resizeTo: wrapperRef.current,
      })
      if (destroyed) {
        app.destroy()
        return
      }

      wrapperRef.current.appendChild(app.canvas)
      app.stage.eventMode = "static"
      app.stage.hitArea = app.screen
      app.stage.sortableChildren = true 

      const background = new Graphics()
      background.alpha = 0
      background.eventMode = "static"
      background.cursor = "default"
      background.hitArea = app.screen
      app.stage.addChild(background)

      const content = new Container()
      content.eventMode = "static"
      app.stage.addChild(content)

      const guides = new Graphics()
      guides.eventMode = "none" 
      guides.zIndex = 9999
      app.stage.addChild(guides)
      guidesRef.current = guides

      appRef.current = app
      contentRef.current = content
      backgroundRef.current = background
      registerApp(app)

      if (stateRef.current.elements.length > 0) {
        renderElements(content, stateRef.current.elements, stateRef.current)
      }

      const resizeObserver = new ResizeObserver(() => {
        app.resize()
        updateBackground()
      })
      resizeObserver.observe(wrapperRef.current)
      resizeObserverRef.current = resizeObserver

      background.on("pointerdown", (event: FederatedPointerEvent) => {
        if (event.originalEvent && (event.originalEvent as any).button === 2) {
          event.preventDefault();
          return;
        }
        if (stateRef.current.interactionMode === "pan") {
          panRef.current = {
            lastPointer: { x: event.global.x, y: event.global.y },
          }
          background.cursor = "grabbing"
        }
        else if (stateRef.current.interactionMode === "select") {
          const nativeEvent = event.originalEvent as unknown as MouseEvent;
          if (!(nativeEvent.shiftKey || nativeEvent.metaKey || nativeEvent.ctrlKey) && event.target === background) {
            const localPos = event.getLocalPosition(content);
            selectionStartRef.current = { x: localPos.x, y: localPos.y };
            isSelectedRef.current = true;

            const selectionBox = new Graphics();
            selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
            selectionBox.fill({ color: SELECTION_COLOR, alpha: 0.1 });
            selectionBox.zIndex = 100;
            content.addChild(selectionBox);
            selectionBoxRef.current = selectionBox;
          }
        } else {
          clearSelection()
        }
      })

      preventContextMenu = (e: Event) => { e.preventDefault(); };

      const handleRightClick = (event: FederatedPointerEvent) => {
        event.preventDefault();
        if (stateRef.current.interactionMode !== "select") return;
        const originalEvent = event.originalEvent as any;
        setRightClickMenu({
          isVisible: true,
          x: originalEvent.clientX,
          y: originalEvent.clientY
        });
      };

      app.stage.on("rightclick", handleRightClick);
      if (appRef.current && appRef.current.canvas) {
        appRef.current.canvas.addEventListener('contextmenu', preventContextMenu);
      }
    })

      const handleGlobalWheelInternal = (event: WheelEvent) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          const canvas = app.canvas;
          const rect = canvas.getBoundingClientRect();
          const isMouseInCanvas = (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );
          if (isMouseInCanvas) {
            const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = stateRef.current.zoom * zoomFactor;
            setZoom(newZoom);
          }
        }
      };
      // 更新全局变量引用，以便清理
      handleGlobalWheel = handleGlobalWheelInternal;
      window.addEventListener('wheel', handleGlobalWheel, { passive: false });

      app.stage.on("pointermove", (event: FederatedPointerEvent) => {
        const content = contentRef.current
        if (!content) return

        if (isSelectedRef.current && selectionStartRef.current && selectionBoxRef.current) {
          const localPos = event.getLocalPosition(content);
          const start = selectionStartRef.current;
          const x = Math.min(start.x, localPos.x);
          const y = Math.min(start.y, localPos.y);
          const width = Math.abs(start.x - localPos.x);
          const height = Math.abs(start.y - localPos.y);
          const selectionBox = selectionBoxRef.current;
          selectionBox.clear();
          selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
          selectionBox.beginFill(SELECTION_COLOR, 0.1);
          selectionBox.fill({ color: SELECTION_COLOR, alpha: 0.1 });
          selectionBox.drawRect(x, y, width, height);
          selectionBox.endFill();
          return;
        }
      }

        if (resizeRef.current) {
          const current = resizeRef.current
          const local = event.getLocalPosition(content)
          const dx = local.x - current.startPointer.x
          const dy = local.y - current.startPointer.y
          current.moved = true
          performResize(current, dx, dy)
          return
        }
        
        if (rotateRef.current) {
          const { centerX, centerY, startAngle, startRotation, id } = rotateRef.current
          const local = event.getLocalPosition(content)
          const currentMouseAngle = Math.atan2(local.y - centerY, local.x - centerX)
          let deltaRad = currentMouseAngle - startAngle
          let newRotationDeg = startRotation + toDeg(deltaRad)

          if (event.shiftKey) {
            
            newRotationDeg = Math.round(newRotationDeg / SNAP_ANGLE) * SNAP_ANGLE
          }

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
              return { ...el, rotation: newRotationDeg, x: newX, y: newY }
            }),
            { recordHistory: false }
          )
          return 
        }

        if (dragRef.current) {
          const current = dragRef.current
          const local = event.getLocalPosition(content)
          const dx = local.x - current.startPointer.x
          const dy = local.y - current.startPointer.y

          const movingElements = stateRef.current.elements.filter(el => current.ids.includes(el.id));
          const zoom = stateRef.current.zoom;
          const { dx: snappedDx, dy: snappedDy, guides } = calculateSnap(
            movingElements,
            stateRef.current.elements,
            dx,
            dy,
            current.snapshot,
            5 / zoom 
          );
          
          currentGuidesRef.current = guides;

          if (guidesRef.current) {
            const g = guidesRef.current;
            g.clear();
            if (guides.length > 0) {
              const lineWidth = Math.max(1, 1 / zoom);
              const app = appRef.current;
              if (app) {
                const pan = stateRef.current.pan;
                const screen = app.screen;
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
                g.stroke({ width: lineWidth, color: 0x947eec, alpha: 1 });
              }
            }
          }

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

        if (panRef.current) {
          const last = panRef.current.lastPointer
          const dx = event.global.x - last.x
          const dy = event.global.y - last.y
          panRef.current.lastPointer = { x: event.global.x, y: event.global.y }
          panBy({ x: dx, y: dy })
        }
      })

      const stopInteractions = () => {
        if (rotateRef.current) {
            mutateElements(
            (elements) => elements, 
            { 
              historySnapshot: rotateRef.current.snapshot
            }
          )
          if (rotateRef.current.tooltip) {
            rotateRef.current.tooltip = null
          }
          rotateRef.current = null
        }
        
        if (isSelectedRef.current && selectionBoxRef.current && selectionStartRef.current) {
          const selectionBox = selectionBoxRef.current;
          const bounds = selectionBox.getBounds();
          const selectionRect = new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
          const selectedElements = stateRef.current.elements.filter(elem => {
            const elemRect = new Rectangle(elem.x, elem.y, elem.width, elem.height);
            return selectionRect.intersects(elemRect); 
          });
          if (selectedElements.length > 0) {
            setSelection(selectedElements.map((el) => el.id));
          } else {
            clearSelection();
          }
          selectionBox.destroy();
          selectionBoxRef.current = null;
        }

        isSelectedRef.current = false;
        selectionStartRef.current = null;

        const background = backgroundRef.current
        if (panRef.current && background) {
          background.cursor = "default"
        }

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

        if (resizeRef.current?.moved) {
          mutateElements(
            (elements) => elements,
            {
              historySnapshot: resizeRef.current.historySnapshot,
            }
          )
        }

        dragRef.current = null
        resizeRef.current = null
        panRef.current = null
      }

      // 设置容器大小变化观察器
      const resizeObserver = new ResizeObserver(() => {
        app.resize()
        updateBackground()
      })
      resizeObserver.observe(wrapperRef.current)
      resizeObserverRef.current = resizeObserver

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
      if (handleGlobalWheel) {
        window.removeEventListener('wheel', handleGlobalWheel)
        handleGlobalWheel = null
      }
    }
  }, [clearSelection, mutateElements, panBy, registerApp, performResize, setSelection, renderPage])

  const menuItems = [
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
