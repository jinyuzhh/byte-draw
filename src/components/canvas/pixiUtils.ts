import type { CanvasElement } from "../../types/canvas"
import type { ResizeDirection } from "./pixiConstants"

export const getBoundingBox = (elements: CanvasElement[]) => {
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
