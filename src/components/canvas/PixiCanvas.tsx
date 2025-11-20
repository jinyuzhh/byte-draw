import { useEffect, useRef, useCallback } from "react"
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
  selected: boolean,
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

  if (selected) {
    const outline = new Graphics()
    outline.roundRect(0, 0, element.width, element.height, 2)
    outline.stroke({ width: 1.4, color: SELECTION_COLOR, alpha: 1 })
    outline.zIndex = 5
    container.addChild(outline)
  }

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
  const {
    state,
    setSelection,
    clearSelection,
    mutateElements,
    panBy,
    registerApp,
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
    id: string
    direction: ResizeDirection
    startPointer: { x: number; y: number }
    startElement: CanvasElement
    historySnapshot: CanvasElement[]
    moved: boolean
  } | null>(null)
  const panRef = useRef<{ lastPointer: { x: number; y: number } } | null>(null)
  const stateRef = useRef(state)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const selectionBoxRef = useRef<Graphics | null>(null) // reference to the selection box graphics object
  const isSelectedRef = useRef(false); // reference to the selection state, default as false 
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null); // reference to the start point of the selection box

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const performResize = useCallback(
    (
      info: {
        id: string
        direction: ResizeDirection
        startElement: CanvasElement
      },
      dx: number,
      dy: number
    ) => {
      const { direction, startElement, id } = info
      let { x, y, width, height } = startElement

      if (direction.includes("e")) {
        width = clampSize(startElement.width + dx)
      }
      if (direction.includes("s")) {
        height = clampSize(startElement.height + dy)
      }
      if (direction.includes("w")) {
        const updatedWidth = clampSize(startElement.width - dx)
        const delta = startElement.width - updatedWidth
        width = updatedWidth
        x = startElement.x + delta
      }
      if (direction.includes("n")) {
        const updatedHeight = clampSize(startElement.height - dy)
        const delta = startElement.height - updatedHeight
        height = updatedHeight
        y = startElement.y + delta
      }

      mutateElements(
        (elements) =>
          elements.map((el) =>
            el.id === id ? { ...el, x, y, width, height } : el
          ) as CanvasElement[],
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
          // selectionBox.fill({color: SELECTION_COLOR, alpha: 0.1});
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
    }
  }, [clearSelection, mutateElements, panBy, registerApp, performResize, setSelection])

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
    (event: FederatedPointerEvent, elementId: string, direction: ResizeDirection) => {
      event.stopPropagation()
      if (stateRef.current.interactionMode !== "select") return
      const content = contentRef.current
      if (!content) return
      const element = stateRef.current.elements.find((el) => el.id === elementId)
      if (!element) return
      const local = event.getLocalPosition(content)
      resizeRef.current = {
        id: elementId,
        direction,
        startPointer: local,
        startElement: cloneElement(element),
        historySnapshot: cloneElements(stateRef.current.elements),
        moved: false,
      }
    },
    []
  )

  useEffect(() => {
    const content = contentRef.current
    const app = appRef.current
    if (!content || !app) return
    content.removeChildren().forEach((child) => child.destroy({ children: true }))
    content.sortableChildren = true
    state.elements.forEach((element) => {
      const selected = state.selectedIds.includes(element.id)
      const node = createShape(element, selected, state.interactionMode, (event) =>
        handleElementPointerDown(event, element.id)
      )
      node.zIndex = 1
      content.addChild(node)
      if (
        selected &&
        state.selectedIds.length === 1 &&
        state.interactionMode === "select"
      ) {
        const handlesLayer = new Container()
        handlesLayer.sortableChildren = true
        handlesLayer.zIndex = 10
        handlesLayer.position.set(element.x, element.y)
        handlesLayer.angle = element.rotation
        const handleSize = Math.max(6, 10 / state.zoom)
        const edgeThickness = Math.max(16 / state.zoom, handleSize * 1.6)
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
            handleResizeStart(event, element.id, direction)
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
  }, [
    state.elements,
    state.selectedIds,
    state.interactionMode,
    state.zoom,
    handleElementPointerDown,
    handleResizeStart,
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
