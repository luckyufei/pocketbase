/**
 * T018: TimeRangeSelector - 时间范围选择器组件
 * 用于选择预定义的时间范围
 */
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TimeRangeOption {
  value: string
  label: string
  hours: number
}

interface TimeRangeSelectorProps {
  selected?: string
  options?: TimeRangeOption[]
  onChange?: (data: { value: string; hours: number }) => void
  className?: string
}

const defaultOptions: TimeRangeOption[] = [
  { value: '1h', label: '1 小时', hours: 1 },
  { value: '24h', label: '24 小时', hours: 24 },
  { value: '7d', label: '7 天', hours: 168 },
]

export function TimeRangeSelector({
  selected: controlledSelected,
  options = defaultOptions,
  onChange,
  className,
}: TimeRangeSelectorProps) {
  const [internalSelected, setInternalSelected] = useState('24h')
  const selected = controlledSelected ?? internalSelected

  const selectRange = useCallback(
    (option: TimeRangeOption) => {
      setInternalSelected(option.value)
      onChange?.({ value: option.value, hours: option.hours })
    },
    [onChange]
  )

  return (
    <div className={cn('flex gap-2', className)}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={selected === option.value ? 'default' : 'secondary'}
          onClick={() => selectRange(option)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

export default TimeRangeSelector
