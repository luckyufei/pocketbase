/**
 * Filter Autocomplete Input
 * 支持 PocketBase filter 语法的自动补全输入框
 * 使用原生 input + 自定义下拉菜单实现，避免 CodeMirror 多实例问题
 */
import { useCallback, useMemo, useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { CollectionModel } from 'pocketbase'
import {
  getAllAutocompleteKeys,
  FILTER_MACROS,
} from '@/lib/filterAutocomplete'

interface FilterAutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  collections: CollectionModel[]
  baseCollection?: CollectionModel | null
  placeholder?: string
  disabled?: boolean
  className?: string
}

interface AutocompleteOption {
  label: string
  type?: string
  info?: string
}

export function FilterAutocompleteInput({
  value,
  onChange,
  onSubmit,
  collections,
  baseCollection,
  placeholder = 'Filter records, e.g. created > @now',
  disabled = false,
  className,
}: FilterAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)

  // 计算自动补全键
  const autocompleteKeys = useMemo(() => {
    return getAllAutocompleteKeys(collections, baseCollection)
  }, [collections, baseCollection])

  // 获取当前光标位置的词
  const getCurrentWord = useCallback((text: string, position: number): { word: string; start: number; end: number } => {
    // 查找词的开始和结束位置
    let start = position
    let end = position

    // 向左查找词的开始
    while (start > 0 && /[\w@.:_]/.test(text[start - 1])) {
      start--
    }

    // 向右查找词的结束
    while (end < text.length && /[\w@.:_]/.test(text[end])) {
      end++
    }

    return {
      word: text.slice(start, end),
      start,
      end,
    }
  }, [])

  // 计算补全选项
  const options = useMemo((): AutocompleteOption[] => {
    const { word } = getCurrentWord(value, cursorPosition)
    if (!word) return []

    const lowerWord = word.toLowerCase()
    const result: AutocompleteOption[] = []

    // 添加宏
    for (const macro of FILTER_MACROS) {
      if (macro.label.toLowerCase().includes(lowerWord)) {
        result.push({
          label: macro.label,
          type: macro.type,
          info: macro.info,
        })
      }
    }

    // 添加基础字段
    for (const key of autocompleteKeys.baseKeys) {
      if (key.toLowerCase().includes(lowerWord)) {
        result.push({
          label: key,
          type: 'property',
        })
      }
    }

    // @request 键
    if (lowerWord.startsWith('@r')) {
      for (const key of autocompleteKeys.requestKeys) {
        if (key.toLowerCase().includes(lowerWord)) {
          result.push({
            label: key,
            type: 'property',
          })
        }
      }
    }

    // @collection 键
    if (lowerWord.startsWith('@c')) {
      result.push({
        label: '@collection.*',
        type: 'keyword',
        info: '跨集合查询',
      })
      for (const key of autocompleteKeys.collectionJoinKeys) {
        if (key.toLowerCase().includes(lowerWord)) {
          result.push({
            label: key,
            type: 'property',
          })
        }
      }
    }

    return result.slice(0, 20) // 限制最多显示 20 个选项
  }, [value, cursorPosition, autocompleteKeys, getCurrentWord])

  // 选择补全选项
  const selectOption = useCallback((option: AutocompleteOption) => {
    const { start, end } = getCurrentWord(value, cursorPosition)
    const newValue = value.slice(0, start) + option.label + value.slice(end)
    onChange(newValue)
    setIsOpen(false)

    // 设置光标位置到插入内容之后
    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = start + option.label.length
        inputRef.current.setSelectionRange(newPosition, newPosition)
        inputRef.current.focus()
      }
    }, 0)
  }, [value, cursorPosition, onChange, getCurrentWord])

  // 键盘事件处理
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || options.length === 0) {
      if (e.key === 'Enter' && onSubmit) {
        e.preventDefault()
        onSubmit(value)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % options.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length)
        break
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        selectOption(options[selectedIndex])
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }, [isOpen, options, selectedIndex, selectOption, onSubmit, value])

  // 输入变化处理
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setCursorPosition(e.target.selectionStart || 0)
    setIsOpen(true)
    setSelectedIndex(0)
  }, [onChange])

  // 光标位置变化
  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement
    setCursorPosition(target.selectionStart || 0)
  }, [])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 滚动选中项到可见区域
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const selectedEl = dropdownRef.current.querySelector('[data-selected="true"]')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, isOpen])

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full h-9 px-3 py-2 text-sm rounded-md border border-input bg-background',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      />

      {/* 自动补全下拉菜单 */}
      {isOpen && options.length > 0 && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute z-50 top-full left-0 mt-1 w-full min-w-[200px] max-h-[300px]',
            'overflow-auto rounded-md border bg-popover p-1 shadow-md',
            'animate-in fade-in-0 zoom-in-95'
          )}
        >
          {options.map((option, index) => (
            <div
              key={option.label}
              data-selected={index === selectedIndex}
              onClick={() => selectOption(option)}
              className={cn(
                'flex items-center justify-between px-2 py-1.5 text-sm rounded-sm cursor-pointer',
                index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              )}
            >
              <span className="font-mono">{option.label}</span>
              {option.info && (
                <span className="text-xs text-muted-foreground ml-2">{option.info}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FilterAutocompleteInput
