/**
 * T000q: FormField 组件
 * 带错误显示的表单字段包装器
 */
import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { formErrorsAtom, removeFormErrorAtom, getNestedError } from '@/store/formErrors'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  /** 字段路径（用于错误映射），如 "name" 或 "fields.0.name" */
  name: string
  /** 字段标签 */
  label?: string
  /** 是否必填 */
  required?: boolean
  /** 自定义样式类 */
  className?: string
  /** 子元素 */
  children: React.ReactNode
  /** 提示文本 */
  hint?: string
}

/**
 * FormField 组件
 * 自动处理表单字段的错误显示和输入时清除错误
 */
export function FormField({
  name,
  label,
  required,
  className,
  children,
  hint,
}: FormFieldProps) {
  const errors = useAtomValue(formErrorsAtom)
  const removeError = useSetAtom(removeFormErrorAtom)
  const fieldError = getNestedError(errors, name)

  // 获取错误消息
  const errorMessage = React.useMemo(() => {
    if (!fieldError) return null
    if (typeof fieldError === 'string') return fieldError
    if (fieldError.message) return fieldError.message
    if (fieldError.code) return fieldError.code
    return JSON.stringify(fieldError)
  }, [fieldError])

  // 包装子元素，添加错误清除和样式
  const wrappedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child

    const childProps = child.props as Record<string, unknown>
    const originalClassName = childProps.className as string | undefined

    // 检查是否有 data-field-label 属性，这是标签元素，不需要包装
    if (childProps['data-field-label'] !== undefined) {
      return child
    }

    // 创建新的 props
    const newProps: Record<string, unknown> = {
      className: cn(
        originalClassName,
        fieldError && 'border-destructive focus-visible:ring-destructive'
      ),
    }

    // 智能处理不同类型的 onChange
    // Switch 使用 onCheckedChange，Select 使用 onValueChange，普通 input 使用 onChange
    const changeHandlers = ['onChange', 'onCheckedChange', 'onValueChange'] as const
    for (const handler of changeHandlers) {
      const originalHandler = childProps[handler] as ((...args: unknown[]) => void) | undefined
      if (originalHandler) {
        newProps[handler] = (...args: unknown[]) => {
          // 输入时清除错误
          if (fieldError) {
            removeError(name)
          }
          originalHandler(...args)
        }
        break // 只处理第一个找到的 handler
      }
    }

    return React.cloneElement(child as React.ReactElement, newProps)
  })

  return (
    <div className={cn('form-field', fieldError && 'error', className)}>
      {label && (
        <label data-field-label="" className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      {wrappedChildren}
      {hint && !errorMessage && (
        <p className="text-xs text-muted-foreground px-3 py-1">{hint}</p>
      )}
      {errorMessage && (
        <p className="text-destructive text-sm px-3 py-1">{errorMessage}</p>
      )}
    </div>
  )
}

export default FormField
