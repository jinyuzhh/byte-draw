import React from "react"

export const PRESET_COLORS = [
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
]

type ColorTabType = "fill" | "stroke"

export const ColorSelector = ({
  fillColor,
  strokeColor,
  onFillChange,
  onStrokeChange,
}: {
  fillColor: string
  strokeColor: string
  onFillChange: (color: string) => void
  onStrokeChange: (color: string) => void
}) => {
  const [activeTab, setActiveTab] = React.useState<ColorTabType>("fill")

  return (
    <div className="space-y-2">
      <div className="flex border-b border-canvas-border">
        <button
          type="button"
          onClick={() => setActiveTab("fill")}
          className={`px-3 py-1 text-sm font-medium transition-colors ${activeTab === "fill"
            ? "border-b-2 border-canvas-accent text-canvas-accent"
            : "text-slate-500 hover:text-slate-700"}`}
        >
          填充颜色
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("stroke")}
          className={`px-3 py-1 text-sm font-medium transition-colors ${activeTab === "stroke"
            ? "border-b-2 border-canvas-accent text-canvas-accent"
            : "text-slate-500 hover:text-slate-700"}`}
        >
          边框颜色
        </button>
      </div>

      <div className="flex">
        <div className="grid grid-cols-5 gap-1 mr-2">
          {PRESET_COLORS.slice(0, 25).map((color, index) => (
            <button
              key={index}
              type="button"
              onClick={() => activeTab === "fill" ? onFillChange(color) : onStrokeChange(color)}
              className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${color === "#ffffff" ? "border border-canvas-border" : ""}`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>

        <div className="flex-1">
          <input
            type="color"
            value={activeTab === "fill" ? fillColor : strokeColor}
            onChange={(event) => activeTab === "fill"
              ? onFillChange(event.target.value)
              : onStrokeChange(event.target.value)}
            className="h-12 w-full cursor-pointer rounded-lg border border-canvas-border bg-white"
          />
          <div className="mt-1 text-xs text-center text-slate-500">
            {activeTab === "fill" ? fillColor : strokeColor}
          </div>
        </div>
      </div>
    </div>
  )
}

export const ColorInput = ({
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
