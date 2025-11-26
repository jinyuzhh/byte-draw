/**
 * @fileoverview canvas.ts
 * @file /Volumes/DreamZero/code/project/bytedance-canvas/src/types/canvas.ts
 * 
 * @description 画布相关类型定义文件
 * 
 * 该文件定义了画布应用中使用的所有 TypeScript 类型，包括：
 * - 形状变体类型（ShapeVariant）
 * - 交互模式类型（InteractionMode）
 * - 元素基础接口（ElementBase）
 * - 具体元素类型（ShapeElement, TextElement, ImageElement）
 * - 画布状态接口（CanvasState）
 * - 画布上下文值接口（CanvasContextValue）
 * 
 * 这些类型为整个画布应用提供了类型安全保障，确保组件间的数据传递类型一致。
 * 
 * @author ByteDance Canvas Team
 * @created 2025-11-19
 * @modified 2025-11-19
 * 
 * @version 1.0.0
 */

/**
 * 形状变体类型
 * 定义了画布支持的所有基本形状类型
 * 
 * @typedef {string} ShapeVariant
 * @property {"rectangle"} rectangle - 矩形形状
 * @property {"circle"} circle - 圆形形状
 * @property {"triangle"} triangle - 三角形形状
 * TODO: 添加更多形状变体（如多边形、梯形等）
 * 
 * @example
 * ```typescript
 * const shape: ShapeVariant = "rectangle";
 * ```
 */
export type ShapeVariant = "rectangle" | "circle" | "triangle"

/**
 * 交互模式类型
 * 定义了画布的两种主要交互模式
 * 
 * @typedef {string} InteractionMode
 * @property {"select"} select - 选择模式，用于选择和操作元素
 * @property {"pan"} pan - 平移模式，用于移动画布视图
 * 
 * @example
 * ```typescript
 * const mode: InteractionMode = "select";
 * ```
 */
export type InteractionMode = "select" | "pan"

/**
 * 元素基础接口
 * 定义了所有画布元素共有的基本属性
 * 
 * @interface ElementBase
 * 
 * @property {string} id - 元素的唯一标识符，用于选择和操作
 * @property {string} name - 元素的显示名称，用于UI展示
 * @property {number} x - 元素在画布上的X坐标（左上角）
 * @property {number} y - 元素在画布上的Y坐标（左上角）
 * @property {number} width - 元素的宽度（像素）
 * @property {number} height - 元素的高度（像素）
 * @property {number} rotation - 元素的旋转角度（度数，0-360）
 * @property {number} opacity - 元素的不透明度（0-1，1为完全不透明）
 * @property {boolean} [locked] - 元素是否被锁定，锁定后不可操作（可选）
 * 
 * @example
 * ```typescript
 * const baseElement: ElementBase = {
 *   id: "element-123",
 *   name: "矩形元素",
 *   x: 100,
 *   y: 100,
 *   width: 200,
 *   height: 150,
 *   rotation: 0,
 *   opacity: 1,
 *   locked: false
 * };
 * ```
 */
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

/**
 * 形状元素接口
 * 继承自ElementBase，定义了形状特有的属性
 * 
 * @interface ShapeElement
 * @extends ElementBase
 * 
 * @property {"shape"} type - 元素类型标识，固定为"shape"
 * @property {ShapeVariant} shape - 形状变体（矩形、圆形或三角形）
 * @property {string} fill - 形状的填充颜色（CSS颜色值）
 * @property {string} stroke - 形状的边框颜色（CSS颜色值）
 * @property {number} strokeWidth - 形状边框的宽度（像素）
 * @property {number} cornerRadius - 形状的圆角半径（像素，仅对矩形有效）
 * 
 * @example
 * ```typescript
 * const rectangle: ShapeElement = {
 *   // ...ElementBase properties
 *   type: "shape",
 *   shape: "rectangle",
 *   fill: "#f8fafc",
 *   stroke: "#0f172a",
 *   strokeWidth: 2,
 *   cornerRadius: 12
 * };
 * 
 * const circle: ShapeElement = {
 *   // ...ElementBase properties
 *   type: "shape",
 *   shape: "circle",
 *   fill: "#dbeafe",
 *   stroke: "#1e40af",
 *   strokeWidth: 3,
 *   cornerRadius: 0 // 圆形忽略此属性
 * };
 * ```
 */
export interface ShapeElement extends ElementBase {
  type: "shape"
  shape: ShapeVariant
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
}

/**
 * 文本元素接口
 * 继承自ElementBase，定义了文本特有的属性
 * 
 * @interface TextElement
 * @extends ElementBase
 * 
 * @property {"text"} type - 元素类型标识，固定为"text"
 * @property {string} text - 文本内容
 * @property {number} fontSize - 字体大小（像素）
 * @property {string} fontFamily - 字体族名称（如"Inter", "Arial"等）
 * @property {number} fontWeight - 字体粗细（100-900，400为正常，700为粗体）
 * @property {"left"|"center"|"right"} align - 文本对齐方式
 * @property {string} color - 文本颜色（CSS颜色值）
 * @property {string} background - 文本背景颜色（CSS颜色值）
 * @property {number} lineHeight - 行高倍数（1.0-2.0，1.3为常用值）
 * 
 * @example
 * ```typescript
 * const heading: TextElement = {
 *   // ...ElementBase properties
 *   type: "text",
 *   text: "标题文本",
 *   fontSize: 32,
 *   fontFamily: "Inter",
 *   fontWeight: 700,
 *   align: "center",
 *   color: "#1e293b",
 *   background: "#f1f5f9",
 *   lineHeight: 1.2
 * };
 * 
 * const paragraph: TextElement = {
 *   // ...ElementBase properties
 *   type: "text",
 *   text: "段落文本内容",
 *   fontSize: 16,
 *   fontFamily: "Inter",
 *   fontWeight: 400,
 *   align: "left",
 *   color: "#475569",
 *   background: "#ffffff",
 *   lineHeight: 1.5
 * };
 * ```
 */
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

/**
 * 图片元素接口
 * 继承自ElementBase，定义了图片特有的属性
 * 
 * @interface ImageElement
 * @extends ElementBase
 * 
 * @property {"image"} type - 元素类型标识，固定为"image"
 * @property {string} src - 图片资源的URL或路径
 * @property {Object} filters - 图片滤镜效果集合
 * @property {boolean} filters.grayscale - 是否应用灰度滤镜
 * @property {number} filters.blur - 模糊滤镜强度（0-10，0为无模糊）
 * @property {number} filters.brightness - 亮度调整（0.0-2.0，1.0为原始亮度）
 * @property {number} borderRadius - 图片圆角半径（像素，0为无圆角）
 * 
 * @example
 * ```typescript
 * const photo: ImageElement = {
 *   // ...ElementBase properties
 *   type: "image",
 *   src: "https://example.com/image.jpg",
 *   filters: {
 *     grayscale: false,
 *     blur: 0,
 *     brightness: 1.0
 *   },
 *   borderRadius: 8
 * };
 * 
 * const vintagePhoto: ImageElement = {
 *   // ...ElementBase properties
 *   type: "image",
 *   src: "https://example.com/vintage.jpg",
 *   filters: {
 *     grayscale: true,
 *     blur: 0.5,
 *     brightness: 0.8
 *   },
 *   borderRadius: 16
 * };
 * ```
 */
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

/**
 * 画布元素联合类型
 * 包含所有可能的画布元素类型
 * 
 * @typedef {ShapeElement|TextElement|ImageElement} CanvasElement
 * 
 * @example
 * ```typescript
 * // 类型守卫示例
 * function isShapeElement(element: CanvasElement): element is ShapeElement {
 *   return element.type === "shape";
 * }
 * 
 * // 使用示例
 * const elements: CanvasElement[] = [
 *   shapeElement,    // ShapeElement
 *   textElement,     // TextElement
 *   imageElement     // ImageElement
 * ];
 * ```
 */
/**
 * 组元素接口
 * 继承自ElementBase，定义了组特有的属性
 * 组元素可以包含多个子元素，作为一个整体进行操作
 * 
 * @interface GroupElement
 * @extends ElementBase
 * 
 * @property {"group"} type - 元素类型标识，固定为"group"
 * @property {string[]} children - 子元素ID列表，包含在组内的所有元素ID
 * 
 * @example
 * ```typescript
 * const group: GroupElement = {
 *   id: "group-123",
 *   name: "组1",
 *   x: 100,
 *   y: 100,
 *   width: 300,
 *   height: 200,
 *   rotation: 0,
 *   opacity: 1,
 *   type: "group",
 *   children: ["element-1", "element-2", "element-3"]
 * };
 * ```
 */
export interface GroupElement extends ElementBase {
  type: "group"
  children: CanvasElement[]
}

/**
 * 画布元素联合类型
 * 包含所有可能的画布元素类型
 * 
 * @typedef {ShapeElement|TextElement|ImageElement|GroupElement} CanvasElement
 */
export type CanvasElement = ShapeElement | TextElement | ImageElement | GroupElement

/**
 * 画布状态接口
 * 定义了画布应用的完整状态结构
 * 
 * @interface CanvasState
 * 
 * @property {CanvasElement[]} elements - 画布上的所有元素列表
 * @property {string[]} selectedIds - 当前选中的元素ID列表，空数组表示无选中
 * @property {number} zoom - 画布缩放比例（0.25-3.0，1.0为原始大小）
 * @property {Object} pan - 画布平移偏移量
 * @property {number} pan.x - 水平平移偏移量（像素）
 * @property {number} pan.y - 垂直平移偏移量（像素）
 * @property {InteractionMode} interactionMode - 当前交互模式（选择或平移）
 * @property {CanvasElement[][]} history - 操作历史记录栈，每个元素是历史时刻的元素数组
 * @property {CanvasElement[][]} redoStack - 重做操作栈，用于存储撤销后的操作
 * 
 * @example
 * ```typescript
 * const initialState: CanvasState = {
 *   elements: [],
 *   selectedIds: [],
 *   zoom: 1.0,
 *   pan: { x: 0, y: 0 },
 *   interactionMode: "select",
 *   history: [],
 *   redoStack: []
 * };
 * 
 * // 状态变更示例
 * const updatedState: CanvasState = {
 *   ...initialState,
 *   elements: [...initialState.elements, newShapeElement],
 *   selectedIds: [newShapeElement.id],
 *   history: [initialState.elements]
 * };
 * ```
 */
export interface CanvasState {
  elements: CanvasElement[]
  selectedIds: string[]
  zoom: number
  pan: { x: number; y: number }
  interactionMode: InteractionMode
  history: CanvasElement[][]
  redoStack: CanvasElement[][]
}

/**
 * 画布上下文值接口
 * 定义了通过React Context提供的画布操作方法和状态
 * 
 * @interface CanvasContextValue
 * 
 * @property {CanvasState} state - 当前画布状态
 * 
 * @property {function(ShapeVariant): void} addShape - 添加形状元素到画布
 * @param {ShapeVariant} shape - 要添加的形状类型（矩形、圆形或三角形）
 * 
 * @property {function(string=): void} addText - 添加文本元素到画布
 * @param {string} [text="双击编辑文本"] - 文本内容，默认为提示文本
 * 
 * @property {function(string, Object): void} addImage - 添加图片元素到画布
 * @param {string} src - 图片资源的URL或路径
 * @param {Object} [size] - 可选的图片尺寸
 * @param {number} size.width - 图片宽度（像素）
 * @param {number} size.height - 图片高度（像素）
 * 
 * @property {function(string, Partial<CanvasElement>): void} updateElement - 更新单个元素属性
 * @param {string} id - 要更新的元素ID
 * @param {Partial<CanvasElement>} changes - 要更新的属性对象
 * 
 * @property {function(function(CanvasElement): Partial<CanvasElement>): void} updateSelectedElements - 批量更新选中元素属性
 * @param {function(CanvasElement): Partial<CanvasElement>} updater - 更新函数，接收元素返回变更属性
 * 
 * @property {function(function(CanvasElement[]): CanvasElement[], Object): void} mutateElements - 元素变更函数
 * @param {function(CanvasElement[]): CanvasElement[]} updater - 元素数组更新函数
 * @param {Object} [options] - 可选配置
 * @param {boolean} [options.recordHistory=true] - 是否记录历史
 * @param {CanvasElement[]} [options.historySnapshot] - 自定义历史快照
 * 
 * @property {function(string[], boolean): void} setSelection - 设置选中元素
 * @param {string[]} ids - 要选中的元素ID列表
 * @param {boolean} [additive=false] - 是否追加选中（true追加，false替换）
 * 
 * @property {function(): void} clearSelection - 清除所有选中状态
 * 
 * @property {function(): void} deleteSelected - 删除当前选中的元素
 * 
 * @property {function(number): void} setZoom - 设置画布缩放级别
 * @param {number} zoom - 缩放级别（0.25-3.0）
 * 
 * @property {function(Object): void} panBy - 平移画布视图
 * @param {number} delta.x - 水平平移量（像素）
 * @param {number} delta.y - 垂直平移量（像素）
 * 
 * @property {function(InteractionMode): void} setInteractionMode - 设置交互模式
 * @param {InteractionMode} mode - 交互模式（"select"或"pan"）
 * 
 * @property {function(): void} undo - 撤销上一步操作
 * 
 * @property {function(): void} redo - 重做下一步操作
 * 
 * @property {function(import("pixi.js").Application|null): void} registerApp - 注册PIXI应用实例
 * @param {import("pixi.js").Application|null} app - PIXI应用实例或null
 * 
 * @property {function(): string|null} exportAsImage - 导出画布为图片
 * @returns {string|null} 图片的Data URL或null（如果导出失败）
 * 
 * @property {function(): void} copy - 复制当前选中的元素到内部剪贴板
 * 
 * @property {function(): void} paste - 从内部剪贴板粘贴元素到画布
 * 
 * @example
 * ```typescript
 * // 在组件中使用上下文
 * const { state, addShape, updateElement, deleteSelected } = useCanvas();
 * 
 * // 添加矩形
 * addShape("rectangle");
 * 
 * // 更新元素位置
 * updateElement("element-id", { x: 100, y: 100 });
 * 
 * // 删除选中元素
 * if (state.selectedIds.length > 0) {
 *   deleteSelected();
 * }
 * 
 * // 设置缩放
 * setZoom(1.5);
 * 
 * // 平移画布
 * panBy({ x: 50, y: 30 });
 * ```
 */
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
  deleteSelected: () => void
  setZoom: (zoom: number) => void
  panBy: (delta: { x: number; y: number }) => void
  setInteractionMode: (mode: InteractionMode) => void
  undo: () => void
  redo: () => void
  registerApp: (app: import("pixi.js").Application | null) => void
  exportAsImage: () => string | null
  copy: () => void
  paste: () => void
  /**
   * 将选中的多个元素组合成一个组元素
   * 
   * @function groupElements
   * 
   * @description 
   * 将当前选中的多个元素组合成一个组元素，执行以下操作：
   * 1. 检查是否选中了多个元素，若只有一个或没有选中则不执行
   * 2. 计算选中元素的边界框，作为组的位置和大小
   * 3. 创建一个新的组元素，包含所有选中元素的ID
   * 4. 从画布中移除原选中的元素
   * 5. 将新组元素添加到画布并选中它
   * 6. 记录历史以便撤销
   */
  groupElements: () => void

  /**
   * 将选中的组元素解散为独立元素
   * 
   * @function ungroupElements
   * 
   * @description 
   * 将当前选中的组元素解散，执行以下操作：
   * 1. 检查是否选中了一个组元素，若未选中或选中了多个元素则不执行
   * 2. 获取组内所有子元素的引用
   * 3. 将子元素的位置转换为相对于画布的全局位置
   * 4. 从画布中移除组元素
   * 5. 将子元素添加回画布并选中它们
   * 6. 记录历史以便撤销
   */
  ungroupElements: () => void
}
