/**
 * @file ExportMenu.tsx
 * @description 导出功能模块菜单组件
 */
import { useState, useEffect, useRef } from "react";
import { Download } from "lucide-react";

interface ExportMenuProps {
    onExport: (options: {
        format: 'png' | 'jpeg' | 'jpg'
        quality: number
        scale: number
    }) => void
}

export const ExportMenu = ({onExport}: ExportMenuProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const [format, setFormat] = useState<'png' | 'jpeg' | 'jpg'>('png')
    const [size, setSize] = useState<string>('1x')
    const [quality, setQuality] = useState<string>('high')
    const dropdownRef = useRef<HTMLDivElement>(null)

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const showDetail = format !== 'png'

    const handleExport = () => {
        const qualityMap = {
            low: 0.5,
            medium: 0.75,
            high: 1,
        }
        const scaleMap = {
            '1x': 1,
            '1.5x': 1.5,
            '2x': 2,
            '3x': 3,
        }
        onExport({
            format,
            quality: showDetail ? qualityMap[quality as keyof typeof qualityMap] : 1,
            scale: showDetail ? scaleMap[size as keyof typeof scaleMap] : 1,
        })
        setIsOpen(false)
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-slate-800 transition-colors"
            >
                <Download size={16} />
                导出
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-lg z-50">
                    <div className="space-y-3">
                        {/* 导出格式 */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                格式
                            </label>
                            <select
                                value={format}
                                onChange={e => setFormat(e.target.value as 'png' | 'jpg' | 'jpeg')}
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            >
                                <option value="png">PNG</option>
                                <option value="jpeg">JPEG</option>
                                <option value="jpg">JPG</option>
                            </select>
                        </div>

                        {/* 导出尺寸 */}
                        {showDetail && (
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">
                                    尺寸
                                </label>
                                <select
                                    value={size}
                                    onChange={e => setSize(e.target.value)}
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                >
                                    <option value="1x">1x </option>
                                    <option value="1.5x">1.5x </option>
                                    <option value="2x">2x </option>
                                    <option value="3x">3x </option>
                                </select>
                            </div>
                        )}

                        {/* 导出质量 */}
                        {showDetail && (
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">
                                    画质
                                </label>
                                <select
                                    value={quality}
                                    onChange={e => setQuality(e.target.value)}
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                >
                                    <option value="high">高 </option>
                                    <option value="medium">中 </option>
                                    <option value="low">低 </option>
                                </select>
                            </div>
                        )}

                        {/* 导出按钮 */}
                        <button
                            onClick={handleExport}
                            className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                            点击导出
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}