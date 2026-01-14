/**
 * T011: AdvancedSelect - 高级选择器组件
 * 支持搜索、多选、自定义选项渲染
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

interface SelectOption<T = string> {
  value: T
  label: string
  disabled?: boolean
}

interface AdvancedSelectProps<T = string> {
  options: SelectOption<T>[]
  value?: T | T[]
  onChange?: (value: T | T[] | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  noOptionsText?: string
  multiple?: boolean
  searchable?: boolean
  disabled?: boolean
  readonly?: boolean
  clearable?: boolean
  className?: string
  renderOption?: (option: SelectOption<T>) => React.ReactNode
  renderLabel?: (option: SelectOption<T>) => React.ReactNode
  searchFunc?: (option: SelectOption<T>, searchTerm: string) => boolean
}

export function AdvancedSelect<T = string>({
  options,
  value,
  onChange,
  placeholder = '- Select -',
  searchPlaceholder = 'Search...',
  noOptionsText = 'No options found',
  multiple = false,
  searchable = false,
  disabled = false,
  readonly = false,
  clearable = true,
  className,
  renderOption,
  renderLabel,
  searchFunc,
}: AdvancedSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // 标准化选中值为数组
  const selectedValues = useMemo(() => {
    if (value === undefined || value === null) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  // 默认搜索函数
  const defaultSearchFunc = useCallback((option: SelectOption<T>, search: string): boolean => {
    const normalizedSearch = search.replace(/\s+/g, '').toLowerCase()
    const normalizedLabel = option.label.replace(/\s+/g, '').toLowerCase()
    const normalizedValue = String(option.value).replace(/\s+/g, '').toLowerCase()
    return normalizedLabel.includes(normalizedSearch) || normalizedValue.includes(normalizedSearch)
  }, [])

  // 过滤选项
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options
    const filterFn = searchFunc || defaultSearchFunc
    return options.filter((opt) => filterFn(opt, searchTerm))
  }, [options, searchTerm, searchFunc, defaultSearchFunc])

  // 获取选中的选项对象
  const selectedOptions = useMemo(() => {
    return options.filter((opt) => selectedValues.some((v) => v === opt.value))
  }, [options, selectedValues])

  // 检查是否选中
  const isSelected = useCallback(
    (optionValue: T) => {
      return selectedValues.some((v) => v === optionValue)
    },
    [selectedValues]
  )

  // 选择/取消选择
  const handleSelect = useCallback(
    (optionValue: T) => {
      if (multiple) {
        const newValues = isSelected(optionValue)
          ? selectedValues.filter((v) => v !== optionValue)
          : [...selectedValues, optionValue]
        onChange?.(newValues as T[])
      } else {
        onChange?.(optionValue)
        setOpen(false)
      }
    },
    [multiple, isSelected, selectedValues, onChange]
  )

  // 清除选择
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange?.(multiple ? ([] as T[]) : undefined)
    },
    [multiple, onChange]
  )

  // 移除单个选项（多选模式）
  const handleRemove = useCallback(
    (optionValue: T, e: React.MouseEvent) => {
      e.stopPropagation()
      const newValues = selectedValues.filter((v) => v !== optionValue)
      onChange?.(newValues as T[])
    },
    [selectedValues, onChange]
  )

  // 重置搜索
  useEffect(() => {
    if (!open) {
      setSearchTerm('')
    }
  }, [open])

  const isDisabled = disabled || readonly

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={isDisabled}
          className={cn(
            'w-full justify-between font-normal',
            !selectedOptions.length && 'text-muted-foreground',
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left">
            {selectedOptions.length > 0 ? (
              multiple ? (
                selectedOptions.map((opt) => (
                  <Badge key={String(opt.value)} variant="secondary" className="mr-1">
                    {renderLabel ? renderLabel(opt) : opt.label}
                    {clearable && (
                      <button
                        type="button"
                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={(e) => handleRemove(opt.value, e)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))
              ) : (
                <span>
                  {renderLabel ? renderLabel(selectedOptions[0]) : selectedOptions[0].label}
                </span>
              )
            ) : (
              placeholder
            )}
          </div>
          <div className="flex items-center gap-1">
            {clearable && selectedOptions.length > 0 && !isDisabled && (
              <X className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" onClick={handleClear} />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          {searchable && (
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
          )}
          <CommandList>
            <CommandEmpty>{noOptionsText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={String(option.value)}
                  value={String(option.value)}
                  disabled={option.disabled}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      isSelected(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {renderOption ? renderOption(option) : option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default AdvancedSelect
