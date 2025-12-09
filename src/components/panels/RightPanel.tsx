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

import type { ReactNode } from "react"
import React from "react"
import { useCanvas } from "../../store/CanvasProvider"
import type { CanvasElement, ShapeElement, TextElement, ImageElement, GroupElement } from "../../types/canvas"

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
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}
    </span>
    {children}
  </label>
)

/**
 * 旋转角度输入控件组件
 * 
 * @component RotationInput
 * 
 * @description 
 * 专用于旋转角度的输入控件，允许用户自由输入（包括负数、空值等临时不合法值），
 * 在失焦时统一校正为合法角度。支持上下箭头微调。
 */
const RotationInput = ({
  value,
  onChange,
  step = 1,
}: {
  value: number
  onChange: (value: number) => void
  step?: number
}) => {
  const [inputValue, setInputValue] = React.useState<string>(value.toFixed(2))

  // 同步外部 value 变化到输入框（仅当输入框未聚焦时）
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      // 保留两位小数
      setInputValue(value.toFixed(2))
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 允许任意输入，不做实时校验
    setInputValue(e.target.value)
  }

  const handleBlur = () => {
    // 失焦时校正为合法角度
    const parsed = parseFloat(inputValue)
    if (Number.isNaN(parsed)) {
      // 非法输入，恢复为当前值（保留两位小数）
      setInputValue(value.toFixed(2))
    } else {
      // 合法输入，保留两位小数并更新值
      const rounded = parseFloat(parsed.toFixed(2))
      setInputValue(rounded.toFixed(2))
      onChange(rounded)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur()
    }
  }

  const handleStep = (delta: number) => {
    const parsed = parseFloat(inputValue)
    const baseValue = Number.isNaN(parsed) ? value : parsed
    const newValue = parseFloat((baseValue + delta).toFixed(2))
    setInputValue(newValue.toFixed(2))
    onChange(newValue)
  }

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-canvas-border bg-white px-2 py-1 pr-8 text-sm text-slate-700 focus:border-canvas-accent focus:outline-none"
      />
      <div className="absolute right-1 flex flex-col">
        <button
          type="button"
          onClick={() => handleStep(step)}
          className="h-3 w-5 flex items-center justify-center text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 6">
            <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleStep(-step)}
          className="h-3 w-5 flex items-center justify-center text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 6">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * 数字输入控件组件
 * 
 * @component NumberInput
 * 
 * @description 
 * 专用于属性面板的数字输入控件，支持范围限制和步进控制。
 * 提供统一的样式和交互体验，确保数值输入的一致性。
 * 
 * @param {Object} props - 组件属性
 * @param {number} props.value - 当前数值
 * @param {Function} props.onChange - 数值变更回调函数
 * @param {number} [props.min] - 最小值限制
 * @param {number} [props.max] - 最大值限制
 * @param {number} [props.step=1] - 步进值，默认为1
 * 
 * @returns {JSX.Element} 返回数字输入控件
 * 
 * @example
 * ```tsx
 * // 使用示例
 * <NumberInput 
 *   value={width} 
 *   onChange={setWidth} 
 *   min={0} 
 *   max={1000} 
 *   step={10}
 * />
 * ```
 */
const NumberInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) => (
  <input
    type="number"
    min={min}
    max={max}
    step={step}
    // 限制小数位数为2位，提高显示精度
    value={Number(value.toFixed(2))}
    onChange={(event) => onChange(Number(event.target.value))}
    className="w-full rounded-lg border border-canvas-border bg-white px-2 py-1 text-sm text-slate-700 focus:border-canvas-accent focus:outline-none"
  />
)

// 预设颜色列表
const PRESET_COLORS = [
  '#ffffff', '#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a',
  '#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d',
  '#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f',
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
  '#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b',
  '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e',
  '#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a',
  '#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95',
  '#fdf4ff', '#fae8ff', '#f5d0fe', '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf', '#86198f', '#701a75',
  '#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337',
];

// 预设画板尺寸
const PRESET_SIZES = [
  { name: '竖版视频封面', ratio: '3:4', width: 1242, height: 1656 },
  { name: '竖版视频封面', ratio: '9:16', width: 1080, height: 1920 },
  { name: '横版视频封面', ratio: '16:9', width: 1920, height: 1080 },
  { name: '横版海报', ratio: '16:9', width: 1800, height: 1000 },
];

// 画板尺寸选择器组件
const ArtboardSizeSelector = ({
  width,
  height,
  onWidthChange,
  onHeightChange,
}: {
  width: number;
  height: number;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
}) => {
  const [customWidth, setCustomWidth] = React.useState(String(width));
  const [customHeight, setCustomHeight] = React.useState(String(height));
  const widthInputRef = React.useRef<HTMLInputElement>(null);
  const heightInputRef = React.useRef<HTMLInputElement>(null);

  // 检查当前尺寸是否匹配某个预设
  const isPresetSelected = (preset: typeof PRESET_SIZES[0]) => {
    return width === preset.width && height === preset.height;
  };

  const isCustomSelected = !PRESET_SIZES.some(isPresetSelected);

  // 同步外部值到自定义输入（仅当输入框未聚焦时）
  React.useEffect(() => {
    if (document.activeElement !== widthInputRef.current) {
      setCustomWidth(String(width));
    }
  }, [width]);

  React.useEffect(() => {
    if (document.activeElement !== heightInputRef.current) {
      setCustomHeight(String(height));
    }
  }, [height]);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomWidth(e.target.value);
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomHeight(e.target.value);
  };

  const handleWidthBlur = () => {
    const parsed = parseInt(customWidth, 10);
    if (Number.isNaN(parsed) || parsed < 100) {
      setCustomWidth(String(width));
    } else {
      const clamped = Math.min(4096, parsed);
      setCustomWidth(String(clamped));
      if (clamped !== width) {
        onWidthChange(clamped);
      }
    }
  };

  const handleHeightBlur = () => {
    const parsed = parseInt(customHeight, 10);
    if (Number.isNaN(parsed) || parsed < 100) {
      setCustomHeight(String(height));
    } else {
      const clamped = Math.min(4096, parsed);
      setCustomHeight(String(clamped));
      if (clamped !== height) {
        onHeightChange(clamped);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'width' | 'height') => {
    if (e.key === 'Enter') {
      if (type === 'width') {
        widthInputRef.current?.blur();
      } else {
        heightInputRef.current?.blur();
      }
    }
  };

  const handlePresetClick = (preset: typeof PRESET_SIZES[0]) => {
    onWidthChange(preset.width);
    onHeightChange(preset.height);
  };

  return (
    <div className="space-y-3">
      {/* 自定义尺寸选项 */}
      <div 
        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
          isCustomSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
        }`}
      >
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          isCustomSelected ? 'border-blue-500' : 'border-slate-300'
        }`}>
          {isCustomSelected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
        </div>
        <span className="text-sm text-slate-700 min-w-[48px]">自定义</span>
        <div className="flex items-center gap-1">
          <input
            ref={widthInputRef}
            type="text"
            inputMode="numeric"
            value={customWidth}
            onChange={handleWidthChange}
            onBlur={handleWidthBlur}
            onKeyDown={(e) => handleKeyDown(e, 'width')}
            className="w-14 px-1.5 py-0.5 text-sm border border-canvas-border rounded focus:border-canvas-accent focus:outline-none text-center"
          />
          <span className="text-slate-400 text-xs">×</span>
          <input
            ref={heightInputRef}
            type="text"
            inputMode="numeric"
            value={customHeight}
            onChange={handleHeightChange}
            onBlur={handleHeightBlur}
            onKeyDown={(e) => handleKeyDown(e, 'height')}
            className="w-14 px-1.5 py-0.5 text-sm border border-canvas-border rounded focus:border-canvas-accent focus:outline-none text-center"
          />
          <span className="text-xs text-slate-400">px</span>
        </div>
      </div>

      {/* 预设尺寸列表 */}
      {PRESET_SIZES.map((preset, index) => {
        const selected = isPresetSelected(preset);
        return (
          <div
            key={index}
            onClick={() => handlePresetClick(preset)}
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
              selected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                selected ? 'border-blue-500' : 'border-slate-300'
              }`}>
                {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <span className="text-sm text-slate-700">{preset.name}（{preset.ratio}）</span>
            </div>
            <span className="text-xs text-slate-400">{preset.width} × {preset.height} px</span>
          </div>
        );
      })}
    </div>
  );
};

// 画板背景颜色选择器组件
const ArtboardColorSelector = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) => {
  // 画板常用背景色
  const quickColors = [
    '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1',
    '#fef2f2', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff',
    '#1e293b', '#0f172a', '#000000', '#3b82f6', '#22c55e',
  ];

  return (
    <div className="space-y-3">
      {/* 快捷颜色选择 */}
      <div className="grid grid-cols-5 gap-2">
        {quickColors.map((color, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onChange(color)}
            className={`h-8 w-full rounded-lg transition-all hover:scale-105 ${
              color === value
                ? "ring-2 ring-blue-500 ring-offset-2"
                : color === '#ffffff'
                ? "border border-canvas-border"
                : ""
            }`}
            style={{ backgroundColor: color }}
            aria-label={`选择颜色 ${color}`}
          />
        ))}
      </div>

      {/* 更多颜色折叠区 */}
      <details className="group">
        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 list-none flex items-center gap-1">
          <svg
            className="w-3 h-3 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          更多颜色
        </summary>
        <div className="mt-2 grid grid-cols-10 gap-1">
          {PRESET_COLORS.map((color, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onChange(color)}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                color === value
                  ? "ring-2 ring-blue-500 ring-offset-1"
                  : color === '#ffffff'
                  ? "border border-canvas-border"
                  : ""
              }`}
              style={{ backgroundColor: color }}
              aria-label={`选择颜色 ${color}`}
            />
          ))}
        </div>
      </details>

      {/* 自定义颜色选择器 */}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-12 cursor-pointer rounded-lg border border-canvas-border bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const val = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
              onChange(val);
            }
          }}
          placeholder="#ffffff"
          className="flex-1 px-2 py-1 text-sm border border-canvas-border rounded-lg focus:border-canvas-accent focus:outline-none"
        />
      </div>
    </div>
  );
};

// 颜色选项卡类型
type ColorTabType = 'fill' | 'stroke';

// 双选项卡颜色选择器组件
const ColorSelector = ({
  fillColor,
  strokeColor,
  onFillChange,
  onStrokeChange,
}: {
  fillColor: string;
  strokeColor: string;
  onFillChange: (color: string) => void;
  onStrokeChange: (color: string) => void;
}) => {
  const [activeTab, setActiveTab] = React.useState<ColorTabType>('fill');

  return (
    <div className="space-y-2">
      {/* 选项卡 */}
      <div className="flex border-b border-canvas-border">
        <button
          type="button"
          onClick={() => setActiveTab('fill')}
          className={`px-3 py-1 text-sm font-medium transition-colors ${activeTab === 'fill'
            ? 'border-b-2 border-canvas-accent text-canvas-accent'
            : 'text-slate-500 hover:text-slate-700'}`}
        >
          填充颜色
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stroke')}
          className={`px-3 py-1 text-sm font-medium transition-colors ${activeTab === 'stroke'
            ? 'border-b-2 border-canvas-accent text-canvas-accent'
            : 'text-slate-500 hover:text-slate-700'}`}
        >
          边框颜色
        </button>
      </div>

      {/* 颜色选择区域 */}
      <div className="flex">
        {/* 左侧预设颜色 */}
        <div className="grid grid-cols-5 gap-1 mr-2">
          {PRESET_COLORS.slice(0, 25).map((color, index) => (
            <button
              key={index}
              type="button"
              onClick={() => activeTab === 'fill' ? onFillChange(color) : onStrokeChange(color)}
              className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${color === '#ffffff' ? 'border border-canvas-border' : ''}`}
              style={{ backgroundColor: color }}
              aria-label={`选择颜色 ${color}`}
            />
          ))}
        </div>

        {/* 右侧自定义颜色选择器 */}
        <div className="flex-1">
          <input
            type="color"
            value={activeTab === 'fill' ? fillColor : strokeColor}
            onChange={(event) => activeTab === 'fill'
              ? onFillChange(event.target.value)
              : onStrokeChange(event.target.value)}
            className="h-12 w-full cursor-pointer rounded-lg border border-canvas-border bg-white"
          />
          <div className="mt-1 text-xs text-center text-slate-500">
            {activeTab === 'fill' ? fillColor : strokeColor}
          </div>
        </div>
      </div>
    </div>
  );
};

// 保留原有的ColorInput组件，供其他地方使用
const ColorInput = ({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) => (
  <input
    type="color"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="h-10 w-full cursor-pointer rounded-lg border border-canvas-border bg-white"
  />
)

/**
 * 属性面板区域容器组件
 * 
 * @component Section
 * 
 * @description 
 * 可复用的属性面板区域容器，用于组织不同类型的属性控件。
 * 提供统一的视觉样式和布局结构，确保属性面板的界面一致性。
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.title - 区域标题，显示在容器顶部
 * @param {ReactNode} props.children - 区域内容，可以是任何有效的 React 节点
 * 
 * @returns {JSX.Element} 返回带有统一样式的区域容器
 * 
 * @example
 * ```tsx
 * // 使用示例
 * <Section title="布局属性">
 *   <Field label="宽度">
 *     <NumberInput value={width} onChange={setWidth} />
 *   </Field>
 * </Section>
 * ```
 */
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-4 rounded-2xl border border-canvas-border bg-white/90 p-4 shadow-sm">
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    {children}
  </section>
)

/**
 * 图形元素属性控制组件
 * 
 * @component ShapeControls
 * 
 * @description 
 * 专用于图形元素的属性编辑控件，提供图形特有的属性调整功能。
 * 根据图形类型显示相应的属性选项，如矩形的圆角设置。
 * 
 * @param {Object} props - 组件属性
 * @param {ShapeElement} props.element - 当前编辑的图形元素
 * @param {Function} props.update - 属性更新函数，接收部分属性变更对象
 * 
 * @returns {JSX.Element} 返回图形属性编辑控件
 * 
 * @example
 * ```tsx
 * // 使用示例
 * <ShapeControls 
 *   element={selectedShape} 
 *   update={handleShapeUpdate} 
 * />
 * ```
 */
const ShapeControls = ({
  element,
  update,
}: {
  element: ShapeElement
  update: (changes: Partial<ShapeElement>) => void
}) => (
  <div className="space-y-3">
    <Field label="颜色设置">
      <ColorSelector
        fillColor={element.fill}
        strokeColor={element.stroke}
        onFillChange={(color) => update({ fill: color })}
        onStrokeChange={(color) => update({ stroke: color })}
      />
    </Field>
    {/* 图形边框宽度控制 */}
    <Field label="边框宽度">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={element.strokeWidth}
          onChange={(event) => update({ strokeWidth: Number(event.target.value) })}
          className="flex-1"
        />
        <span className="w-10 text-center text-sm">{element.strokeWidth}</span>
      </div>
    </Field>
    {/* 仅矩形类型显示圆角控制 */}
    {element.shape === "rectangle" && (
      <Field label="圆角">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={element.cornerRadius}
            onChange={(event) => update({ cornerRadius: Number(event.target.value) })}
            className="flex-1"
          />
          <span className="w-10 text-center text-sm">{element.cornerRadius}</span>
        </div>
      </Field>
    )}
  </div>
)

/**
 * 文本元素属性控制组件
 * 
 * @component TextControls
 * 
 * @description 
 * 专用于文本元素的属性编辑控件，提供文本特有的属性调整功能。
 * 包括文本内容、字体大小、字体粗细、文字颜色和背景色等属性设置。
 * 
 * @param {Object} props - 组件属性
 * @param {TextElement} props.element - 当前编辑的文本元素
 * @param {Function} props.update - 属性更新函数，接收部分属性变更对象
 * 
 * @returns {JSX.Element} 返回文本属性编辑控件
 * 
 * @example
 * ```tsx
 * // 使用示例
 * <TextControls 
 *   element={selectedText} 
 *   update={handleTextUpdate} 
 * />
 * ```
 */
const TextControls = ({
  element,
  update,
}: {
  element: TextElement
  update: (changes: Partial<TextElement>) => void
}) => {
  // 文本框获得焦点
  const handleFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    // 如果是占位符，则清空文本内容
    if (event.target.value === '请输入文本内容...') {
      update({ text: '' })
    }
  }
  // 文本框失去焦点
  const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    // 如果文本内容为空，则显示占位符
    if (!event.target.value.trim()) {
      update({ text: '请输入文本内容...' })
    }
  }

  return (
    <div className="space-y-3">
      {/* 文本内容编辑区域 */}
      <Field label="内容">
        <textarea
          value={element.text}
          onChange={(event) => update({ text: event.target.value })}
          onFocus={handleFocus} // 获得焦点时清空文本内容
          onBlur={handleBlur} // 失去焦点时更新文本内容
          className="h-24 w-full rounded-lg border border-canvas-border bg-white p-2 text-sm text-slate-700 focus:border-canvas-accent focus:outline-none"
          style={{ color: element.text === "请输入文本内容..." ? "#9CA3AF" : "#374151" }} // 文本框状态决定显示颜色
        />
      </Field>
      {/* 字体大小控制 */}
      <Field label="字体大小">
        <NumberInput value={element.fontSize} onChange={(value) => update({ fontSize: value })} min={12} max={128} />
      </Field>
      {/* 字体粗细控制 */}
      <Field label="字体粗细">
        <NumberInput value={element.fontWeight} onChange={(value) => update({ fontWeight: value })} min={100} max={900} step={100} />
      </Field>
      {/* 文字颜色选择器 */}
      <Field label="文字颜色">
        <ColorInput value={element.color} onChange={(value) => update({ color: value })} />
      </Field>
      {/* 背景颜色选择器 */}
      <Field label="背景色">
        <ColorInput value={element.background} onChange={(value) => update({ background: value })} />
      </Field>
    </div>
  )
}

/**
 * 图片元素属性控制组件
 * 
 * @component ImageControls
 * 
 * @description 
 * 专用于图片元素的属性编辑控件，提供图片特有的属性调整功能。
 * 包括圆角设置、亮度调节、模糊效果和灰度滤镜等图片处理选项。
 * 
 * @param {Object} props - 组件属性
 * @param {ImageElement} props.element - 当前编辑的图片元素
 * @param {Function} props.update - 属性更新函数，接收部分属性变更对象
 * 
 * @returns {JSX.Element} 返回图片属性编辑控件
 * 
 * @example
 * ```tsx
 * // 使用示例
 * <ImageControls 
 *   element={selectedImage} 
 *   update={handleImageUpdate} 
 * />
 * ```
 */
const ImageControls = ({
  element,
  update,
}: {
  element: ImageElement
  update: (changes: Partial<ImageElement>) => void
}) => (
  <div className="space-y-3">
    {/* 图片圆角控制 */}
    <Field label="圆角">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={element.borderRadius}
          onChange={(event) => update({ borderRadius: Number(event.target.value) })}
          className="flex-1"
        />
        <span className="w-10 text-center text-sm">{element.borderRadius}</span>
      </div>
    </Field>
    {/* 图片亮度调节滑块 */}
    <Field label="亮度">
      <input
        type="range"
        min={0.5}
        max={1.5}
        step={0.05}
        value={element.filters.brightness}
        onChange={(event) =>
          update({ filters: { ...element.filters, brightness: Number(event.target.value) } })
        }
      />
    </Field>
    {/* 图片模糊效果调节滑块 */}
    <Field label="模糊">
      <input
        type="range"
        min={0}
        max={8}
        step={0.5}
        value={element.filters.blur}
        onChange={(event) =>
          update({ filters: { ...element.filters, blur: Number(event.target.value) } })
        }
      />
    </Field>
    {/* 灰度滤镜开关 */}
    <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
      <input
        type="checkbox"
        checked={element.filters.grayscale}
        onChange={(event) =>
          update({ filters: { ...element.filters, grayscale: event.target.checked } })
        }
        className="h-4 w-4 rounded border-canvas-border text-canvas-accent focus:ring-canvas-accent"
      />
      灰度滤镜
    </label>
  </div>
)

/**
 * 元素类型名称显示映射
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
          <p>💡 提示：</p>
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
        {/* 文本类 */}
        {isSameType && commonType === "text" && (
          <Section title="文字属性">
            <TextControls
              element={selectedElement as TextElement}
              update={(changes) => handleTextsChange(changes)}
            />
            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                正在批量处理 {state.selectedIds.length} 个文本元素
              </p>
              <p className="text-xs text-blue-600 mt-1">
                注意：文本批操作将修改所有选中的文本内容
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

          {commonType === "text" && (
            <Section title="文字属性">
              <TextControls
                element={sampleElement as TextElement}
                update={(changes) =>
                  handleSameGroupUpdate(changes as Partial<CanvasElement>)
                }
              />
              <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  正在批量编辑 {children.length} 个文本元素
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

      {selectedElement.type === "text" && (
        <Section title="文字属性">
          <TextControls
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
