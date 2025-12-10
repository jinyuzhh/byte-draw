import { useEffect, useRef, useCallback, useState } from "react";
import {
  Application,
  Container,
  Graphics,
  FederatedPointerEvent,
  Rectangle
} from "pixi.js";
import { useCanvas } from "../../store/CanvasProvider";
import type { CanvasElement, GroupElement } from "../../types/canvas";
import {
  MIN_ELEMENT_SIZE,
  SELECTION_COLOR,
  SNAP_ANGLE,
  type ResizeDirection,
} from "./pixiConstants";
import { cloneElement, cloneElements, getBoundingBox } from "./pixiUtils";
import {
  calculateSnap,
  calculateResizeSnap,
  type GuideLine,
} from "./snapUtils";
import {
  createBoundsHandlesLayer,
  createResizeHandlesLayer,
  createSelectionOutline,
  createShape,
  createSolidBoundsOutline,
  createRotateTooltip,
  createArtboard
} from "./pixiRenderers"
import { RightClickMenu } from "./RightClickMenu"
import { TextEditOverlay } from "./TextEditOverlay"
import { TextToolbar } from "./TextToolbar"

export const PixiCanvas = () => {
  // --- 1. 全局变量声明 ---
  let handleGlobalWheel: ((event: WheelEvent) => void) | null = null;
  const preventContextMenuRef = useRef<((e: Event) => void) | null>(null); // --- 2. Hooks 和 状态获取 ---

  const {
    state,
    isInitialized,
    setSelection,
    clearSelection,
    mutateElements,
    panBy,
    registerApp,
    registerScrollContainer,
    setZoom,
    groupElements,
    ungroupElements,
    updateArtboard,
    startEditingText,
    stopEditingText,
  } = useCanvas(); // --- 3. Refs 定义 ---

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const contentRef = useRef<Container | null>(null);
  const backgroundRef = useRef<Graphics | null>(null);
  const guidesRef = useRef<Graphics | null>(null);
  const currentGuidesRef = useRef<GuideLine[]>([]);

  const rotateRef = useRef<{
    id: string;
    startRotation: number;
    centerX: number;
    centerY: number;
    startAngle: number;
    snapshot: CanvasElement[];
    tooltip: Container | null;
  } | null>(null);

  const dragRef = useRef<{
    ids: string[];
    startPointer: { x: number; y: number };
    snapshot: Record<string, CanvasElement>;
    historySnapshot: CanvasElement[];
    moved: boolean;
    shouldEnterEditOnRelease?: boolean; // 标记是否应该在释放时进入编辑模式
  } | null>(null);

  const resizeRef = useRef<{
    ids: string[];
    direction: ResizeDirection;
    startPointer: { x: number; y: number };
    startElements: Record<string, CanvasElement>;
    startBounds: { x: number; y: number; width: number; height: number };
    historySnapshot: CanvasElement[];
    moved: boolean;
  } | null>(null); // Pan 拖拽状态：记录起始指针位置和起始滚动位置

  const panRef = useRef<{
    startPointer: { x: number; y: number };
    startScroll: { x: number; y: number };
  } | null>(null);
  const stateRef = useRef(state);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const selectionBoxRef = useRef<Graphics | null>(null);
  const isSelectedRef = useRef(false);
  const modifierKeysRef = useRef({ shiftKey: false, metaKey: false, ctrlKey: false });
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionLastPosRef = useRef<{ x: number; y: number } | null>(null);
  // 用于追踪画板尺寸变化
  const prevArtboardSizeRef = useRef<{ width: number; height: number } | null>(null);

  const [pixiReady, setPixiReady] = useState(false);
  const [rightClickMenu, setRightClickMenu] = useState({
    isVisible: false,
    x: 0,
    y: 0,
  }); // --- 4. 辅助函数 ---

  const toDeg = (rad: number) => rad * (180 / Math.PI); // --- 5. Effect: 同步 stateRef ---

  useEffect(() => {
    stateRef.current = state;
  }, [state]); // --- 7. Callbacks: 交互逻辑 ---

  const handleRotateStart = useCallback(
    (event: FederatedPointerEvent, id: string) => {
      event.stopPropagation();
      const content = contentRef.current;
      if (!content) return;

      const element = stateRef.current.elements.find((el) => el.id === id);
      if (!element) return;

      const localPoint = event.getLocalPosition(content);
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      const startMouseAngle = Math.atan2(
        localPoint.y - centerY,
        localPoint.x - centerX
      );

      rotateRef.current = {
        id,
        startRotation: element.rotation,
        centerX,
        centerY,
        startAngle: startMouseAngle,
        snapshot: cloneElements(stateRef.current.elements),
        tooltip: null,
      };
    },
    []
  );
  // --- 统一的背景更新函数 ---
  const updateViewportGeometry = useCallback(() => {
    const app = appRef.current;
    const background = backgroundRef.current;
    if (!app || !background) return;

    const zoom = state.zoom;
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;

    // 计算反向缩放后的尺寸
    const worldWidth = screenWidth / zoom;
    const worldHeight = screenHeight / zoom;

    // 1. 重绘背景 (用于接收平移/框选事件)
    background.clear();
    background.rect(0, 0, worldWidth, worldHeight);
    background.fill({ color: 0xffffff, alpha: 0 });
    
    // 2. 更新 HitArea (用于接收所有指针事件)
    const hitArea = new Rectangle(0, 0, worldWidth, worldHeight);
    background.hitArea = hitArea;
    app.stage.hitArea = hitArea; 

  }, [state.zoom]);

  const handleResizeStart = useCallback(
    (
      event: FederatedPointerEvent,
      ids: string[],
      direction: ResizeDirection
    ) => {
      event.stopPropagation();
      if (stateRef.current.interactionMode !== "select") return;
      const content = contentRef.current;
      if (!content) return;

      const elements = stateRef.current.elements.filter((el) =>
        ids.includes(el.id)
      );
      if (elements.length === 0) return;

      const startElements: Record<string, CanvasElement> = {};
      elements.forEach((el) => {
        startElements[el.id] = cloneElement(el);
      });

      const bounds = getBoundingBox(elements);
      if (!bounds) return;

      const local = event.getLocalPosition(content);
      resizeRef.current = {
        ids,
        direction,
        startPointer: local,
        startElements,
        startBounds: bounds,
        historySnapshot: cloneElements(stateRef.current.elements),
        moved: false,
      };
    },
    []
  );

  const handleElementPointerDown = useCallback(
    (event: FederatedPointerEvent, elementId: string) => {
      event.stopPropagation();
      if (stateRef.current.interactionMode !== "select") return;
      const { selectedIds, elements, editingTextId } = stateRef.current;
      
      // 如果正在编辑文本，点击其他元素时退出编辑模式
      if (editingTextId && editingTextId !== elementId) {
        stopEditingText();
      }
      
      // 如果正在编辑当前点击的文本元素，不做任何处理（让 textarea 接收事件）
      if (editingTextId === elementId) {
        return;
      }
      
      const nativeEvent = event.originalEvent as unknown as
        | { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }
        | undefined;
      const additive = Boolean(
        nativeEvent?.shiftKey || nativeEvent?.metaKey || nativeEvent?.ctrlKey
      );

      // 检查是否是已选中的文本元素被再次点击（可能进入编辑模式）
      const clickedElement = elements.find(el => el.id === elementId);
      const shouldEnterEditOnRelease = 
        clickedElement &&
        clickedElement.type === "text" &&
        selectedIds.length === 1 &&
        selectedIds.includes(elementId) &&
        !editingTextId &&
        !additive;

      const selection = additive
        ? Array.from(new Set([...selectedIds, elementId]))
        : selectedIds.includes(elementId)
          ? selectedIds
          : [elementId];

      setSelection(selection);

      const content = contentRef.current;
      if (!content) return;
      const local = event.getLocalPosition(content);
      const snapshot: Record<string, CanvasElement> = {};
      elements.forEach((el) => {
        if (selection.includes(el.id)) {
          snapshot[el.id] = cloneElement(el);
        }
      });

      dragRef.current = {
        ids: selection,
        startPointer: local,
        snapshot,
        historySnapshot: cloneElements(elements),
        moved: false,
        shouldEnterEditOnRelease, // 标记是否应该在释放时进入编辑模式
      };
    },
    [setSelection, stopEditingText]
  );

  const handleSelectionBoxPointerDown = useCallback(
    (event: FederatedPointerEvent) => {
      event.stopPropagation();
      if (stateRef.current.interactionMode !== "select") return;
      const { selectedIds, elements } = stateRef.current;
      const content = contentRef.current;
      if (!content) return;
      const local = event.getLocalPosition(content);
      const snapshot: Record<string, CanvasElement> = {};
      elements.forEach((el) => {
        if (selectedIds.includes(el.id)) {
          snapshot[el.id] = cloneElement(el);
        }
      });
      dragRef.current = {
        ids: selectedIds,
        startPointer: local,
        snapshot,
        historySnapshot: cloneElements(elements),
        moved: false,
      };
    },
    []
  );

  const performResize = useCallback(
    (
      info: {
        ids: string[];
        direction: ResizeDirection;
        startElements: Record<string, CanvasElement>;
        startBounds: { x: number; y: number; width: number; height: number };
      },
      dx: number,
      dy: number,
      enableSnap: boolean = false
    ) => {
      const { direction, startElements, startBounds, ids } = info;
      let newBounds = { ...startBounds };

      if (direction.includes("e"))
        newBounds.width = Math.max(MIN_ELEMENT_SIZE, startBounds.width + dx);
      if (direction.includes("s"))
        newBounds.height = Math.max(MIN_ELEMENT_SIZE, startBounds.height + dy);
      if (direction.includes("w")) {
        const updatedWidth = Math.max(MIN_ELEMENT_SIZE, startBounds.width - dx);
        const delta = startBounds.width - updatedWidth;
        newBounds.width = updatedWidth;
        newBounds.x = startBounds.x + delta;
      }
      if (direction.includes("n")) {
        const updatedHeight = Math.max(
          MIN_ELEMENT_SIZE,
          startBounds.height - dy
        );
        const delta = startBounds.height - updatedHeight;
        newBounds.height = updatedHeight;
        newBounds.y = startBounds.y + delta;
      }

      // 如果启用吸附，计算吸附后的边界和辅助线
      let guides: GuideLine[] = [];
      if (enableSnap) {
        const resizingElements = stateRef.current.elements.filter((el) =>
          ids.includes(el.id)
        );
        const zoom = stateRef.current.zoom;
        const snapResult = calculateResizeSnap(
          resizingElements,
          stateRef.current.elements,
          newBounds,
          direction as "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
          5 / zoom,
          stateRef.current.artboard
        );
        newBounds = snapResult.snappedBounds;
        guides = snapResult.guides;
        currentGuidesRef.current = guides;

        // 绘制辅助线
        if (guidesRef.current) {
          const g = guidesRef.current;
          g.clear();
          if (guides.length > 0) {
            const lineWidth = Math.max(1, 1 / zoom);
            const app = appRef.current;
            if (app) {
              const pan = stateRef.current.pan;
              const screen = app.screen;
              const padding = 5000 / zoom;
              const minX = -pan.x / zoom - padding;
              const maxX = (screen.width - pan.x) / zoom + padding;
              const minY = -pan.y / zoom - padding;
              const maxY = (screen.height - pan.y) / zoom + padding;

              guides.forEach((guide) => {
                if (guide.type === "horizontal") {
                  g.moveTo(minX, guide.coor);
                  g.lineTo(maxX, guide.coor);
                } else {
                  g.moveTo(guide.coor, minY);
                  g.lineTo(guide.coor, maxY);
                }
              });
              g.stroke({ width: lineWidth, color: 0x947eec, alpha: 1 });
            }
          }
        }
      }

      const scaleX =
        startBounds.width > 0 ? newBounds.width / startBounds.width : 1;
      const scaleY =
        startBounds.height > 0 ? newBounds.height / startBounds.height : 1;

      mutateElements(
        (elements) =>
          elements.map((el) => {
            if (!ids.includes(el.id)) return el;
            const startEl = startElements[el.id];
            if (!startEl) return el;

            const newX = newBounds.x + (startEl.x - startBounds.x) * scaleX;
            const newY = newBounds.y + (startEl.y - startBounds.y) * scaleY;
            const newWidth = Math.max(MIN_ELEMENT_SIZE, startEl.width * scaleX);
            const newHeight = Math.max(
              MIN_ELEMENT_SIZE,
              startEl.height * scaleY
            );

            if (
              el.type === "group" &&
              "children" in el &&
              Array.isArray(el.children)
            ) {
              const startGroup = startEl as typeof el;
              if (startGroup.children) {
                const scaledChildren = startGroup.children.map((child) => ({
                  ...child,
                  x: child.x * scaleX,
                  y: child.y * scaleY,
                  width: Math.max(MIN_ELEMENT_SIZE, child.width * scaleX),
                  height: Math.max(MIN_ELEMENT_SIZE, child.height * scaleY),
                }));
                return {
                  ...el,
                  x: newX,
                  y: newY,
                  width: newWidth,
                  height: newHeight,
                  children: scaledChildren,
                };
              }
            }
            return {
              ...el,
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            };
          }) as CanvasElement[],
        { recordHistory: false }
      );
    },
    [mutateElements]
  ); // --- 8. renderElements 定义 (关键修复点：必须在 useEffect 之前) ---

  const renderElements = useCallback(
    (
      content: Container,
      elements: CanvasElement[],
      currentState: typeof state
    ) => {
      content
        .removeChildren()
        .forEach((child) => child.destroy({ children: true }));
      content.sortableChildren = true;

      elements.forEach(async (element) => {
        const selected = state.selectedIds.includes(element.id);
        const node = await createShape(
          element,
          state.interactionMode,
          (event) => handleElementPointerDown(event, element.id)
        );
        node.zIndex = 1;
        content.addChild(node);

        if (
          selected &&
          currentState.selectedIds.length === 1 &&
          currentState.interactionMode === "select"
        ) {
          const handlesLayer = createResizeHandlesLayer(
            element,
            currentState.zoom,
            resizeRef.current?.direction ?? null,
            state.selectedIds,
            handleResizeStart,
            handleRotateStart
          );
          content.addChild(handlesLayer);
        }
      });
    },
    [
      handleElementPointerDown,
      handleResizeStart,
      handleRotateStart,
      state.interactionMode,
      state.selectedIds,
    ]
  ); // --- 9. Effect: 主渲染循环 (监听 state 变化) ---

  useEffect(() => {
    const content = contentRef.current;
    const app = appRef.current;
    if (!content || !app) return;

    content
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));
    content.sortableChildren = true;

    // 0. 渲染画板（如果存在）
    if (state.artboard && state.artboard.visible) {
      const artboardGraphics = createArtboard(state.artboard, state.zoom)
      content.addChild(artboardGraphics)
    }

    // 创建一个带遮罩的容器，用于裁剪元素到画板范围内
    // 控制框会渲染到 content 层，不受遮罩影响
    let elementsContainer: Container;
    
    if (state.artboard && state.artboard.visible) {
      // 创建遮罩容器
      elementsContainer = new Container();
      elementsContainer.sortableChildren = true;
      elementsContainer.eventMode = "static";
      elementsContainer.zIndex = 10;
      
      // 创建遮罩图形（与画板形状相同）
      const mask = new Graphics();
      mask.rect(
        state.artboard.x,
        state.artboard.y,
        state.artboard.width,
        state.artboard.height
      );
      mask.fill({ color: 0xffffff });
      
      // 应用遮罩
      elementsContainer.mask = mask;
      content.addChild(mask);
      mask.alpha = 0;
      mask.eventMode = 'none';
      mask.zIndex = 0;
      content.addChild(elementsContainer);
    } else {
      // 没有画板时，元素直接渲染到 content
      elementsContainer = content;
    }

    // 1. 渲染元素（到可能被遮罩的容器中）
    state.elements.forEach(async (element) => {
      const selected = state.selectedIds.includes(element.id);
      const isEditing = state.editingTextId === element.id;
      
      const node = await createShape(element, state.interactionMode, (event) =>
        handleElementPointerDown(event, element.id)
      );
      node.zIndex = 1;
      
      // 如果正在编辑该文本元素，隐藏 Pixi 渲染的内容（用 HTML textarea 替代）
      if (isEditing) {
        node.visible = false;
      }
      
      elementsContainer.addChild(node);

      // 选中轮廓渲染到 content 层（不受遮罩影响，超出画板部分也显示）
      // 注意：如果元素正在编辑中，不渲染选中轮廓（由 TextEditOverlay 渲染编辑态边框）
      if (selected && !isEditing) {
        const outline = createSelectionOutline(element);
        outline.zIndex = 49; // 确保在遮罩容器之上，但在控制手柄之下
        content.addChild(outline);
      }
    });

    // 2. 渲染控制层（直接添加到 content，不受遮罩影响）
    // 注意：如果正在编辑文本，不渲染控制层（调整手柄等）
    if (state.interactionMode === "select" && state.selectedIds.length > 0 && !state.editingTextId) {
      const selectedElements = state.elements.filter((el) =>
        state.selectedIds.includes(el.id)
      );

      if (selectedElements.length > 1) {
        const bounds = getBoundingBox(selectedElements);
        if (bounds) {
          const globalOutline = createSolidBoundsOutline({
            ...bounds,
            rotation: 0,
          });
          globalOutline.zIndex = 50; // 确保在遮罩容器之上
          content.addChild(globalOutline);

          if (!dragRef.current?.moved) {
            const handlesLayer = createBoundsHandlesLayer({
              bounds: { ...bounds, rotation: 0 },
              zoom: state.zoom,
              activeDirection: resizeRef.current?.direction ?? null,
              isMultiSelection: false,
              selectedIds: state.selectedIds,
              handleResizeStart,
            });
            handlesLayer.zIndex = 51; // 确保在轮廓之上
            content.addChild(handlesLayer);
          }
        }
      } else if (selectedElements.length === 1) {
        const element = selectedElements[0];
        if (!dragRef.current?.moved) {
          const handlesLayer = createResizeHandlesLayer(
            element,
            state.zoom,
            resizeRef.current?.direction ?? null,
            state.selectedIds,
            handleResizeStart,
            handleRotateStart
          );
          handlesLayer.zIndex = 51; // 确保在遮罩容器之上
          content.addChild(handlesLayer);
        }
      }
    }

    // 3. 渲染旋转提示（直接添加到 content，不受遮罩影响）
    if (rotateRef.current) {
      const el = state.elements.find((e) => e.id === rotateRef.current?.id);
      if (el) {
        const tooltip = createRotateTooltip(el, state.zoom);
        tooltip.zIndex = 100;
        content.addChild(tooltip);
        rotateRef.current.tooltip = tooltip;

        // 计算元素中心点（不随旋转变化）
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;

        // 计算元素对角线半径，确保tooltip在旋转时始终在元素下方
        const boundsRadius = Math.sqrt(
          (el.width / 2) ** 2 + (el.height / 2) ** 2
        );
        const offset = boundsRadius + 10 / state.zoom;

        tooltip.position.set(cx, cy + offset);
      }
    }
  }, [
    state,
    state.elements,
    state.selectedIds,
    state.interactionMode,
    state.zoom,
    state.artboard,
    state.editingTextId,
    handleElementPointerDown,
    handleResizeStart,
    handleRotateStart,
    handleSelectionBoxPointerDown,
    pixiReady, // PixiJS 初始化完成后触发渲染
  ]); 
  
  // --- 9.5. Effect: 当选择改变时退出编辑模式 ---
  useEffect(() => {
    // 如果当前正在编辑文本，但该文本不再被选中，则退出编辑模式
    if (state.editingTextId && !state.selectedIds.includes(state.editingTextId)) {
      stopEditingText();
    }
  }, [state.selectedIds, state.editingTextId, stopEditingText]);
  
  // --- 10. Effect: 缩放同步（pan 由 onScroll 驱动，不在这里处理） ---

  useEffect(() => {
    const app = appRef.current;
    if (!app) return; // 只处理缩放
    app.stage.scale.set(state.zoom);
    updateViewportGeometry();
  }, [state.zoom]); 
  
  // --- 10.5. Effect: 画板尺寸变化时自动居中和自适应缩放 ---
  useEffect(() => {
    const artboard = state.artboard;
    if (!artboard || !pixiReady) return;
    
    const prevSize = prevArtboardSizeRef.current;
    const currentWidth = artboard.width;
    const currentHeight = artboard.height;
    
    // 检查画板尺寸是否发生变化
    if (prevSize && (prevSize.width !== currentWidth || prevSize.height !== currentHeight)) {
      // 画板尺寸变化了，执行居中和自适应缩放
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      
      const viewportWidth = scrollContainer.clientWidth;
      const viewportHeight = scrollContainer.clientHeight;
      
      // 计算自适应缩放比例，使画板完整显示在视口中
      // 留出一些边距（例如80%的视口空间用于显示画板）
      const padding = 0.8;
      const scaleX = (viewportWidth * padding) / currentWidth;
      const scaleY = (viewportHeight * padding) / currentHeight;
      const fitZoom = Math.min(scaleX, scaleY, 1); // 最大缩放为1
      
      // 限制缩放比例在合理范围内
      const clampedZoom = Math.min(3, Math.max(0.25, fitZoom));
      
      // 设置新的缩放比例
      setZoom(clampedZoom);

      stateRef.current.zoom = clampedZoom;
      
      // 计算滚动位置，将画板居中显示在视口中
      const virtualCanvasSize = 4000;
      const contentWidth = virtualCanvasSize * clampedZoom;
      const contentHeight = virtualCanvasSize * clampedZoom;
      
      // 滚动位置使得虚拟画布中心（也是画板中心）位于视口中心
      const newScrollLeft = Math.max(0, (contentWidth / 2) - (viewportWidth / 2));
      const newScrollTop = Math.max(0, (contentHeight / 2) - (viewportHeight / 2));
      
      // 使用 setTimeout 确保 React 状态更新和 contentSize 更新后再设置滚动位置
      // 延迟 100ms 以确保所有 DOM 更新完成
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = newScrollLeft;
          scrollContainerRef.current.scrollTop = newScrollTop;
          
          // 同步更新 Pixi 容器位置
          // 需要除以缩放因子，因为 stage 的 scale 会应用到 content 的 position 上
          if (contentRef.current) {
            contentRef.current.position.set(-newScrollLeft / clampedZoom, -newScrollTop / clampedZoom);
          }
          if (guidesRef.current) {
            guidesRef.current.position.set(-newScrollLeft / clampedZoom, -newScrollTop / clampedZoom);
          }
          const deltaX = newScrollLeft - stateRef.current.pan.x;
          const deltaY = newScrollTop - stateRef.current.pan.y;
          if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
           // 立即更新 Store
           panBy({ x: deltaX, y: deltaY });
           // 立即更新 Ref，保证当前闭包内的逻辑也能读到最新值
           stateRef.current.pan = { x: newScrollLeft, y: newScrollTop };
        }
        }
      }, 100);
    }
    
    // 更新 ref 记录当前尺寸
    prevArtboardSizeRef.current = { width: currentWidth, height: currentHeight };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.artboard?.width, state.artboard?.height, pixiReady, setZoom]);
  
  // --- 11. Effect: 光标样式 ---

  useEffect(() => {
    const background = backgroundRef.current;
    if (!background) return;
    background.cursor = state.interactionMode === "pan" ? "grab" : "default";
  }, [state.interactionMode]); // --- 12. Effect: 键盘快捷键 ---

  const isGroupSelected =
    state.selectedIds.length === 1 &&
    (state.elements.find(
      (el) => el.id === state.selectedIds[0] && el.type === "group"
    ) as GroupElement);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey; // 打组快捷键: Ctrl+G
      if (isCtrlOrCmd && event.key.toLowerCase() === "g" && !event.shiftKey) {
        event.preventDefault();
        if (state.selectedIds.length >= 2) {
          groupElements();
        }
      } // 解组快捷键: Ctrl+Shift+G
      if (isCtrlOrCmd && event.key.toLowerCase() === "g" && event.shiftKey) {
        event.preventDefault();
        if (isGroupSelected) {
          ungroupElements();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.selectedIds, isGroupSelected, groupElements, ungroupElements]); // --- 13. Effect: 初始化 PixiJS (SETUP) ---

  useEffect(() => {
    let destroyed = false;

    const updateBackground = () => {
      const app = appRef.current;
      const background = backgroundRef.current;
      const zoom = stateRef.current.zoom;
      if (!app || !background) return;
      background.clear();

      const viewportWidth = app.screen.width / zoom;
      const viewportHeight = app.screen.height / zoom;

      background.rect(0, 0, app.screen.width, app.screen.height);
      background.fill({ color: 0xffffff, alpha: 0 });

      const hitRect = new Rectangle(0, 0, viewportWidth, viewportHeight);
      background.hitArea = hitRect;
      app.stage.hitArea = hitRect; // 确保拖拽出背景时只要在屏幕内也能响应
    };

    const setup = async () => {
      if (!wrapperRef.current) return;
      const app = new Application();
      await app.init({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        resizeTo: wrapperRef.current,
      });
      if (destroyed) {
        app.destroy();
        return;
      }
      wrapperRef.current.appendChild(app.canvas);
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      app.stage.sortableChildren = true;

      const background = new Graphics();
      background.alpha = 0;
      background.eventMode = "static";
      background.cursor = "default";
      background.hitArea = app.screen;
      app.stage.addChild(background);

      const content = new Container();
      content.eventMode = "static";
      app.stage.addChild(content);

      const guides = new Graphics();
      guides.eventMode = "none";
      guides.zIndex = 9999;
      app.stage.addChild(guides);
      guidesRef.current = guides;

      appRef.current = app;
      contentRef.current = content;
      backgroundRef.current = background;
      registerApp(app);

      // 画板居中逻辑：检查画板是否需要居中到虚拟画布中央
      // 虚拟画布默认大小是 4000x4000
      const virtualCanvasSize = 4000;
      if (stateRef.current.artboard) {
        const artboard = stateRef.current.artboard;
        const expectedCenterX = (virtualCanvasSize - artboard.width) / 2;
        const expectedCenterY = (virtualCanvasSize - artboard.height) / 2;
        
        // 如果画板位置是 (0, 0) 或者明显偏离中心太多，则重新居中
        const needsRecenter = 
          (artboard.x === 0 && artboard.y === 0) || 
          (artboard.x < 100 && artboard.y < 100);
        
        if (needsRecenter) {
          updateArtboard({ x: expectedCenterX, y: expectedCenterY });
        }
      }

      // PixiJS 初始化完成，设置状态触发主渲染 useEffect
      setPixiReady(true);

      const resizeObserver = new ResizeObserver(() => {
        app.resize();
        updateViewportGeometry();
        updateBackground(); // 确保画布大小变化后，缩放比例仍然正确应用
        if (contentRef.current && stateRef.current) {
          const content = contentRef.current; // 重新应用平移和缩放
          const zoom = stateRef.current.zoom;
          // content 位置需要除以缩放因子，因为 stage 的 scale 会应用到 position 上
          content.position.set(
            -stateRef.current.pan.x / zoom,
            -stateRef.current.pan.y / zoom
          );
          // guides 容器也需要同样的位置更新
          if (guidesRef.current) {
            guidesRef.current.position.set(
              -stateRef.current.pan.x / zoom,
              -stateRef.current.pan.y / zoom
            );
          }
          app.stage.scale.set(zoom);
        }
      });
      resizeObserver.observe(wrapperRef.current);
      resizeObserverRef.current = resizeObserver;

      background.on("pointerdown", (event: FederatedPointerEvent) => {
        if (event.originalEvent && (event.originalEvent as any).button === 2) {
          event.preventDefault();
          return;
        }
        
        // 点击背景时，如果正在编辑文本，先退出编辑模式
        if (stateRef.current.editingTextId) {
          stopEditingText();
        }
        
        if (stateRef.current.interactionMode === "pan") {
          // 记录起始指针位置和起始滚动位置
          const scrollContainer = scrollContainerRef.current;
          panRef.current = {
            startPointer: { x: event.global.x, y: event.global.y },
            startScroll: {
              x: scrollContainer?.scrollLeft ?? 0,
              y: scrollContainer?.scrollTop ?? 0,
            },
          };
          background.cursor = "grabbing";
        } else if (stateRef.current.interactionMode === "select") {
          if (event.target === background) {
            const localPos = event.getLocalPosition(content);
            selectionStartRef.current = { x: localPos.x, y: localPos.y };
            selectionLastPosRef.current = { x: localPos.x, y: localPos.y };
            isSelectedRef.current = true;

            const selectionBox = new Graphics();
            selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
            selectionBox.beginFill(SELECTION_COLOR, 0.1);
            selectionBox.drawRect(localPos.x, localPos.y, 0, 0);
            selectionBox.endFill();
            selectionBox.zIndex = 100;
            content.addChild(selectionBox);
            selectionBoxRef.current = selectionBox;
            console.log('选择框已创建，起始位置:', localPos);
          }
        } else {
          clearSelection();
        }
      });

      preventContextMenuRef.current = (e: Event) => {
        e.preventDefault();
      };

      const handleRightClick = (event: FederatedPointerEvent) => {
        event.preventDefault();
        if (stateRef.current.interactionMode !== "select") return;
        const originalEvent = event.originalEvent as any;
        setRightClickMenu({
          isVisible: true,
          x: originalEvent.clientX,
          y: originalEvent.clientY,
        });
      };

      app.stage.on("rightclick", handleRightClick);
      if (appRef.current && appRef.current.canvas && preventContextMenuRef.current) {
        appRef.current.canvas.addEventListener(
          "contextmenu",
          preventContextMenuRef.current
        );
      }

      const handleGlobalWheelInternal = (event: WheelEvent) => {
        // 当按下Ctrl/Meta键时，阻止浏览器默认缩放行为
        if (event.ctrlKey || event.metaKey) {
          // 首先阻止浏览器默认行为
          event.preventDefault();
          event.stopPropagation(); // 然后检查鼠标是否在画布内，如果是则执行自定义缩放

          const canvas = app.canvas;
          const rect = canvas.getBoundingClientRect();
          const isMouseInCanvas =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
          if (isMouseInCanvas) {
            const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = stateRef.current.zoom * zoomFactor;
            setZoom(newZoom);
          }
        } // 否则，让事件正常传播到滚动容器的onScroll事件
      }; // 更新全局变量引用，以便清理
      handleGlobalWheel = handleGlobalWheelInternal;
      window.addEventListener("wheel", handleGlobalWheel, { passive: false });

      app.stage.on("pointermove", (event: FederatedPointerEvent) => {
        // 跟踪修饰键状态
        const nativeEvent = event.originalEvent as unknown as MouseEvent;
        modifierKeysRef.current = {
          shiftKey: nativeEvent.shiftKey,
          metaKey: nativeEvent.metaKey,
          ctrlKey: nativeEvent.ctrlKey
        };

        const content = contentRef.current;
        if (!content) return;

        if (
          isSelectedRef.current &&
          selectionStartRef.current &&
          selectionBoxRef.current
        ) {
          const localPos = event.getLocalPosition(content);
          // 记录最后位置，用于选择完成时的手动边界计算
          selectionLastPosRef.current = localPos;

          const start = selectionStartRef.current;
          const x = Math.min(start.x, localPos.x);
          const y = Math.min(start.y, localPos.y);
          const width = Math.abs(start.x - localPos.x);
          const height = Math.abs(start.y - localPos.y);
          const selectionBox = selectionBoxRef.current;
          selectionBox.clear();
          selectionBox.lineStyle(1, SELECTION_COLOR, 0.8);
          selectionBox.beginFill(SELECTION_COLOR, 0.1);
          selectionBox.drawRect(x, y, width, height);
          selectionBox.endFill();
          console.log('选择框已更新，尺寸:', { x, y, width, height });
          return;
        }

        if (resizeRef.current) {
          const current = resizeRef.current;
          const local = event.getLocalPosition(content);
          const dx = local.x - current.startPointer.x;
          const dy = local.y - current.startPointer.y;
          current.moved = true;
          performResize(current, dx, dy, true);
          return;
        }

        if (rotateRef.current) {
          const { centerX, centerY, startAngle, startRotation, id } =
            rotateRef.current;
          const local = event.getLocalPosition(content);
          const currentMouseAngle = Math.atan2(
            local.y - centerY,
            local.x - centerX
          );
          const deltaRad = currentMouseAngle - startAngle;
          let newRotationDeg = startRotation + toDeg(deltaRad);

          if (event.shiftKey) {
            newRotationDeg =
              Math.round(newRotationDeg / SNAP_ANGLE) * SNAP_ANGLE;
          }

          mutateElements(
            (elements) =>
              elements.map((el) => {
                if (el.id !== id) return el;
                return { ...el, rotation: newRotationDeg };
              }),
            { recordHistory: false }
          );
          return;
        }

        if (dragRef.current) {
          const current = dragRef.current;
          const local = event.getLocalPosition(content);
          const dx = local.x - current.startPointer.x;
          const dy = local.y - current.startPointer.y;

          const movingElements = stateRef.current.elements.filter((el) =>
            current.ids.includes(el.id)
          );
          const zoom = stateRef.current.zoom;
          const {
            dx: snappedDx,
            dy: snappedDy,
            guides,
          } = calculateSnap(
            movingElements,
            stateRef.current.elements,
            dx,
            dy,
            current.snapshot,
            5 / zoom,
            stateRef.current.artboard
          );

          currentGuidesRef.current = guides;

          if (guidesRef.current) {
            const g = guidesRef.current;
            g.clear();
            if (guides.length > 0) {
              const lineWidth = Math.max(1, 1 / zoom);
              const app = appRef.current;
              if (app) {
                const pan = stateRef.current.pan;
                const screen = app.screen;
                const padding = 5000 / zoom;
                const minX = -pan.x / zoom - padding;
                const maxX = (screen.width - pan.x) / zoom + padding;
                const minY = -pan.y / zoom - padding;
                const maxY = (screen.height - pan.y) / zoom + padding;

                guides.forEach((guide) => {
                  if (guide.type === "horizontal") {
                    g.moveTo(minX, guide.coor);
                    g.lineTo(maxX, guide.coor);
                  } else {
                    g.moveTo(guide.coor, minY);
                    g.lineTo(guide.coor, maxY);
                  }
                });
                g.stroke({ width: lineWidth, color: 0x947eec, alpha: 1 });
              }
            }
          }

          if (Math.abs(snappedDx) > 0.01 || Math.abs(snappedDy) > 0.01) {
            current.moved = true;
            mutateElements(
              (elements) =>
                elements.map((el) => {
                  if (!current.ids.includes(el.id)) return el;
                  const base = current.snapshot[el.id] ?? el;
                  return {
                    ...el,
                    x: base.x + snappedDx,
                    y: base.y + snappedDy,
                  };
                }) as CanvasElement[],
              { recordHistory: false }
            );
          }
          return;
        }

        if (panRef.current) {
          const scrollContainer = scrollContainerRef.current;
          if (!scrollContainer) return; // 计算鼠标位移（从起始位置）
          const dx = panRef.current.startPointer.x - event.global.x;
          const dy = panRef.current.startPointer.y - event.global.y; // 直接修改 DOM scrollLeft/scrollTop，这会触发 onScroll 事件 // onScroll 事件会统一更新 Pixi 容器位置
          scrollContainer.scrollLeft = panRef.current.startScroll.x + dx;
          scrollContainer.scrollTop = panRef.current.startScroll.y + dy;
        }
      });

      const stopInteractions = () => {
        if (rotateRef.current) {
          mutateElements((elements) => elements, {
            historySnapshot: rotateRef.current.snapshot,
          });
          if (rotateRef.current.tooltip) {
            rotateRef.current.tooltip = null;
          }
          rotateRef.current = null;
        }

        if (
          isSelectedRef.current &&
          selectionBoxRef.current &&
          selectionStartRef.current &&
          selectionLastPosRef.current
        ) {
          // 直接使用选择框的起始位置和结束位置计算边界
          const start = selectionStartRef.current;
          const end = selectionLastPosRef.current;

          const selectionLeft = Math.min(start.x, end.x);
          const selectionTop = Math.min(start.y, end.y);
          const selectionRight = Math.max(start.x, end.x);
          const selectionBottom = Math.max(start.y, end.y);

          console.log('选择框起始位置:', start);
          console.log('选择框结束位置:', end);
          console.log('选择框计算边界:', { left: selectionLeft, top: selectionTop, right: selectionRight, bottom: selectionBottom });
          // 同时记录手动计算的边界作为对比
          const lastLocalPos = selectionLastPosRef.current || start;
          const manualX = Math.min(start.x, lastLocalPos.x);
          const manualY = Math.min(start.y, lastLocalPos.y);
          const manualWidth = Math.abs(start.x - lastLocalPos.x);
          const manualHeight = Math.abs(start.y - lastLocalPos.y);
          console.log('手动计算的选择框边界:', { x: manualX, y: manualY, width: manualWidth, height: manualHeight });
          console.log('所有元素的位置和大小:', stateRef.current.elements.map(el => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height })));

          const selectedElements = stateRef.current.elements.filter((elem) => {
            // 直接使用元素的存储位置（左上角）
            const elemLeft = elem.x;
            const elemTop = elem.y;
            const elemRight = elem.x + elem.width;
            const elemBottom = elem.y + elem.height;

            // 检查元素与选择框是否相交
            const intersects = !(
              elemRight < selectionLeft ||
              elemLeft > selectionRight ||
              elemBottom < selectionTop ||
              elemTop > selectionBottom
            );

            console.log(`元素 ${elem.id} 存储位置: (${elem.x}, ${elem.y})`);
            console.log(`元素 ${elem.id} 存储边界:`, { left: elemLeft, top: elemTop, right: elemRight, bottom: elemBottom });
            console.log(`元素 ${elem.id} 与选择框的交集情况:`, intersects);
            return intersects;
          });

          console.log('选中的元素:', selectedElements);

          if (selectedElements.length > 0) {
            // 使用跟踪的修饰键状态来决定是否累加选择
            const additive = modifierKeysRef.current.shiftKey || modifierKeysRef.current.metaKey || modifierKeysRef.current.ctrlKey;
            console.log('累加选择模式:', additive);
            console.log('调用setSelection，选中的元素ID:', selectedElements.map(el => el.id));
            setSelection(selectedElements.map((el) => el.id), additive);
          } else {
            console.log('没有选中任何元素，清除选择');
            clearSelection();
          }
          selectionBoxRef.current?.destroy();
          selectionBoxRef.current = null;
          selectionLastPosRef.current = null;
          isSelectedRef.current = false;
          selectionStartRef.current = null;
        }

        isSelectedRef.current = false;
        selectionStartRef.current = null;

        const background = backgroundRef.current;
        if (panRef.current && background) {
          background.cursor = "default";
        }

        // 无论是否移动，都清除辅助线
        if (dragRef.current || resizeRef.current) {
          currentGuidesRef.current = [];
          if (guidesRef.current) {
            guidesRef.current.clear();
          }
        }

        // 检查是否应该进入文本编辑模式（点击已选中的文本元素且没有移动）
        if (dragRef.current?.shouldEnterEditOnRelease && !dragRef.current.moved) {
          const elementId = dragRef.current.ids[0];
          if (elementId) {
            startEditingText(elementId);
          }
        }

        if (dragRef.current?.moved) {
          mutateElements((elements) => elements, {
            historySnapshot: dragRef.current.historySnapshot,
          });
        }

        if (resizeRef.current?.moved) {
          mutateElements((elements) => elements, {
            historySnapshot: resizeRef.current.historySnapshot,
          });
        }

        dragRef.current = null;
        resizeRef.current = null;
        panRef.current = null;
      };

      app.stage.on("pointerup", stopInteractions);
      app.stage.on("pointerupoutside", stopInteractions);
    };

    setup();

    return () => {
      destroyed = true;
      resizeObserverRef.current?.disconnect();
      const app = appRef.current;
      // 移除 contextmenu 监听器
      if (app?.canvas && preventContextMenuRef.current) {
        app.canvas.removeEventListener("contextmenu", preventContextMenuRef.current);
        preventContextMenuRef.current = null;
      }
      app?.stage.removeAllListeners();
      app?.destroy(true);
      registerApp(null);
      appRef.current = null;
      contentRef.current = null;
      backgroundRef.current = null;
      if (handleGlobalWheel) {
        window.removeEventListener("wheel", handleGlobalWheel);
        handleGlobalWheel = null;
      }
    };
  }, [
    clearSelection,
    mutateElements,
    panBy,
    registerApp,
    performResize,
    setSelection,
    startEditingText,
    stopEditingText,
  ]);

  const menuItems = [
    {
      label: "打组 (Ctrl+G)",
      onClick: () => {
        if (state.selectedIds.length >= 2) {
          groupElements();
          setRightClickMenu({ isVisible: false, x: 0, y: 0 });
        }
      },
      disabled: state.selectedIds.length < 2,
    },
    {
      label: "解组 (Ctrl+Shift+G)",
      onClick: () => {
        if (isGroupSelected) {
          ungroupElements();
          setRightClickMenu({ isVisible: false, x: 0, y: 0 });
        }
      },
      disabled: !isGroupSelected,
    },
  ]; // --- 12. 滚动条相关逻辑 ---

  const scrollContainerRef = useRef<HTMLDivElement | null>(null); // 虚拟内容尺寸，用于撑大滚动区域
  const [contentSize, setContentSize] = useState({ width: 4000, height: 4000 }); // 更新内容尺寸

  const updateContentSize = useCallback(() => {
    // 始终使用固定的虚拟画布大小，保持稳定性
    // 画板位于虚拟画布中心，不需要动态调整
    const baseSize = 4000;
    const newSize = baseSize * state.zoom;
    setContentSize((prev) => {
      if (prev.width !== newSize || prev.height !== newSize) {
        return { width: newSize, height: newSize };
      }
      return prev;
    });
  }, [state.zoom]); // 滚动事件处理：DOM scrollLeft/scrollTop 是单一数据源
  // 直接驱动 Pixi 容器位置更新，并同步到 React state
  
  // 追踪是否已完成初始滚动位置设置
  const initialScrollSetRef = useRef(false);
  
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    const content = contentRef.current;
    const guides = guidesRef.current;
    if (!scrollContainer || !content) return;

    // 获取当前滚动位置
    const scrollX = scrollContainer.scrollLeft;
    const scrollY = scrollContainer.scrollTop;

    // 获取当前缩放值
    const zoom = stateRef.current.zoom;

    // 直接更新 Pixi 容器位置（负值，因为滚动向右时内容向左移动）
    // 需要除以缩放因子，因为 stage 的 scale 会应用到 content 的 position 上
    // 这样实际的屏幕偏移才会正确匹配滚动位置
    content.position.set(-scrollX / zoom, -scrollY / zoom);
    if (guides) {
      guides.position.set(-scrollX / zoom, -scrollY / zoom);
    }

    // 同步更新 stateRef 供其他逻辑使用（如元素拖拽时的坐标计算）
    stateRef.current = {
      ...stateRef.current,
      pan: { x: scrollX, y: scrollY },
    };

    // 只有在初始化完成后才更新 React 状态中的 pan 值
    // 避免初始化期间触发不必要的重渲染
    if (initialScrollSetRef.current) {
      panBy({ x: scrollX - state.pan.x, y: scrollY - state.pan.y });
    }
  }, [state.pan, panBy]);
  
  // 初始化时同步滚动条位置，将画板居中显示
  useEffect(() => {
    // 已经设置过初始滚动位置，跳过
    if (initialScrollSetRef.current) return;
    
    if (isInitialized && scrollContainerRef.current && pixiReady) {
      const scrollContainer = scrollContainerRef.current;
      // 注册滚动容器到 CanvasProvider，用于计算视口中心
      registerScrollContainer(scrollContainer);

      // 始终将画板居中显示
      // 虚拟画布大小是 4000x4000，画板中心在 (2000, 2000)
      // 滚动位置应该使画板中心位于视口中心
      const virtualCanvasCenter = 2000 * state.zoom;
      const viewportWidth = scrollContainer.clientWidth;
      const viewportHeight = scrollContainer.clientHeight;
      
      const initialScrollLeft = Math.max(0, virtualCanvasCenter - viewportWidth / 2);
      const initialScrollTop = Math.max(0, virtualCanvasCenter - viewportHeight / 2);
      
      scrollContainer.scrollLeft = initialScrollLeft;
      scrollContainer.scrollTop = initialScrollTop;
      
      // 更新 Pixi 容器的初始位置
      // 需要除以缩放因子，因为 stage 的 scale 会应用到 content 的 position 上
      if (contentRef.current) {
        contentRef.current.position.set(-initialScrollLeft / state.zoom, -initialScrollTop / state.zoom);
      }
      if (guidesRef.current) {
        guidesRef.current.position.set(-initialScrollLeft / state.zoom, -initialScrollTop / state.zoom);
      }
      
      // 标记初始滚动位置已设置
      initialScrollSetRef.current = true;
    }
    // 组件卸载时取消注册
    return () => {
      registerScrollContainer(null);
    };
  }, [isInitialized, registerScrollContainer, pixiReady, state.zoom]); // 当元素变化时更新内容尺寸 (使用防抖优化)

  useEffect(() => {
    // 使用 setTimeout 进行防抖，避免频繁更新
    const timer = setTimeout(() => {
      updateContentSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [updateContentSize]); // 当缩放变化时更新内容尺寸

  useEffect(() => {
    updateContentSize();
  }, [state.zoom, updateContentSize]);
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 1. Scroll Container 
        这是唯一的滚动容器。所有东西都在这里面。
    */}
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-auto relative" // 确保是 relative
        onScroll={handleScroll}
      >
        {/* 2. Content Sizer 
          放在这里是为了撑大父容器(Scroll Container)。
          使用 absolute 避免干扰 sticky 的布局流。
      */}
        <div
          style={{
            width: `${contentSize.width}px`,
            height: `${contentSize.height}px`,
            position: "absolute", // 关键：绝对定位
            top: 0,
            left: 0,
            pointerEvents: "none", // 让点击穿透
            zIndex: 0,
          }}
        />

        {/* 3. Canvas Wrapper (Sticky)
          必须放在 Scroll Container 内部！
          position: sticky 保证它永远吸附在滚动视口的左上角，
          而不会随内容滚出屏幕。
      */}
        <div
          ref={wrapperRef}
          style={{
            position: "sticky", // 关键修改：使用 sticky
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            overflow: "hidden",
            zIndex: 1, // 确保在 Sizer 之上接收事件
          }}
        />
      </div>

      {/* 4. 文本编辑覆盖层 - 放在滚动容器外部 */}
      <TextEditOverlay
        scrollContainerRef={scrollContainerRef}
        canvasWrapperRef={wrapperRef}
      />

      {/* 文本工具栏 - 当文本元素被选中时显示在右上角 */}
      <TextToolbar />

      {/* 右键菜单层级最高，放在外面没问题 */}
      <RightClickMenu
        items={menuItems}
        x={rightClickMenu.x}
        y={rightClickMenu.y}
        isVisible={rightClickMenu.isVisible}
        onClose={() => setRightClickMenu({ isVisible: false, x: 0, y: 0 })}
      />
    </div>
  );
};
