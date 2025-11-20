import type { ReactNode } from "react"
import React from "react"
import { useCanvas } from "../../store/CanvasProvider"
import type { CanvasElement, ShapeElement, TextElement, ImageElement } from "../../types/canvas"

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}
    </span>
    {children}
  </label>
)

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

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-4 rounded-2xl border border-canvas-border bg-white/90 p-4 shadow-sm">
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    {children}
  </section>
)

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

const TextControls = ({
  element,
  update,
}: {
  element: TextElement
  update: (changes: Partial<TextElement>) => void
}) => (
  <div className="space-y-3">
    <Field label="内容">
      <textarea
        value={element.text}
        onChange={(event) => update({ text: event.target.value })}
        className="h-24 w-full rounded-lg border border-canvas-border bg-white p-2 text-sm text-slate-700 focus:border-canvas-accent focus:outline-none"
      />
    </Field>
    <Field label="字体大小">
      <NumberInput value={element.fontSize} onChange={(value) => update({ fontSize: value })} min={12} max={128} />
    </Field>
    <Field label="字体粗细">
      <NumberInput value={element.fontWeight} onChange={(value) => update({ fontWeight: value })} min={100} max={900} step={100} />
    </Field>
    <Field label="文字颜色">
      <ColorInput value={element.color} onChange={(value) => update({ color: value })} />
    </Field>
    <Field label="背景色">
      <ColorInput value={element.background} onChange={(value) => update({ background: value })} />
    </Field>
  </div>
)

const ImageControls = ({
  element,
  update,
}: {
  element: ImageElement
  update: (changes: Partial<ImageElement>) => void
}) => (
  <div className="space-y-3">
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

export const RightPanel = () => {
  const { state, updateElement, deleteSelected } = useCanvas()
  const selectedId = state.selectedIds[0]
  const selectedElement = state.elements.find((el) => el.id === selectedId)

  const handleChange = (
    changes: Partial<CanvasElement>,
  ) => {
    if (!selectedElement) return
    updateElement(selectedElement.id, changes)
  }

  if (!selectedElement) {
    return (
      <aside className="flex w-80 flex-col gap-3 border-l border-canvas-border bg-white/70 p-6 text-sm text-slate-500">
        <p className="font-semibold text-slate-700">属性</p>
        <p>请选择画布中的元素以编辑属性。</p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-slate-400">
          <li>支持图形、文字、图片基础属性调整</li>
          <li>可在左侧插入新的画布元素</li>
        </ul>
      </aside>
    )
  }

  return (
    <aside className="flex w-80 flex-col gap-4 overflow-y-auto border-l border-canvas-border bg-white/70 p-4">
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

      <Section title="布局">
        <div className="grid grid-cols-2 gap-3">
          <Field label="X">
            <NumberInput
              value={selectedElement.x}
              onChange={(value) => handleChange({ x: value })}
            />
          </Field>
          <Field label="Y">
            <NumberInput
              value={selectedElement.y}
              onChange={(value) => handleChange({ y: value })}
            />
          </Field>
          <Field label="宽度">
            <NumberInput
              value={selectedElement.width}
              onChange={(value) => handleChange({ width: value })}
            />
          </Field>
          <Field label="高度">
            <NumberInput
              value={selectedElement.height}
              onChange={(value) => handleChange({ height: value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="旋转">
            <NumberInput
              value={selectedElement.rotation}
              onChange={(value) => handleChange({ rotation: value })}
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
                handleChange({ opacity: Number(event.target.value) })
              }
            />
          </Field>
        </div>
      </Section>

      {selectedElement.type === "shape" && (
        <Section title="图形属性">
          <ShapeControls
            element={selectedElement}
            update={(changes) =>
              handleChange(changes as Partial<CanvasElement>)
            }
          />
        </Section>
      )}

      {selectedElement.type === "text" && (
        <Section title="文字属性">
          <TextControls
            element={selectedElement}
            update={(changes) =>
              handleChange(changes as Partial<CanvasElement>)
            }
          />
        </Section>
      )}

      {selectedElement.type === "image" && (
        <Section title="图片属性">
          <ImageControls
            element={selectedElement}
            update={(changes) =>
              handleChange(changes as Partial<CanvasElement>)
            }
          />
        </Section>
      )}
    </aside>
  )
}
