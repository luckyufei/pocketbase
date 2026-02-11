/**
 * JsonField - JSON 字段组件
 * 用于编辑 json 类型的记录字段
 * 显示 JSON 有效性状态图标
 * 
 * 与旧版 UI 保持一致：直接传递字符串值
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { CodeEditor } from '@/components/CodeEditor'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { CollectionField } from 'pocketbase'

interface JsonFieldProps {
  field: CollectionField
  value: unknown
  onChange: (value: string) => void  // 直接传递字符串，与旧版 UI 一致
}

function isValidJson(val: string): boolean {
  if (val === '' || val.trim() === '') return true
  try {
    JSON.parse(val)
    return true
  } catch {
    return false
  }
}

function serialize(val: unknown): string {
  // 如果已经是字符串，检查是否为有效 JSON
  if (typeof val === 'string') {
    if (isValidJson(val)) {
      return val  // 已经是序列化的 JSON 字符串
    }
    return val
  }
  // undefined/null → 空对象（与旧版 UI 一致）
  if (val === undefined || val === null) {
    return '{}'
  }
  return JSON.stringify(val, null, 2)
}

export function JsonField({ field, value, onChange }: JsonFieldProps) {
  const uniqueId = `field_${field.name}`
  
  // 初始化序列化值
  const initialValue = useRef(serialize(value))
  const [localValue, setLocalValue] = useState(initialValue.current)
  const [isValid, setIsValid] = useState(() => isValidJson(localValue))
  
  // 追踪外部 value 的引用，用于检测真正的外部变化（如切换记录）
  const externalValueRef = useRef(value)
  
  // 当外部 value 真正变化时（如切换记录或重置表单），同步到本地
  useEffect(() => {
    // 检测是否是外部真正的变化（不是由 onChange 触发的）
    const newSerialized = serialize(value)
    const currentSerialized = serialize(externalValueRef.current)
    
    // 只有当外部值真正变化时才同步
    if (newSerialized !== currentSerialized) {
      setLocalValue(newSerialized)
      setIsValid(isValidJson(newSerialized))
      externalValueRef.current = value
    }
  }, [value])

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue)
      setIsValid(isValidJson(newValue))
      // 直接传递字符串，与旧版 UI 一致
      onChange(newValue.trim())
    },
    [onChange]
  )

  return (
    <FormField name={field.name} className={field.required ? 'required' : ''}>
      <div data-field-label="" className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5">
          <FieldLabel field={field} htmlFor={uniqueId} />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">
              {isValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left">{isValid ? 'Valid JSON' : 'Invalid JSON'}</TooltipContent>
        </Tooltip>
      </div>
      <div className="px-1 pb-1">
        <CodeEditor
          id={uniqueId}
          language="json"
          value={localValue}
          onChange={handleChange}
          height="auto"
          minHeight={80}
          maxHeight={300}
          minimal
        />
      </div>
    </FormField>
  )
}
