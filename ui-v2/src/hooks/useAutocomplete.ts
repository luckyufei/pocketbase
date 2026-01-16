/**
 * T090: useAutocomplete - 自动补全 Hook
 * 提供自动补全功能的状态管理
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

interface AutocompleteOption<T = string> {
  value: T
  label: string
  description?: string
}

interface UseAutocompleteOptions<T = string> {
  options: AutocompleteOption<T>[]
  value?: string
  onChange?: (value: string) => void
  onSelect?: (option: AutocompleteOption<T>) => void
  searchFunc?: (option: AutocompleteOption<T>, searchTerm: string) => boolean
  maxResults?: number
  minSearchLength?: number
}

interface UseAutocompleteReturn<T = string> {
  inputValue: string
  setInputValue: (value: string) => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  highlightedIndex: number
  setHighlightedIndex: (index: number) => void
  filteredOptions: AutocompleteOption<T>[]
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  handleSelect: (option: AutocompleteOption<T>) => void
  handleFocus: () => void
  handleBlur: () => void
  reset: () => void
}

/**
 * 自动补全 Hook
 * @param options 配置选项
 * @returns 自动补全状态和处理函数
 */
export function useAutocomplete<T = string>({
  options,
  value: controlledValue,
  onChange,
  onSelect,
  searchFunc,
  maxResults = 10,
  minSearchLength = 0,
}: UseAutocompleteOptions<T>): UseAutocompleteReturn<T> {
  const [inputValue, setInputValueState] = useState(controlledValue ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const blurTimeoutRef = useRef<NodeJS.Timeout>()

  // 同步受控值
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInputValueState(controlledValue)
    }
  }, [controlledValue])

  // 默认搜索函数
  const defaultSearchFunc = useCallback(
    (option: AutocompleteOption<T>, search: string): boolean => {
      const normalizedSearch = search.toLowerCase().trim()
      const normalizedLabel = option.label.toLowerCase()
      const normalizedValue = String(option.value).toLowerCase()
      return (
        normalizedLabel.includes(normalizedSearch) || normalizedValue.includes(normalizedSearch)
      )
    },
    []
  )

  // 获取当前输入的最后一个词（用于部分匹配）
  const currentWord = useMemo(() => {
    const words = inputValue.split(/\s+/)
    return words[words.length - 1] || ''
  }, [inputValue])

  // 过滤选项
  const filteredOptions = useMemo(() => {
    if (currentWord.length < minSearchLength) {
      return []
    }

    const filterFn = searchFunc || defaultSearchFunc
    return options.filter((opt) => filterFn(opt, currentWord)).slice(0, maxResults)
  }, [options, currentWord, minSearchLength, searchFunc, defaultSearchFunc, maxResults])

  // 设置输入值
  const setInputValue = useCallback(
    (value: string) => {
      setInputValueState(value)
      onChange?.(value)
    },
    [onChange]
  )

  // 处理输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setInputValue(newValue)
      setIsOpen(true)
      setHighlightedIndex(0)
    },
    [setInputValue]
  )

  // 选择选项
  const handleSelect = useCallback(
    (option: AutocompleteOption<T>) => {
      // 替换当前词
      const words = inputValue.split(/\s+/)
      words[words.length - 1] = String(option.value)
      const newValue = words.join(' ')

      setInputValue(newValue)
      setIsOpen(false)
      onSelect?.(option)
    },
    [inputValue, setInputValue, onSelect]
  )

  // 处理键盘事件
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
    [isOpen, filteredOptions, highlightedIndex, currentWord, handleSelect]
  )

  // 处理聚焦
  const handleFocus = useCallback(() => {
    clearTimeout(blurTimeoutRef.current)
    if (currentWord.length >= minSearchLength) {
      setIsOpen(true)
    }
  }, [currentWord.length, minSearchLength])

  // 处理失焦（延迟关闭以允许点击选项）
  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200)
  }, [])

  // 重置
  const reset = useCallback(() => {
    setInputValue('')
    setIsOpen(false)
    setHighlightedIndex(0)
  }, [setInputValue])

  // 清理定时器
  useEffect(() => {
    return () => {
      clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  return {
    inputValue,
    setInputValue,
    isOpen,
    setIsOpen,
    highlightedIndex,
    setHighlightedIndex,
    filteredOptions,
    handleInputChange,
    handleKeyDown,
    handleSelect,
    handleFocus,
    handleBlur,
    reset,
  }
}

export default useAutocomplete
