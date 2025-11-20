export type ShapeVariant = "rectangle" | "circle" | "triangle"

export type InteractionMode = "select" | "pan"

export interface ElementBase {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked?: boolean
}

export interface ShapeElement extends ElementBase {
  type: "shape"
  shape: ShapeVariant
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
}

export interface TextElement extends ElementBase {
  type: "text"
  text: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  align: "left" | "center" | "right"
  color: string
  background: string
  lineHeight: number
}

export interface ImageElement extends ElementBase {
  type: "image"
  src: string
  filters: {
    grayscale: boolean
    blur: number
    brightness: number
  }
  borderRadius: number
}

export type CanvasElement = ShapeElement | TextElement | ImageElement

export interface CanvasState {
  elements: CanvasElement[]
  selectedIds: string[]
  zoom: number
  pan: { x: number; y: number }
  interactionMode: InteractionMode
  history: CanvasElement[][]
  redoStack: CanvasElement[][]
}

export interface CanvasContextValue {
  state: CanvasState
  isInitialized: boolean // 用于判断是否已经初始化
  addShape: (shape: ShapeVariant) => void
  addText: (text?: string) => void
  addImage: (src: string, size?: { width: number; height: number }) => void
  updateElement: (id: string, changes: Partial<CanvasElement>) => void
  updateSelectedElements: (
    updater: (element: CanvasElement) => Partial<CanvasElement>
  ) => void
  mutateElements: (
    updater: (elements: CanvasElement[]) => CanvasElement[],
    options?: { recordHistory?: boolean; historySnapshot?: CanvasElement[] }
  ) => void
  setSelection: (ids: string[], additive?: boolean) => void
  clearSelection: () => void
  deleteSelected: () => void //删除方法
  setZoom: (zoom: number) => void
  panBy: (delta: { x: number; y: number }) => void
  setInteractionMode: (mode: InteractionMode) => void
  undo: () => void
  redo: () => void
  registerApp: (app: import("pixi.js").Application | null) => void
  exportAsImage: () => string | null
  copy:()=> void   //快捷键复制方法
  paste:()=> void  //快捷键粘贴方法
}
