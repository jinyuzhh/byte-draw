export type ResizeDirection =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw"

export const RESIZE_DIRECTIONS: ResizeDirection[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
]

export const RESIZE_CURSORS: Record<ResizeDirection, string> = {
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
  nw: "nwse-resize",
}

export const MIN_ELEMENT_SIZE = 0
export const SELECTION_COLOR = 0x39b5ff
export const HANDLE_ACTIVE_COLOR = 0x00cae0

// 旋转手柄距离元素边界的偏移量
export const ROTATE_HANDLE_OFFSET = 30
// 旋转吸附角度 (15度对应弧度)
export const SNAP_ANGLE = 15
