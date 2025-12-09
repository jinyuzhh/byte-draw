import React, { type ReactNode } from "react"
import type { ImageElement, ShapeElement, TextElement } from "../../../types/canvas"
import { ColorInput, ColorSelector } from "./ColorSelector"

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}
    </span>
    {children}
  </label>
)

export const RotationInput = ({
  value,
  onChange,
  step = 1,
}: {
  value: number
  onChange: (value: number) => void
  step?: number
}) => {
  const [inputValue, setInputValue] = React.useState<string>(value.toFixed(2))

  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setInputValue(value.toFixed(2))
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleBlur = () => {
    const parsed = parseFloat(inputValue)
    if (Number.isNaN(parsed)) {
      setInputValue(value.toFixed(2))
    } else {
      const rounded = parseFloat(parsed.toFixed(2))
      setInputValue(rounded.toFixed(2))
      onChange(rounded)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
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

export const NumberInput = ({
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

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-4 rounded-2xl border border-canvas-border bg-white/90 p-4 shadow-sm">
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    {children}
  </section>
)

export const ShapeControls = ({
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

export const TextControls = ({
  element,
  update,
}: {
  element: TextElement
  update: (changes: Partial<TextElement>) => void
}) => {
  const placeholder = "请输入文本内容..."

  const handleFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    if (event.target.value === placeholder) {
      update({ text: "" })
    }
  }

  const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!event.target.value.trim()) {
      update({ text: placeholder })
    }
  }

  return (
    <div className="space-y-3">
      <Field label="内容">
        <textarea
          value={element.text}
          onChange={(event) => update({ text: event.target.value })}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="h-24 w-full rounded-lg border border-canvas-border bg-white p-2 text-sm text-slate-700 focus:border-canvas-accent focus:outline-none"
          style={{ color: element.text === placeholder ? "#9CA3AF" : "#374151" }}
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
}

export const ImageControls = ({
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
