/**
 * @fileoverview 右侧属性面板组件
 * @file /Volumes/DreamZero/code/project/bytedance-canvas/src/components/layout/RightPanel.tsx
 * 
 * @description 
 * 右侧属性面板组件，用于显示和编辑画布中选中元素的属性。
 * 该组件提供以下功能：
 * 1. 显示选中元素的基本信息（名称、类型）
 * 2. 编辑元素的通用属性（位置、尺寸、旋转、透明度）
 * 3. 根据元素类型提供特定的属性编辑器
 *    - 图形元素：填充色、边框、圆角等
 *    - 文本元素：内容、字体、颜色等
 *    - 图片元素：滤镜、圆角等
 * 4. 提供删除选中元素的功能
 * 
 * @author Canvas Team
 * @version 1.0.0
 */

import { useCanvas } from "../../store/CanvasProvider"
import type { CanvasElement, ShapeElement, TextElement, ImageElement, GroupElement } from "../../types/canvas"
import {
  ArtboardColorSelector,
  ArtboardSizeSelector,
  Field,
  ImageControls,
  NumberInput,
  RotationInput,
  Section,
  ShapeControls,
  TextControls,
} from "./components"

/**
 * 表单字段容器组件
 * 
 * @component Field
 * 
 * @description 
 * 可复用的表单字段容器，用于统一属性面板中各个输入控件的布局和样式。
 * 提供标签和输入控件的垂直排列布局，确保界面一致性。
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.label - 字段标签文本，显示在输入控件上方
 * @param {ReactNode} props.children - 输入控件，可以是任何有效的 React 节点
 * 
 * @returns {JSX.Element} 返回带有统一样式的表单字段容器
 * 
 * @example
 * ```tsx
 * // 使用示例
 * <Field label="颜色">
 *   <ColorInput value="#ff0000" onChange={setColor} />
 * </Field>
 * ```
 */


const getTypeDisplayName = (type: CanvasElement["type"] | null): string => {
  switch (type) {
    case "shape":
      return "图形"
    case "text":
      return "文本"
    case "image":
      return "图片"
    case "group":
      return "组"
    default:
      return "元素"
  }
}

/**
 * 右侧属性面板组件
 * 
 * @component RightPanel
 * 
 * @description 
 * 画布编辑器的右侧属性面板，用于显示和编辑选中元素的属性。
 * 根据选中元素的类型（图形、文本、图片）显示相应的属性控制选项。
 * 未选中元素时显示提示信息。
 * 
 * @returns {JSX.Element} 返回属性面板组件
 * 
 * @example
 * ```tsx
 * // 使用示例
 * <RightPanel />
 * ```
 */
export const RightPanel = () => {
  const { state, updateElement, deleteSelected, updateArtboard } = useCanvas()
  const selectedId = state.selectedIds[0]
  const selectedElement = state.elements.find((el) => el.id === selectedId)

  /* ---------- 辅助函数 ---------- */

  /* 组元素的辅助函数 */
  // 是否单选了一个组元素
  const isSingleGroup = state.selectedIds.length === 1 && selectedElement?.type === 'group'
  // 递归获取组内所有子元素（包括嵌套组）
  const getGroupChildren = (group: GroupElement): CanvasElement[] => {
    if (!group.children || group.children.length === 0) return []

    const allChildren: CanvasElement[] = []

    const processChildren = (children: CanvasElement[]) => {
      children.forEach(child => {
        if (child.type === 'group') {
          // 如果是嵌套组，递归处理其内部的子元素
          processChildren((child as GroupElement).children)
        } else {
          // 如果是普通元素，直接添加到结果中
          allChildren.push(child)
        }
      })
    }

    processChildren(group.children)
    return allChildren
  }
  // 递归检查组内所有元素是否相同类型（包括嵌套组）
  const isGroupSameType = (group: GroupElement): boolean => {
    const children = getGroupChildren(group)
    if (children.length === 0) return false
    const firstType = children[0].type
    return children.every((el) => el.type === firstType)
  }
  // 递归获取组内所有元素的共同类型（包括嵌套组）
  const getGroupCommonType = (group: GroupElement): CanvasElement["type"] | null => {
    const children = getGroupChildren(group)
    if (children.length === 0) return null
    const firstType = children[0].type
    const allSame = children.every((el) => el.type === firstType)
    return allSame ? firstType : null
  }

  /* 框选/多选时的辅助函数 */
  // 检查选中的各元素是否具有相同的类型
  const elementsHaveSameType = (elements: CanvasElement[], selectedId: string[]): boolean => {
    if (selectedId.length === 0) return false
    const selectedElement = elements.filter((el) => selectedId.includes(el.id))
    if (selectedElement.length === 0) return false

    const firstType = selectedElement[0].type
    return selectedElement.every((el) => el.type === firstType)
  }

  // 获取选中元素的共同类型
  const getCommonType = (elements: CanvasElement[], selectedId: string[]): CanvasElement["type"] | null => {
    if (!elementsHaveSameType(elements, selectedId)) return null
    const selectedElement = elements.filter((el) => selectedId.includes(el.id))
    return selectedElement[0]?.type || null
  }

  /* ---------- 事件处理函数 ---------- */

  /**
   * 处理元素属性变更
   * 
   * @function handleSingleChange
   * 
   * @description 
   * 更新当前选中元素的属性。该函数接收部分属性变更对象，
   * 并通过 updateElement 方法将变更应用到画布状态中。
   * 
   * @param {Partial<CanvasElement>} changes - 要变更的属性对象
   * 
   * @returns {void} 无返回值
   */

  // 右侧属性面板，操作处理函数
  // 支持单个元素属性更新
  const handleSingleChange = (
    changes: Partial<CanvasElement>,
  ) => {
    if (!selectedElement) return
    updateElement(selectedElement.id, changes)
  }

  // 支持多批量多种类型元素的部分属性更新操作
  const handleLayoutChange = (changes: Partial<CanvasElement>) => {
    if (state.elements.length === 0) return

    // 批量更新
    state.selectedIds.forEach((id) => {
      updateElement(id, changes)
    })
  }

  // 同类型多元素批量操作
  // 批量处理图形元素
  const handleShapesChange = (changes: Partial<ShapeElement>) => {
    if (state.selectedIds.length === 0) return
    state.selectedIds.forEach((id) => {
      updateElement(id, changes as Partial<CanvasElement>)
    })
  }
  // 批量处理文本元素
  const handleTextsChange = (changes: Partial<TextElement>) => {
    if (state.selectedIds.length === 0) return
    state.selectedIds.forEach((id) => {
      updateElement(id, changes as Partial<CanvasElement>)
    })
  }
  // 批量处理图片元素
  const handleImagesChange = (changes: Partial<ImageElement>) => {
    if (state.selectedIds.length === 0) return
    state.selectedIds.forEach((id) => {
      updateElement(id, changes as Partial<CanvasElement>)
    })
  }

  // 处理组元素的属性变更
  // 组内相同元素批量更新
  const handleSameGroupUpdate = (changes: Partial<CanvasElement>) => {
    if (!isSingleGroup || !selectedElement) return
    const group = selectedElement as GroupElement

    // 递归更新子元素的辅助函数
    const updateChildElements = (children: CanvasElement[]) => {
      const updatedChildren: CanvasElement[] = [];

      children.forEach(child => {
        if (child.type === 'group') {
          // 如果是嵌套组，递归处理其内部的子元素
          const nestedGroup = child as GroupElement;
          const updatedNestedChildren = updateChildElements(nestedGroup.children);

          // 更新嵌套组本身
          updateElement(nestedGroup.id, {
            children: updatedNestedChildren
          });

          // 将更新后的嵌套组添加到结果中
          updatedChildren.push({
            ...nestedGroup,
            children: updatedNestedChildren
          });
        } else {
          // 如果是普通元素，更新其属性
          updateElement(child.id, changes as Partial<CanvasElement>);

          // 将更新后的元素添加到结果中，根据元素类型进行类型安全的合并
          if (child.type === 'text') {
            const textElement = child as TextElement;
            const textChanges = changes as Partial<TextElement>;
            updatedChildren.push({
              ...textElement,
              ...textChanges
            });
          } else if (child.type === 'shape') {
            const shapeElement = child as ShapeElement;
            const shapeChanges = changes as Partial<ShapeElement>;
            updatedChildren.push({
              ...shapeElement,
              ...shapeChanges
            });
          } else if (child.type === 'image') {
            const imageElement = child as ImageElement;
            const imageChanges = changes as Partial<ImageElement>;
            updatedChildren.push({
              ...imageElement,
              ...imageChanges
            });
          } else {
            // 剩下的类型只能是group
            const groupElement = child as GroupElement;
            updatedChildren.push({
              ...groupElement
            });
          }
        }
      });

      return updatedChildren;
    };

    // 计算需要传递给子元素的变化
    const childChanges: Partial<CanvasElement> = { ...changes };

    // 对于布局属性，需要特殊处理
    if ('x' in changes || 'y' in changes || 'width' in changes || 'height' in changes
      || 'rotation' in changes || 'opacity' in changes) {

      // 计算缩放比例
      let scaleX = 1;
      let scaleY = 1;

      if ('width' in changes || 'height' in changes) {
        const oldWidth = group.width;
        const oldHeight = group.height;
        const newWidth = 'width' in changes ? changes.width! : oldWidth;
        const newHeight = 'height' in changes ? changes.height! : oldHeight;

        scaleX = oldWidth > 0 ? newWidth / oldWidth : 1;
        scaleY = oldHeight > 0 ? newHeight / oldHeight : 1;
      }

      // 计算位置偏移
      const deltaX = 'x' in changes ? changes.x! - group.x : 0;
      const deltaY = 'y' in changes ? changes.y! - group.y : 0;

      // 递归更新组元素的children数组，让子元素保持最新的引用状态
      const updateLayoutForChildren = (children: CanvasElement[]): CanvasElement[] => {
        return children.map(child => {
          const childElement = state.elements.find(el => el.id === child.id);
          if (!childElement) return child;

          // 创建更新后的子元素对象
          const updatedChild = { ...child };

          if (child.type === 'group') {
            // 如果是嵌套组，递归处理其内部的子元素
            const nestedGroup = child as GroupElement;
            const nestedParentX = childElement.x;
            const nestedParentY = childElement.y;

            const updatedNestedChildren = updateLayoutForChildren(nestedGroup.children);

            // 更新嵌套组的位置和尺寸
            const nestedDeltaX = deltaX;
            const nestedDeltaY = deltaY;
            const nestedScaleX = scaleX;
            const nestedScaleY = scaleY;

            const nestedRelativeX = nestedParentX - group.x;
            const nestedRelativeY = nestedParentY - group.y;

            updatedChild.width = childElement.width * nestedScaleX;
            updatedChild.height = childElement.height * nestedScaleY;
            updatedChild.x = group.x + nestedDeltaX + nestedRelativeX * nestedScaleX;
            updatedChild.y = group.y + nestedDeltaY + nestedRelativeY * nestedScaleY;

            // 应用旋转和透明度
            if ('rotation' in changes && childChanges.rotation !== undefined) {
              updatedChild.rotation = childChanges.rotation;
            }
            if ('opacity' in changes && childChanges.opacity !== undefined) {
              updatedChild.opacity = childChanges.opacity;
            }

            // 更新嵌套组本身
            updateElement(nestedGroup.id, {
              x: updatedChild.x,
              y: updatedChild.y,
              width: updatedChild.width,
              height: updatedChild.height,
              rotation: updatedChild.rotation,
              opacity: updatedChild.opacity,
              children: updatedNestedChildren
            });

            return {
              ...updatedChild,
              children: updatedNestedChildren
            };
          } else {
            // 如果是普通元素，应用位置和尺寸变化
            if (deltaX !== 0 || deltaY !== 0) {
              updatedChild.x = childElement.x + deltaX;
              updatedChild.y = childElement.y + deltaY;
            }

            // 应用尺寸缩放
            if (scaleX !== 1 || scaleY !== 1) {
              const relativeX = childElement.x - group.x;
              const relativeY = childElement.y - group.y;

              updatedChild.width = childElement.width * scaleX;
              updatedChild.height = childElement.height * scaleY;
              updatedChild.x = group.x + deltaX + relativeX * scaleX;
              updatedChild.y = group.y + deltaY + relativeY * scaleY;
            }

            // 应用旋转和透明度
            if ('rotation' in changes && childChanges.rotation !== undefined) {
              updatedChild.rotation = childChanges.rotation;
            }
            if ('opacity' in changes && childChanges.opacity !== undefined) {
              updatedChild.opacity = childChanges.opacity;
            }

            // 实际更新子元素的状态
            updateElement(childElement.id, {
              x: updatedChild.x,
              y: updatedChild.y,
              width: updatedChild.width,
              height: updatedChild.height,
              rotation: updatedChild.rotation,
              opacity: updatedChild.opacity,
            });

            return updatedChild;
          }
        });
      };

      // 更新组元素的children数组
      const updatedChildren = updateLayoutForChildren(group.children);

      // 一次性更新组元素本身和它的children数组
      updateElement(group.id, {
        ...changes,
        children: updatedChildren
      });

      // 对于颜色等特定属性，需要额外更新
    } else if (isGroupSameType(group)) {
      const commonType = getGroupCommonType(group);
      if (commonType) {
        // 递归更新所有子元素的相同属性
        const updatedChildren = updateChildElements(group.children);

        // 更新组元素的children数组
        updateElement(group.id, {
          children: updatedChildren
        } as Partial<GroupElement>);
      }
    } else {
      // 对于混合类型组，递归更新所有子元素
      const updatedChildren = updateChildElements(group.children);

      // 更新组元素的children数组
      updateElement(group.id, {
        children: updatedChildren
      } as Partial<GroupElement>);
    }
  }


  // 未选中元素时显示画板属性编辑面板
  if (!selectedElement) {
    const artboard = state.artboard
    
    return (
      <aside className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-canvas-border bg-white/70 p-4">
        {/* 画板信息头部 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">画板设置</p>
            <p className="text-base font-semibold text-slate-900">
              画板属性
            </p>
          </div>
        </div>

        {/* 画板尺寸设置 */}
        <Section title="画板尺寸">
          <ArtboardSizeSelector
            width={artboard?.width ?? 800}
            height={artboard?.height ?? 600}
            onWidthChange={(value) => updateArtboard({ width: Math.max(100, value) })}
            onHeightChange={(value) => updateArtboard({ height: Math.max(100, value) })}
          />
        </Section>

        {/* 画板外观设置 */}
        <Section title="画板背景">
          <ArtboardColorSelector
            value={artboard?.backgroundColor ?? "#ffffff"}
            onChange={(value) => updateArtboard({ backgroundColor: value })}
          />
          <Field label="不透明度">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={artboard?.opacity ?? 1}
                onChange={(event) => updateArtboard({ opacity: Number(event.target.value) })}
                className="flex-1"
              />
              <span className="w-12 text-center text-sm">{Math.round((artboard?.opacity ?? 1) * 100)}%</span>
            </div>
          </Field>
        </Section>

        {/* 提示信息 */}
        <div className="mt-2 text-xs text-slate-400 space-y-1">
          <p>提示：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>画板是所有元素的基础容器</li>
            <li>新增的元素会渲染在画板上</li>
            <li>选中画布中的元素可编辑元素属性</li>
          </ul>
        </div>
      </aside>
    )
  }

  // 选中元素时显示的属性编辑面板
  // 根据选中的元素数量决定是单选渲染，还是多选渲染
  if (state.selectedIds.length > 1) {
    // 多选渲染，包括不同类型和相同类型的多元素
    const isSameType = elementsHaveSameType(state.elements, state.selectedIds);
    const commonType = getCommonType(state.elements, state.selectedIds);

    return (
      <aside className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-canvas-border bg-white/70 p-4">
        {/* 多选的头部信息 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {isSameType ? `多选${getTypeDisplayName(commonType)}` : "多选元素"}
            </p>
            <p className="text-base font-semibold text-slate-900">
              一共 {state.selectedIds.length} 个元素
              {isSameType && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({getTypeDisplayName(commonType)})
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={deleteSelected}
            className="text-xs font-medium text-rose-600 hover:text-rose-700"
          >
            删除全部
          </button>
        </div>

        {/* 多选的属性控制区域，此时仅支持统一设置宽高、旋转和不透明度 */}
        <Section title="布局属性">
          <div className="space-y-3">
            <Field label="宽度">
              <NumberInput
                value={selectedElement?.width || 0}
                onChange={(value) => handleLayoutChange({ width: value })}
                min={1}
              />
            </Field>
            <Field label="高度">
              <NumberInput
                value={selectedElement?.height || 0}
                onChange={(value) => handleLayoutChange({ height: value })}
                min={1}
              />
            </Field>
            <Field label="旋转">
              <RotationInput
                value={selectedElement?.rotation || 0}
                onChange={(value) => handleLayoutChange({ rotation: value })}
              />
            </Field>
            <Field label="不透明度">
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={selectedElement?.opacity || 0}
                onChange={(event) => handleLayoutChange({ opacity: Number(event.target.value) })}
                className="w-full"
              />
            </Field>
          </div>
        </Section>

        {/* 同类元素的特定属性控制区域 */}
        {/* 基础图形类 */}
        {isSameType && commonType === "shape" && (
          <Section title="图形属性">
            <ShapeControls
              element={selectedElement as ShapeElement}
              update={(changes) => handleShapesChange(changes)}
            />
            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                正在批量处理 {state.selectedIds.length} 个图形元素
              </p>
            </div>
          </Section>
        )}
        {/* 图片类 */}
        {isSameType && commonType === "image" && (
          <Section title="图片属性">
            <ImageControls
              element={selectedElement as ImageElement}
              update={(changes) => handleImagesChange(changes)}
            />
            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                正在批量处理 {state.selectedIds.length} 个图片元素
              </p>
            </div>
          </Section>
        )}

        {/* 不同类型元素，给一个提示信息 */}
        {!isSameType && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700">
              当前选中了多个不同类型的元素，仅适用部分类型的批操作
            </p>
            <p className="text-xs text-blue-600 mt-1">
              如需编辑特定属性，请单独选中元素
            </p>
          </div>
        )}
      </aside>
    );
  }

  // 单选渲染
  // 是一个组元素
  if (isSingleGroup) {
    const group = selectedElement as GroupElement
    const isSameType = isGroupSameType(group)
    const commonType = getGroupCommonType(group)

    // 并且是相同类型的组元素
    if (isSameType && commonType) {
      const children = getGroupChildren(group)
      const sampleElement = children[0]

      return (
        <aside className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-canvas-border bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                组（{getTypeDisplayName(commonType)}）
              </p>
              <p className="text-base font-semibold text-slate-900">
                {selectedElement.name}
              </p>
              <p className="text-xs text-slate-500">
                包含 {children.length} 个{getTypeDisplayName(commonType)}元素
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={deleteSelected}
                className="text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                删除
              </button>
            </div>
          </div>

          <Section title="布局">
            <div className="grid grid-cols-2 gap-3">
              <Field label="X">
                <NumberInput
                  value={selectedElement.x}
                  onChange={value => handleSameGroupUpdate({ x: value })}
                />
              </Field>
              <Field label="Y">
                <NumberInput
                  value={selectedElement.y}
                  onChange={value => handleSameGroupUpdate({ y: value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="旋转">
                <RotationInput
                  value={selectedElement.rotation}
                  onChange={value => handleSameGroupUpdate({ rotation: value })}
                />
              </Field>
              <Field label="不透明度">
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={selectedElement.opacity}
                  onChange={(event) =>
                    handleSameGroupUpdate({ opacity: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
          </Section>

          {/* 类型特定的属性（根据共同类型显示） */}
          {commonType === "shape" && (
            <Section title="图形属性">
              <ShapeControls
                element={sampleElement as ShapeElement}
                update={(changes) =>
                  handleSameGroupUpdate(changes as Partial<CanvasElement>)
                }
              />
              <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  正在批量编辑 {children.length} 个图形元素
                </p>
              </div>
            </Section>
          )}

          {commonType === "image" && (
            <Section title="图片属性">
              <ImageControls
                element={sampleElement as ImageElement}
                update={(changes) =>
                  handleSameGroupUpdate(changes as Partial<CanvasElement>)
                }
              />
              <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  正在批量编辑 {children.length} 个图片元素
                </p>
              </div>
            </Section>
          )}
        </aside>
      )
    } else { // 是组，但是元素类型不一致
      return (
        <aside className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-canvas-border bg-white/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">组（混合类型）</p>
              <p className="text-base font-semibold text-slate-900">
                {selectedElement.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={deleteSelected}
                className="text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                删除
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              混合类型组
            </p>
            <p className="mt-1 text-xs text-amber-600">
              当前可能存在嵌套组元素。
              如需编辑特定属性，请解散组或单独选中子元素。
            </p>
          </div>

          <Section title="布局">
            <div className="grid grid-cols-2 gap-3">
              <Field label="X">
                <NumberInput
                  value={selectedElement.x}
                  onChange={value => handleSameGroupUpdate({ x: value })}
                />
              </Field>
              <Field label="Y">
                <NumberInput
                  value={selectedElement.y}
                  onChange={value => handleSameGroupUpdate({ y: value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="旋转">
                <RotationInput
                  value={selectedElement.rotation}
                  onChange={value => handleSingleChange({ rotation: value })}
                />
              </Field>
              <Field label="不透明度">
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={selectedElement.opacity}
                  onChange={(event) =>
                    handleSingleChange({ opacity: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
          </Section>
        </aside>
      )
    }
  }
  return (
    <aside className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-canvas-border bg-white/70 p-4">
      {/* 元素信息头部，显示元素名称和删除按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">当前元素</p>
          <p className="text-base font-semibold text-slate-900">
            {selectedElement.name}
          </p>
        </div>
        <button
          type="button"
          onClick={deleteSelected}
          className="text-xs font-medium text-rose-600 hover:text-rose-700"
        >
          删除
        </button>
      </div>

      {/* 通用布局属性控制区域 */}
      <Section title="布局">
        <div className="grid grid-cols-2 gap-3">
          <Field label="X">
            <NumberInput
              value={selectedElement.x}
              onChange={(value) => handleSingleChange({ x: value })}
            />
          </Field>
          <Field label="Y">
            <NumberInput
              value={selectedElement.y}
              onChange={(value) => handleSingleChange({ y: value })}
            />
          </Field>
          <Field label="宽度">
            <NumberInput
              value={selectedElement.width}
              onChange={(value) => handleSingleChange({ width: value })}
            />
          </Field>
          <Field label="高度">
            <NumberInput
              value={selectedElement.height}
              onChange={(value) => handleSingleChange({ height: value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="旋转">
            <RotationInput
              value={selectedElement.rotation}
              onChange={(value) => handleSingleChange({ rotation: value })}
            />
          </Field>
          <Field label="不透明度">
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={selectedElement.opacity}
              onChange={(event) =>
                handleSingleChange({ opacity: Number(event.target.value) })
              }
            />
          </Field>
        </div>
      </Section>

      {/* 根据元素类型显示相应的属性控制组件 */}
      {selectedElement.type === "shape" && (
        <Section title="图形属性">
          <ShapeControls
            element={selectedElement}
            update={(changes) =>
              handleSingleChange(changes as Partial<CanvasElement>)
            }
          />
        </Section>
      )}

      {selectedElement.type === "image" && (
        <Section title="图片属性">
          <ImageControls
            element={selectedElement}
            update={(changes) =>
              handleSingleChange(changes as Partial<CanvasElement>)
            }
          />
        </Section>
      )}
    </aside>
  )
}


