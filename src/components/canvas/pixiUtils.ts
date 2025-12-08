import type { CanvasElement } from "../../types/canvas"
import type { ResizeDirection } from "./pixiConstants"

// 将角度转换为弧度
const toRadians = (degrees: number) => degrees * (Math.PI / 180)

// 计算旋转后的点坐标
const rotatePoint = (
  px: number,
  py: number,
  cx: number,
  cy: number,
  angle: number
): { x: number; y: number } => {
  const rad = toRadians(angle)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

// 获取元素旋转后的四个角点
const getRotatedCorners = (element: CanvasElement): { x: number; y: number }[] => {
  const { x, y, width, height, rotation } = element
  const cx = x + width / 2
  const cy = y + height / 2

  // 四个角点（未旋转时的位置）
  const corners = [
    { x: x, y: y },                      // 左上
    { x: x + width, y: y },              // 右上
    { x: x + width, y: y + height },     // 右下
    { x: x, y: y + height },             // 左下
  ]

  // 如果没有旋转，直接返回
  if (!rotation || rotation === 0) {
    return corners
  }

  // 计算旋转后的角点位置
  return corners.map((corner) => rotatePoint(corner.x, corner.y, cx, cy, rotation))
}

export const getBoundingBox = (elements: CanvasElement[]) => {
  if (elements.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  elements.forEach((el) => {
    // 获取旋转后的四个角点
    const corners = getRotatedCorners(el)
    
    // 找出所有角点的边界
    corners.forEach((corner) => {
      minX = Math.min(minX, corner.x)
      minY = Math.min(minY, corner.y)
      maxX = Math.max(maxX, corner.x)
      maxY = Math.max(maxY, corner.y)
    })
  })

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export const hexToNumber = (value: string) =>
  Number.parseInt(value.replace("#", ""), 16)

export const cloneElements = (elements: CanvasElement[]) => {
  if (typeof structuredClone === "function") {
    return structuredClone(elements)
  }
  return JSON.parse(JSON.stringify(elements))
}

export const cloneElement = (element: CanvasElement): CanvasElement =>
  cloneElements([element])[0]

export const getHandlePosition = (
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
