// T029: 筛选自动完成输入组件
import { useState, useCallback, useRef, useEffect, forwardRef, useMemo } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface FilterOption {
  value: string
  label: string
  description?: string
}

interface BaseCollection {
  name: string
  type: string
  fields?: Array<{ name: string; type: string; hidden?: boolean }>
}

interface FilterAutocompleteInputProps {
  value?: string
  onChange?: (value: string) => void
  options?: FilterOption[]
  baseCollection?: BaseCollection
  placeholder?: string
  className?: string
  disabled?: boolean
}

// 生成基于 collection 的自动完成选项
function generateOptions(collection?: BaseCollection): FilterOption[] {
  if (!collection) return []

  const options: FilterOption[] = []

  // 添加字段名
  collection.fields?.forEach((field) => {
    if (!field.hidden) {
      options.push({
        value: field.name,
        label: field.name,
        description: `${field.type} field`,
      })
    }
  })

  // 添加 @request 选项
  options.push(
    {
      value: '@request.auth.id',
      label: '@request.auth.id',
      description: 'Current authenticated user ID',
    },
    {
      value: '@request.auth.email',
      label: '@request.auth.email',
      description: 'Current authenticated user email',
    },
    { value: '@request.body.', label: '@request.body.*', description: 'Request body fields' },
    { value: '@request.query.', label: '@request.query.*', description: 'Query parameters' },
    { value: '@request.headers.', label: '@request.headers.*', description: 'Request headers' }
  )

  // 添加操作符
  options.push(
    { value: '&&', label: '&&', description: 'AND operator' },
    { value: '||', label: '||', description: 'OR operator' },
    { value: '=', label: '=', description: 'Equal' },
    { value: '!=', label: '!=', description: 'Not equal' },
    { value: '>', label: '>', description: 'Greater than' },
    { value: '>=', label: '>=', description: 'Greater than or equal' },
    { value: '<', label: '<', description: 'Less than' },
    { value: '<=', label: '<=', description: 'Less than or equal' },
    { value: '~', label: '~', description: 'Like/Contains' },
    { value: '!~', label: '!~', description: 'Not like/Contains' }
  )

  return options
}

/**
 * 筛选自动完成输入组件
 * 用于 PocketBase 查询语法的自动完成
 */
export const FilterAutocompleteInput = forwardRef<
  HTMLTextAreaElement,
  FilterAutocompleteInputProps
>(function FilterAutocompleteInput(
  {
    value: controlledValue,
    onChange,
    options: externalOptions,
    baseCollection,
    placeholder = 'Leave empty to grant everyone access...',
    className,
    disabled = false,
  },
  ref
) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // 使用传入的 ref 或内部 ref
  const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef

  const value = controlledValue ?? internalValue

  // 生成选项
  const options = useMemo(() => {
    return externalOptions || generateOptions(baseCollection)
  }, [externalOptions, baseCollection])

  // 获取当前输入的最后一个词
  const currentWord = useMemo(() => {
    const words = value.split(/\s+/)
    return words[words.length - 1] || ''
  }, [value])

  // 过滤选项
  const filteredOptions = useMemo(() => {
    if (!currentWord) return options.slice(0, 10)
    return options
      .filter(
        (opt) =>
          opt.label.toLowerCase().includes(currentWord.toLowerCase()) ||
          opt.value.toLowerCase().includes(currentWord.toLowerCase())
      )
      .slice(0, 10)
  }, [options, currentWord])

  // 同步受控值
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue)
    }
  }, [controlledValue])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setInternalValue(newValue)
      onChange?.(newValue)
      setIsOpen(true)
      setHighlightedIndex(0)
    },
    [onChange]
  )

  const handleSelect = useCallback(
    (option: FilterOption) => {
      // 替换当前词
      const words = value.split(/\s+/)
      words[words.length - 1] = option.value
      const newValue = words.join(' ')
      setInternalValue(newValue)
      onChange?.(newValue)
      setIsOpen(false)
      textareaRef.current?.focus()
    },
    [value, onChange, textareaRef]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || filteredOptions.length === 0) {
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((i) => (i < filteredOptions.length - 1 ? i + 1 : 0))
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((i) => (i > 0 ? i - 1 : filteredOptions.length - 1))
          break
        case 'Tab':
        case 'Enter':
          if (filteredOptions[highlightedIndex] && currentWord) {
            e.preventDefault()
            handleSelect(filteredOptions[highlightedIndex])
          }
          break
        case 'Escape':
          setIsOpen(false)
          break
      }
    },
    [isOpen, filteredOptions, highlightedIndex, handleSelect, currentWord]
  )

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [textareaRef])

  return (
    <div className={cn('relative', className)}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => !disabled && setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="font-mono text-sm resize-none"
      />

      {isOpen && !disabled && filteredOptions.length > 0 && currentWord && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
          role="listbox"
        >
          {filteredOptions.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={index === highlightedIndex}
              className={cn(
                'cursor-pointer rounded-sm px-2 py-1.5 text-sm',
                index === highlightedIndex && 'bg-accent text-accent-foreground'
              )}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono">{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground ml-2">{option.description}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

export default FilterAutocompleteInput
