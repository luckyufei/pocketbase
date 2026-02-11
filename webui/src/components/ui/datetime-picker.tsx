/**
 * DateTimePicker 组件 - 模仿 Flatpickr 风格
 * 与 UI 版本保持一致的日期时间选择器
 *
 * 特性：
 * 1. 点击输入框打开选择面板
 * 2. 日历选择 + 时间输入框
 * 3. 支持秒级精度
 * 4. 24 小时制
 */
import * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, parse, isValid, setHours, setMinutes, setSeconds } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Input } from './input'
import { Button } from './button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X } from 'lucide-react'

interface DateTimePickerProps {
  value?: string // ISO 格式或 'YYYY-MM-DD HH:mm:ss' 格式
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
}

// 时间输入框组件 - Flatpickr 风格，箭头在右侧 hover 显示
function TimeInput({
  value,
  onChange,
  min = 0,
  max,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = useState(String(value).padStart(2, '0'))
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    setLocalValue(String(value).padStart(2, '0'))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 2)
    setLocalValue(newValue)
  }

  const handleBlur = () => {
    let num = parseInt(localValue, 10)
    if (isNaN(num)) num = min
    if (num < min) num = min
    if (num > max) num = max
    setLocalValue(String(num).padStart(2, '0'))
    onChange(num)
  }

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newVal = value >= max ? min : value + 1
    onChange(newVal)
  }

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newVal = value <= min ? max : value - 1
    onChange(newVal)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newVal = value >= max ? min : value + 1
      onChange(newVal)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newVal = value <= min ? max : value - 1
      onChange(newVal)
    } else if (e.key === 'Enter') {
      handleBlur()
    }
  }

  return (
    <div
      className="flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 数字输入框 */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-8 h-8 text-center text-sm font-medium bg-transparent border-0 outline-none focus:bg-slate-100 dark:focus:bg-slate-800 rounded transition-colors"
        onFocus={(e) => e.target.select()}
      />
      {/* 上下箭头 - hover 时显示，在右侧垂直排列 */}
      <div
        className={cn(
          'flex flex-col transition-opacity duration-150',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
      >
        <button
          type="button"
          className="w-4 h-4 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
          onClick={handleIncrement}
          tabIndex={-1}
        >
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        </button>
        <button
          type="button"
          className="w-4 h-4 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
          onClick={handleDecrement}
          tabIndex={-1}
        >
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = '年 /月/日 -:-:-',
  disabled,
  required,
  className,
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [internalDate, setInternalDate] = useState<Date | undefined>()
  const [month, setMonth] = useState<Date>(new Date())

  // 解析输入值
  useEffect(() => {
    if (!value) {
      setInternalDate(undefined)
      return
    }

    // 尝试解析 ISO 格式
    let parsed = new Date(value)
    if (isValid(parsed)) {
      setInternalDate(parsed)
      setMonth(parsed)
      return
    }

    // 尝试解析 'YYYY-MM-DD HH:mm:ss' 格式
    parsed = parse(value, 'yyyy-MM-dd HH:mm:ss', new Date())
    if (isValid(parsed)) {
      setInternalDate(parsed)
      setMonth(parsed)
      return
    }

    setInternalDate(undefined)
  }, [value])

  // 格式化显示值
  const displayValue = useMemo(() => {
    if (!internalDate || !isValid(internalDate)) {
      return ''
    }
    return format(internalDate, 'yyyy-MM-dd HH:mm:ss')
  }, [internalDate])

  // 输出值（ISO 格式）
  const emitChange = useCallback(
    (date: Date | undefined) => {
      if (!date || !isValid(date)) {
        onChange?.('')
        return
      }
      // 输出 ISO 格式
      onChange?.(date.toISOString())
    },
    [onChange]
  )

  // 日期选择
  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return

      // 保留当前时间
      const currentDate = internalDate || new Date()
      const newDate = setHours(
        setMinutes(
          setSeconds(date, currentDate.getSeconds()),
          currentDate.getMinutes()
        ),
        currentDate.getHours()
      )

      setInternalDate(newDate)
      emitChange(newDate)
    },
    [internalDate, emitChange]
  )

  // 时间选择
  const handleTimeChange = useCallback(
    (type: 'hour' | 'minute' | 'second', value: number) => {
      const currentDate = internalDate || new Date()
      let newDate: Date

      switch (type) {
        case 'hour':
          newDate = setHours(currentDate, value)
          break
        case 'minute':
          newDate = setMinutes(currentDate, value)
          break
        case 'second':
          newDate = setSeconds(currentDate, value)
          break
      }

      setInternalDate(newDate)
      emitChange(newDate)
    },
    [internalDate, emitChange]
  )

  // 清除值
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setInternalDate(undefined)
      onChange?.('')
    },
    [onChange]
  )

  // 快捷按钮
  const handleToday = useCallback(() => {
    const now = new Date()
    setInternalDate(now)
    setMonth(now)
    emitChange(now)
  }, [emitChange])

  const handleClearAll = useCallback(() => {
    setInternalDate(undefined)
    onChange?.('')
  }, [onChange])

  const currentHour = internalDate?.getHours() ?? 0
  const currentMinute = internalDate?.getMinutes() ?? 0
  const currentSecond = internalDate?.getSeconds() ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            id={id}
            type="text"
            value={displayValue}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            readOnly
            className={cn(
              'cursor-pointer pr-8',
              !displayValue && 'text-muted-foreground',
              className
            )}
            onClick={() => !disabled && setOpen(true)}
          />
          {!required && displayValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-60 hover:opacity-100"
              onClick={handleClear}
              aria-label="Clear date"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        sideOffset={4}
      >
        <div className="p-3">
          {/* 日历部分 - 使用自定义的 DayPicker */}
          <DayPicker
            mode="single"
            selected={internalDate}
            onSelect={handleDateSelect}
            month={month}
            onMonthChange={setMonth}
            weekStartsOn={1}
            showOutsideDays
            className="border-0"
            classNames={{
              months: 'flex flex-col sm:flex-row gap-2',
              month: 'flex flex-col gap-4',
              month_caption: 'flex justify-center pt-1 relative items-center w-full',
              caption_label: 'text-sm font-medium',
              nav: 'flex items-center gap-1',
              button_previous: 'absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center',
              button_next: 'absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center',
              month_grid: 'w-full border-collapse',
              weekdays: 'flex',
              weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center',
              week: 'flex w-full mt-2',
              day: 'h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
              day_button: cn(
                'h-9 w-9 p-0 font-normal',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:bg-accent focus:text-accent-foreground',
                'aria-selected:opacity-100'
              ),
              range_end: 'day-range-end',
              selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md',
              today: 'bg-accent text-accent-foreground rounded-md',
              outside: 'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
              disabled: 'text-muted-foreground opacity-50',
              range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
              hidden: 'invisible',
            }}
            components={{
              Chevron: ({ orientation }) => {
                const Icon = orientation === 'left' ? ChevronLeft : ChevronRight
                return <Icon className="h-4 w-4" />
              },
            }}
          />

          {/* 时间选择部分 - Flatpickr 风格 */}
          <div className="border-t border-border mt-2 pt-2">
            <div className="flex items-center justify-center gap-1">
              <TimeInput
                value={currentHour}
                onChange={(v) => handleTimeChange('hour', v)}
                min={0}
                max={23}
              />
              <span className="text-lg font-bold text-muted-foreground">:</span>
              <TimeInput
                value={currentMinute}
                onChange={(v) => handleTimeChange('minute', v)}
                min={0}
                max={59}
              />
              <span className="text-lg font-bold text-muted-foreground">:</span>
              <TimeInput
                value={currentSecond}
                onChange={(v) => handleTimeChange('second', v)}
                min={0}
                max={59}
              />
            </div>
          </div>

          {/* 快捷按钮 */}
          <div className="border-t border-border mt-2 pt-2 flex justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive"
              onClick={handleClearAll}
            >
              清除
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-primary hover:text-primary"
              onClick={handleToday}
            >
              今天
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
