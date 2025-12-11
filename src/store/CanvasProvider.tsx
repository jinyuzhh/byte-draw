import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react"
import type { ReactNode } from "react"
import type { Application } from "pixi.js"
import type {
  CanvasContextValue,
  CanvasElement,
  CanvasState,
  InteractionMode,
  ShapeVariant,
  GroupElement,
  Artboard
} from "../types/canvas"

/**
 * 生成唯一标识符
 * 
 * @function createId
 * @returns {string} 生成的唯一ID
 * 
 * @description 
 * 使用 Crypto API 的 randomUUID 方法生成符合 RFC 4122 标准的 UUID。
 * 用于为画布元素创建唯一标识符。
 */
const createId = () => crypto.randomUUID()

/**
 * 深度复制对象
 * 
 * @function deepCopy
 * @template T - 要复制的对象类型
 * @param {T} value - 要复制的对象
 * @returns {T} 复制后的新对象
 * 
 * @description 
 * 优先使用 structuredClone API 进行深度复制，如果不可用则使用 JSON 方法作为后备。
 * 确保返回的对象与原对象完全独立，修改不会影响原对象。
 * 用于创建元素数组的副本，避免引用共享问题。
 */
const deepCopy = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

// 本地存储键名，用于保存画布状态
const STORAGE_KEY = "my-figma:canvas-state"

/**
 * 画布基础状态
 * 
 * @constant {CanvasState} baseState
 * @description 
 * 定义画布的初始状态，包括：
 * - elements: 画布元素数组
 * - selectedIds: 当前选中的元素ID列表
 * - zoom: 画布缩放比例
 * - pan: 画布平移偏移量
 * - interactionMode: 交互模式（选择/平移）
 * - history: 撤销历史记录栈
 * - redoStack: 重做历史记录栈
 */
const baseState: CanvasState = {
  elements: [],
  selectedIds: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
  interactionMode: "select",
  history: [],
  redoStack: [],
  artboard: {
    // 画板位于虚拟画布(4000x4000)的中心
    // x = virtualCenter - width/2 = 2000 - 400 = 1600
    // y = virtualCenter - height/2 = 2000 - 300 = 1700
    x: 1600,
    y: 1700,
    width: 800,
    height: 600,
    backgroundColor: "#ffffff",
    opacity: 1,
    visible: true
  },
  editingTextId: null,  // 当前正在编辑的文本元素ID
}

/**
 * 获取初始画布状态
 * 
 * @function getInitialState
 * @returns {CanvasState} 初始画布状态
 * 
 * @description 
 * 从本地存储中恢复画布状态，如果不存在或无效则返回基础状态。
 * 只恢复元素列表、平移偏移和缩放比例，其他状态使用默认值。
 * 处理了各种边界情况，如存储数据格式不正确、解析错误等。
 */
const getInitialState = (): CanvasState => {
  const fallback = deepCopy(baseState)
  if (typeof window === "undefined") return fallback

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return fallback

    const parsed = JSON.parse(stored)

    // 状态恢复
    return {
      ...fallback,
      elements: Array.isArray(parsed?.elements) ? parsed.elements : [],
      selectedIds: Array.isArray(parsed?.selectedIds) ? parsed.selectedIds : [],
      pan:
        parsed?.pan && typeof parsed.pan.x === "number" && typeof parsed.pan.y === "number"
          ? parsed.pan
          : fallback.pan,
      zoom: typeof parsed?.zoom === "number" ? parsed.zoom : fallback.zoom,
      interactionMode: parsed?.interactionMode || fallback.interactionMode,
      // 合并画板属性，确保新增的 opacity 属性有默认值
      // 同时重新计算画板位置，使其居中于虚拟画布 (4000x4000)
      artboard: parsed?.artboard 
        ? {
            ...fallback.artboard,
            ...parsed.artboard,
            // 强制重新计算居中位置: x = 2000 - width/2, y = 2000 - height/2
            x: 2000 - (parsed.artboard.width || 800) / 2,
            y: 2000 - (parsed.artboard.height || 600) / 2,
          }
        : fallback.artboard,
    }
  } catch (error) {
    console.error("Failed to load canvas state from local storage", error)
    return fallback
  }
}

/**
 * 画布状态管理动作类型
 * 
 * @description 
 * 定义了所有可以修改画布状态的动作类型，包括元素操作、选择管理、
 * 视图控制和历史记录管理等。使用联合类型确保动作类型的类型安全。
 */
type Action =
  | {
    type: "SET_ELEMENTS"
    payload: {
      updater: (elements: CanvasElement[]) => CanvasElement[]
      recordHistory: boolean
      historySnapshot?: CanvasElement[]
    }
  }
  | { type: "SET_SELECTION"; payload: string[]; additive?: boolean }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_ZOOM"; payload: number }
  | { type: "SET_PAN"; payload: { x: number; y: number } }
  | { type: "PAN_BY"; payload: { x: number; y: number } }
  | { type: "SET_MODE"; payload: InteractionMode }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_ARTBOARD"; payload: Artboard | null }
  | { type: "UPDATE_ARTBOARD_COLOR"; payload: string }
  | { type: "UPDATE_ARTBOARD"; payload: Partial<Artboard> }
  | { type: "START_EDITING_TEXT"; payload: string }
  | { type: "STOP_EDITING_TEXT" }

/**
 * 画布状态管理 Reducer
 * 
 * @function canvasReducer
 * @param {CanvasState} state - 当前画布状态
 * @param {Action} action - 状态更新动作
 * @returns {CanvasState} 更新后的画布状态
 * 
 * @description 
 * 根据动作类型更新画布状态，实现以下功能：
 * 1. SET_ELEMENTS: 更新元素列表，可选择是否记录历史
 * 2. SET_SELECTION: 设置选中元素，支持累加选择模式
 * 3. CLEAR_SELECTION: 清除所有选中状态
 * 4. SET_ZOOM: 设置画布缩放比例
 * 5. PAN_BY: 相对平移画布视图
 * 6. SET_MODE: 设置交互模式（选择/平移）
 * 7. UNDO: 撤销上一步操作
 * 8. REDO: 重做已撤销的操作
 */
const canvasReducer = (state: CanvasState, action: Action): CanvasState => {
  switch (action.type) {
    case "SET_ELEMENTS": {
      // 创建元素列表的工作副本，避免直接修改原数组
      const workingCopy = deepCopy(state.elements)
      // 应用更新函数
      const updated = action.payload.updater(workingCopy)
      // 判断是否需要记录历史
      const shouldRecord = action.payload.recordHistory
      return {
        ...state,
        elements: updated,
        // 根据需要记录历史快照
        history: shouldRecord
          ? [...state.history, action.payload.historySnapshot ?? deepCopy(state.elements)]
          : state.history,
        // 记录历史时清空重做栈
        redoStack: shouldRecord ? [] : state.redoStack,
      }
    }
    case "SET_SELECTION":
      return {
        ...state,
        // 根据累加模式决定是追加选择还是替换选择
        selectedIds: action.additive
          ? Array.from(new Set([...state.selectedIds, ...action.payload]))
          : action.payload,
      }
    case "CLEAR_SELECTION":
      return { ...state, selectedIds: [] }
    case "SET_ZOOM":
      return { ...state, zoom: action.payload }
    case "SET_PAN":
      return { ...state, pan: action.payload }
    case "PAN_BY":
      return {
        ...state,
        // 在当前平移基础上累加新的偏移量
        pan: {
          x: state.pan.x + action.payload.x,
          y: state.pan.y + action.payload.y,
        },
      }
    case "SET_MODE":
      return { ...state, interactionMode: action.payload }
    case "UNDO": {
      // 检查是否有可撤销的历史记录
      if (!state.history.length) return state
      // 获取最近的历史记录
      const previous = state.history[state.history.length - 1]
      // 创建新的历史栈（移除最后一个）
      const nextHistory = state.history.slice(0, -1)
      return {
        ...state,
        elements: previous,
        history: nextHistory,
        // 将当前状态添加到重做栈
        redoStack: [deepCopy(state.elements), ...state.redoStack],
        // 撤销时清除选择状态
        selectedIds: [],
      }
    }
    case "REDO": {
      // 检查是否有可重做的操作
      if (!state.redoStack.length) return state
      // 获取重做栈的第一个元素
      const [next, ...rest] = state.redoStack
      return {
        ...state,
        elements: next,
        // 将当前状态添加到历史栈
        history: [...state.history, deepCopy(state.elements)],
        // 更新重做栈
        redoStack: rest,
        // 重做时清除选择状态
        selectedIds: [],
      }
    }
    case "SET_ARTBOARD":
      return { ...state, artboard: action.payload }
    case "UPDATE_ARTBOARD_COLOR":
      if (!state.artboard) return state
      return { 
        ...state, 
        artboard: { ...state.artboard, backgroundColor: action.payload } 
      }
    case "UPDATE_ARTBOARD": {
      if (!state.artboard) return state
      // 计算新的尺寸
      const newWidth = action.payload.width ?? state.artboard.width
      const newHeight = action.payload.height ?? state.artboard.height
      // 如果尺寸变化，重新计算位置以保持居中
      const newX = action.payload.width !== undefined 
        ? 2000 - newWidth / 2 
        : (action.payload.x ?? state.artboard.x)
      const newY = action.payload.height !== undefined 
        ? 2000 - newHeight / 2 
        : (action.payload.y ?? state.artboard.y)
      return { 
        ...state, 
        artboard: { 
          ...state.artboard, 
          ...action.payload,
          x: newX,
          y: newY,
        } 
      }
    }
    case "START_EDITING_TEXT":
      return { ...state, editingTextId: action.payload }
    case "STOP_EDITING_TEXT":
      return { ...state, editingTextId: null }
    default:
      // 未知动作类型，返回原状态
      return state
  }
}

const CanvasContext = createContext<CanvasContextValue | null>(null)

/**
 * CanvasProvider 画布状态提供者组件
 * 
 * @component CanvasProvider
 * @param {ReactNode} children - 子组件
 * @returns {JSX.Element} Context Provider 组件
 * 
 * @description 
 * 提供画布状态管理的上下文，实现以下功能：
 * 1. 管理画布元素（添加、更新、删除）
 * 2. 处理元素选择和批量操作
 * 3. 实现撤销/重做功能
 * 4. 管理画布缩放和平移
 * 5. 提供剪贴板功能（复制/粘贴）
 * 6. 导出画布为图片
 */
export const CanvasProvider = ({ children }: { children: ReactNode }) => {
  // 使用 useReducer 管理画布状态，通过 getInitialState 初始化状态
  const [state, dispatch] = useReducer(canvasReducer, undefined, getInitialState)
  // 存储 PixiJS 应用实例的引用
  const appRef = useRef<Application | null>(null)
  // 存储滚动容器DOM元素的引用，用于获取当前滚动位置
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [isInitialized] = useState(true)

  // 使用 useRef 作为内部剪贴板，存储复制的元素
  const clipboardRef = useRef<CanvasElement[]>([])
  // 计算粘贴次数，用来计算连续粘贴的偏移量
  const pasteCountRef = useRef(1)

  /**
   * 获取当前视口中心的画布坐标
   * 
   * @function getViewportCenter
   * @returns {{ x: number, y: number }} 视口中心的画布坐标
   * 
   * @description 
   * 根据当前滚动位置和视口尺寸计算视口中心在画布坐标系中的位置：
   * 1. 从滚动容器获取当前滚动位置（scrollLeft, scrollTop）
   * 2. 从 PixiJS 应用获取视口尺寸
   * 3. 考虑缩放比例计算实际的画布坐标
   */
  const getViewportCenter = useCallback(() => {

    const scrollContainer = scrollContainerRef.current
    const app = appRef.current

    // 计算当前的缩放比例
    const zoom = state.zoom

    if (scrollContainer && app) {
      // 如果有滚动容器和应用实例，使用实际的视口信息计算
      // 获取当前滚动位置
      const scrollX = scrollContainer.scrollLeft
      const scrollY = scrollContainer.scrollTop

      // 获取视口尺寸
      const viewportWidth = scrollContainer.clientWidth
      const viewportHeight = scrollContainer.clientHeight

      // 计算视口中心在画布坐标系中的位置
      const centerX = scrollX + (viewportWidth / 2) / zoom
      const centerY = scrollY + (viewportHeight / 2) / zoom

      return { x: centerX, y: centerY }
    } else {
      // 如果没有滚动容器或应用实例，使用当前的pan值和默认视口尺寸计算
      // 默认视口尺寸（假设中等屏幕大小）
      const defaultViewportWidth = 800
      const defaultViewportHeight = 600

      // 使用当前的pan值作为滚动位置
      const scrollX = state.pan.x
      const scrollY = state.pan.y

      // 计算视口中心在画布坐标系中的位置
      const centerX = scrollX + (defaultViewportWidth / 2) / zoom
      const centerY = scrollY + (defaultViewportHeight / 2) / zoom

      return { x: centerX, y: centerY }
    }
  }, [state.zoom, state.pan])

  /**
   * 获取画板中心的画布坐标
   * 
   * @function getArtboardCenter
   * @returns {{ x: number, y: number }} 画板中心的画布坐标
   * 
   * @description 
   * 返回画板中心位置，如果没有画板则回退到视口中心
   */
  const getArtboardCenter = useCallback(() => {
    const artboard = state.artboard
    if (artboard && artboard.visible) {
      // 计算画板中心位置
      return {
        x: artboard.x + artboard.width / 2,
        y: artboard.y + artboard.height / 2,
      }
    }
    // 如果没有画板，回退到视口中心
    return getViewportCenter()
  }, [state.artboard, getViewportCenter])

  /**
   * 更新元素列表的核心方法
   * 
   * @function mutateElements
   * @param {function} updater - 更新函数，接收当前元素数组并返回更新后的数组
   * @param {object} options - 可选配置项
   * @param {boolean} options.recordHistory - 是否记录历史，默认为 true
   * @param {CanvasElement[]} options.historySnapshot - 自定义历史快照
   * 
   * @description 
   * 这是所有元素更新的核心方法，通过 dispatch SET_ELEMENTS 动作来更新状态。
   * 支持控制是否记录历史，以及提供自定义历史快照。
   */
  const mutateElements = useCallback(
    (
      updater: (elements: CanvasElement[]) => CanvasElement[],
      options?: { recordHistory?: boolean; historySnapshot?: CanvasElement[] }
    ) =>
      dispatch({
        type: "SET_ELEMENTS",
        payload: {
          updater,
          recordHistory: options?.recordHistory ?? true,
          historySnapshot: options?.historySnapshot,
        },
      }),
    []
  )

  /**
   * 设置选中元素
   * 
   * @function setSelection
   * @param {string[]} ids - 要选中的元素ID数组
   * @param {boolean} additive - 是否累加选择模式，默认为 false
   * 
   * @description 
   * 设置当前选中的元素列表。当 additive 为 true 时，新的选择会添加到现有选择中；
   * 为 false 时，会替换当前选择。通过 dispatch SET_SELECTION 动作更新状态。
   */
  const setSelection = useCallback(
    (ids: string[], additive = false) =>
      dispatch({ type: "SET_SELECTION", payload: ids, additive }),
    []
  )

  /**
   * 复制选中的元素到剪贴板
   * 
   * @function copy
   * 
   * @description 
   * 将当前选中的元素复制到内部剪贴板。
   * 使用深拷贝确保剪贴板中的元素与原始元素完全独立，
   * 防止后续修改影响原始数据。
   */
  const copy = useCallback(() => {
    // 筛选出当前选中的元素
    const selectedElements = state.elements.filter((el) =>
      state.selectedIds.includes(el.id)
    )
    if (selectedElements.length > 0) {
      // 深拷贝存储，防止引用关联
      clipboardRef.current = deepCopy(selectedElements)
      pasteCountRef.current = 1
    }
  }, [state.elements, state.selectedIds])

  /**
   * 从剪贴板粘贴元素
   * 
   * @function paste
   * 
   * @description 
   * 将剪贴板中的元素粘贴到画布上，执行以下操作：
   * 1. 为每个元素生成新的唯一ID
   * 2. 将元素位置偏移20px，避免与原元素重叠
   * 3. 在元素名称后添加"副本"后缀
   * 4. 使用深拷贝确保新元素与剪贴板断开关联
   * 5. 将新元素添加到画布并选中它们
   */
  const paste = useCallback(() => {
    const clipboard = clipboardRef.current
    if (!clipboard.length) return

    const newElements: CanvasElement[] = []
    const newIds: string[] = []

    //计算偏移量：20px*连续粘贴次数
    const offset = 20 * pasteCountRef.current

    clipboard.forEach((item) => {
      const id = createId()
      newIds.push(id)
      // 生成新元素：新ID，位置偏移 20px
      const newElement = {
        ...deepCopy(item), // 再次深拷贝，确保新粘贴的元素与剪贴板断开关联
        id,
        name: `${item.name} 副本`,
        x: item.x + offset,
        y: item.y + offset,
      }
      newElements.push(newElement)
    })

    // 将新元素添加到画布
    mutateElements((prev) => [...prev, ...newElements])
    // 选中新粘贴的元素
    dispatch({ type: "SET_SELECTION", payload: newIds })
    //  计数器+1
    pasteCountRef.current += 1
  }, [mutateElements])



  /**
   * 清除所有选中状态
   * 
   * @function clearSelection
   * 
   * @description 
   * 清除当前所有元素的选中状态，通过 dispatch CLEAR_SELECTION 动作实现。
   * 通常在执行某些操作后需要取消选择时使用。
   */
  const clearSelection = useCallback(
    () => dispatch({ type: "CLEAR_SELECTION" }),
    []
  )

  /**
   * 添加形状元素到画布
   * 
   * @function addShape
   * @param {ShapeVariant} shape - 形状类型（rectangle 或 circle）
   * 
   * @description 
   * 创建一个新的形状元素并添加到画布中：
   * 1. 根据形状类型设置默认尺寸（矩形：220x140，圆形：160x160）
   * 2. 将元素放置在当前视口中心位置
   * 3. 矩形默认圆角为12px，圆形无圆角
   * 4. 将新元素添加到画布并自动选中
   */
  const addShape = useCallback(
    (shape: ShapeVariant) => {
      const id = createId()
      // 根据形状类型设置默认尺寸
      const size = shape === "rectangle" ? { width: 220, height: 140 } : { width: 160, height: 160 }
      // 计算画板中心位置，将元素放置在中心
      const center = getArtboardCenter()
      const element: CanvasElement = {
        id,
        type: "shape",
        name: `${shape} ${state.elements.length + 1}`,
        x: center.x - size.width / 2,
        y: center.y - size.height / 2,
        width: size.width,
        height: size.height,
        rotation: 0,
        opacity: 1,
        shape,
        fill: "#f8fafc",
        stroke: "#0f172a",
        strokeWidth: 1,
        // 矩形默认圆角为12px，圆形无圆角
        cornerRadius: shape === "rectangle" ? 12 : 0,
      }
      // 将新元素添加到画布
      mutateElements((elements) => [...elements, element])
      // 自动选中新添加的元素
      dispatch({ type: "SET_SELECTION", payload: [id] })
      // 自动切换到选择模式
      dispatch({ type: "SET_MODE", payload: "select" })
    },
    [mutateElements, state.elements.length, getArtboardCenter]
  )

  /**
   * 添加文本元素到画布
   * 
   * @function addText
   * @param {string} text - 文本内容，默认为"双击编辑文本"
   * 
   * @description 
   * 创建一个新的文本元素并添加到画布中：
   * 1. 将元素放置在当前视口中心位置
   * 2. 使用默认字体样式（Inter字体，24px大小，500字重）
   * 3. 设置默认文本颜色和背景色
   * 4. 将新元素添加到画布并自动选中
   */
  const addText = useCallback(
    (text = "双击编辑文本") => {
      const id = createId()
      // 计算画板中心位置，将元素放置在中心
      const center = getArtboardCenter()
      const width = 260
      const height = 80
      const element: CanvasElement = {
        id,
        type: "text",
        name: `文本 ${state.elements.length + 1}`,
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height,
        rotation: 0,
        opacity: 1,
        text: text || "请输入文本内容...", // 如果传入空串，则使用默认文本
        fontSize: 24,
        fontFamily: "Inter",
        fontWeight: 500,
        align: "left",
        verticalAlign: "top",
        color: "#0f172a",
        background: "#ffffff",
        lineHeight: 1.3,
        letterSpacing: 0,
        italic: false,
        underline: false,
        textTransform: "none",
      }
      // 将新元素添加到画布
      mutateElements((elements) => [...elements, element])
      // 自动选中新添加的元素
      dispatch({ type: "SET_SELECTION", payload: [id] })
      // 自动切换到选择模式
      dispatch({ type: "SET_MODE", payload: "select" })
    },
    [mutateElements, state.elements.length, getArtboardCenter]
  )

  /**
   * 添加图片元素到画布
   * 
   * @function addImage
   * @param {string} src - 图片URL或数据URI
   * @param {object} size - 可选的图片尺寸
   * @param {number} size.width - 图片宽度，默认为240
   * @param {number} size.height - 图片高度，默认为160
   * 
   * @description 
   * 创建一个新的图片元素并添加到画布中：
   * 1. 将元素放置在当前视口中心位置
   * 2. 初始化默认滤镜设置（无灰度、无模糊、正常亮度）
   * 3. 设置默认圆角为12px
   * 4. 将新元素添加到画布并自动选中
   */
  const addImage = useCallback(
    (src: string, size?: { width: number; height: number }) => {
      const id = createId()
      // 计算画板中心位置，将元素放置在中心
      const center = getArtboardCenter()
      // 使用传入的尺寸或默认尺寸
      const width = size?.width ?? 240
      const height = size?.height ?? 160
      const element: CanvasElement = {
        id,
        type: "image",
        name: `图片 ${state.elements.length + 1}`,
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height,
        rotation: 0,
        opacity: 1,
        src,
        // 初始化默认滤镜设置
        filters: {
          grayscale: false,
          blur: 0,
          brightness: 1,
        },
        borderRadius: 12,
      }
      // 将新元素添加到画布
      mutateElements((elements) => [...elements, element])
      // 自动选中新添加的元素
      dispatch({ type: "SET_SELECTION", payload: [id] })
      // 自动切换到选择模式
      dispatch({ type: "SET_MODE", payload: "select" })
    },
    [mutateElements, state.elements.length, getArtboardCenter]
  )

  /**
   * 更新单个元素的属性
   * 
   * @function updateElement
   * @param {string} id - 要更新的元素ID
   * @param {Partial<CanvasElement>} changes - 要更新的属性对象
   * 
   * @description 
   * 根据元素ID更新指定元素的属性：
   * 1. 查找匹配ID的元素
   * 2. 将传入的属性合并到元素中
   * 3. 保留未指定的原有属性
   * 4. 自动记录历史以便撤销
   */
  const updateElement = useCallback(
    (id: string, changes: Partial<CanvasElement>) => {
      mutateElements(
        (elements) =>
          elements.map((el) => (el.id === id ? { ...el, ...changes } : el)) as CanvasElement[]
      )
    },
    [mutateElements]
  )

  /**
   * 批量更新所有选中元素的属性
   * 
   * @function updateSelectedElements
   * @param {function} updater - 更新函数，接收当前元素并返回要更新的属性
   * 
   * @description 
   * 对当前选中的所有元素应用相同的更新逻辑：
   * 1. 检查是否有选中的元素，无则直接返回
   * 2. 对每个选中的元素调用updater函数
   * 3. 将返回的属性合并到对应元素中
   * 4. 适用于批量操作如统一修改颜色、字体等
   */
  const updateSelectedElements = useCallback(
    (updater: (element: CanvasElement) => Partial<CanvasElement>) => {
      const ids = state.selectedIds
      // 没有选中元素时直接返回
      if (!ids.length) return
      mutateElements(
        (elements) =>
          elements.map((el) =>
            // 只更新选中的元素
            ids.includes(el.id) ? { ...el, ...updater(el) } : el
          ) as CanvasElement[]
      )
    },
    [mutateElements, state.selectedIds]
  )

  /**
   * 删除所有选中的元素
   * 
   * @function deleteSelected
   * 
  /**
   * 删除所有选中的元素
   * 
   * @function deleteSelected
   * 
   * @description 
   * 从画布中删除当前选中的所有元素：
   * 1. 检查是否有选中的元素，无则直接返回
   * 2. 过滤掉所有选中的元素
   * 3. 清除选择状态
   * 4. 自动记录历史以便撤销
   */
  const deleteSelected = useCallback(() => {
    // 没有选中元素时直接返回
    if (!state.selectedIds.length) return
    // 过滤掉选中的元素
    mutateElements((elements) =>
      elements.filter((el) => !state.selectedIds.includes(el.id))
    )
    // 清除选择状态
    dispatch({ type: "CLEAR_SELECTION" })
  }, [mutateElements, state.selectedIds])

  /**
   * 开始编辑文本元素
   * 
   * @function startEditingText
   * @param {string} id - 要编辑的文本元素ID
   */
  const startEditingText = useCallback((id: string) => {
    dispatch({ type: "START_EDITING_TEXT", payload: id })
  }, [])

  /**
   * 停止编辑文本元素
   * 
   * @function stopEditingText
   */
  const stopEditingText = useCallback(() => {
    dispatch({ type: "STOP_EDITING_TEXT" })
  }, [])

  /**
   * 将选中的元素移动到最前面（数组末尾）
   * 
   * @function bringToFront
   */
  const bringToFront = useCallback(() => {
    if (!state.selectedIds.length) return
    mutateElements((elements) => {
      const selected = elements.filter(el => state.selectedIds.includes(el.id))
      const rest = elements.filter(el => !state.selectedIds.includes(el.id))
      return [...rest, ...selected]
    })
  }, [mutateElements, state.selectedIds])

  /**
   * 将选中的元素移动到最后面（数组开头）
   * 
   * @function sendToBack
   */
  const sendToBack = useCallback(() => {
    if (!state.selectedIds.length) return
    mutateElements((elements) => {
      const selected = elements.filter(el => state.selectedIds.includes(el.id))
      const rest = elements.filter(el => !state.selectedIds.includes(el.id))
      return [...selected, ...rest]
    })
  }, [mutateElements, state.selectedIds])

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
  const groupElements = useCallback(() => {
    // 检查是否选中了多个元素
    if (state.selectedIds.length <= 1) return

    // 获取选中的元素
    const selectedElements = state.elements.filter(el =>
      state.selectedIds.includes(el.id)
    )

    // 计算选中元素的边界框
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    selectedElements.forEach(el => {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + el.width)
      maxY = Math.max(maxY, el.y + el.height)
    })

    // 创建组元素，保存子元素的完整副本（相对于组的位置）
    const groupId = createId()
    const childElements = selectedElements.map(el => ({
      ...deepCopy(el),
      // 转换为相对于组的位置
      x: el.x - minX,
      y: el.y - minY
    }))

    const group: GroupElement = {
      id: groupId,
      name: `组 ${state.elements.filter(el => el.type === 'group').length + 1}`,
      type: 'group',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      opacity: 1,
      children: childElements
    }

    // 更新元素列表：移除原元素，添加组元素
    mutateElements(elements => {
      // 过滤掉选中的元素
      const elementsWithoutSelected = elements.filter(
        el => !state.selectedIds.includes(el.id)
      )
      // 添加组元素
      return [...elementsWithoutSelected, group]
    })

    // 选中新创建的组
    dispatch({ type: 'SET_SELECTION', payload: [groupId] })
  }, [state.selectedIds, state.elements, mutateElements])

  /**
   * 将选中的组元素解散为独立元素
   * 
   * @function ungroupElements
   * 
   * @description 
   * 将当前选中的组元素解散，执行以下操作：
   * 1. 检查是否选中了一个组元素，若未选中或选中了多个元素则不执行
   * 2. 从组中提取子元素数据
   * 3. 将子元素的位置转换为相对于画布的全局位置
   * 4. 从画布中移除组元素
   * 5. 将子元素添加回画布并选中它们
   * 6. 记录历史以便撤销
   */
  const ungroupElements = useCallback(() => {
    // 检查是否选中了一个组元素
    if (state.selectedIds.length !== 1) return

    const group = state.elements.find(
      el => el.id === state.selectedIds[0] && el.type === 'group'
    ) as GroupElement | undefined

    if (!group || !group.children) return

    // 准备子元素数组，将相对位置转换为绝对位置
    const groupChildren: CanvasElement[] = []
    const newIds: string[] = []

    // 递归处理子元素（支持嵌套组）
    const processChildren = (children: CanvasElement[], parentX: number, parentY: number) => {
      children.forEach(child => {
        // 创建子元素的新副本并分配新ID
        const newElement = { ...deepCopy(child) } as CanvasElement

        // 转换为全局位置
        newElement.x += parentX
        newElement.y += parentY

        // 为嵌套组设置新ID和处理其子元素
        if (newElement.type === 'group' && 'children' in newElement && Array.isArray(newElement.children)) {
          const newId = createId()
          newElement.id = newId
          newIds.push(newId)

          // 递归处理嵌套的子元素 - 确保children是CanvasElement[]类型
          const childElements = newElement.children as CanvasElement[]
          processChildren(childElements, newElement.x, newElement.y)
        } else {
          // 为普通元素设置新ID
          const newId = createId()
          newElement.id = newId
          newIds.push(newId)

          // 添加到子元素数组
          groupChildren.push(newElement)
        }
      })
    }

    // 从根组开始处理 - 确保children是CanvasElement[]类型
    const rootChildren = Array.isArray(group.children) ? (group.children as CanvasElement[]) : []
    processChildren(rootChildren, group.x, group.y)

    // 更新元素列表：移除组元素，添加子元素
    mutateElements(elements => {
      // 过滤掉组元素
      const elementsWithoutGroup = elements.filter(
        el => el.id !== group.id
      )
      // 添加子元素
      return [...elementsWithoutGroup, ...groupChildren]
    })

    // 选中所有解组后的子元素
    dispatch({ type: 'SET_SELECTION', payload: newIds })
  }, [state.selectedIds, state.elements, mutateElements])

  /**
      // 过滤掉组元素
      const elementsWithoutGroup = elements.filter(
        el => el.id !== group.id
      )
      
      // 添加子元素
      return [...elementsWithoutGroup, ...groupChildren]
    })
    
    // 选中解组后的所有子元素
    dispatch({ type: 'SET_SELECTION', payload: groupChildren.map(el => el.id) })
  }, [state.selectedIds, state.elements, mutateElements])

  /**
   * 设置画板
   * 
   * @function setArtboard
   * @param {Artboard | null} artboard - 画板配置或 null
   * 
   * @description 
   * 设置画布的画板区域，画板定义了导出时的裁剪区域
   */
  const setArtboard = useCallback((artboard: Artboard | null) => {
    dispatch({ type: "SET_ARTBOARD", payload: artboard })
  }, [])

  /**
   * 更新画板背景颜色
   * 
   * @function updateArtboardColor
   * @param {string} color - 画板背景颜色（CSS颜色值）
   * 
   * @description 
   * 更新画板的背景颜色
   */
  const updateArtboardColor = useCallback((color: string) => {
    dispatch({ type: "UPDATE_ARTBOARD_COLOR", payload: color })
  }, [])

  /**
   * 更新画板属性
   * 
   * @function updateArtboard
   * @param {Partial<Artboard>} changes - 画板属性变更对象
   * 
   * @description 
   * 更新画板的任意属性，包括宽度、高度、颜色、透明度等
   */
  const updateArtboard = useCallback((changes: Partial<Artboard>) => {
    dispatch({ type: "UPDATE_ARTBOARD", payload: changes })
  }, [])

  /**
   * 更新画板属性并自适应缩放居中显示
   * 
   * @function updateArtboardWithFit
   * @param {Partial<Artboard>} changes - 画板属性变更对象
   * 
   * @description 
   * 更新画板属性（尤其是尺寸），并执行以下操作：
   * 1. 重新计算画板位置，使其居中于虚拟画布（4000x4000）
   * 2. 居中和自适应缩放由 PixiCanvas 中的 useEffect 自动处理
   */
  const updateArtboardWithFit = useCallback((changes: Partial<Artboard>) => {
    const virtualCanvasSize = 4000
    const currentArtboard = state.artboard
    
    // 计算新的画板尺寸
    const newWidth = changes.width ?? currentArtboard?.width ?? 800
    const newHeight = changes.height ?? currentArtboard?.height ?? 600
    
    // 计算画板在虚拟画布中的居中位置
    const newX = (virtualCanvasSize - newWidth) / 2
    const newY = (virtualCanvasSize - newHeight) / 2
    
    // 更新画板属性，包含新的位置
    // PixiCanvas 中的 useEffect 会监听 artboard 尺寸变化并自动居中和缩放
    dispatch({ 
      type: "UPDATE_ARTBOARD", 
      payload: { 
        ...changes, 
        x: newX, 
        y: newY 
      } 
    })
  }, [state.artboard])

  /**
   * 设置画布缩放比例
   * 
   * @function setZoom
   * @param {number} zoom - 目标缩放比例
   * 
   * @description 
   * 设置画布的缩放比例，限制在0.25到3之间：
   * 1. 使用Math.min和Math.max确保缩放比例在合理范围内
   * 2. 通过dispatch SET_ZOOM动作更新状态
   * 3. 缩放会影响画布中所有元素的显示大小
   */
  const setZoom = useCallback((zoom: number) => {
    // 限制缩放比例在0.25到3之间
    const next = Math.min(3, Math.max(0.25, zoom))
    dispatch({ type: "SET_ZOOM", payload: next })
  }, [])

  /**
   * 相对平移画布视图
   * 
   * @function panBy
   * @param {object} delta - 平移距离
   * @param {number} delta.x - X轴方向的平移距离
   * @param {number} delta.y - Y轴方向的平移距离
   * 
   * @description 
   * 根据指定的距离相对平移画布视图：
   * 1. 接收X和Y方向的平移距离
   * 2. 通过dispatch PAN_BY动作更新状态
   * 3. 平移会影响画布中所有元素的显示位置
   */
  const panBy = useCallback((delta: { x: number; y: number }) => {
    dispatch({ type: "PAN_BY", payload: delta })
  }, [])

  /**
   * 设置画布交互模式
   * 
   * @function setInteractionMode
   * @param {InteractionMode} mode - 交互模式（select 或 pan）
   * 
   * @description 
   * 设置画布的交互模式：
   * 1. select模式：可以选择和操作画布元素
   * 2. pan模式：可以平移整个画布视图
   * 3. 通过dispatch SET_MODE动作更新状态
   */
  const setInteractionMode = useCallback(
    (mode: InteractionMode) => dispatch({ type: "SET_MODE", payload: mode }),
    []
  )

  /**
   * 撤销上一步操作
   * 
   * @function undo
   * 
   * @description 
   * 撤销上一步操作，恢复到上一个历史状态：
   * 1. 从历史栈中取出上一个状态
   * 2. 将当前状态添加到重做栈
   * 3. 恢复到上一个状态并清除选择
   */
  const undo = useCallback(() => dispatch({ type: "UNDO" }), [])

  /**
   * 重做已撤销的操作
   * 
   * @function redo
   * 
   * @description 
   * 重做已撤销的操作，恢复到下一个历史状态：
   * 1. 从重做栈中取出下一个状态
   * 2. 将当前状态添加到历史栈
   * 3. 恢复到下一个状态并清除选择
   */
  const redo = useCallback(() => dispatch({ type: "REDO" }), [])

  /**
   * 注册PixiJS应用实例
   * 
   * @function registerApp
   * @param {Application} app - PixiJS应用实例
   * 
   * @description 
   * 将PixiJS应用实例存储到ref中：
   * 1. 用于后续的画布导出功能
   * 2. 确保CanvasProvider可以访问PixiJS应用
   * 3. 通常在PixiCanvas组件初始化时调用
   */
  const registerApp = useCallback((app: Application | null) => {
    appRef.current = app
  }, [])

  /**
   * 注册滚动容器DOM元素
   * 
   * @function registerScrollContainer
   * @param {HTMLDivElement | null} container - 滚动容器DOM元素
   * 
   * @description 
   * 将滚动容器DOM元素存储到ref中：
   * 1. 用于获取当前滚动位置来计算视口中心
   * 2. 使添加新元素时可以将其放置在当前可见视口的中心位置
   * 3. 通常在PixiCanvas组件初始化时调用
   */
  const registerScrollContainer = useCallback((container: HTMLDivElement | null) => {
    scrollContainerRef.current = container
  }, [])

  /**
   * 导出画布为PNG图片
   * 
   * @function exportAsImage
   * @returns {string|null} 图片的Data URL或null（如果导出失败）
   * 
   * @description 
   * 将当前画布导出为用户选定格式的图片：
   * 1. 获取已注册的PixiJS应用实例
   * 2. 如果存在画板，只导出画板区域的内容
   * 3. 使用 Canvas 2D API 重新绘制所有元素
   * 4. 将 canvas 转换为指定格式的 Data URL
   * 5. 返回可用于下载或显示的图片数据
   */
  const exportAsImage = useCallback(async (
    options?: {
      format?: 'png' | 'jpg' | 'jpeg'
      quality?: number
      scale?: number
  }): Promise<string | null> => {
    const {
      format = 'png',
      quality = 1,
      scale = 1
    } = options || {}

    const artboard = state.artboard
    const elements = state.elements
    
    // 创建导出用的 canvas
    const exportCanvas = document.createElement('canvas')
    
    // 设置 canvas 尺寸
    if (artboard && artboard.visible) {
      exportCanvas.width = artboard.width * scale
      exportCanvas.height = artboard.height * scale
    } else {
      // 没有画板时，计算所有元素的边界
      const bounds = elements.reduce((acc, el) => ({
        minX: Math.min(acc.minX, el.x),
        minY: Math.min(acc.minY, el.y),
        maxX: Math.max(acc.maxX, el.x + el.width),
        maxY: Math.max(acc.maxY, el.y + el.height),
      }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
      
      exportCanvas.width = (bounds.maxX - bounds.minX) * scale || 800
      exportCanvas.height = (bounds.maxY - bounds.minY) * scale || 600
    }
    
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return null
    
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    
    // 应用缩放
    ctx.scale(scale, scale)
    
    // 计算偏移量（将画板或内容移到原点）
    const offsetX = artboard?.visible ? -artboard.x : 0
    const offsetY = artboard?.visible ? -artboard.y : 0
    
    // 绘制画板背景
    if (artboard && artboard.visible) {
      ctx.fillStyle = artboard.backgroundColor || '#ffffff'
      ctx.fillRect(0, 0, artboard.width, artboard.height)
    }
    
    // 辅助函数：将十六进制颜色转换为 CSS 颜色
    const hexToColor = (hex: string) => {
      if (hex.startsWith('#')) return hex
      return `#${hex}`
    }
    
    // 辅助函数：加载图片
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })
    }
    
    // 收集所有图片元素的 src
    const collectImageSrcs = (elements: CanvasElement[]): string[] => {
      const srcs: string[] = []
      elements.forEach(el => {
        if (el.type === 'image') {
          srcs.push(el.src)
        } else if (el.type === 'group' && el.children) {
          srcs.push(...collectImageSrcs(el.children as CanvasElement[]))
        }
      })
      return srcs
    }
    
    // 预加载所有图片
    const imageSrcs = collectImageSrcs(elements)
    const imageCache = new Map<string, HTMLImageElement>()
    
    await Promise.all(
      imageSrcs.map(async (src) => {
        try {
          const img = await loadImage(src)
          imageCache.set(src, img)
        } catch {
          console.warn('Failed to load image:', src)
        }
      })
    )
    
    // 绘制所有元素（异步版本）
    const drawElement = async (element: CanvasElement, ctx: CanvasRenderingContext2D) => {
      ctx.save()
      
      // 计算元素在导出画布中的位置
      const x = element.x + offsetX
      const y = element.y + offsetY
      
      // 应用旋转（绕元素中心）
      if (element.rotation !== 0) {
        const centerX = x + element.width / 2
        const centerY = y + element.height / 2
        ctx.translate(centerX, centerY)
        ctx.rotate((element.rotation * Math.PI) / 180)
        ctx.translate(-centerX, -centerY)
      }
      
      // 应用透明度
      ctx.globalAlpha = element.opacity
      
      // 根据元素类型绘制
      if (element.type === 'shape') {
        const fillColor = hexToColor(element.fill)
        const strokeColor = hexToColor(element.stroke)
        
        ctx.beginPath()
        
        switch (element.shape) {
          case 'rectangle':
            if (element.cornerRadius > 0) {
              // 圆角矩形
              const r = element.cornerRadius
              ctx.moveTo(x + r, y)
              ctx.lineTo(x + element.width - r, y)
              ctx.quadraticCurveTo(x + element.width, y, x + element.width, y + r)
              ctx.lineTo(x + element.width, y + element.height - r)
              ctx.quadraticCurveTo(x + element.width, y + element.height, x + element.width - r, y + element.height)
              ctx.lineTo(x + r, y + element.height)
              ctx.quadraticCurveTo(x, y + element.height, x, y + element.height - r)
              ctx.lineTo(x, y + r)
              ctx.quadraticCurveTo(x, y, x + r, y)
            } else {
              ctx.rect(x, y, element.width, element.height)
            }
            break
          case 'circle':
            ctx.ellipse(
              x + element.width / 2,
              y + element.height / 2,
              element.width / 2,
              element.height / 2,
              0, 0, Math.PI * 2
            )
            break
          case 'triangle':
            ctx.moveTo(x + element.width / 2, y)
            ctx.lineTo(x + element.width, y + element.height)
            ctx.lineTo(x, y + element.height)
            ctx.closePath()
            break
        }
        
        ctx.fillStyle = fillColor
        ctx.fill()
        
        if (element.strokeWidth > 0) {
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = element.strokeWidth
          ctx.stroke()
        }
      }
      
      else if (element.type === 'text') {
        // 绘制文本背景
        if (element.background !== 'transparent') {
          ctx.fillStyle = hexToColor(element.background)
          ctx.globalAlpha = element.opacity * 0.8
          ctx.beginPath()
          ctx.roundRect(x, y, element.width, element.height, 12)
          ctx.fill()
          ctx.globalAlpha = element.opacity
        }
        
        // 绘制文本
        ctx.fillStyle = hexToColor(element.color)
        ctx.font = `${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`
        ctx.textAlign = element.align as CanvasTextAlign
        ctx.textBaseline = 'top'
        
        // 文本换行处理
        const lines = element.text.split('\n')
        const lineHeight = element.fontSize * element.lineHeight
        let textX = x + 12
        if (element.align === 'center') textX = x + element.width / 2
        else if (element.align === 'right') textX = x + element.width - 12
        
        lines.forEach((line, i) => {
          ctx.fillText(line, textX, y + 12 + i * lineHeight)
        })
      }
      
      else if (element.type === 'image') {
        // 从缓存中获取已加载的图片
        const img = imageCache.get(element.src)
        
        if (img) {
          ctx.save()
          
          // 创建圆角裁剪路径
          if (element.borderRadius > 0) {
            ctx.beginPath()
            ctx.roundRect(x, y, element.width, element.height, element.borderRadius)
            ctx.clip()
          }
          
          // 应用滤镜效果
          if (element.filters.grayscale) {
            ctx.filter = 'grayscale(100%)'
          }
          if (element.filters.blur > 0) {
            ctx.filter = `blur(${element.filters.blur}px)`
          }
          if (element.filters.brightness !== 1) {
            ctx.filter = `brightness(${element.filters.brightness})`
          }
          
          ctx.drawImage(img, x, y, element.width, element.height)
          ctx.restore()
        }
      }
      
      else if (element.type === 'group' && element.children) {
        // 递归绘制组内元素
        for (const child of element.children) {
          // 组内子元素的坐标是相对于组的
          const childWithAbsolutePos = {
            ...child,
            x: element.x + child.x,
            y: element.y + child.y,
          }
          await drawElement(childWithAbsolutePos as CanvasElement, ctx)
        }
      }
      
      ctx.restore()
    }
    
    // 按顺序绘制所有元素
    for (const element of elements) {
      // 如果有画板，只绘制在画板范围内的元素
      if (artboard && artboard.visible) {
        const elementRight = element.x + element.width
        const elementBottom = element.y + element.height
        const artboardRight = artboard.x + artboard.width
        const artboardBottom = artboard.y + artboard.height
        
        // 检查元素是否与画板有交集
        if (element.x < artboardRight && elementRight > artboard.x &&
            element.y < artboardBottom && elementBottom > artboard.y) {
          await drawElement(element, ctx)
        }
      } else {
        await drawElement(element, ctx)
      }
    }
    
    return exportCanvas.toDataURL(`image/${format}`, quality) ?? null
  }, [state.artboard, state.elements])

  /**
   * 持久化画布状态到本地存储
   * 
   * @description 
   * 当画布元素、平移或缩放状态发生变化时，将状态保存到localStorage：
   * 1. 检查是否在浏览器环境中运行
   * 2. 将关键状态序列化为JSON字符串
   * 3. 使用STORAGE_KEY作为键保存到localStorage
   * 4. 实现画布状态的自动持久化
   */
  useEffect(() => {
    // 检查是否在浏览器环境中运行
    if (typeof window === "undefined" || !isInitialized) return

    // 将关键状态序列化为JSON字符串
    const payload = JSON.stringify({
      elements: state.elements,
      selectedIds: state.selectedIds,
      pan: state.pan,
      zoom: state.zoom,
      interactionMode: state.interactionMode,
      artboard: state.artboard,
      // 不保存 history 和 redoStack，避免数据量过大
    })
    // 使用STORAGE_KEY作为键保存到localStorage
    window.localStorage.setItem(STORAGE_KEY, payload)
  }, [state.elements, state.selectedIds, state.pan, state.zoom, state.interactionMode, state.artboard, isInitialized])

  /**
   * 创建上下文值对象
   * 
   * @description 
   * 使用useMemo创建稳定的上下文值对象，包含所有状态和方法：
   * 1. 避免不必要的重新渲染
   * 2. 提供统一的状态和方法访问接口
   * 3. 确保依赖项变化时才重新创建对象
   */
  const value = useMemo<CanvasContextValue>(
    () => ({
      // 当前画布状态
      state,
      isInitialized, // 有关初始化状态的标记
      addShape,
      addText,
      addImage,
      updateElement,
      updateSelectedElements,
      mutateElements,
      // 选择操作方法
      setSelection,
      clearSelection,
      deleteSelected,
      // 视图操作方法
      setZoom,
      panBy,
      setInteractionMode,
      // 历史操作方法
      undo,
      redo,
      // 应用操作方法
      registerApp,
      registerScrollContainer,
      exportAsImage,
      // 剪贴板操作方法
      copy,
      paste,
      // 打组和解组操作方法
      groupElements,
      ungroupElements,
      // 画板操作方法
      setArtboard,
      updateArtboardColor,
      updateArtboard,
      updateArtboardWithFit,
      // 文本编辑操作方法
      startEditingText,
      stopEditingText,
      // 图层排列操作方法
      bringToFront,
      sendToBack,
    }),
    [
      state,
      isInitialized, // 有关初始化状态的标记
      addShape,
      addText,
      addImage,
      updateElement,
      updateSelectedElements,
      mutateElements,
      setSelection,
      clearSelection,
      deleteSelected,
      setZoom,
      panBy,
      setInteractionMode,
      undo,
      redo,
      registerApp,
      registerScrollContainer,
      exportAsImage,
      copy,
      paste,
      groupElements,
      ungroupElements,
      setArtboard,
      updateArtboardColor,
      updateArtboard,
      updateArtboardWithFit,
      startEditingText,
      stopEditingText,
      bringToFront,
      sendToBack,
    ]
  )

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  )
}

/**
 * Canvas上下文Hook
 * 
 * @function useCanvas
 * @returns {CanvasContextValue} 画布上下文值
 * @throws {Error} 如果在CanvasProvider外部使用会抛出错误
 * 
 * @description 
 * 用于在组件中访问画布状态和方法的Hook：
 * 1. 通过useContext获取CanvasContext的值
 * 2. 检查是否在CanvasProvider内部使用
 * 3. 提供类型安全的上下文访问方式
 * 4. 是所有画布相关组件访问状态的标准入口
 */
export const useCanvas = () => {
  // 获取CanvasContext的当前值
  const context = useContext(CanvasContext)
  // 确保Hook在Provider内部使用
  if (!context) {
    throw new Error("useCanvas must be used within CanvasProvider")
  }
  // 返回上下文值，包含所有状态和方法
  return context
}
