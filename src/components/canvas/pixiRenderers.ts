import {
  Assets,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
} from "pixi.js"
import type { TextStyleFontWeight } from "pixi.js"
import type { CanvasElement } from "../../types/canvas"
import type { ResizeDirection } from "./pixiConstants"
import {
  HANDLE_ACTIVE_COLOR,
  RESIZE_CURSORS,
  RESIZE_DIRECTIONS,
  SELECTION_COLOR,
} from "./pixiConstants"
import { getHandlePosition, hexToNumber } from "./pixiUtils"

type SelectionBounds = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export const createShape = async (
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

  // 处理组元素
  if (element.type === "group") {
    // 移除背景和文本标签，仅保留子元素渲染功能

    // 递归渲染组内的子元素
    if (element.children && element.children.length > 0) {
      for (const child of element.children) {
        // 递归调用createShape渲染子元素
        const childContainer = await createShape(child, interactionMode, (event) => {
          // 当点击子元素时，冒泡到父组的点击事件
          event.stopPropagation()
          onPointerDown(event)
        })
        // 子元素已经是相对于组的位置，直接添加到容器
        container.addChild(childContainer)
      }
    }
  }

  else if (element.type === "shape") {
    const fill = new Graphics()
    const stroke = new Graphics()
    const mask = new Graphics()
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

    drawPath(mask)
    mask.fill({ color: 0xffffff, alpha: 1 })
    mask.alpha = 0
    mask.eventMode = "none"
    container.addChild(mask)
    container.mask = mask

    drawPath(fill)
    fill.fill({ color: fillColor, alpha: 1 })
    container.addChild(fill)

    if (element.strokeWidth > 0) {
      drawPath(stroke)
      const halfMinSize =
        Math.min(Math.abs(element.width), Math.abs(element.height)) / 2
      const safeStrokeWidth = Math.max(
        0,
        Math.min(element.strokeWidth, halfMinSize)
      )

      if (safeStrokeWidth > 0) {
        stroke.stroke({
          width: safeStrokeWidth,
          color: strokeColor,
          alignment: 1,
          join: "round",
        })
        container.addChild(stroke)
      }
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
    const texture = await Assets.load(element.src)
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
        const gray = new ColorMatrixFilter()
        gray.greyscale(0.5, false)
        filters.push(gray)
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

const drawHandle = (
  target: Graphics,
  direction: ResizeDirection,
  opts: { hovered: boolean; active: boolean },
  handleSize: number,
  isMultiSelection: boolean
) => {
  const { hovered, active } = opts
  const isHighlighted = hovered || active
  const fill = isHighlighted ? HANDLE_ACTIVE_COLOR : 0xffffff
  const stroke = isHighlighted ? HANDLE_ACTIVE_COLOR : SELECTION_COLOR
  target.clear()

  if (!isMultiSelection && (direction === "n" || direction === "s")) {
    target.roundRect(-handleSize, -handleSize / 2, handleSize * 2, handleSize, 4)
  } else if (!isMultiSelection && (direction === "e" || direction === "w")) {
    target.roundRect(-handleSize / 2, -handleSize, handleSize, handleSize * 2, 4)
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

export const createResizeHandlesLayer = (
  element: CanvasElement,
  zoom: number,
  activeDirection: ResizeDirection | null,
  selectedIds: string[],
  handleResizeStart: (
    event: FederatedPointerEvent,
    ids: string[],
    direction: ResizeDirection
  ) => void
) => {
  const handlesLayer = new Container()
  handlesLayer.sortableChildren = true
  handlesLayer.zIndex = 10
  handlesLayer.position.set(element.x, element.y)
  handlesLayer.angle = element.rotation

  const handleSize = Math.max(6, 10 / zoom)
  const edgeThickness = Math.max(16 / zoom, handleSize * 1.6)

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
      }, handleSize, false)
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
      handleResizeStart(event, selectedIds, direction)
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

  return handlesLayer
}

export const createSelectionOutline = (element: CanvasElement) => {
  const outline = new Graphics()
  outline.roundRect(0, 0, element.width, element.height, 2)
  outline.stroke({ width: 1.4, color: SELECTION_COLOR, alpha: 1 })
  outline.position.set(element.x, element.y)
  outline.angle = element.rotation
  outline.zIndex = 2
  return outline
}

export const createMultiSelectionBox = (
  bounds: SelectionBounds,
  handleSelectionBoxPointerDown: (event: FederatedPointerEvent) => void
) => {
  const box = new Graphics()
  const dash = 5
  const gap = 3

  const drawDashedLine = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    const count = Math.floor(len / (dash + gap))
    const dashX = (dx / len) * dash
    const dashY = (dy / len) * dash
    const gapX = (dx / len) * gap
    const gapY = (dy / len) * gap

    let cx = x1
    let cy = y1

    for (let i = 0; i < count; i++) {
      box.moveTo(cx, cy)
      box.lineTo(cx + dashX, cy + dashY)
      cx += dashX + gapX
      cy += dashY + gapY
    }
    if (Math.sqrt((x2 - cx) * (x2 - cx) + (y2 - cy) * (y2 - cy)) > 0) {
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

  box.eventMode = "static"
  box.cursor = "move"
  box.hitArea = new Rectangle(0, 0, bounds.width, bounds.height)
  box.on("pointerdown", handleSelectionBoxPointerDown)

  return box
}

export const createBoundsHandlesLayer = ({
  bounds,
  zoom,
  activeDirection,
  isMultiSelection,
  selectedIds,
  handleResizeStart,
}: {
  bounds: SelectionBounds
  zoom: number
  activeDirection: ResizeDirection | null
  isMultiSelection: boolean
  selectedIds: string[]
  handleResizeStart: (
    event: FederatedPointerEvent,
    ids: string[],
    direction: ResizeDirection
  ) => void
}) => {
  const handlesLayer = new Container()
  handlesLayer.sortableChildren = true
  handlesLayer.zIndex = 10
  handlesLayer.position.set(bounds.x, bounds.y)
  handlesLayer.angle = bounds.rotation

  const handleSize = Math.max(6, 10 / zoom)
  const edgeThickness = Math.max(16 / zoom, handleSize * 1.6)

  const directions = isMultiSelection
    ? (["nw", "ne", "sw", "se"] as ResizeDirection[])
    : RESIZE_DIRECTIONS

  directions.forEach((direction) => {
    const handle = new Graphics()
    handle.eventMode = "static"
    handle.cursor = RESIZE_CURSORS[direction]
    handle.zIndex = 2
    let hovered = false
    const isActive = activeDirection === direction

    const updateStyle = (forcedActive?: boolean) =>
      drawHandle(
        handle,
        direction,
        {
          hovered,
          active: forcedActive ?? isActive,
        },
        handleSize,
        isMultiSelection
      )

    updateStyle()

    const pos = getHandlePosition(direction, bounds.width, bounds.height)
    handle.position.set(pos.x, pos.y)
    handle.visible = !activeDirection || isActive

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
      handleResizeStart(event, selectedIds, direction)
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

  return handlesLayer
}
