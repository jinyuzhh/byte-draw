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
  // HANDLE_ACTIVE_COLOR,
  RESIZE_CURSORS,
  RESIZE_DIRECTIONS,
  SELECTION_COLOR,
  ROTATE_HANDLE_OFFSET,
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

  container.pivot.set(element.width / 2, element.height / 2)
  container.position.set(element.x + element.width / 2, element.y + element.height / 2)
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

    // 创建一个内部容器用于填充，这个容器会被 mask 裁剪
    const fillContainer = new Container()
    
    drawPath(mask)
    mask.fill({ color: 0xffffff, alpha: 1 })
    mask.alpha = 0
    mask.eventMode = "none"
    fillContainer.addChild(mask)
    fillContainer.mask = mask

    drawPath(fill)
    fill.fill({ color: fillColor, alpha: 1 })
    fillContainer.addChild(fill)
    
    // 将填充容器添加到主容器
    container.addChild(fillContainer)

    // 描边单独添加到主容器，不受 mask 影响
    // 这样描边（尤其是外侧对齐的描边）不会被裁剪
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
  _direction: ResizeDirection,
  _opts: { hovered: boolean; active: boolean },
  handleSize: number,
  _isMultiSelection: boolean
) => {
  target.clear()
  
  // 控制点颜色 #29b6f2 (0x29b6f2)
  const DOT_COLOR = 0x29b6f2

  // 绘制圆形 (x, y, radius)
  // 半径 = 直径 / 2
  target.circle(0, 0, handleSize / 2)
  
  // 填充实心蓝
  target.fill({ color: DOT_COLOR })
  
  // 添加 1px 白色描边，防止在深色背景或同色物体上看不清
  target.stroke({ width: 1, color: 0xffffff })
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
  ) => void,
  handleRotateStart?: (event: FederatedPointerEvent, id: string) => void
) => {
  const handlesLayer = new Container()
  handlesLayer.sortableChildren = true
  handlesLayer.zIndex = 10
  handlesLayer.pivot.set(element.width / 2, element.height / 2)
  handlesLayer.position.set(element.x + element.width / 2, element.y + element.height / 2)
  handlesLayer.angle = element.rotation

  const handleSize = 7 / zoom 
  // 增加点击区域的大小（edgeThickness），让小圆点更容易被点中
  const edgeThickness = Math.max(20 / zoom, handleSize * 2)

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

  if (handleRotateStart) {
    const rotateHandle = new Graphics()
    rotateHandle.eventMode = "static"
    rotateHandle.cursor = "alias" // 或者使用 url 自定义光标
    rotateHandle.zIndex = 3 // 确保在最上层

    const handleSize = 8 / zoom
    // 计算右上角位置
    const nePos = getHandlePosition("ne", element.width, element.height)
    
    // 旋转手柄位置：在右上角 (ne) 的基础上，再向上延伸 ROTATE_HANDLE_OFFSET 距离
    // 因为 layer 已经旋转了，所以这里的 y 轴负方向就是相对于元素的“上方”
    const rotateY = -ROTATE_HANDLE_OFFSET / zoom
    
    // 1. 绘制连接线 (从右上角连出来)
    rotateHandle.moveTo(nePos.x, 0) // 从 ne 的 y=0 (top edge) 开始
    rotateHandle.lineTo(nePos.x, rotateY)
    rotateHandle.stroke({ width: 1 / zoom, color: 0x3b82f6 })

    // 2. 绘制旋转圆点
    rotateHandle.circle(nePos.x, rotateY, handleSize / 2)
    rotateHandle.fill({ color: 0xffffff })
    rotateHandle.stroke({ width: 1.5, color: 0x3b82f6 })

    // 增加点击区域
    rotateHandle.hitArea = new Rectangle(
      nePos.x - handleSize,
      rotateY - handleSize,
      handleSize * 2,
      handleSize * 2
    )

    rotateHandle.on("pointerdown", (event) => {
      event.stopPropagation()
      handleRotateStart(event, element.id)
    })

    handlesLayer.addChild(rotateHandle)
  }


  return handlesLayer
}

export const createSolidBoundsOutline = (
  bounds: { x: number; y: number; width: number; height: number; rotation?: number }
) => {
  const outline = new Graphics()
  
  // 直接绘制矩形路径
  outline.rect(0, 0, bounds.width, bounds.height)

  // 使用实线描边 (Pixi v8 语法)
  outline.stroke({ width: 1.5, color: SELECTION_COLOR, alpha: 1 })

  // 设置位置
  outline.pivot.set(bounds.width / 2, bounds.height / 2)
  outline.position.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  // 如果是多选大框通常不旋转，但为了通用性这里加上旋转判断
  outline.angle = bounds.rotation || 0
  outline.zIndex = 2

  return outline
}

export const createSelectionOutline = (bounds: { x: number; y: number; width: number; height: number; rotation: number }) => {
  const outline = new Graphics()
  // 定义虚线参数
  const dash = 5 // 实线段长度
  const gap = 3  // 间隔长度

  // 内部辅助函数：绘制虚线
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
      outline.moveTo(cx, cy)
      outline.lineTo(cx + dashX, cy + dashY)
      cx += dashX + gapX
      cy += dashY + gapY
    }
    // 绘制剩余部分，确保线条闭合
    if (Math.sqrt((x2 - cx) * (x2 - cx) + (y2 - cy) * (y2 - cy)) > 0) {
      outline.moveTo(cx, cy)
      outline.lineTo(x2, y2)
    }
  }

  // 分别绘制矩形的四条边
  drawDashedLine(0, 0, bounds.width, 0)
  drawDashedLine(bounds.width, 0, bounds.width, bounds.height)
  drawDashedLine(bounds.width, bounds.height, 0, bounds.height)
  drawDashedLine(0, bounds.height, 0, 0)

  // 应用描边样式
 outline.stroke({ width: 1.4, color: SELECTION_COLOR, alpha: 1 })
  
  // 设置位置和旋转
  outline.pivot.set(bounds.width / 2, bounds.height / 2)
  outline.position.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  outline.angle = bounds.rotation
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

  const handleSize = 7 / zoom
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

// 创建画板渲染
export const createArtboard = (
  artboard: { x: number; y: number; width: number; height: number; backgroundColor: string; opacity?: number },
  zoom: number
) => {
  const container = new Container()
  container.zIndex = 0 // 画板在最底层
  container.eventMode = "none" // 画板不接收事件
  container.alpha = artboard.opacity ?? 1 // 应用画板透明度

  // 绘制画板背景
  const bg = new Graphics()
  bg.rect(artboard.x, artboard.y, artboard.width, artboard.height)
  bg.fill({ color: hexToNumber(artboard.backgroundColor) })
  container.addChild(bg)

  // 绘制画板边框（使用投影效果）
  const shadow = new Graphics()
  shadow.rect(artboard.x, artboard.y, artboard.width, artboard.height)
  shadow.stroke({ width: 1 / zoom, color: 0xcccccc, alpha: 0.5 })
  container.addChild(shadow)

  return container
}

// 创建角度提示文本
export const createRotateTooltip = (element: CanvasElement, zoom: number) => {
  const container = new Container()
  // 将角度转换为度数，并归一化到 0-360
  let degrees = Math.round(element.rotation) % 360
  if (degrees < 0) degrees += 360
  
  const text = new Text({
    text: `${degrees}°`,
    style: new TextStyle({
      fontFamily: "Inter, sans-serif",
      fontSize: 18 / zoom,
      fill: "white",
      fontWeight: "bold",
    }),
  })
  
  // 创建背景
  const bg = new Graphics()
  const padding = 6 / zoom
  bg.roundRect(0, 0, text.width + padding * 2, text.height + padding * 2, 4 / zoom)
  bg.fill({ color: 0x1e293b, alpha: 0.9 })
  
  text.position.set(padding, padding)
  
  container.addChild(bg)
  container.addChild(text)
  
  // 抵消画布的缩放，让文字始终保持清晰大小
  // 同时抵消元素的旋转（如果它是作为子元素添加的话），但通常 Tooltip 是加在顶层的
  // 这里假设它加在 content 层，位置是绝对坐标
  container.pivot.set(bg.width / 2, 0) // 居中显示
  container.zIndex = 100

  return container
}
