// T028: 搜索栏组件
import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SearchbarProps {
  value?: string
  onChange?: (value: string) => void
  onSearch?: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
  autoFocus?: boolean
}

/**
 * 搜索栏组件
 * 支持防抖搜索、清空、回车搜索
 */
export function Searchbar({
  value: controlledValue,
  onChange,
  onSearch,
  placeholder = '搜索...',
  debounceMs = 300,
  className,
  autoFocus = false,
}: SearchbarProps) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '')
  const value = controlledValue ?? internalValue
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)

  // 自动聚焦
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // 同步受控值
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue)
    }
  }, [controlledValue])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setInternalValue(newValue)
      onChange?.(newValue)

      // 防抖搜索
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        onSearch?.(newValue)
      }, debounceMs)
    },
    [onChange, onSearch, debounceMs]
  )

  const handleClear = useCallback(() => {
    setInternalValue('')
    onChange?.('')
    onSearch?.('')
    inputRef.current?.focus()
  }, [onChange, onSearch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
        onSearch?.(value)
      }
    },
    [onSearch, value]
  )

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pl-9 pr-8"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
          onClick={handleClear}
          aria-label="清空搜索"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

export default Searchbar
