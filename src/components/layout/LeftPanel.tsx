/**
 * @fileoverview 左侧面板组件
 * @file /Volumes/DreamZero/code/project/bytedance-canvas/src/components/layout/LeftPanel.tsx
 * 
 * @description 
 * 左侧工具面板组件，提供画布元素的创建和添加功能。
 * 该组件作为应用的主要工具栏，允许用户：
 * 1. 添加基本图形（矩形、圆形、三角形）
 * 2. 添加文本元素
 * 3. 上传并添加图片
 * 
 * @author Canvas Team
 * @version 1.0.0
 */

import { useState, type ChangeEvent, type ReactNode } from "react"
import { useCanvas } from "../../store/CanvasProvider" 
import type { ShapeVariant } from "../../types/canvas"
import {
  Square,
  Circle,
  Triangle,
  Type,
  ImagePlus,
  Plus,
  Upload,
} from "lucide-react" 

/**
 * 图片参数常量
 */
const MAX_IMAGE_SIZE_MB = 10 // 最大图片大小 10MB
const MAX_IMAGE_SIZE = MAX_IMAGE_SIZE_MB * 1024 * 1024 // 最大图片大小 10 * 1024 * 1024 Byte

/**
 * 支持的基础图形类型配置
 * 
 * @description 
 * 定义应用中支持的基础图形类型及其显示标签。
 * 每个对象包含：
 * - label: 用户界面显示的中文名称
 * - shape: 对应的 ShapeVariant 类型值，用于内部逻辑处理
 * 
 * @type {Array<{label: string, shape: ShapeVariant}>}
 * 
 * @example
 * ```tsx
 * // 使用示例
 * shapes.map((shape) => (
 *   <button key={shape.shape} onClick={() => addShape(shape.shape)}>
 *     {shape.label}
 *   </button>
 * ))
 * ```
 */
const shapes: { label: string; shape: ShapeVariant; icon: ReactNode }[] = [
  { label: "矩形", shape: "rectangle", icon: <Square size={20} /> },
  { label: "圆形", shape: "circle", icon: <Circle size={20} /> },
  { label: "三角形", shape: "triangle", icon: <Triangle size={20} /> },
]

/**
 * 面板区域容器组件
 * 
 * @component Section
 * 
 * @description 
 * 可复用的面板区域容器，用于组织左侧面板中的不同功能区域。
 * 提供统一的视觉样式和布局结构，确保界面一致性。
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
 * <Section title="图形工具">
 *   <button>矩形</button>
 *   <button>圆形</button>
 * </Section>
 * ```
 */
const Section = ({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) => (
  <section className="space-y-3 rounded-2xl border border-canvas-border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      {icon && <span className="text-canvas-accent">{icon}</span>}
      {title}
    </h3>
    {children}
  </section>
)

/**
 * 左侧工具面板组件
 * 
 * @component LeftPanel
 * 
 * @description 
 * 应用程序左侧的工具面板，提供画布元素的创建和添加功能。
 * 该组件包含三个主要功能区：
 * 1. 图形工具区：提供基础图形（矩形、圆形、三角形）的快速添加
 * 2. 文本工具区：允许用户输入并添加文本元素
 * 3. 图片上传区：支持本地图片上传并添加到画布
 * 
 * @returns {JSX.Element} 返回左侧面板的完整 JSX 结构
 * 
 * @example
 * ```tsx
 * // 在布局中使用
 * <div className="flex">
 *   <LeftPanel />
 *   <CanvasArea />
 * </div>
 * ```
 */
export const LeftPanel = () => {
  // 从 CanvasProvider 获取画布操作方法
  const { addShape, addText, addImage } = useCanvas()
  
  // 文本输入状态管理，默认值为提示文本
  // 实际应该设置分为 textValue 和 placeholder
  const [textValue, setTextValue] = useState("") // 文本输入的值
  const [showPlaceholder, setShowPlaceholder] = useState(true) // 是否显示提示文本

  /**
 * 处理图片上传事件
 * 
 * @function handleUpload
 * 
 * @description 
 * 处理用户选择的图片文件，将其转换为 Data URL 并添加到画布中。
 * 该函数执行以下步骤：
 * 1. 获取用户选择的文件
 * 2. 使用 FileReader 读取文件为 Data URL
 * 3. 创建 Image 对象获取图片尺寸
 * 4. 根据最大宽度限制计算缩放比例
 * 5. 调用 addImage 方法将图片添加到画布
 * 
 * @param {ChangeEvent<HTMLInputElement>} event - 文件输入框的变更事件
 * 
 * @returns {void} 无返回值
 * 
 * @example
 * ```tsx
 * // 在文件输入框中使用
 * <input
 *   type="file"
 *   accept="image/png,image/jpeg"
 *   onChange={handleUpload}
 * />
 * ```
 */

  // 文本框获得焦点
  const handleTextFocus = () => {
    setShowPlaceholder(false) // 隐藏提示文本
    if (textValue === "文本文案 / 支持多行输入") { // 如果文本框初始值为提示文本，清空文本框
      setTextValue("") // 清空文本输入框
    }
  }
  // 文本框失去焦点
  const handleTextBlur = () => {
    if (!textValue.trim()) {
      setShowPlaceholder(true) // 显示提示文本
      setTextValue("文本文案 / 支持多行输入") // 设置提示文本
    }
  }
  // 添加文本
  const handleAddText = () => {
    if (showPlaceholder || !textValue.trim() || textValue === "文本文案 / 支持多行输入") {
      return // 空输入或提示文本不添加
    }
    addText(textValue) // 添加文本元素
    setTextValue("") // 清空文本输入框
    setShowPlaceholder(true) // 显示提示文本
  }

  // 图片压缩方法
  const compressImage = (dataURL: string, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        // 合理的尺寸
        if (img.width <= maxWidth && img.height <= maxHeight) {
          resolve(dataURL)
          return
        }

        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(dataURL)
          return
        }

        // 计算等比例缩放
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (maxWidth / width) * height
          width = maxWidth
        }
        
        if (height > maxHeight) {
          width = (maxHeight / height) * width
          height = maxHeight
        }
        
        canvas.width = width
        canvas.height = height

        // 绘制压缩后的图片
        ctx.drawImage(img, 0, 0, width, height)
        // 转换为JPEG格式（压缩率更高）
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        resolve(compressedDataUrl)
      }

      img.onerror = () => {
        resolve(dataURL)
      }
      img.src = dataURL
    })
  }

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    // 获取用户选择的第一个文件
    const file = event.target.files?.[0]
    if (!file) return

    // 1. 类型检查
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"]
    if (!allowedTypes.includes(file.type)){
      alert(`当前不支持 ${file.type} 类型的图片上传`)
      event.target.value = ""
      return
    }
    // 2. 大小检查
    if (file.size > MAX_IMAGE_SIZE){
      alert(`图片大小不能超过 ${MAX_IMAGE_SIZE_MB}MB\n请重新选择图片`)
      event.target.value = ""
      return
    }
    
    // 创建 FileReader 对象用于读取文件
    const reader = new FileReader()
    
    // 文件读取完成后的回调函数
    reader.onload = () => {
      // 验证读取结果是否为有效的字符串格式 Data URL
      if (!reader.result || typeof reader.result !== "string") return
      const dataUrl = reader.result
      
      // 创建 Image 对象以获取图片的实际尺寸
      const image = new Image()
      // 设置跨域属性，避免跨域图片加载问题
      image.crossOrigin = "anonymous"
      
      // 图片加载完成后的回调函数，搭配图片压缩使用
      image.onload = async () => {
        const MAX_PIXEL = 2000 // 最大像素限制

        let findDataUrl = dataUrl
        if (image.width > MAX_PIXEL || image.height > MAX_PIXEL) {
          try {
            findDataUrl = await compressImage(dataUrl, MAX_PIXEL, MAX_PIXEL)
          } catch (err) {
            alert("图片压缩失败，使用图片,错误：" + err)
          }
        }

        const maxWidth = 480 // 最大宽度限制
        const scale = Math.min(1, maxWidth / image.width)

        addImage(findDataUrl, {
          width: image.width * scale,
          height: image.height * scale,
        })
      }
      
      // 图片加载错误处理
      image.onerror = () => {
        console.error("无法加载图片")
      }
      
      // 设置图片源，触发图片加载
      image.src = dataUrl
    }
    
    // 以 Data URL 格式读取文件
    reader.readAsDataURL(file)
    
    // 重置文件输入框的值，允许重复选择同一文件
    event.target.value = ""
  }


  return (
    // 左侧面板容器，固定宽度，垂直布局，带边框和背景
    <aside className="flex w-72 flex-col gap-4 border-r border-canvas-border bg-gradient-to-b from-slate-50/80 to-white/60 p-4 backdrop-blur-sm">
      {/* 图形工具区域：提供基础图形的快速添加功能 */}
      <Section title="快速插入图形" icon={<Plus size={16} />}>
        {/* 使用网格布局展示图形按钮，3列排列 */}
        <div className="grid grid-cols-3 gap-2">
          {/* 遍历 shapes 数组，为每个图形类型创建按钮 */}
          {shapes.map((shape) => (
            <button
              key={shape.shape} // 使用 shape 类型作为唯一键
              type="button"
              onClick={() => addShape(shape.shape)} // 点击时调用 addShape 方法
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-3 py-3 text-sm font-medium text-slate-600 hover:border-canvas-accent hover:text-canvas-accent hover:shadow-sm transition-all group"
            >
              <span className="text-slate-400 group-hover:text-canvas-accent transition-colors">
                {shape.icon}
              </span>
              <span className="text-xs">{shape.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* 文本工具区域：允许用户输入并添加文本元素 */}
      <Section title="文本" icon={<Type size={16} />}>
        {/* 多行文本输入框，受控组件 */}
        <textarea
          value={showPlaceholder ? "文本文案 / 支持多行输入" : textValue} // 根据是否显示提示文本显示不同默认值
          onChange={(event) => setTextValue(event.target.value)} // 更新文本状态
          onFocus={handleTextFocus} // 获得焦点时调用 handleTextFocus 函数
          onBlur={handleTextBlur} // 失去焦点时调用 handleTextBlur 函数
          className="h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-canvas-accent focus:ring-2 focus:ring-canvas-accent/20 focus:outline-none transition-all resize-none"
          style={{color: showPlaceholder ? "#9CA3AF" : "#374151"}} // 根据是否显示提示文本显示不同颜色
        />
        {/* 添加文本按钮 */}
        <button
          type="button"
          onClick={handleAddText} // 点击时调用 addText 方法
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 py-2.5 text-sm font-semibold text-white hover:from-slate-700 hover:to-slate-800 shadow-sm hover:shadow-md transition-all"
        >
          <Plus size={16} />
          添加文字
        </button>
      </Section>

      {/* 图片上传区域：支持本地图片上传并添加到画布 */}
      <Section title="上传图片" icon={<ImagePlus size={16} />}>
        {/* 自定义文件上传标签，提供拖放样式的上传区域 */}
        <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white text-center text-sm text-slate-500 hover:border-canvas-accent hover:bg-canvas-accent/5 transition-all group">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-canvas-accent/10 group-hover:text-canvas-accent transition-all">
            <Upload size={20} />
          </div>
          <span className="font-medium text-slate-600 group-hover:text-canvas-accent transition-colors">点击上传图片</span>
          <span className="text-xs text-slate-400">
            支持 PNG / JPG（≤ {MAX_IMAGE_SIZE_MB}MB）
          </span>
          {/* 隐藏的文件输入框，通过 label 触发 */}
          <input
            type="file"
            accept="image/png,image/jpeg" // 限制接受的文件类型
            className="hidden" // 隐藏原生输入框
            onChange={handleUpload} // 文件选择时调用 handleUpload 函数
          />
        </label>
      </Section>
    </aside>
  )
}
