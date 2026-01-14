// T024: 单个规则编辑器组件
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterAutocompleteInput } from '@/components/FilterAutocompleteInput'

interface RuleFieldProps {
  label: string
  formKey: string
  rule: string | null
  onChange: (rule: string | null) => void
  collection: {
    name: string
    type: string
    system?: boolean
    fields?: Array<{ name: string; type: string; hidden?: boolean }>
  }
  placeholder?: string
  required?: boolean
  disabled?: boolean
  superuserToggle?: boolean
  helpText?: React.ReactNode
  afterLabel?: React.ReactNode
}

/**
 * 规则编辑器组件
 * 支持锁定（Superusers only）和解锁（自定义规则）
 */
export function RuleField({
  label,
  formKey,
  rule,
  onChange,
  collection,
  placeholder = 'Leave empty to grant everyone access...',
  required = false,
  disabled = false,
  superuserToggle = true,
  helpText,
  afterLabel,
}: RuleFieldProps) {
  const [tempValue, setTempValue] = useState<string>('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isSuperuserOnly = superuserToggle && rule === null
  const isDisabled = disabled || collection.system

  // 解锁规则
  const unlock = () => {
    onChange(tempValue || '')
    // 延迟聚焦
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  // 锁定规则（设为 Superusers only）
  const lock = () => {
    setTempValue(rule || '')
    onChange(null)
  }

  return (
    <div className={cn('space-y-2', isSuperuserOnly && 'opacity-75')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className={cn(isSuperuserOnly && 'text-muted-foreground')}>
            {label}
            {isSuperuserOnly && ' - Superusers only'}
          </Label>
          {afterLabel}
        </div>

        {superuserToggle && !isSuperuserOnly && !isDisabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={lock}
          >
            <Lock className="h-3.5 w-3.5 mr-1" />
            Set Superusers only
          </Button>
        )}
      </div>

      <div className="relative">
        <FilterAutocompleteInput
          ref={inputRef}
          value={rule || ''}
          onChange={(value) => onChange(value)}
          baseCollection={collection}
          disabled={isDisabled || isSuperuserOnly}
          placeholder={!isSuperuserOnly ? placeholder : ''}
        />

        {/* 锁定覆盖层 */}
        {superuserToggle && isSuperuserOnly && !isDisabled && (
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-end gap-2 px-4 border-2 border-dashed border-muted rounded-md bg-background/50 hover:border-muted-foreground transition-colors cursor-pointer"
            onClick={unlock}
          >
            <span className="text-xs text-muted-foreground opacity-0 hover:opacity-100 transition-opacity">
              Unlock and set custom rule
            </span>
            <Unlock className="h-4 w-4 text-green-600" />
          </button>
        )}
      </div>

      {helpText && <div className="text-xs text-muted-foreground">{helpText}</div>}
    </div>
  )
}

export default RuleField
