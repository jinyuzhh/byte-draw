import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react"
import type { ReactNode } from "react"
import type { Application } from "pixi.js"
import type {
  CanvasContextValue,
  CanvasElement,
  CanvasState,
  InteractionMode,
  ShapeVariant,
} from "../types/canvas"

const createId = () => crypto.randomUUID()

const deepCopy = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

const STORAGE_KEY = "my-figma:canvas-state"

const baseState: CanvasState = {
  elements: [],
  selectedIds: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
  interactionMode: "select",
  history: [],
  redoStack: [],
}

const getInitialState = (): CanvasState => {
  const fallback = deepCopy(baseState)
  if (typeof window === "undefined") return fallback
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return fallback
    const parsed = JSON.parse(stored)
    return {
      ...fallback,
      elements: Array.isArray(parsed?.elements) ? parsed.elements : [],
      pan:
        parsed?.pan && typeof parsed.pan.x === "number" && typeof parsed.pan.y === "number"
          ? parsed.pan
          : fallback.pan,
      zoom: typeof parsed?.zoom === "number" ? parsed.zoom : fallback.zoom,
    }
  } catch {
    return fallback
  }
}

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
  | { type: "PAN_BY"; payload: { x: number; y: number } }
  | { type: "SET_MODE"; payload: InteractionMode }
  | { type: "UNDO" }
  | { type: "REDO" }

const canvasReducer = (state: CanvasState, action: Action): CanvasState => {
  switch (action.type) {
    case "SET_ELEMENTS": {
      const workingCopy = deepCopy(state.elements)
      const updated = action.payload.updater(workingCopy)
      const shouldRecord = action.payload.recordHistory
      return {
        ...state,
        elements: updated,
        history: shouldRecord
          ? [...state.history, action.payload.historySnapshot ?? deepCopy(state.elements)]
          : state.history,
        redoStack: shouldRecord ? [] : state.redoStack,
      }
    }
    case "SET_SELECTION":
      return {
        ...state,
        selectedIds: action.additive
          ? Array.from(new Set([...state.selectedIds, ...action.payload]))
          : action.payload,
      }
    case "CLEAR_SELECTION":
      return { ...state, selectedIds: [] }
    case "SET_ZOOM":
      return { ...state, zoom: action.payload }
    case "PAN_BY":
      return {
        ...state,
        pan: {
          x: state.pan.x + action.payload.x,
          y: state.pan.y + action.payload.y,
        },
      }
    case "SET_MODE":
      return { ...state, interactionMode: action.payload }
    case "UNDO": {
      if (!state.history.length) return state
      const previous = state.history[state.history.length - 1]
      const nextHistory = state.history.slice(0, -1)
      return {
        ...state,
        elements: previous,
        history: nextHistory,
        redoStack: [deepCopy(state.elements), ...state.redoStack],
        selectedIds: [],
      }
    }
    case "REDO": {
      if (!state.redoStack.length) return state
      const [next, ...rest] = state.redoStack
      return {
        ...state,
        elements: next,
        history: [...state.history, deepCopy(state.elements)],
        redoStack: rest,
        selectedIds: [],
      }
    }
    default:
      return state
  }
}

const CanvasContext = createContext<CanvasContextValue | null>(null)

export const CanvasProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(canvasReducer, undefined, getInitialState)
  const appRef = useRef<Application | null>(null)

  //useRef作为内部剪切板
  const clipboardRef = useRef<CanvasElement[]>([])

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

  const setSelection = useCallback(
    (ids: string[], additive = false) =>
      dispatch({ type: "SET_SELECTION", payload: ids, additive }),
    []
  )

  //复制方法
  const copy = useCallback(() => {
    const selectedElements = state.elements.filter((el) =>
      state.selectedIds.includes(el.id)
    )
    if (selectedElements.length > 0) {
      //深拷贝存储，防止引用关联
      clipboardRef.current = deepCopy(selectedElements)
    }
  }, [state.elements, state.selectedIds])

  //粘贴方法
  const paste = useCallback(() => {
    const clipboard = clipboardRef.current
    if (!clipboard.length) return

    const newElements: CanvasElement[] = []
    const newIds: string[] = []

    clipboard.forEach((item) => {
      const id = createId()
      newIds.push(id)
      // 生成新元素：新ID，位置偏移 20px
      const newElement = {
        ...deepCopy(item), // 再次深拷贝，确保新粘贴的元素与剪贴板断开关联
        id,
        name: `${item.name} 副本`,
        x: item.x + 20,
        y: item.y + 20,
      }
      newElements.push(newElement)
    })

    // 将新元素添加到画布
    mutateElements((prev) => [...prev, ...newElements])
    // 选中新粘贴的元素
    dispatch({ type: "SET_SELECTION", payload: newIds })
  }, [mutateElements])



  const clearSelection = useCallback(
    () => dispatch({ type: "CLEAR_SELECTION" }),
    []
  )

  const addShape = useCallback(
    (shape: ShapeVariant) => {
      const id = createId()
      const size = shape === "rectangle" ? { width: 220, height: 140 } : { width: 160, height: 160 }
      const element: CanvasElement = {
        id,
        type: "shape",
        name: `${shape} ${state.elements.length + 1}`,
        x: 320,
        y: 180,
        width: size.width,
        height: size.height,
        rotation: 0,
        opacity: 1,
        shape,
        fill: "#f8fafc",
        stroke: "#0f172a",
        strokeWidth: 2,
        cornerRadius: shape === "rectangle" ? 12 : 0,
      }
      mutateElements((elements) => [...elements, element])
      dispatch({ type: "SET_SELECTION", payload: [id] })
    },
    [mutateElements, state.elements.length]
  )

  const addText = useCallback(
    (text = "双击编辑文本") => {
      const id = createId()
      const element: CanvasElement = {
        id,
        type: "text",
        name: `文本 ${state.elements.length + 1}`,
        x: 360,
        y: 220,
        width: 260,
        height: 80,
        rotation: 0,
        opacity: 1,
        text,
        fontSize: 24,
        fontFamily: "Inter",
        fontWeight: 500,
        align: "left",
        color: "#0f172a",
        background: "#ffffff",
        lineHeight: 1.3,
      }
      mutateElements((elements) => [...elements, element])
      dispatch({ type: "SET_SELECTION", payload: [id] })
    },
    [mutateElements, state.elements.length]
  )

  const addImage = useCallback(
    (src: string, size?: { width: number; height: number }) => {
      const id = createId()
      const element: CanvasElement = {
        id,
        type: "image",
        name: `图片 ${state.elements.length + 1}`,
        x: 280,
        y: 160,
        width: size?.width ?? 240,
        height: size?.height ?? 160,
        rotation: 0,
        opacity: 1,
        src,
        filters: {
          grayscale: false,
          blur: 0,
          brightness: 1,
        },
        borderRadius: 12,
      }
      mutateElements((elements) => [...elements, element])
      dispatch({ type: "SET_SELECTION", payload: [id] })
    },
    [mutateElements, state.elements.length]
  )

  const updateElement = useCallback(
    (id: string, changes: Partial<CanvasElement>) => {
      mutateElements(
        (elements) =>
          elements.map((el) => (el.id === id ? { ...el, ...changes } : el)) as CanvasElement[]
      )
    },
    [mutateElements]
  )

  const updateSelectedElements = useCallback(
    (updater: (element: CanvasElement) => Partial<CanvasElement>) => {
      const ids = state.selectedIds
      if (!ids.length) return
      mutateElements(
        (elements) =>
          elements.map((el) =>
            ids.includes(el.id) ? { ...el, ...updater(el) } : el
          ) as CanvasElement[]
      )
    },
    [mutateElements, state.selectedIds]
  )

  const deleteSelected = useCallback(() => {
    if (!state.selectedIds.length) return
    mutateElements((elements) =>
      elements.filter((el) => !state.selectedIds.includes(el.id))
    )
    dispatch({ type: "CLEAR_SELECTION" })
  }, [mutateElements, state.selectedIds])

  const setZoom = useCallback((zoom: number) => {
    const next = Math.min(3, Math.max(0.25, zoom))
    dispatch({ type: "SET_ZOOM", payload: next })
  }, [])

  const panBy = useCallback((delta: { x: number; y: number }) => {
    dispatch({ type: "PAN_BY", payload: delta })
  }, [])

  const setInteractionMode = useCallback(
    (mode: InteractionMode) => dispatch({ type: "SET_MODE", payload: mode }),
    []
  )

  const undo = useCallback(() => dispatch({ type: "UNDO" }), [])
  const redo = useCallback(() => dispatch({ type: "REDO" }), [])

  const registerApp = useCallback((app: Application | null) => {
    appRef.current = app
  }, [])

  const exportAsImage = useCallback(() => {
    const app = appRef.current
    if (!app) return null
    const extractor = app.renderer.extract
    if (!extractor || typeof extractor.canvas !== "function") {
      return null
    }
    const getCanvas = extractor.canvas as
      | ((displayObject: unknown) => HTMLCanvasElement)
      | undefined
    if (!getCanvas) return null
    const canvas = getCanvas.call(extractor, app.stage)
    return canvas?.toDataURL("image/png") ?? null
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const payload = JSON.stringify({
      elements: state.elements,
      pan: state.pan,
      zoom: state.zoom,
    })
    window.localStorage.setItem(STORAGE_KEY, payload)
  }, [state.elements, state.pan, state.zoom])

  const value = useMemo<CanvasContextValue>(
    () => ({
      state,
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
      exportAsImage,
      copy,//复制
      paste,//粘贴
    }),
    [
      state,
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
      exportAsImage,
      copy,//复制
      paste,//粘贴
    ]
  )

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  )
}

export const useCanvas = () => {
  const context = useContext(CanvasContext)
  if (!context) {
    throw new Error("useCanvas must be used within CanvasProvider")
  }
  return context
}
