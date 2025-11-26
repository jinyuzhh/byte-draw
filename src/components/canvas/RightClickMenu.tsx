import React, { useRef, useEffect } from 'react'

interface MenuItem {
  label: string
  onClick: () => void
  disabled?: boolean
}

interface RightClickMenuProps {
  items: MenuItem[]
  x: number
  y: number
  isVisible: boolean
  onClose: () => void
}

export const RightClickMenu: React.FC<RightClickMenuProps> = ({
  items,
  x,
  y,
  isVisible,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  return (
    <div
      ref={menuRef}
      className="fixed bg-white shadow-lg rounded-md border border-gray-200 z-50 min-w-[180px] overflow-hidden"
      style={{
        left: x,
        top: y
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 ${item.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-800'}`}
          onClick={() => !item.disabled && item.onClick()}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}