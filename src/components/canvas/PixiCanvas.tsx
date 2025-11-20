import { useEffect, useRef, useCallback, useState } from "react"
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  BlurFilter,
  ColorMatrixFilter,
  FederatedPointerEvent,
  Rectangle,
  Texture,
} from "pixi.js"
import type { TextStyleFontWeight } from "pixi.js"
import { useCanvas } from "../../store/CanvasProvider"
import type { CanvasElement } from "../../types/canvas"

type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

const RESIZE_DIRECTIONS: ResizeDirection[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
]

const RESIZE_CURSORS: Record<ResizeDirection, string> = {
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
  nw: "nwse-resize",
}

const MIN_ELEMENT_SIZE = 0
const clampSize = (value: number) => Math.max(MIN_ELEMENT_SIZE, value)
const SELECTION_COLOR = 0x39b5ff
const HANDLE_ACTIVE_COLOR = 0x00cae0

const getBoundingBox = (elements: CanvasElement[]) => {
  if (elements.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  elements.forEach((el) => {
    minX = Math.min(minX, el.x)
    minY = Math.min(minY, el.y)
    maxX = Math.max(maxX, el.x + el.width)
    maxY = Math.max(maxY, el.y + el.height)
  })

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

const hexToNumber = (value: string) =>
  Number.parseInt(value.replace("#", ""), 16)

const cloneElements = (elements: CanvasElement[]) => {
  if (typeof structuredClone === "function") {
    return structuredClone(elements)
  }
  return JSON.parse(JSON.stringify(elements))
}

const cloneElement = (element: CanvasElement): CanvasElement =>
  cloneElements([element])[0]

const getHandlePosition = (
  direction: ResizeDirection,
  width: number,
  height: number
) => {
  switch (direction) {
    case "n":
      return { x: width / 2, y: 0 }
    case "e":
      return { x: width, y: height / 2 }
    case "s":
      return { x: width / 2, y: height }
    case "w":
      return { x: 0, y: height / 2 }
    case "nw":
      return { x: 0, y: 0 }
    case "ne":
      return { x: width, y: 0 }
    case "se":
      return { x: width, y: height }
    case "sw":
      return { x: 0, y: height }
    default:
      return { x: width, y: height }
  }
}

const createShape = (
  element: CanvasElement,
  interactionMode: "select" | "pan",
  onPointerDown: (event: FederatedPointerEvent) => void
) => {
  const container = new Container()
  container.position.set(element.x, element.y)
  container.angle = element.rotation
  container.alpha = element.opacity
  container.eventMode = "static"
  container.cursor = interactionMode === "select" ? "move" : "grab"
  container.hitArea = new Rectangle(0, 0, element.width, element.height)
  container.sortableChildren = true

  if (element.type === "shape") {
    const fill = new Graphics()
    const stroke = new Graphics()
    const fillColor = hexToNumber(element.fill)
    const strokeColor = hexToNumber(element.stroke)

    const drawPath = (target: Graphics) => {
      switch (element.shape) {
        case "rectangle":
          target.roundRect(
            0,
            0,
            element.width,
            element.height,
            Math.max(element.cornerRadius, 0)
          )
          break
        case "circle": {
          target.ellipse(
            element.width / 2,
            element.height / 2,
            element.width / 2,
            element.height / 2
          )
          break
        }
        case "triangle":
          target.moveTo(element.width / 2, 0)
          target.lineTo(element.width, element.height)
          target.lineTo(0, element.height)
          target.closePath()
          break
      }
    }

    drawPath(fill)
    fill.fill({ color: fillColor, alpha: 1 })
    container.addChild(fill)

    if (element.strokeWidth > 0) {
      drawPath(stroke)
      // 修复：确保描边宽度不会超过图形的最小尺寸，防止溢出
      const safeStrokeWidth = Math.min(
        element.strokeWidth,
        Math.abs(element.width),
        Math.abs(element.height)
      )

      stroke.stroke({
        width: safeStrokeWidth,
        color: strokeColor,
        alignment: 1,
        join: "round",
      })
      container.addChild(stroke)
    }
  }

  if (element.type === "text") {
    if (element.background !== "transparent") {
      const bg = new Graphics()
      bg.roundRect(0, 0, element.width, element.height, 12)
      bg.fill({ color: hexToNumber(element.background), alpha: 0.8 })
      container.addChild(bg)
    }
    const text = new Text({
      text: element.text,
      style: new TextStyle({
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        fontWeight: `${element.fontWeight}` as TextStyleFontWeight,
        fill: element.color,
        align: element.align,
        lineHeight: element.fontSize * element.lineHeight,
        wordWrap: true,
        wordWrapWidth: element.width,
      }),
    })
    text.position.set(12, 12)
    container.addChild(text)
  }

  if (element.type === "image") {
    const texture = Texture.from(element.src)
    const sprite = new Sprite(texture)
    sprite.eventMode = "none"
    sprite.width = element.width
    sprite.height = element.height
    const mask = new Graphics()
    mask.roundRect(0, 0, element.width, element.height, element.borderRadius)
    mask.fill({ color: 0xffffff })
    mask.alpha = 0
    mask.eventMode = "none"
    sprite.mask = mask
    const filters = []
    if (element.filters.blur > 0) {
      filters.push(new BlurFilter({ strength: element.filters.blur }))
    }
    if (element.filters.grayscale || element.filters.brightness !== 1) {
      const colorMatrix = new ColorMatrixFilter()
      if (element.filters.grayscale) {
        colorMatrix.greyscale(1, false)
      }
      if (element.filters.brightness !== 1) {
        colorMatrix.brightness(element.filters.brightness, false)
      }
      filters.push(colorMatrix)
    }
    sprite.filters = filters.length ? filters : undefined
    container.addChild(mask)
    container.addChild(sprite)
  }

  if (interactionMode === "select") {
    container.on("pointerdown", onPointerDown)
  }

  return container
}

export const PixiCanvas = () => {
  // 在组件顶部声明全局变量，确保在所有作用域内可用
  let handleGlobalWheel: ((event: WheelEvent) => void) | null = null;

  const {
    state,
    isInitialized, // 获取初始状态
    setSelection,
    clearSelection,
    mutateElements,
    panBy,
    registerApp,
    setZoom,
  } = useCanvas()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const contentRef = useRef<Container | null>(null)
  const backgroundRef = useRef<Graphics | null>(null)
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

  const selectionBoxRef = useRef<Graphics | null>(null) // reference to the selection box graphics object
  const isSelectedRef = useRef(false); // reference to the selection state, default as false 
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null); // reference to the start point of the selection box

  const [renderPage, setRenderPage] = useState(0); // 用于触发页面渲染

  useEffect(() => {
    if (isInitialized && state.elements.length > 0) {
      // 初始化成功，进行渲染
      setRenderPage(prev => prev + 1)
    }
  }, [isInitialized, state.elements.length])

  useEffect(() => {
    stateRef.current = state
  }, [state])

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
      if (direction.includes("s")) {
        newBounds.height = Math.max(MIN_ELEMENT_SIZE, startBounds.height + dy)
      }
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

      // 计算缩放比例
      const scaleX = startBounds.width > 0 ? newBounds.width / startBounds.width : 1
      const scaleY = startBounds.height > 0 ? newBounds.height / startBounds.height : 1

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

            return { ...el, x: newX, y: newY, width: newWidth, height: newHeight }
          }) as CanvasElement[],
        { recordHistory: false }
      )
    },
    [mutateElements]
  )

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
      const background = new Graphics()
      background.alpha = 0
      background.eventMode = "static"
      background.cursor = "default"
      background.hitArea = app.screen
      app.stage.addChild(background)

      const content = new Container()
      content.eventMode = "static"
      app.stage.addChild(content)

      appRef.current = app
      contentRef.current = content
      backgroundRef.current = background
      registerApp(app)

      // 立即渲染现有元素
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
        if (stateRef.current.interactionMode === "pan") {
          panRef.current = {
            lastPointer: { x: event.global.x, y: event.global.y },
          }
          background.cursor = "grabbing"
        } 
        /* handle area selection */
        else if (stateRef.current.interactionMode === "select") {
          const nativeEvent = event.originalEvent as unknown as MouseEvent;
          if (!(nativeEvent.shiftKey || nativeEvent.metaKey || nativeEvent.ctrlKey) && event.target === background) {
            // now, start to select area
            const localPos = event.getLocalPosition(content);
            selectionStartRef.current = { x: localPos.x, y: localPos.y };
            isSelectedRef.current = true;

            // now, create the selection box
            const selectionBox = new Graphics();
            selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
            selectionBox.fill({color: SELECTION_COLOR, alpha: 0.1});
            selectionBox.zIndex = 100;
            content.addChild(selectionBox);
            selectionBoxRef.current = selectionBox;
          }
        } else {
          clearSelection()
        }
      })

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


      app.stage.on("pointermove", (event: FederatedPointerEvent) => {
        const content = contentRef.current
        if (!content) return

        // branch for area selection
        if (isSelectedRef.current && selectionStartRef.current && selectionBoxRef.current) {
          const localPos = event.getLocalPosition(content);
          const start = selectionStartRef.current;
          
          // how large of this selection box should be?
          const x = Math.min(start.x, localPos.x);
          const y = Math.min(start.y, localPos.y);
          const width = Math.abs(start.x - localPos.x);
          const height = Math.abs(start.y - localPos.y);

          // now, draw the selection box
          const selectionBox = selectionBoxRef.current;
          selectionBox.clear();
          selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
          selectionBox.beginFill(SELECTION_COLOR, 0.1);
          selectionBox.fill({color: SELECTION_COLOR, alpha: 0.1});
          selectionBox.drawRect(x, y, width, height);
          selectionBox.endFill();
          return;
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
        if (dragRef.current) {
          const current = dragRef.current
          const local = event.getLocalPosition(content)
          const dx = local.x - current.startPointer.x
          const dy = local.y - current.startPointer.y
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
        if (panRef.current) {
          const last = panRef.current.lastPointer
          const dx = event.global.x - last.x
          const dy = event.global.y - last.y
          panRef.current.lastPointer = { x: event.global.x, y: event.global.y }
          panBy({ x: dx, y: dy })
        }
      })

      const stopInteractions = () => {
        // branch for area selection when done
        if (isSelectedRef.current && selectionBoxRef.current && selectionStartRef.current) {
          const selectionBox = selectionBoxRef.current;

          // get the bounds of the selection box
          const bounds = selectionBox.getBounds();
          const selectionRect = new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);

          // now, find all the elements that intersect with the selection box
          const selectedElements = stateRef.current.elements.filter(elem => {
            const elemRect = new Rectangle( elem.x, elem.y, elem.width, elem.height );
            return selectionRect.intersects(elemRect); // these two elements intersect or not?
          });

          // now, update the selection state
          if (selectedElements.length > 0) {
            setSelection(selectedElements.map((el) => el.id));
          } else {
            clearSelection();
          }

          // now, clear the selection box
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
      const additive = Boolean(
        nativeEvent?.shiftKey || nativeEvent?.metaKey || nativeEvent?.ctrlKey
      )
      const selection = additive
        ? Array.from(new Set([...selectedIds, elementId]))
        : selectedIds.includes(elementId)
          ? selectedIds
          : [elementId]
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

  // 添加 renderElements 函数
  const renderElements = useCallback((
    content: Container, 
    elements: CanvasElement[], 
    currentState: typeof state
  ) => {
    content.removeChildren().forEach((child) => child.destroy({ children: true }))
    content.sortableChildren = true
    
    elements.forEach((element) => {
      const selected = state.selectedIds.includes(element.id)
      const node = createShape(element, state.interactionMode, (event) =>
        handleElementPointerDown(event, element.id)
      )
      node.zIndex = 1
      content.addChild(node)
      
      // 处理选中状态的调整手柄
      if (
        selected &&
        currentState.selectedIds.length === 1 &&
        currentState.interactionMode === "select"
      ) {
        const handlesLayer = new Container()
        handlesLayer.sortableChildren = true
        handlesLayer.zIndex = 10
        handlesLayer.position.set(element.x, element.y)
        handlesLayer.angle = element.rotation
        const handleSize = Math.max(6, 10 / currentState.zoom)
        const edgeThickness = Math.max(16 / currentState.zoom, handleSize * 1.6)
        const activeDirection = resizeRef.current?.direction ?? null

        const drawHandle = (
          target: Graphics,
          direction: ResizeDirection,
          opts: { hovered: boolean; active: boolean }
        ) => {
          const { hovered, active } = opts
          const isHighlighted = hovered || active
          const fill = isHighlighted ? HANDLE_ACTIVE_COLOR : 0xffffff
          const stroke = isHighlighted ? HANDLE_ACTIVE_COLOR : SELECTION_COLOR
          target.clear()
          if (direction === "n" || direction === "s") {
            target.roundRect(
              -handleSize,
              -handleSize / 2,
              handleSize * 2,
              handleSize,
              4
            )
          } else if (direction === "e" || direction === "w") {
            target.roundRect(
              -handleSize / 2,
              -handleSize,
              handleSize,
              handleSize * 2,
              4
            )
          } else {
            target.roundRect(
              -handleSize / 2,
              -handleSize / 2,
              handleSize,
              handleSize,
              4
            )
          }
          target.fill({ color: fill })
          target.stroke({ width: active ? 1.6 : 1, color: stroke })
        }

        RESIZE_DIRECTIONS.forEach((direction) => {
          const handle = new Graphics()
          handle.eventMode = "static"
          handle.cursor = RESIZE_CURSORS[direction]
          handle.zIndex = 2
          let hovered = false
          const isActive = activeDirection === direction
          const updateStyle = (forcedActive?: boolean) =>
            drawHandle(handle, direction, {
              hovered,
              active: forcedActive ?? isActive,
            })
          updateStyle()
          const pos = getHandlePosition(direction, element.width, element.height)
          handle.position.set(pos.x, pos.y)
          handle.visible = !activeDirection || isActive

          switch (direction) {
            case "n":
              handle.hitArea = new Rectangle(
                -element.width / 2,
                -edgeThickness,
                element.width,
                edgeThickness * 2
              )
              break
            case "s":
              handle.hitArea = new Rectangle(
                -element.width / 2,
                -edgeThickness,
                element.width,
                edgeThickness * 2
              )
              break
            case "e":
              handle.hitArea = new Rectangle(
                -edgeThickness,
                -element.height / 2,
                edgeThickness * 2,
                element.height
              )
              break
            case "w":
              handle.hitArea = new Rectangle(
                -edgeThickness,
                -element.height / 2,
                edgeThickness * 2,
                element.height
              )
              break
            default:
              handle.hitArea = new Rectangle(
                -edgeThickness / 2,
                -edgeThickness / 2,
                edgeThickness,
                edgeThickness
              )
              break
          }

          handle.on("pointerdown", (event) => {
            hovered = true
            updateStyle(true)
            handleResizeStart(event, state.selectedIds, direction)
          })
          handle.on("pointerover", () => {
            hovered = true
            if (!isActive) updateStyle()
          })
          handle.on("pointerout", () => {
            hovered = false
            if (!isActive) updateStyle()
          })
          handlesLayer.addChild(handle)
        })
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
    renderElements(content, state.elements, state)

    content.removeChildren().forEach((child) => child.destroy({ children: true }))
    content.sortableChildren = true
    
    // 1. 渲染所有元素和单选框
    state.elements.forEach((element) => {
      const selected = state.selectedIds.includes(element.id)
      const node = createShape(element, state.interactionMode, (event) =>
        handleElementPointerDown(event, element.id)
      )
      node.zIndex = 1
      content.addChild(node)

      if (selected) {
        const outline = new Graphics()
        outline.roundRect(0, 0, element.width, element.height, 2)
        outline.stroke({ width: 1.4, color: SELECTION_COLOR, alpha: 1 })
        outline.position.set(element.x, element.y)
        outline.angle = element.rotation
        outline.zIndex = 2
        content.addChild(outline)
      }
    })

    // 2. 渲染控制点和多选包围盒
    if (
      state.interactionMode === "select" &&
      state.selectedIds.length > 0
    ) {
      const selectedElements = state.elements.filter((el) =>
        state.selectedIds.includes(el.id)
      )
      
      if (selectedElements.length === 0) return

      // 计算包围盒
      let bounds = { x: 0, y: 0, width: 0, height: 0, rotation: 0 }
      const isMultiSelection = selectedElements.length > 1

      if (isMultiSelection) {
        const box = getBoundingBox(selectedElements)
        if (box) {
          bounds = { ...box, rotation: 0 }
        }
      } else {
        const el = selectedElements[0]
        bounds = { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation }
      }

      // 绘制多选包围盒
      if (isMultiSelection) {
        const box = new Graphics()
        const dash = 5
        const gap = 3
        
        const drawDashedLine = (x1: number, y1: number, x2: number, y2: number) => {
           const dx = x2 - x1
           const dy = y2 - y1
           const len = Math.sqrt(dx*dx + dy*dy)
           const count = Math.floor(len / (dash + gap))
           const dashX = dx / len * dash
           const dashY = dy / len * dash
           const gapX = dx / len * gap
           const gapY = dy / len * gap
           
           let cx = x1
           let cy = y1
           
           for (let i = 0; i < count; i++) {
             box.moveTo(cx, cy)
             box.lineTo(cx + dashX, cy + dashY)
             cx += dashX + gapX
             cy += dashY + gapY
           }
           if (Math.sqrt((x2-cx)*(x2-cx) + (y2-cy)*(y2-cy)) > 0) {
              box.moveTo(cx, cy)
              box.lineTo(x2, y2)
           }
        }
        
        drawDashedLine(0, 0, bounds.width, 0)
        drawDashedLine(bounds.width, 0, bounds.width, bounds.height)
        drawDashedLine(bounds.width, bounds.height, 0, bounds.height)
        drawDashedLine(0, bounds.height, 0, 0)

        box.stroke({ width: 2, color: SELECTION_COLOR, alpha: 1 })
        box.position.set(bounds.x, bounds.y)
        box.zIndex = 3
        
        // Make box interactive for dragging
        box.eventMode = "static"
        box.cursor = "move"
        box.hitArea = new Rectangle(0, 0, bounds.width, bounds.height)
        box.on("pointerdown", handleSelectionBoxPointerDown)

        content.addChild(box)
      }

      // 绘制控制点
      if (!dragRef.current?.moved) {
      const handlesLayer = new Container()
      handlesLayer.sortableChildren = true
      handlesLayer.zIndex = 10
      handlesLayer.position.set(bounds.x, bounds.y)
      handlesLayer.angle = bounds.rotation

      const handleSize = Math.max(6, 10 / state.zoom)
      const edgeThickness = Math.max(16 / state.zoom, handleSize * 1.6)
      const activeDirection = resizeRef.current?.direction ?? null

      // 确定显示的控制点方向
      const directions = isMultiSelection
        ? (["nw", "ne", "sw", "se"] as ResizeDirection[])
        : RESIZE_DIRECTIONS

      const drawHandle = (
        target: Graphics,
        direction: ResizeDirection,
        opts: { hovered: boolean; active: boolean }
      ) => {
        const { hovered, active } = opts
        const isHighlighted = hovered || active
        const fill = isHighlighted ? HANDLE_ACTIVE_COLOR : 0xffffff
        const stroke = isHighlighted ? HANDLE_ACTIVE_COLOR : SELECTION_COLOR
        target.clear()
        
        // 只有单选且非角点时才绘制长条形，多选只绘制方形点
        if (!isMultiSelection && (direction === "n" || direction === "s")) {
          target.roundRect(-handleSize, -handleSize / 2, handleSize * 2, handleSize, 4)
        } else if (!isMultiSelection && (direction === "e" || direction === "w")) {
          target.roundRect(-handleSize / 2, -handleSize, handleSize, handleSize * 2, 4)
        } else {
          target.roundRect(-handleSize / 2, -handleSize / 2, handleSize, handleSize, 4)
        }
        
        target.fill({ color: fill })
        target.stroke({ width: active ? 1.6 : 1, color: stroke })
      }

      directions.forEach((direction) => {
        const handle = new Graphics()
        handle.eventMode = "static"
        handle.cursor = RESIZE_CURSORS[direction]
        handle.zIndex = 2
        let hovered = false
        const isActive = activeDirection === direction
        
        const updateStyle = (forcedActive?: boolean) =>
          drawHandle(handle, direction, {
            hovered,
            active: forcedActive ?? isActive,
          })
        
        updateStyle()
        
        const pos = getHandlePosition(direction, bounds.width, bounds.height)
        handle.position.set(pos.x, pos.y)
        handle.visible = !activeDirection || isActive

        // HitArea 逻辑
        if (isMultiSelection) {
             handle.hitArea = new Rectangle(
                -edgeThickness / 2,
                -edgeThickness / 2,
                edgeThickness,
                edgeThickness
              )
        } else {
             switch (direction) {
                case "n":
                case "s":
                  handle.hitArea = new Rectangle(
                    -bounds.width / 2,
                    -edgeThickness,
                    bounds.width,
                    edgeThickness * 2
                  )
                  break
                case "e":
                case "w":
                  handle.hitArea = new Rectangle(
                    -edgeThickness,
                    -bounds.height / 2,
                    edgeThickness * 2,
                    bounds.height
                  )
                  break
                default:
                  handle.hitArea = new Rectangle(
                    -edgeThickness / 2,
                    -edgeThickness / 2,
                    edgeThickness,
                    edgeThickness
                  )
                  break
             }
        }

        handle.on("pointerdown", (event) => {
          hovered = true
          updateStyle(true)
          handleResizeStart(event, state.selectedIds, direction)
        })
        handle.on("pointerover", () => {
          hovered = true
          if (!isActive) updateStyle()
        })
        handle.on("pointerout", () => {
          hovered = false
          if (!isActive) updateStyle()
        })
        handlesLayer.addChild(handle)
      })
      content.addChild(handlesLayer)
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

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    content.position.set(state.pan.x, state.pan.y)
    content.scale.set(state.zoom)
  }, [state.pan, state.zoom])

  useEffect(() => {
    const background = backgroundRef.current
    if (!background) return
    background.cursor = state.interactionMode === "pan" ? "grab" : "default"
  }, [state.interactionMode])

  return <div ref={wrapperRef} className="h-full w-full rounded-[32px]" />
}
