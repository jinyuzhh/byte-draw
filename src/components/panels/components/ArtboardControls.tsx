import React from "react"
import { PRESET_COLORS } from "./ColorSelector"

export const PRESET_SIZES = [
  { name: "竖版视频封面", ratio: "3:4", width: 1242, height: 1656 },
  { name: "竖版视频封面", ratio: "9:16", width: 1080, height: 1920 },
  { name: "横版视频封面", ratio: "16:9", width: 1920, height: 1080 },
  { name: "横版海报", ratio: "16:9", width: 1800, height: 1000 },
]

export const ArtboardSizeSelector = ({
  width,
  height,
  onWidthChange,
  onHeightChange,
}: {
  width: number
  height: number
  onWidthChange: (value: number) => void
  onHeightChange: (value: number) => void
}) => {
  const [customWidth, setCustomWidth] = React.useState(String(width))
  const [customHeight, setCustomHeight] = React.useState(String(height))
  const widthInputRef = React.useRef<HTMLInputElement>(null)
  const heightInputRef = React.useRef<HTMLInputElement>(null)

  const isPresetSelected = (preset: typeof PRESET_SIZES[0]) => {
    return width === preset.width && height === preset.height
  }

  const isCustomSelected = !PRESET_SIZES.some(isPresetSelected)

  React.useEffect(() => {
    if (document.activeElement !== widthInputRef.current) {
      setCustomWidth(String(width))
    }
  }, [width])

  React.useEffect(() => {
    if (document.activeElement !== heightInputRef.current) {
      setCustomHeight(String(height))
    }
  }, [height])

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomWidth(e.target.value)
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomHeight(e.target.value)
  }

  const handleWidthBlur = () => {
    const parsed = parseInt(customWidth, 10)
    if (Number.isNaN(parsed) || parsed < 100) {
      setCustomWidth(String(width))
    } else {
      const clamped = Math.min(4096, parsed)
      setCustomWidth(String(clamped))
      if (clamped !== width) {
        onWidthChange(clamped)
      }
    }
  }

  const handleHeightBlur = () => {
    const parsed = parseInt(customHeight, 10)
    if (Number.isNaN(parsed) || parsed < 100) {
      setCustomHeight(String(height))
    } else {
      const clamped = Math.min(4096, parsed)
      setCustomHeight(String(clamped))
      if (clamped !== height) {
        onHeightChange(clamped)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: "width" | "height") => {
    if (e.key === "Enter") {
      if (type === "width") {
        widthInputRef.current?.blur()
      } else {
        heightInputRef.current?.blur()
      }
    }
  }

  const handlePresetClick = (preset: typeof PRESET_SIZES[0]) => {
    onWidthChange(preset.width)
    onHeightChange(preset.height)
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
          isCustomSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"
        }`}
      >
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          isCustomSelected ? "border-blue-500" : "border-slate-300"
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
            onKeyDown={(e) => handleKeyDown(e, "width")}
            className="w-14 px-1.5 py-0.5 text-sm border border-canvas-border rounded focus:border-canvas-accent focus:outline-none text-center"
          />
          <span className="text-slate-400 text-xs">x</span>
          <input
            ref={heightInputRef}
            type="text"
            inputMode="numeric"
            value={customHeight}
            onChange={handleHeightChange}
            onBlur={handleHeightBlur}
            onKeyDown={(e) => handleKeyDown(e, "height")}
            className="w-14 px-1.5 py-0.5 text-sm border border-canvas-border rounded focus:border-canvas-accent focus:outline-none text-center"
          />
          <span className="text-xs text-slate-400">px</span>
        </div>
      </div>

      {PRESET_SIZES.map((preset, index) => {
        const selected = isPresetSelected(preset)
        return (
          <div
            key={index}
            onClick={() => handlePresetClick(preset)}
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
              selected ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                selected ? "border-blue-500" : "border-slate-300"
              }`}>
                {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <span className="text-sm text-slate-700">{preset.name} ({preset.ratio})</span>
            </div>
            <span className="text-xs text-slate-400 flex items-center justify-center gap-1">{preset.width} x {preset.height} 
              <span>px</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export const ArtboardColorSelector = ({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) => {
  const quickColors = [
    "#ffffff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1",
    "#fef2f2", "#fef3c7", "#dcfce7", "#dbeafe", "#f3e8ff",
    "#1e293b", "#0f172a", "#000000", "#3b82f6", "#22c55e",
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {quickColors.map((color, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onChange(color)}
            className={`h-8 w-full rounded-lg transition-all hover:scale-105 ${
              color === value
                ? "ring-2 ring-blue-500 ring-offset-2"
                : color === "#ffffff"
                ? "border border-canvas-border"
                : ""
            }`}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>

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
                  : color === "#ffffff"
                  ? "border border-canvas-border"
                  : ""
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </details>

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
            const val = e.target.value
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
              onChange(val)
            }
          }}
          placeholder="#ffffff"
          className="flex-1 px-2 py-1 text-sm border border-canvas-border rounded-lg focus:border-canvas-accent focus:outline-none"
        />
      </div>
    </div>
  )
}
