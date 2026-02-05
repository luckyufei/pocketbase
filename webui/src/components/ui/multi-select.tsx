/**
 * MultiSelect - 多选标签选择器组件
 * 类似于 UI 版本的 ObjectSelect，支持多选并显示为可删除的标签
 * 使用 Portal 将下拉面板渲染到 body，避免被父容器的 overflow:hidden 裁剪
 */
import * as React from 'react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MultiSelectOption {
  value: string
  label?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = '- Select -',
  className,
  disabled = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // 确保 selected 和 options 始终是数组
  const safeSelected = selected || []
  const safeOptions = options || []

  // 计算下拉面板位置
  const updateDropdownPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4, // 4px 间距
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [])

  // 打开时计算位置
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition()
      // 监听滚动和窗口大小变化
      window.addEventListener('scroll', updateDropdownPosition, true)
      window.addEventListener('resize', updateDropdownPosition)
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true)
        window.removeEventListener('resize', updateDropdownPosition)
      }
    }
  }, [isOpen, updateDropdownPosition])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current && 
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggleOption = (value: string) => {
    if (safeSelected.includes(value)) {
      onChange(safeSelected.filter((v) => v !== value))
    } else {
      onChange([...safeSelected, value])
    }
  }

  const handleRemoveOption = (e: React.MouseEvent, value: string) => {
    e.stopPropagation()
    onChange(safeSelected.filter((v) => v !== value))
  }

  const getLabel = (value: string) => {
    const option = safeOptions.find((o) => o.value === value)
    return option?.label || value
  }

  // 下拉面板内容
  const dropdownContent = isOpen && !disabled && (
    <div
      ref={dropdownRef}
      className="fixed z-[99999] rounded-md border border-slate-200 bg-white shadow-lg"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
    >
      <div className="max-h-[200px] overflow-auto py-1">
        {safeOptions.map((option) => (
          <div
            key={option.value}
            onClick={() => handleToggleOption(option.value)}
            className={cn(
              'px-2 py-1.5 text-[12px] cursor-pointer transition-colors',
              'hover:bg-slate-50',
              safeSelected.includes(option.value) && 'bg-blue-50 text-blue-600'
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'h-3.5 w-3.5 rounded border flex items-center justify-center',
                  safeSelected.includes(option.value)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-slate-300'
                )}
              >
                {safeSelected.includes(option.value) && (
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span>{option.label || option.value}</span>
            </div>
          </div>
        ))}
        {safeOptions.length === 0 && (
          <div className="px-2 py-1.5 text-[12px] text-slate-400">No options available</div>
        )}
      </div>
    </div>
  )

  return (
    <div className={cn('relative', className)}>
      {/* 选中项显示区域（触发器） */}
      <div
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'min-h-[28px] w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px]',
          'flex flex-wrap items-center gap-1 cursor-pointer',
          'hover:border-slate-300 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed bg-slate-50',
          isOpen && 'border-blue-500 ring-1 ring-blue-500'
        )}
      >
        {safeSelected.length > 0 ? (
          safeSelected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]"
            >
              {getLabel(value)}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveOption(e, value)}
                  className="ml-0.5 hover:text-slate-900 focus:outline-none"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <div className="flex-1" />
        <ChevronDown className={cn(
          'h-3.5 w-3.5 text-slate-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </div>

      {/* 使用 Portal 将下拉面板渲染到 body，避免被 overflow:hidden 裁剪 */}
      {typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
    </div>
  )
}
