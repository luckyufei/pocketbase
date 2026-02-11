# Implementation Tasks: WebUI New Record 功能 1:1 对齐

**Branch**: `032-webui-new-record-alignment` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Task Legend

- `[P]` = Parallelizable with other `[P]` tasks in same phase
- `[US#]` = Implements User Story #
- Priority: Tasks ordered by dependency, not priority
- 🔴 = 红灯（写测试）
- 🟢 = 绿灯（实现代码）
- ♻️ = 重构

---

## Phase 0: 基础设施 (P0 Critical)

**Purpose**: 实现核心基础功能，确保数据安全和用户体验

### 0.1 草稿管理 Hook

- [x] T0100 [P] 🔴 创建 `useDraft.test.ts` 测试草稿管理功能
  ```typescript
  // webui/src/features/records/hooks/useDraft.test.ts
  // 测试用例：
  // - 应该能保存草稿到 localStorage
  // - 应该能从 localStorage 恢复草稿
  // - 应该能删除草稿
  // - 应该能检测是否存在草稿
  // - 草稿键格式应为 record_draft_{collectionId}_{recordId}
  // - localStorage 满时应静默失败
  ```

- [x] T0101 [P] 🟢 实现 `useDraft` hook
  ```typescript
  // webui/src/features/records/hooks/useDraft.ts
  import { useState, useEffect, useCallback } from 'react'

  interface UseDraftOptions {
    collectionId: string
    recordId?: string
  }

  interface UseDraftReturn {
    hasDraft: boolean
    getDraft: () => Record<string, unknown> | null
    saveDraft: (data: Record<string, unknown>) => void
    deleteDraft: () => void
    restoreDraft: () => Record<string, unknown> | null
  }

  export function useDraft(options: UseDraftOptions): UseDraftReturn {
    const draftKey = `record_draft_${options.collectionId}_${options.recordId || ''}`
    
    const [hasDraft, setHasDraft] = useState(false)
    
    useEffect(() => {
      const draft = localStorage.getItem(draftKey)
      setHasDraft(!!draft)
    }, [draftKey])
    
    const getDraft = useCallback(() => {
      try {
        const raw = localStorage.getItem(draftKey)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    }, [draftKey])
    
    const saveDraft = useCallback((data: Record<string, unknown>) => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(data))
        setHasDraft(true)
      } catch (e) {
        console.warn('Draft save failed:', e)
        localStorage.removeItem(draftKey)
        setHasDraft(false)
      }
    }, [draftKey])
    
    const deleteDraft = useCallback(() => {
      localStorage.removeItem(draftKey)
      setHasDraft(false)
    }, [draftKey])
    
    const restoreDraft = useCallback(() => {
      const draft = getDraft()
      if (draft) {
        // 排除敏感字段
        delete draft.password
        delete draft.passwordConfirm
      }
      return draft
    }, [getDraft])
    
    return { hasDraft, getDraft, saveDraft, deleteDraft, restoreDraft }
  }
  ```

### 0.2 变更检测 Hook

- [x] T0200 [P] 🔴 创建 `useChangeDetection.test.ts` 测试变更检测
  ```typescript
  // webui/src/features/records/hooks/useChangeDetection.test.ts
  // 测试用例：
  // - 无变更时 hasChanges 应为 false
  // - 数据变更时 hasDataChanges 应为 true
  // - 文件上传时 hasFileChanges 应为 true
  // - 文件删除时 hasFileChanges 应为 true
  // - 综合变更 hasChanges 应为 true
  ```

- [x] T0201 [P] 🟢 实现 `useChangeDetection` hook
  ```typescript
  // webui/src/features/records/hooks/useChangeDetection.ts
  import { useMemo } from 'react'

  interface UseChangeDetectionOptions {
    original: Record<string, unknown>
    current: Record<string, unknown>
    uploadedFiles: Record<string, File[]>
    deletedFiles: Record<string, string[]>
  }

  export function useChangeDetection(options: UseChangeDetectionOptions) {
    const hasFileChanges = useMemo(() => {
      const hasUploaded = Object.values(options.uploadedFiles).some(f => f.length > 0)
      const hasDeleted = Object.values(options.deletedFiles).some(n => n.length > 0)
      return hasUploaded || hasDeleted
    }, [options.uploadedFiles, options.deletedFiles])
    
    const hasDataChanges = useMemo(() => {
      return JSON.stringify(options.original) !== JSON.stringify(options.current)
    }, [options.original, options.current])
    
    return {
      hasChanges: hasFileChanges || hasDataChanges,
      hasFileChanges,
      hasDataChanges,
    }
  }
  ```

### 0.3 未保存变更确认

- [x] T0300 [P] 🔴 创建未保存变更确认测试
  ```typescript
  // 测试用例：
  // - 有变更时关闭面板应显示确认弹窗
  // - 无变更时关闭面板应直接关闭
  // - 确认关闭后应删除草稿
  // - 取消关闭后应保持面板打开
  ```

- [x] T0301 [P] 🟢 在 UpsertPanel 中集成未保存变更确认
  ```typescript
  // 在 UpsertPanel.tsx 中添加
  const handleClose = useCallback(() => {
    if (hasChanges) {
      confirm(
        'You have unsaved changes. Do you really want to close the panel?',
        () => {
          deleteDraft()
          onClose()
        }
      )
    } else {
      deleteDraft()
      onClose()
    }
  }, [hasChanges, deleteDraft, onClose])
  ```

### 0.4 Ctrl+S 快捷键

- [x] T0400 [P] 🔴 创建快捷键测试
  ```typescript
  // 测试用例：
  // - Ctrl+S 应触发保存（不关闭面板）
  // - Cmd+S (Mac) 应触发保存
  // - 保存中时应禁用快捷键
  ```

- [x] T0401 [P] 🟢 实现 Ctrl+S 快捷键
  ```typescript
  // 在 UpsertPanel.tsx 中添加
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        e.stopPropagation()
        if (canSave && !saving) {
          handleSave(false) // false = 不关闭面板
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canSave, saving, handleSave])
  ```

### 0.5 草稿恢复 UI

- [x] T0500 [P] 🔴 创建草稿恢复 UI 测试
  ```typescript
  // 测试用例：
  // - 存在草稿时应显示恢复提示
  // - 点击 "Restore draft" 应恢复草稿数据
  // - 点击关闭按钮应删除草稿
  // - 恢复后提示应消失
  ```

- [x] T0501 [P] 🟢 实现草稿恢复提示 UI
  ```tsx
  // 在 UpsertPanel.tsx 表单顶部添加
  {!hasChanges && hasDraft && !isLoading && (
    <div className="block">
      <Alert variant="info">
        <div className="flex items-center gap-2">
          <span>The record has previous unsaved changes.</span>
          <Button size="sm" variant="secondary" onClick={handleRestoreDraft}>
            Restore draft
          </Button>
        </div>
        <button
          className="close"
          onClick={deleteDraft}
          title="Discard draft"
        >
          <i className="ri-close-line" />
        </button>
      </Alert>
    </div>
  )}
  ```

---

## Phase 1: 缺失组件 (P0)

**Purpose**: 补全所有缺失的字段组件

### 1.1 SecretField 组件

- [x] T1100 [P] 🔴 创建 `SecretField.test.tsx` 测试
  ```typescript
  // webui/src/features/records/components/fields/SecretField.test.tsx
  // 测试用例：
  // - 应渲染 SecretInput 组件
  // - 应正确处理 required 属性
  // - 应正确传递 value 和 onChange
  // - 应显示正确的字段图标
  ```

- [x] T1101 [P] 🟢 实现 `SecretField` 组件
  ```tsx
  // webui/src/features/records/components/fields/SecretField.tsx
  import { FieldLabel } from './FieldLabel'
  import { SecretInput } from '@/components/base/SecretInput'
  import type { CollectionField } from 'pocketbase'

  interface SecretFieldProps {
    field: CollectionField
    value: string
    onChange: (value: string) => void
  }

  export function SecretField({ field, value, onChange }: SecretFieldProps) {
    const uniqueId = `field_${field.name}`
    
    return (
      <div className={`form-field ${field.required ? 'required' : ''}`}>
        <FieldLabel uniqueId={uniqueId} field={field} />
        <SecretInput
          id={uniqueId}
          required={field.required}
          value={value}
          onChange={onChange}
        />
      </div>
    )
  }
  ```

### 1.2 EmailField 组件

- [x] T1200 [P] 🔴 创建 `EmailField.test.tsx` 测试
  ```typescript
  // 测试用例：
  // - 应渲染 type="email" 的 input
  // - 应正确处理 required 属性
  // - 应显示正确的字段图标 (ri-mail-line)
  ```

- [x] T1201 [P] 🟢 实现 `EmailField` 组件
  ```tsx
  // webui/src/features/records/components/fields/EmailField.tsx
  import { Input } from '@/components/ui/input'
  import { FieldLabel } from './FieldLabel'
  import type { CollectionField } from 'pocketbase'

  interface EmailFieldProps {
    field: CollectionField
    value: string
    onChange: (value: string) => void
  }

  export function EmailField({ field, value, onChange }: EmailFieldProps) {
    const uniqueId = `field_${field.name}`
    
    return (
      <div className={`form-field ${field.required ? 'required' : ''}`}>
        <FieldLabel uniqueId={uniqueId} field={field} />
        <Input
          id={uniqueId}
          type="email"
          required={field.required}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  ```

### 1.3 UrlField 组件

- [x] T1300 [P] 🔴 创建 `UrlField.test.tsx` 测试
  ```typescript
  // 测试用例：
  // - 应渲染 type="url" 的 input
  // - 应正确处理 required 属性
  // - 应显示正确的字段图标 (ri-link)
  ```

- [x] T1301 [P] 🟢 实现 `UrlField` 组件
  ```tsx
  // webui/src/features/records/components/fields/UrlField.tsx
  import { Input } from '@/components/ui/input'
  import { FieldLabel } from './FieldLabel'
  import type { CollectionField } from 'pocketbase'

  interface UrlFieldProps {
    field: CollectionField
    value: string
    onChange: (value: string) => void
  }

  export function UrlField({ field, value, onChange }: UrlFieldProps) {
    const uniqueId = `field_${field.name}`
    
    return (
      <div className={`form-field ${field.required ? 'required' : ''}`}>
        <FieldLabel uniqueId={uniqueId} field={field} />
        <Input
          id={uniqueId}
          type="url"
          required={field.required}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  ```

### 1.4 AutodateIcon 组件

- [x] T1400 [P] 🔴 创建 `AutodateIcon.test.tsx` 测试
  ```typescript
  // 测试用例：
  // - 应显示日历图标
  // - Tooltip 应显示所有 autodate 字段的本地时间
  // - 时间格式应为 "yyyy-MM-dd HH:mm:ss.SSS Local"
  ```

- [x] T1401 [P] 🟢 实现 `AutodateIcon` 组件
  ```tsx
  // webui/src/features/records/components/AutodateIcon.tsx
  import { useMemo } from 'react'
  import { format } from 'date-fns'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
  import { useCollectionsStore } from '@/store/collections'
  import type { RecordModel } from 'pocketbase'

  interface AutodateIconProps {
    record: RecordModel
  }

  const DETAILED_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss.SSS'

  export function AutodateIcon({ record }: AutodateIconProps) {
    const { collections } = useCollectionsStore()
    
    const tooltipDates = useMemo(() => {
      const collection = collections.find(c => c.id === record.collectionId)
      if (!collection) return []
      
      return (collection.fields || [])
        .filter(f => f.type === 'autodate')
        .map(field => {
          const dateValue = record[field.name]
          if (!dateValue) return null
          const localDate = format(new Date(dateValue), DETAILED_DATE_FORMAT)
          return `${field.name}: ${localDate} Local`
        })
        .filter(Boolean)
    }, [record, collections])
    
    if (tooltipDates.length === 0) return null
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <i className="ri-calendar-event-line txt-disabled cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="left">
          <pre className="text-xs whitespace-pre-wrap">
            {tooltipDates.join('\n')}
          </pre>
        </TooltipContent>
      </Tooltip>
    )
  }
  ```

---

## Phase 2: 组件对齐 (P1)

**Purpose**: 对齐现有组件的功能和 UI

### 2.1 TextField 改进

- [x] T2100 [P] 🔴 创建 TextField 改进测试
  ```typescript
  // 测试用例：
  // - 应使用 AutoExpandTextarea 组件
  // - 有 autogeneratePattern 时应显示提示文本
  // - required 逻辑：field.required && !hasAutogenerate
  ```

- [x] T2101 [P] 🟢 改进 TextField 组件
  ```tsx
  // webui/src/features/records/components/fields/TextField.tsx
  import { useMemo } from 'react'
  import { FieldLabel } from './FieldLabel'
  import { AutoExpandTextarea } from '@/components/base/AutoExpandTextarea'
  import type { CollectionField, RecordModel } from 'pocketbase'

  interface TextFieldProps {
    field: CollectionField
    original?: RecordModel
    value: string
    onChange: (value: string) => void
  }

  export function TextField({ field, original, value, onChange }: TextFieldProps) {
    const uniqueId = `field_${field.name}`
    
    const hasAutogenerate = useMemo(() => {
      return !!field.autogeneratePattern && !original?.id
    }, [field.autogeneratePattern, original?.id])
    
    const isRequired = field.required && !hasAutogenerate
    
    return (
      <div className={`form-field ${isRequired ? 'required' : ''}`}>
        <FieldLabel uniqueId={uniqueId} field={field} />
        <AutoExpandTextarea
          id={uniqueId}
          required={isRequired}
          placeholder={hasAutogenerate ? 'Leave empty to autogenerate...' : ''}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  ```

- [x] T2102 [P] 🟢 创建 AutoExpandTextarea 组件
  ```tsx
  // webui/src/components/base/AutoExpandTextarea.tsx
  import { useRef, useEffect, TextareaHTMLAttributes } from 'react'

  interface AutoExpandTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  }

  export function AutoExpandTextarea({ value, onChange, ...props }: AutoExpandTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    
    useEffect(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }, [value])
    
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        rows={1}
        className="resize-none overflow-hidden"
        {...props}
      />
    )
  }
  ```

### 2.2 NumberField 改进

- [x] T2200 [P] 🔴 创建 NumberField 改进测试
  ```typescript
  // 测试用例：
  // - 应支持 min/max 属性
  // - 应设置 step="any"
  // - 应正确处理 required
  ```

- [x] T2201 [P] 🟢 改进 NumberField 组件
  ```tsx
  // webui/src/features/records/components/fields/NumberField.tsx
  import { Input } from '@/components/ui/input'
  import { FieldLabel } from './FieldLabel'
  import type { CollectionField } from 'pocketbase'

  interface NumberFieldProps {
    field: CollectionField
    value: number | undefined
    onChange: (value: number | undefined) => void
  }

  export function NumberField({ field, value, onChange }: NumberFieldProps) {
    const uniqueId = `field_${field.name}`
    
    return (
      <div className={`form-field ${field.required ? 'required' : ''}`}>
        <FieldLabel uniqueId={uniqueId} field={field} />
        <Input
          id={uniqueId}
          type="number"
          required={field.required}
          min={field.min}
          max={field.max}
          step="any"
          value={value ?? ''}
          onChange={(e) => {
            const val = e.target.value
            onChange(val === '' ? undefined : parseFloat(val))
          }}
        />
      </div>
    )
  }
  ```

### 2.3 SelectField 改进

- [x] T2300 [P] 🔴 创建 SelectField 改进测试
  ```typescript
  // 测试用例：
  // - 超过5个选项时应可搜索
  // - 多选时应显示 "Select up to {maxSelect} items."
  // - 应过滤不存在的选项值
  // - 多选时超过 maxSelect 应截断
  ```

- [x] T2301 [P] 🟢 改进 SelectField 组件
  ```tsx
  // webui/src/features/records/components/fields/SelectField.tsx
  import { useMemo, useEffect } from 'react'
  import { FieldLabel } from './FieldLabel'
  import { MultiSelect } from '@/components/ui/multi-select'
  import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
  } from '@/components/ui/select'
  import type { CollectionField } from 'pocketbase'

  interface SelectFieldProps {
    field: CollectionField
    value: string | string[]
    onChange: (value: string | string[]) => void
  }

  export function SelectField({ field, value, onChange }: SelectFieldProps) {
    const uniqueId = `field_${field.name}`
    const isMultiple = (field.maxSelect || 1) > 1
    const maxSelect = field.maxSelect || field.values?.length || 1
    const searchable = (field.values?.length || 0) > 5
    
    // 过滤不存在的选项
    useEffect(() => {
      if (isMultiple && Array.isArray(value)) {
        const filtered = value.filter(v => field.values?.includes(v))
        if (filtered.length !== value.length) {
          onChange(filtered.length > maxSelect 
            ? filtered.slice(filtered.length - maxSelect) 
            : filtered
          )
        }
      }
    }, [value, field.values, isMultiple, maxSelect, onChange])
    
    const options = useMemo(() => {
      return (field.values || []).map(v => ({ value: v, label: v }))
    }, [field.values])
    
    if (isMultiple) {
      return (
        <div className={`form-field ${field.required ? 'required' : ''}`}>
          <FieldLabel uniqueId={uniqueId} field={field} />
          <MultiSelect
            options={options}
            selected={Array.isArray(value) ? value : []}
            onChange={onChange}
            maxCount={maxSelect}
            searchable={searchable}
          />
          <div className="help-block">Select up to {maxSelect} items.</div>
        </div>
      )
    }
    
    return (
      <div className={`form-field ${field.required ? 'required' : ''}`}>
        <FieldLabel uniqueId={uniqueId} field={field} />
        <Select
          value={value as string}
          onValueChange={onChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {!field.required && (
              <SelectItem value="">-- Clear --</SelectItem>
            )}
            {options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  ```

### 2.4 DateField 改进

- [x] T2400 [P] 🔴 创建 DateField 改进测试
  ```typescript
  // 测试用例：
  // - 应使用日期时间选择器
  // - 应支持秒级精度
  // - 非必填时应显示清除按钮
  // - 格式应为 "Y-m-d H:i:S"
  ```

- [x] T2401 [P] 🟢 安装日期选择器依赖
  ```bash
  # 安装 react-flatpickr
  bun add flatpickr react-flatpickr
  bun add -D @types/react-flatpickr
  ```

- [x] T2402 [P] 🟢 改进 DateField 组件
  ```tsx
  // webui/src/features/records/components/fields/DateField.tsx
  import { useState, useEffect } from 'react'
  import Flatpickr from 'react-flatpickr'
  import 'flatpickr/dist/flatpickr.min.css'
  import { Button } from '@/components/ui/button'
  import { FieldLabel } from './FieldLabel'
  import { X } from 'lucide-react'
  import type { CollectionField } from 'pocketbase'

  interface DateFieldProps {
    field: CollectionField
    value: string
    onChange: (value: string) => void
  }

  const flatpickrOptions = {
    dateFormat: 'Y-m-d H:i:S',
    enableTime: true,
    enableSeconds: true,
    time_24hr: true,
    allowInput: true,
    disableMobile: true,
    locale: { firstDayOfWeek: 1 },
  }

  export function DateField({ field, value, onChange }: DateFieldProps) {
    const uniqueId = `field_${field.name}`
    const [pickerValue, setPickerValue] = useState<string>(value || '')
    
    // 截断毫秒和时区
    useEffect(() => {
      if (value && value.length > 19) {
        onChange(value.substring(0, 19))
      }
    }, [value, onChange])
    
    useEffect(() => {
      if (pickerValue !== value) {
        setPickerValue(value || '')
      }
    }, [value])
    
    const handleClear = () => {
      onChange('')
    }
    
    return (
      <div className={`form-field ${field.required ? 'required' : ''}`}>
        <FieldLabel uniqueId={uniqueId} field={field} />
        {value && !field.required && (
          <div className="form-field-addon">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="link-hint"
              onClick={handleClear}
              title="Clear"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <Flatpickr
          id={uniqueId}
          options={flatpickrOptions}
          value={pickerValue}
          onChange={(dates, dateStr) => {
            setPickerValue(dateStr)
            onChange(dateStr)
          }}
        />
      </div>
    )
  }
  ```

### 2.5 JsonField 改进

- [x] T2500 [P] 🔴 创建 JsonField 改进测试
  ```typescript
  // 测试用例：
  // - 应使用 CodeEditor 组件
  // - 应显示 JSON 有效性状态图标
  // - 有效 JSON 显示绿色勾
  // - 无效 JSON 显示红色叉
  // - 值应该格式化显示
  ```

- [x] T2501 [P] 🟢 改进 JsonField 组件
  ```tsx
  // webui/src/features/records/components/fields/JsonField.tsx
  import { useState, useMemo, useCallback } from 'react'
  import { CodeEditor } from '@/components/CodeEditor'
  import { FieldLabel } from './FieldLabel'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
  import type { CollectionField } from 'pocketbase'

  interface JsonFieldProps {
    field: CollectionField
    value: unknown
    onChange: (value: string) => void
  }

  function isValidJson(val: string): boolean {
    try {
      JSON.parse(val === '' ? 'null' : val)
      return true
    } catch {
      return false
    }
  }

  function serialize(val: unknown): string {
    if (typeof val === 'string' && isValidJson(val)) {
      return val
    }
    return JSON.stringify(val === undefined ? null : val, null, 2)
  }

  export function JsonField({ field, value, onChange }: JsonFieldProps) {
    const uniqueId = `field_${field.name}`
    
    const serialized = useMemo(() => serialize(value), [value])
    const [isValid, setIsValid] = useState(() => isValidJson(serialized))
    
    const handleChange = useCallback((newValue: string) => {
      onChange(newValue.trim())
      setIsValid(isValidJson(newValue))
    }, [onChange])
    
    return (
      <div className={`form-field ${field.required ? 'required' : ''}`}>
        <FieldLabel uniqueId={uniqueId} field={field}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="json-state absolute right-2">
                {isValid ? (
                  <i className="ri-checkbox-circle-fill text-green-500" />
                ) : (
                  <i className="ri-error-warning-fill text-red-500" />
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isValid ? 'Valid JSON' : 'Invalid JSON'}
            </TooltipContent>
          </Tooltip>
        </FieldLabel>
        <CodeEditor
          id={uniqueId}
          language="json"
          value={serialized}
          onChange={handleChange}
          maxHeight={500}
        />
      </div>
    )
  }
  ```

### 2.6 RelationField 改进

- [x] T2600 [P] 🔴 创建 RelationField 改进测试
  ```typescript
  // 测试用例：
  // - 应显示无效关联 ID 的警告图标
  // - 多选时应支持拖拽排序
  // - 应显示 skeleton 加载状态
  ```

- [x] T2601 [P] 🟢 改进 RelationField 组件（添加无效 ID 警告）
  ```tsx
  // 在 RelationField 中添加 invalidIds 状态和警告图标
  const [invalidIds, setInvalidIds] = useState<string[]>([])
  
  // 在 FieldLabel 中添加警告图标
  {invalidIds.length > 0 && (
    <Tooltip>
      <TooltipTrigger asChild>
        <i className="ri-error-warning-line link-hint ml-auto" />
      </TooltipTrigger>
      <TooltipContent side="left">
        The following relation ids were removed because they are missing or invalid: {invalidIds.join(', ')}
      </TooltipContent>
    </Tooltip>
  )}
  ```

### 2.7 AuthFields 改进

- [x] T2700 [P] 🔴 创建 AuthFields 改进测试
  ```typescript
  // 测试用例：
  // - email 新建时应 autofocus
  // - 应显示密码生成按钮
  // - verified 变更时应显示确认弹窗
  ```

- [x] T2701 [P] 🟢 改进 AuthFields 组件
  ```tsx
  // 添加 autofocus 和密码生成按钮
  // 在 email input 上添加 autoFocus={isNew}
  // 在 password 字段旁添加 SecretGeneratorButton
  ```

---

## Phase 3: 高级功能 (P1)

**Purpose**: 实现编辑模式的高级功能

### 3.1 更多操作菜单

- [x] T3100 [P] 🔴 创建更多操作菜单测试
  ```typescript
  // 测试用例：
  // - 编辑模式应显示更多操作按钮
  // - 新建模式不应显示更多操作按钮
  // - 点击各菜单项应触发对应操作
  ```

- [x] T3101 [P] 🟢 实现更多操作菜单
  ```tsx
  // 在 UpsertPanel header 中添加
  {!isNew && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAuthCollection && !record.verified && record.email && (
          <DropdownMenuItem onClick={handleSendVerificationEmail}>
            <Mail className="mr-2 h-4 w-4" />
            Send verification email
          </DropdownMenuItem>
        )}
        {isAuthCollection && record.email && (
          <DropdownMenuItem onClick={handleSendPasswordResetEmail}>
            <Lock className="mr-2 h-4 w-4" />
            Send password reset email
          </DropdownMenuItem>
        )}
        {isAuthCollection && (
          <DropdownMenuItem onClick={() => impersonatePopupRef.current?.show()}>
            <UserCheck className="mr-2 h-4 w-4" />
            Impersonate
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleCopyJSON}>
          <Braces className="mr-2 h-4 w-4" />
          Copy raw JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleDelete}
          className="text-destructive"
        >
          <Trash className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )}
  ```

### 3.2 发送验证邮件![alt text](image.png)

- [x] T3200 [P] 🟢 实现发送验证邮件功能
  ```typescript
  const handleSendVerificationEmail = async () => {
    if (!collection?.id || !record?.email) return
    
    confirm(
      `Do you really want to sent verification email to ${record.email}?`,
      async () => {
        try {
          await pb.collection(collection.id).requestVerification(record.email)
          addSuccessToast(`Successfully sent verification email to ${record.email}.`)
        } catch (err) {
          handleApiError(err)
        }
      }
    )
  }
  ```

### 3.3 发送密码重置邮件

- [x] T3300 [P] 🟢 实现发送密码重置邮件功能
  ```typescript
  const handleSendPasswordResetEmail = async () => {
    if (!collection?.id || !record?.email) return
    
    confirm(
      `Do you really want to sent password reset email to ${record.email}?`,
      async () => {
        try {
          await pb.collection(collection.id).requestPasswordReset(record.email)
          addSuccessToast(`Successfully sent password reset email to ${record.email}.`)
        } catch (err) {
          handleApiError(err)
        }
      }
    )
  }
  ```

### 3.4 复制 JSON

- [x] T3400 [P] 🟢 实现复制 JSON 功能
  ```typescript
  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2))
    addInfoToast('The record JSON was copied to your clipboard!', 3000)
  }
  ```

### 3.5 复制记录 (Duplicate)

- [x] T3500 [P] 🔴 创建复制记录测试
  ```typescript
  // 测试用例：
  // - 有未保存变更时应显示确认弹窗
  // - 应清空 id、file、autodate 字段
  // - 应删除当前草稿
  // - 应标记为 hasChanges
  ```

- [x] T3501 [P] 🟢 实现复制记录功能
  ```typescript
  const handleDuplicate = () => {
    if (hasChanges) {
      confirm(
        'You have unsaved changes. Do you really want to discard them?',
        () => duplicate()
      )
    } else {
      duplicate()
    }
  }

  const duplicate = async () => {
    const clone = record ? structuredClone(record) : null
    
    if (clone) {
      // 重置需要清空的字段类型
      const resetTypes = ['file', 'autodate']
      for (const field of collection?.fields || []) {
        if (resetTypes.includes(field.type)) {
          delete clone[field.name]
        }
      }
      clone.id = ''
    }
    
    deleteDraft()
    setRecord(clone)
    setOriginal({})
    setIsNew(true)
  }
  ```

### 3.6 删除记录

- [x] T3600 [P] 🟢 实现删除记录功能
  ```typescript
  const handleDelete = () => {
    if (!record?.id) return
    
    confirm(
      'Do you really want to delete the selected record?',
      async () => {
        try {
          await pb.collection(collection.id).delete(record.id)
          addSuccessToast('Successfully deleted record.')
          onDelete?.(record)
          onClose()
        } catch (err) {
          handleApiError(err)
        }
      }
    )
  }
  ```

### 3.7 Tab 切换 (Auth Collection)

- [x] T3700 [P] 🔴 创建 Tab 切换测试
  ```typescript
  // 测试用例：
  // - Auth Collection 编辑模式应显示 Tab
  // - 新建模式不应显示 Tab
  // - 非 Auth Collection 不应显示 Tab
  // - superusers 不应显示 Tab
  // - Tab 切换应正确显示内容
  ```

- [x] T3701 [P] 🟢 实现 Tab 切换
  ```tsx
  // 在 header 中添加 Tab
  {isAuthCollection && !isSuperusers && !isNew && (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="form">Account</TabsTrigger>
        <TabsTrigger value="providers">Authorized providers</TabsTrigger>
      </TabsList>
    </Tabs>
  )}
  
  // 在 content 中切换显示
  <TabsContent value="form">
    {/* 表单内容 */}
  </TabsContent>
  <TabsContent value="providers">
    <ExternalAuthsList record={record} />
  </TabsContent>
  ```

### 3.8 Save and continue

- [x] T3800 [P] 🔴 创建 Save and continue 测试
  ```typescript
  // 测试用例：
  // - 编辑模式应显示下拉按钮
  // - 新建模式不应显示下拉按钮
  // - Save and continue 应保存但不关闭面板
  ```

- [x] T3801 [P] 🟢 实现 Save and continue 功能
  ```tsx
  // 修改 footer 按钮
  <div className="btns-group no-gap">
    <Button
      type="submit"
      disabled={!canSave || saving}
      className={isNew ? 'btn-expanded' : 'btn-expanded-sm'}
    >
      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isNew ? 'Create' : 'Save changes'}
    </Button>
    
    {!isNew && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            disabled={!canSave || saving}
            className="px-2"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleSave(false)}>
            Save and continue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )}
  </div>
  ```

---

## Phase 4: 完善与测试 (P2)

**Purpose**: 功能完善和测试覆盖

### 4.1 ID 字段改进

- [x] T4100 [P] 🔴 创建 ID 字段测试
  ```typescript
  // 测试用例：
  // - 新建时应可编辑
  // - 编辑时应只读
  // - 有 autogeneratePattern 时应显示提示
  // - 应显示 AutodateIcon (编辑模式)
  // - 应支持 min/max 长度
  ```

- [x] T4101 [P] 🟢 实现 ID 字段改进
  ```tsx
  // ID 字段组件
  <div className={`form-field ${!isNew ? 'readonly' : ''}`}>
    <label htmlFor="id">
      <i className="ri-key-line" />
      <span className="txt">id</span>
    </label>
    {!isNew && (
      <div className="form-field-addon">
        <AutodateIcon record={record} />
      </div>
    )}
    <Input
      id="id"
      type="text"
      placeholder={
        !isLoading && idField?.autogeneratePattern
          ? 'Leave empty to auto generate...'
          : ''
      }
      minLength={idField?.min}
      maxLength={idField?.max}
      readOnly={!isNew}
      value={formData.id || ''}
      onChange={(e) => handleFieldChange('id', e.target.value)}
    />
  </div>
  ```

### 4.2 面板宽度动态调整

- [x] T4200 [P] 🟢 实现面板宽度动态调整
  ```tsx
  // 根据是否有 editor 字段动态设置宽度
  const hasEditorField = useMemo(() => {
    return collection?.fields?.some(f => f.type === 'editor')
  }, [collection?.fields])
  
  // 在 OverlayPanel 上设置
  <OverlayPanel
    width={hasEditorField ? 'xl' : 'lg'}
    // ...
  />
  ```

### 4.3 导出 FormData 函数

- [x] T4300 [P] 🔴 创建 exportFormData 测试
  ```typescript
  // 测试用例：
  // - 应跳过 autodate 字段
  // - 应跳过 Auth 的 password 字段（除非显式设置）
  // - 应验证 JSON 字段有效性
  // - 应正确处理文件上传 (key+)
  // - 应正确处理文件删除 (key-)
  // - undefined 应转为 null
  ```

- [x] T4301 [P] 🟢 实现 exportFormData 函数
  ```typescript
  // webui/src/features/records/utils/exportFormData.ts
  import { ClientResponseError } from 'pocketbase'
  import type { CollectionModel } from 'pocketbase'

  export function exportFormData(
    record: Record<string, unknown>,
    collection: CollectionModel,
    uploadedFiles: Record<string, File[]>,
    deletedFiles: Record<string, string[]>
  ): FormData {
    const data = structuredClone(record || {})
    const formData = new FormData()
    const exportableFields = new Set<string>()
    const jsonFields = new Set<string>()
    const isAuthCollection = collection.type === 'auth'
    
    // 收集可导出字段
    for (const field of collection.fields || []) {
      if (field.type === 'autodate') continue
      if (isAuthCollection && field.type === 'password') continue
      exportableFields.add(field.name)
      if (field.type === 'json') jsonFields.add(field.name)
    }
    
    // Auth password 特殊处理
    if (isAuthCollection && data.password) {
      exportableFields.add('password')
    }
    if (isAuthCollection && data.passwordConfirm) {
      exportableFields.add('passwordConfirm')
    }
    
    // 导出字段值
    for (const key in data) {
      if (!exportableFields.has(key)) continue
      
      let value = data[key]
      if (value === undefined) value = null
      
      // JSON 校验
      if (jsonFields.has(key) && value !== '' && value !== null) {
        try {
          JSON.parse(typeof value === 'string' ? value : JSON.stringify(value))
        } catch (err) {
          throw new ClientResponseError({
            status: 400,
            response: {
              data: { 
                [key]: { 
                  code: 'invalid_json', 
                  message: (err as Error).toString() 
                } 
              }
            }
          })
        }
      }
      
      addValueToFormData(formData, key, value)
    }
    
    // 上传的文件
    for (const key in uploadedFiles) {
      for (const file of uploadedFiles[key] || []) {
        formData.append(`${key}+`, file)
      }
    }
    
    // 删除的文件
    for (const key in deletedFiles) {
      for (const name of deletedFiles[key] || []) {
        formData.append(`${key}-`, name)
      }
    }
    
    return formData
  }
  
  function addValueToFormData(
    formData: FormData, 
    key: string, 
    value: unknown
  ) {
    if (value === null || value === undefined) {
      formData.append(key, '')
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        formData.append(key, '')
      } else {
        for (const v of value) {
          formData.append(key, String(v))
        }
      }
    } else if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value))
    } else {
      formData.append(key, String(value))
    }
  }
  ```

### 4.4 密码变更注销

- [x] T4400 [P] 🟢 实现 superusers 密码变更自动注销
  ```typescript
  // 在保存成功后检查
  if (
    isSuperusersCollection &&
    record?.id === pb.authStore.record?.id &&
    formData.password
  ) {
    pb.authStore.clear()
    // 重定向到登录页
    return
  }
  ```

### 4.5 单元测试补充

- [ ] T4500 🔴 补充 UpsertPanel 单元测试
- [ ] T4501 🔴 补充所有字段组件单元测试
- [ ] T4502 🔴 补充 hooks 单元测试
- [ ] T4503 🔴 补充 utils 单元测试

### 4.6 集成测试

- [ ] T4600 🔴 创建 Base Collection 记录 CRUD 集成测试
- [ ] T4601 🔴 创建 Auth Collection 记录 CRUD 集成测试
- [ ] T4602 🔴 创建草稿管理集成测试
- [ ] T4603 🔴 创建文件上传集成测试

---

## 验收检查清单

### 功能完整性

- [ ] 所有 15 种字段类型正确渲染和交互
- [ ] Auth Collection 特殊字段正确处理
- [ ] 草稿自动保存和恢复功能
- [ ] 未保存变更确认弹窗
- [ ] Ctrl+S 快捷保存
- [ ] 编辑模式更多操作菜单
- [ ] Tab 切换 (Auth Collection)
- [ ] Save and continue 功能
- [ ] 复制/删除记录功能
- [ ] 发送验证/密码重置邮件

### UI 一致性

- [ ] 字段图标与 UI 版本一致
- [ ] 字段布局与 UI 版本一致
- [ ] 按钮样式与 UI 版本一致
- [ ] 加载状态与 UI 版本一致
- [ ] 错误提示与 UI 版本一致

### 测试覆盖

- [ ] 单元测试覆盖率 >= 80%
- [ ] 核心场景集成测试通过
- [ ] 无 TypeScript 类型错误
- [ ] 无 ESLint 错误

---

## Phase 5: 补充功能 (P2)

**Purpose**: 补充 spec.md 中提到但 tasks 中遗漏的功能点

### 5.1 面板标题对齐

- [x] T5100 [P] 🟢 修改面板标题格式
  ```tsx
  // 面板标题应与 UI 版本一致
  // 新建: "New {collection.name} record"
  // 编辑: "Edit {collection.name} record"
  <h4>
    {isLoading && <span className="loader loader-sm mr-2" />}
    <span className="txt">
      {isNew ? 'New' : 'Edit'} {collection?.name} record
    </span>
  </h4>
  ```

### 5.2 EditorField 改进

- [ ] T5200 [P] 🔴 创建 EditorField 改进测试
  ```typescript
  // 测试用例：
  // - 应支持 field.convertURLs 配置
  // - 应使用 RecordFilePicker 选择图片
  // - 应有 100ms 延迟加载
  ```

- [x] T5201 [P] 🟢 实现 RecordFilePicker 组件
  ```tsx
  // webui/src/features/records/components/RecordFilePicker.tsx
  // 用于在编辑器中选择已上传的文件/图片
  interface RecordFilePickerProps {
    title?: string
    submitText?: string
    fileTypes?: ('image' | 'document' | 'video' | 'audio' | 'file')[]
    onSubmit: (selection: { record: RecordModel, name: string, size: string }) => void
  }
  ```

- [x] T5202 [P] 🟢 改进 EditorField 组件
  ```tsx
  // 添加 convertURLs 支持和图片选择器
  const editorConfig = {
    ...defaultEditorOptions,
    convert_urls: field.convertURLs,
    relative_urls: false,
  }
  ```

### 5.3 FileField 改进

- [ ] T5300 [P] 🔴 创建 FileField 排序测试
  ```typescript
  // 测试用例：
  // - 多文件时应支持拖拽排序
  // - 应有 "在新标签打开" 功能
  ```

- [x] T5301 [P] 🟢 实现 FileField 拖拽排序
  ```tsx
  // 使用 @dnd-kit 实现拖拽排序
  import { DndContext, closestCenter } from '@dnd-kit/core'
  import { SortableContext, useSortable } from '@dnd-kit/sortable'
  ```

- [x] T5302 [P] 🟢 实现 FileField 新标签打开功能
  ```typescript
  const openInNewTab = async (filename: string) => {
    if (!record?.id) return
    const token = await getSuperuserFileToken()
    const url = pb.files.getURL(record, filename, { token })
    window.open(url, '_blank')
  }
  ```

### 5.4 RelationField 排序

- [x] T5400 [P] 🟢 实现 RelationField 拖拽排序
  ```tsx
  // 多选关系字段支持拖拽排序
  // 使用与 FileField 相同的 @dnd-kit 方案
  ```

### 5.5 BoolField 样式对齐

- [x] T5500 [P] 🟢 对齐 BoolField 样式
  ```tsx
  // 应使用 form-field-toggle 样式
  <div className="form-field form-field-toggle">
    <Checkbox
      id={uniqueId}
      checked={!!value}
      onCheckedChange={(checked) => onChange(!!checked)}
    />
    <FieldLabel uniqueId={uniqueId} field={field} />
  </div>
  ```

### 5.6 PasswordField 改进

- [x] T5600 [P] 🟢 改进 PasswordField 组件
  ```tsx
  // 添加 autocomplete="new-password" 属性
  <Input
    type="password"
    autoComplete="new-password"
    // ...
  />
  ```

### 5.7 GeoPointField 范围校验

- [x] T5700 [P] 🔴 创建 GeoPointField 范围校验测试
  ```typescript
  // 测试用例：
  // - lat 应限制在 -90 ~ 90
  // - lon 应限制在 -180 ~ 180
  // - 默认值应为 { lat: 0, lon: 0 }
  ```

- [x] T5701 [P] 🟢 改进 GeoPointField 范围校验
  ```tsx
  // 添加 min/max 属性和默认值处理
  <Input
    type="number"
    min={-90}
    max={90}
    step="any"
    value={value?.lat ?? 0}
    // ...
  />
  ```

### 5.8 ESC 关闭和遮罩关闭控制

- [x] T5800 [P] 🟢 实现 ESC 关闭控制
  ```tsx
  // 加载中或保存中时禁用 ESC 关闭
  <OverlayPanel
    escClose={!isLoading && !saving}
    overlayClose={!isLoading && !saving}
    // ...
  />
  ```

### 5.9 Impersonate 功能集成

- [x] T5900 [P] 🟢 集成 Impersonate 功能
  ```tsx
  // 在更多操作菜单中添加 Impersonate 选项
  // 仅对 Auth Collection 的记录显示
  const impersonatePopupRef = useRef<ImpersonatePopupRef>(null)
  
  // 菜单项
  <DropdownMenuItem onClick={() => impersonatePopupRef.current?.show()}>
    <UserCheck className="mr-2 h-4 w-4" />
    Impersonate
  </DropdownMenuItem>
  
  // 弹窗组件
  <ImpersonatePopup
    ref={impersonatePopupRef}
    collection={collection}
    record={record}
  />
  ```

---

## Phase 6: 边界情况和遗漏功能 (2026-02-09 审查补充)

**Purpose**: 补充代码审查发现的遗漏功能点和边界情况处理

### 6.1 View Collection 限制

- [x] T6100 [P] 🟢 View Collection 不显示 New Record 按钮
  ```tsx
  // 在 PageRecords 或相关组件中
  // View Collection 的 New record 按钮应该不显示或禁用
  {collection?.type !== 'view' && (
    <Button onClick={() => upsertPanel.show()}>
      New record
    </Button>
  )}
  ```

- [x] T6101 [P] 🟢 View Collection 只能打开 PreviewPanel
  ```tsx
  // 点击 View Collection 记录时
  const handleRecordClick = (record: RecordModel) => {
    if (collection?.type === 'view') {
      previewPanel.show(record)
    } else {
      upsertPanel.show(record)
    }
  }
  ```

### 6.2 Hidden 字段标签

- [x] T6200 [P] 🟢 FieldLabel 添加 Hidden 标签显示
  ```tsx
  // webui/src/features/records/components/fields/FieldLabel.tsx
  // 在 field.hidden 时显示红色 "Hidden" 标签
  <label htmlFor={uniqueId}>
    <i className={getFieldTypeIcon(field.type)} />
    <span className="txt">{field.name}</span>
    {field.hidden && (
      <small className="label label-sm label-danger">Hidden</small>
    )}
    {children}
  </label>
  ```

### 6.3 Verified 变更确认逻辑完善

- [ ] T6300 [P] 🔴 创建 Verified 变更确认测试
  ```typescript
  // 测试用例：
  // - 新建记录时变更 verified：不应显示确认弹窗
  // - 编辑记录时变更 verified：应显示确认弹窗
  // - 用户取消确认时：应还原 checkbox 状态
  // - 用户确认时：应保持变更后的状态
  ```

- [x] T6301 [P] 🟢 完善 AuthFields 的 verified 确认逻辑
  ```tsx
  // 在 AuthFields 中
  const handleVerifiedChange = (checked: boolean) => {
    if (isNew) {
      // 新建时直接变更
      onChange('verified', checked)
      return
    }
    
    // 编辑时需要确认
    confirm(
      'Do you really want to manually change the verified account state?',
      () => {
        // 确认：保持变更
      },
      () => {
        // 取消：还原状态 - 需要强制重新渲染 checkbox
        setVerifiedValue(!checked)
      }
    )
    
    onChange('verified', checked)
  }
  ```

### 6.4 Select 字段值自动清理

- [x] T6400 [P] 🔴 创建 SelectField 值清理测试
  ```typescript
  // 测试用例：
  // - 值包含不存在的选项时应自动过滤
  // - 值超过 maxSelect 时应从后面截断
  // - 截断后应保留最新选择的值
  ```

- [x] T6401 [P] 🟢 SelectField 添加值自动清理逻辑
  ```tsx
  // 在 SelectField 组件中
  useEffect(() => {
    if (!isMultiple || !Array.isArray(value)) return
    
    const validValues = field.values || []
    
    // 1. 过滤不存在的选项
    let cleaned = value.filter(v => validValues.includes(v))
    
    // 2. 超过 maxSelect 时截断（保留最新的）
    if (cleaned.length > maxSelect) {
      cleaned = cleaned.slice(cleaned.length - maxSelect)
    }
    
    // 3. 如果有变化，更新值
    if (cleaned.length !== value.length || 
        !cleaned.every((v, i) => v === value[i])) {
      onChange(cleaned)
    }
  }, [value, field.values, maxSelect, isMultiple, onChange])
  ```

### 6.5 ExternalAuthsList 删除确认

- [x] T6500 [P] 🟢 添加 OAuth Provider 解绑确认弹窗
  ```tsx
  // 在 ExternalAuthsList 中
  const handleUnlink = (provider: string) => {
    confirm(
      `Do you really want to unlink the "${provider}" provider?`,
      async () => {
        try {
          await pb.collection(collection.id).unlinkExternalAuth(record.id, provider)
          addSuccessToast(`Successfully unlinked the "${provider}" provider.`)
          // 刷新列表
          refresh()
        } catch (err) {
          handleApiError(err)
        }
      }
    )
  }
  ```

### 6.6 ID 字段 autogeneratePattern 处理

- [ ] T6600 [P] 🔴 创建 ID 字段自动生成提示测试
  ```typescript
  // 测试用例：
  // - idField 有 autogeneratePattern 时应显示提示
  // - 编辑模式时不应显示提示
  // - 应正确获取 idField 的 min/max 长度
  ```

- [x] T6601 [P] 🟢 完善 ID 字段的 autogeneratePattern 支持
  ```tsx
  // 获取 idField 配置
  const idField = useMemo(() => {
    return collection?.fields?.find(f => f.name === 'id')
  }, [collection?.fields])
  
  // ID 字段渲染
  <div className="form-field">
    <label htmlFor="id">
      <i className="ri-key-line" />
      <span className="txt">id</span>
    </label>
    <Input
      id="id"
      type="text"
      readOnly={!isNew}
      placeholder={
        isNew && idField?.autogeneratePattern
          ? 'Leave empty to auto generate...'
          : ''
      }
      minLength={idField?.min}
      maxLength={idField?.max}
      value={formData.id || ''}
      onChange={(e) => handleFieldChange('id', e.target.value)}
    />
  </div>
  ```

### 6.7 RecordUpsertPanel 嵌套使用支持

- [ ] T6700 [P] 🔴 创建嵌套 UpsertPanel 测试
  ```typescript
  // 测试用例：
  // - 在 RecordsPicker 中打开 UpsertPanel 应正常工作
  // - 保存后应触发正确的 onSave 回调
  // - 删除后应触发正确的 onDelete 回调
  // - 嵌套面板的 z-index 应正确堆叠
  ```

- [x] T6701 [P] 🟢 确保 onSave/onDelete 回调返回完整信息
  ```tsx
  // UpsertPanel 保存成功后
  onSave?.({
    isNew: originalIsNew,
    record: savedRecord,  // 完整的记录对象，包括服务端生成的字段
  })
  
  // UpsertPanel 删除成功后
  onDelete?.({
    id: record.id,
    ...record,  // 被删除记录的完整信息
  })
  ```

### 6.8 File 字段 accept 属性

- [x] T6800 [P] 🟢 FileField 添加 mimeTypes 到 accept 属性
  ```tsx
  // 在 FileField 中
  const accept = useMemo(() => {
    if (!field.mimeTypes || field.mimeTypes.length === 0) {
      return undefined  // 无限制
    }
    return field.mimeTypes.join(',')
  }, [field.mimeTypes])
  
  <input
    type="file"
    accept={accept}
    multiple={isMultiple}
    onChange={handleFileSelect}
  />
  ```

### 6.9 GeoPoint 默认值处理

- [x] T6900 [P] 🟢 GeoPointField 默认显示 (0, 0) 位置
  ```tsx
  // 在 GeoPointField 中
  const defaultValue = useMemo(() => ({
    lat: 0,
    lon: 0,
  }), [])
  
  const currentValue = value || defaultValue
  
  // 地图初始化时使用默认中心点
  const initialCenter = [currentValue.lat, currentValue.lon]
  ```

---

## Phase 7: 错误处理和 UI 细节 (补充)

### 7.1 网络错误处理

- [x] T7100 [P] 🟢 保存时网络错误处理
  ```tsx
  // 在 handleSave 中
  try {
    await pb.collection(collection.id).create(formData)
  } catch (err) {
    if (err instanceof ClientResponseError) {
      if (err.status === 0) {
        // 网络错误
        addErrorToast('Network error. Please check your connection and try again.')
      } else {
        handleApiError(err)
      }
    }
    // 保持表单数据不丢失，用户可以重试
  }
  ```

### 7.2 超长字段名处理

- [x] T7200 [P] 🟢 FieldLabel 添加文本截断样式
  ```tsx
  // 在 FieldLabel 中
  <span 
    className="txt truncate max-w-[200px]" 
    title={field.name}  // 完整名称在 hover 时显示
  >
    {field.name}
  </span>
  ```

### 7.3 空 Collection 处理

- [x] T7300 [P] 🟢 只有系统字段的 Collection 应正常显示
  ```tsx
  // 即使没有自定义字段，也应该：
  // - 显示 id 字段
  // - Auth Collection 显示 email/password/verified
  // - 显示 Create/Save 按钮
  ```

---

## 附录：字段类型映射

| 类型 | 组件 | 图标 |
|------|------|------|
| primary | - | ri-key-line |
| text | TextField | ri-text |
| number | NumberField | ri-hashtag |
| bool | BoolField | ri-toggle-line |
| email | EmailField | ri-mail-line |
| url | UrlField | ri-link |
| editor | EditorField | ri-edit-2-line |
| date | DateField | ri-calendar-line |
| select | SelectField | ri-list-check |
| json | JsonField | ri-braces-line |
| file | FileField | ri-image-line |
| relation | RelationField | ri-mind-map |
| password | PasswordField | ri-lock-password-line |
| autodate | - | ri-calendar-check-line |
| geoPoint | GeoPointField | ri-map-pin-2-line |
| secret | SecretField | ri-shield-keyhole-line |

---

## 附录：校验规则详细说明

### 客户端校验规则

| 字段类型 | 规则 | 说明 |
|----------|------|------|
| id | minlength/maxlength | 从 idField 获取，可自定义 |
| text | required && !autogeneratePattern | 有自动生成模式时可为空 |
| number | required + min/max | min/max 从 field 配置获取 |
| email | required + type="email" | 原生浏览器校验 |
| url | required + type="url" | 原生浏览器校验 |
| password | required (新建时) | 编辑时可选 |
| passwordConfirm | required (新建时) | 必须与 password 一致 |
| date | required | 无特殊格式校验 |
| select | required + maxSelect | 多选时限制最大数量 |
| json | JSON.parse 有效性 | 提交前本地校验 |
| file | required + maxSelect | 限制文件数量和类型 |
| relation | required | 无特殊校验 |
| geoPoint | lat: -90~90, lon: -180~180 | 范围校验 |

### 服务端错误处理

```typescript
// 字段级错误显示在对应字段下方
interface FieldError {
  code: string
  message: string
}

// 表单级错误显示在顶部
interface FormError {
  message: string
}

// 错误处理示例
try {
  await pb.collection(id).create(formData)
} catch (err) {
  if (err instanceof ClientResponseError) {
    if (err.response.data) {
      // 字段级错误
      setFieldErrors(err.response.data)
    } else {
      // 表单级错误
      setFormError(err.message)
    }
  }
}
```

---

## 附录：草稿管理详细说明

### 草稿键格式

```typescript
// 新建记录
const draftKey = `record_draft_${collectionId}_`

// 编辑记录
const draftKey = `record_draft_${collectionId}_${recordId}`
```

### 草稿数据结构

```typescript
interface DraftData {
  // 排除敏感字段
  [key: string]: unknown
  // 不包含:
  // - password
  // - passwordConfirm
  // - 文件字段（文件不能序列化）
}
```

### 草稿比较逻辑

```typescript
function areRecordsEqual(a: unknown, b: unknown, skipFileFields: string[] = []): boolean {
  const aClone = structuredClone(a)
  const bClone = structuredClone(b)
  
  // 排除文件字段
  for (const field of skipFileFields) {
    delete aClone[field]
    delete bClone[field]
  }
  
  return JSON.stringify(aClone) === JSON.stringify(bClone)
}
```

---

## 附录：文件处理详细说明

### 文件上传语法

```typescript
// 追加文件使用 key+ 语法
formData.append('avatar+', file)

// 删除文件使用 key- 语法
formData.append('avatar-', 'filename.jpg')
```

### 文件 Token 获取

```typescript
async function getSuperuserFileToken(): Promise<string> {
  // 仅 superusers 需要 token 访问 protected 文件
  return await pb.collections.getSuperuserFileToken()
}
```

### 文件预览逻辑

```typescript
// 已保存的文件
const existingFileUrl = pb.files.getURL(record, filename, { 
  thumb: '100x100',
  token: fileToken 
})

// 新上传的文件（本地预览）
const newFileUrl = URL.createObjectURL(file)
```

---

## Phase 8: 表单校验对齐 (2026-02-09 补充)

**Purpose**: 确保服务端字段错误能正确显示在表单字段下方，与 UI 版本保持一致

**重要发现**：WebUI 的 RecordUpsertPanel 没有集成 formErrors store，导致服务端返回的字段错误无法显示。

### 8.1 服务端错误显示机制

- [x] T8100 [P0] 🔴 创建服务端字段错误显示测试
  ```typescript
  // webui/src/features/records/components/__tests__/UpsertPanel.serverErrors.test.tsx
  import { render, screen, fireEvent, waitFor } from '@testing-library/react'
  import { UpsertPanel } from '../UpsertPanel'
  import { formErrorsAtom } from '@/store/formErrors'
  import { Provider, useAtomValue } from 'jotai'
  
  // Mock PocketBase
  const mockCreate = vi.fn()
  vi.mock('@/lib/pocketbase', () => ({
    pb: {
      collection: () => ({
        create: mockCreate,
        update: mockCreate,
      }),
    },
  }))
  
  describe('UpsertPanel Server Error Display', () => {
    beforeEach(() => {
      mockCreate.mockReset()
    })
    
    it('should display server field error under the corresponding field', async () => {
      // Mock API 返回 400 + email 字段错误
      mockCreate.mockRejectedValue({
        status: 400,
        response: {
          message: 'Failed to create record.',
          data: {
            email: {
              code: 'validation_invalid_email',
              message: 'Must be a valid email address.',
            },
          },
        },
      })
      
      const collection = {
        id: 'test_collection',
        name: 'test',
        type: 'auth',
        fields: [],
      }
      
      render(
        <Provider>
          <UpsertPanel collection={collection} open={true} />
        </Provider>
      )
      
      // 填写表单并提交
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'invalid-email' },
      })
      fireEvent.click(screen.getByText(/create/i))
      
      // 验证错误消息显示在字段下方
      await waitFor(() => {
        expect(screen.getByText('Must be a valid email address.')).toBeInTheDocument()
      })
    })
    
    it('should display multiple field errors simultaneously', async () => {
      mockCreate.mockRejectedValue({
        status: 400,
        response: {
          message: 'Failed to create record.',
          data: {
            email: {
              code: 'validation_invalid_email',
              message: 'Must be a valid email address.',
            },
            password: {
              code: 'validation_required',
              message: 'Cannot be blank.',
            },
          },
        },
      })
      
      const collection = {
        id: 'test_collection',
        name: 'test',
        type: 'auth',
        fields: [],
      }
      
      render(
        <Provider>
          <UpsertPanel collection={collection} open={true} />
        </Provider>
      )
      
      fireEvent.click(screen.getByText(/create/i))
      
      await waitFor(() => {
        expect(screen.getByText('Must be a valid email address.')).toBeInTheDocument()
        expect(screen.getByText('Cannot be blank.')).toBeInTheDocument()
      })
    })
    
    it('should clear field error when user types in the field', async () => {
      mockCreate.mockRejectedValue({
        status: 400,
        response: {
          data: {
            email: {
              message: 'Must be a valid email address.',
            },
          },
        },
      })
      
      const collection = {
        id: 'test_collection',
        name: 'test',
        type: 'auth',
        fields: [],
      }
      
      render(
        <Provider>
          <UpsertPanel collection={collection} open={true} />
        </Provider>
      )
      
      fireEvent.click(screen.getByText(/create/i))
      
      await waitFor(() => {
        expect(screen.getByText('Must be a valid email address.')).toBeInTheDocument()
      })
      
      // 用户在 email 字段输入内容
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      })
      
      // 错误应该被清除
      await waitFor(() => {
        expect(screen.queryByText('Must be a valid email address.')).not.toBeInTheDocument()
      })
    })
    
    it('should clear all errors when panel reopens', async () => {
      // 设置初始错误状态后关闭再打开面板
      // 验证错误已清除
    })
  })
  ```

- [x] T8101 [P0] 🟢 RecordUpsertPanel 集成 formErrors store
  ```tsx
  // webui/src/features/records/components/UpsertPanel.tsx
  import { useSetAtom, useAtomValue } from 'jotai'
  import { 
    setFormErrorsAtom, 
    clearFormErrorsAtom,
    formErrorsAtom 
  } from '@/store/formErrors'
  import { addErrorToast } from '@/store/toasts'
  
  export const UpsertPanel = ({ collection, record, open, onOpenChange, onSave, onDelete }) => {
    const setFormErrors = useSetAtom(setFormErrorsAtom)
    const clearFormErrors = useSetAtom(clearFormErrorsAtom)
    
    // 面板打开时清除之前的错误
    useEffect(() => {
      if (open) {
        clearFormErrors()
      }
    }, [open, clearFormErrors])
    
    const handleSave = async () => {
      setIsSaving(true)
      
      try {
        const formData = await exportFormData()
        
        let savedRecord
        if (isNew) {
          savedRecord = await pb.collection(collection.id).create(formData)
        } else {
          savedRecord = await pb.collection(collection.id).update(record.id, formData)
        }
        
        // 成功：清除错误
        clearFormErrors()
        deleteDraft()
        onSave?.({ isNew: originalIsNew, record: savedRecord })
        onOpenChange?.(false)
        
      } catch (error) {
        // 处理服务端返回的错误
        const responseData = error?.response || error?.data || {}
        
        // 1. 显示 toast 错误通知
        const msg = responseData.message || error?.message || 'Failed to save record.'
        addErrorToast(msg)
        
        // 2. 设置字段级错误（显示在字段下方）
        if (responseData.data && Object.keys(responseData.data).length > 0) {
          setFormErrors(responseData.data)
        }
        
        console.warn('Save record failed:', error)
      }
      
      setIsSaving(false)
    }
    
    // ... rest of component
  }
  ```

### 8.2 字段组件使用 FormField 包装

- [x] T8200 [P0] 🔴 创建 FormField 包装测试
  ```typescript
  // webui/src/features/records/components/fields/__tests__/FormFieldWrapper.test.tsx
  import { render, screen, fireEvent } from '@testing-library/react'
  import { Provider, createStore } from 'jotai'
  import { formErrorsAtom, setFormErrorsAtom } from '@/store/formErrors'
  import { TextField } from '../TextField'
  
  describe('Field components with FormField wrapper', () => {
    it('TextField should display error from formErrors store', () => {
      const store = createStore()
      store.set(setFormErrorsAtom, {
        title: { message: 'Title is required.' },
      })
      
      const field = { name: 'title', type: 'text', required: true }
      
      render(
        <Provider store={store}>
          <TextField 
            field={field} 
            value="" 
            onChange={() => {}} 
          />
        </Provider>
      )
      
      expect(screen.getByText('Title is required.')).toBeInTheDocument()
    })
    
    it('NumberField should display error from formErrors store', () => {
      // Similar test for NumberField
    })
    
    it('SelectField should display error from formErrors store', () => {
      // Similar test for SelectField
    })
    
    // ... tests for all field types
  })
  ```

- [x] T8201 [P0] 🟢 TextField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/TextField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const TextField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        <AutoExpandTextarea
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required && !field.autogeneratePattern}
          placeholder={
            field.autogeneratePattern 
              ? 'Leave empty to autogenerate...' 
              : ''
          }
        />
      </FormField>
    )
  }
  ```

- [x] T8202 [P0] 🟢 NumberField 使用 FormField 包装并添加 min/max/step
  ```tsx
  // webui/src/features/records/components/fields/NumberField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const NumberField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        <Input
          id={field.name}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          required={field.required}
          min={field.min}
          max={field.max}
          step="any"
        />
      </FormField>
    )
  }
  ```

- [x] T8203 [P0] 🟢 BoolField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/BoolField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const BoolField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} className="form-field-toggle">
        <Checkbox
          id={field.name}
          checked={value ?? false}
          onCheckedChange={onChange}
        />
        <FieldLabel field={field} />
      </FormField>
    )
  }
  ```

- [x] T8204 [P0] 🟢 EmailField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/EmailField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const EmailField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        <Input
          id={field.name}
          type="email"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      </FormField>
    )
  }
  ```

- [x] T8205 [P0] 🟢 UrlField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/UrlField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const UrlField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        <Input
          id={field.name}
          type="url"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      </FormField>
    )
  }
  ```

- [x] T8206 [P0] 🟢 SelectField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/SelectField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const SelectField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        {/* Select component */}
      </FormField>
    )
  }
  ```

- [x] T8207 [P0] 🟢 DateField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/DateField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const DateField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        {/* Date picker component */}
      </FormField>
    )
  }
  ```

- [x] T8208 [P0] 🟢 EditorField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/EditorField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const EditorField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required} className="form-field-editor">
        <FieldLabel field={field} />
        {/* TinyMCE editor */}
      </FormField>
    )
  }
  ```

- [x] T8209 [P0] 🟢 JsonField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/JsonField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const JsonField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        {/* JSON editor */}
      </FormField>
    )
  }
  ```

- [x] T8210 [P0] 🟢 FileField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/FileField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const FileField = ({ field, value, uploadedFiles, deletedFiles, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        {/* File upload component */}
      </FormField>
    )
  }
  ```

- [x] T8211 [P0] 🟢 RelationField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/RelationField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const RelationField = ({ field, value, onChange, collection }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        {/* Relation picker */}
      </FormField>
    )
  }
  ```

- [x] T8212 [P0] 🟢 PasswordField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/PasswordField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const PasswordField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        <Input
          id={field.name}
          type="password"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          autoComplete="new-password"
        />
      </FormField>
    )
  }
  ```

- [x] T8213 [P0] 🟢 SecretField 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/SecretField.tsx
  import { FormField } from '@/components/ui/FormField'
  import { SecretInput } from '@/components/ui/SecretInput'
  
  export const SecretField = ({ field, value, onChange }) => {
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        <SecretInput
          id={field.name}
          value={value || ''}
          onChange={onChange}
          required={field.required}
        />
      </FormField>
    )
  }
  ```

- [x] T8214 [P0] 🟢 GeoPointField 使用 FormField 包装并添加 min/max
  ```tsx
  // webui/src/features/records/components/fields/GeoPointField.tsx
  import { FormField } from '@/components/ui/FormField'
  
  export const GeoPointField = ({ field, value, onChange }) => {
    const currentValue = value || { lat: 0, lon: 0 }
    
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field} />
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Longitude"
            value={currentValue.lon}
            onChange={(e) => onChange({ ...currentValue, lon: Number(e.target.value) })}
            min={-180}
            max={180}
            step="any"
          />
          <Input
            type="number"
            placeholder="Latitude"
            value={currentValue.lat}
            onChange={(e) => onChange({ ...currentValue, lat: Number(e.target.value) })}
            min={-90}
            max={90}
            step="any"
          />
        </div>
        {/* Map toggle button and map component */}
      </FormField>
    )
  }
  ```

### 8.3 AuthFields 使用 FormField 包装

- [x] T8300 [P0] 🔴 创建 AuthFields 错误显示测试
  ```typescript
  // webui/src/features/records/components/fields/__tests__/AuthFields.errors.test.tsx
  describe('AuthFields error display', () => {
    it('should display email error from formErrors store', () => {
      // 设置 email 字段错误
      // 验证错误显示在 email 字段下方
    })
    
    it('should display password error from formErrors store', () => {
      // 设置 password 字段错误
      // 验证错误显示在 password 字段下方
    })
    
    it('should display passwordConfirm error from formErrors store', () => {
      // 设置 passwordConfirm 字段错误
      // 验证错误显示在 passwordConfirm 字段下方
    })
  })
  ```

- [x] T8301 [P0] 🟢 AuthFields email 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/AuthFields.tsx
  import { FormField } from '@/components/ui/FormField'
  
  // email 字段
  <FormField name="email" required={emailRequired}>
    <label htmlFor="email">
      <i className="ri-mail-line" />
      <span className="txt">email</span>
    </label>
    <Input
      id="email"
      type="email"
      value={formData.email || ''}
      onChange={(e) => handleChange('email', e.target.value)}
      required={emailRequired}
      autoFocus={isNew}
    />
    {!isSuperusers && (
      <Button variant="ghost" size="sm" onClick={toggleEmailVisibility}>
        Public: {formData.emailVisibility ? 'On' : 'Off'}
      </Button>
    )}
  </FormField>
  ```

- [x] T8302 [P0] 🟢 AuthFields password/passwordConfirm 使用 FormField 包装
  ```tsx
  // webui/src/features/records/components/fields/AuthFields.tsx
  
  // password 字段
  <FormField name="password" required={isNew}>
    <label htmlFor="password">
      <i className="ri-lock-password-line" />
      <span className="txt">password</span>
    </label>
    <div className="flex gap-2">
      <Input
        id="password"
        type="password"
        value={formData.password || ''}
        onChange={(e) => handleChange('password', e.target.value)}
        required={isNew}
        autoComplete="new-password"
      />
      <SecretGeneratorButton onGenerate={(pwd) => handleChange('password', pwd)} />
    </div>
  </FormField>
  
  // passwordConfirm 字段
  <FormField name="passwordConfirm" required={isNew}>
    <label htmlFor="passwordConfirm">
      <i className="ri-lock-password-line" />
      <span className="txt">passwordConfirm</span>
    </label>
    <Input
      id="passwordConfirm"
      type="password"
      value={formData.passwordConfirm || ''}
      onChange={(e) => handleChange('passwordConfirm', e.target.value)}
      required={isNew}
      autoComplete="new-password"
    />
  </FormField>
  ```

### 8.4 JSON 字段校验状态图标

- [x] T8400 [P1] 🔴 创建 JsonField 校验状态图标测试
  ```typescript
  // webui/src/features/records/components/fields/__tests__/JsonField.validation.test.tsx
  describe('JsonField validation status', () => {
    it('should show valid icon when JSON is valid', () => {
      render(<JsonField field={field} value='{"key": "value"}' onChange={() => {}} />)
      expect(screen.getByLabelText('Valid JSON')).toBeInTheDocument()
    })
    
    it('should show invalid icon when JSON is invalid', () => {
      render(<JsonField field={field} value='{invalid}' onChange={() => {}} />)
      expect(screen.getByLabelText('Invalid JSON')).toBeInTheDocument()
    })
    
    it('should show no icon when field is empty', () => {
      render(<JsonField field={field} value='' onChange={() => {}} />)
      expect(screen.queryByLabelText(/json/i)).not.toBeInTheDocument()
    })
  })
  ```

- [x] T8401 [P1] 🟢 JsonField 添加校验状态图标
  ```tsx
  // webui/src/features/records/components/fields/JsonField.tsx
  import { Check, X } from 'lucide-react'
  
  export const JsonField = ({ field, value, onChange }) => {
    const [isValid, setIsValid] = useState<boolean | null>(null)
    
    // 校验 JSON 有效性
    useEffect(() => {
      if (!value || value.trim() === '') {
        setIsValid(null)
        return
      }
      
      try {
        JSON.parse(value)
        setIsValid(true)
      } catch {
        setIsValid(false)
      }
    }, [value])
    
    return (
      <FormField name={field.name} required={field.required}>
        <FieldLabel field={field}>
          {/* 校验状态图标 */}
          {isValid === true && (
            <span className="label label-sm label-success ml-1" aria-label="Valid JSON">
              <Check className="h-3 w-3" />
            </span>
          )}
          {isValid === false && (
            <span className="label label-sm label-danger ml-1" aria-label="Invalid JSON">
              <X className="h-3 w-3" />
            </span>
          )}
        </FieldLabel>
        <CodeEditor
          language="json"
          value={value || ''}
          onChange={onChange}
          maxHeight={500}
        />
      </FormField>
    )
  }
  ```

### 8.5 ID 字段 minlength/maxlength 校验

- [ ] T8500 [P1] 🔴 创建 ID 字段长度校验测试
  ```typescript
  // webui/src/features/records/components/__tests__/UpsertPanel.idField.test.tsx
  describe('ID field validation', () => {
    it('should set minlength/maxlength from idField config', () => {
      const collection = {
        id: 'test',
        fields: [
          { name: 'id', type: 'text', min: 5, max: 15 },
        ],
      }
      
      render(<UpsertPanel collection={collection} open={true} />)
      
      const idInput = screen.getByLabelText('id')
      expect(idInput).toHaveAttribute('minLength', '5')
      expect(idInput).toHaveAttribute('maxLength', '15')
    })
    
    it('should show autogenerate hint when idField has autogeneratePattern', () => {
      const collection = {
        id: 'test',
        fields: [
          { name: 'id', type: 'text', autogeneratePattern: '[a-z0-9]{15}' },
        ],
      }
      
      render(<UpsertPanel collection={collection} open={true} isNew={true} />)
      
      const idInput = screen.getByLabelText('id')
      expect(idInput).toHaveAttribute('placeholder', 'Leave empty to auto generate...')
    })
  })
  ```

- [x] T8501 [P1] 🟢 UpsertPanel ID 字段添加 minlength/maxlength
  ```tsx
  // webui/src/features/records/components/UpsertPanel.tsx
  
  // 获取 idField 配置
  const idField = useMemo(() => {
    return collection?.fields?.find((f) => f.name === 'id')
  }, [collection?.fields])
  
  // ID 字段渲染
  <FormField name="id">
    <label htmlFor="id">
      <i className="ri-key-line" />
      <span className="txt">id</span>
    </label>
    <Input
      id="id"
      type="text"
      value={formData.id || ''}
      onChange={(e) => handleFieldChange('id', e.target.value)}
      readOnly={!isNew}
      disabled={!isNew}
      placeholder={
        isNew && idField?.autogeneratePattern
          ? 'Leave empty to auto generate...'
          : undefined
      }
      minLength={idField?.min}
      maxLength={idField?.max}
    />
  </FormField>
  ```

---

## Phase 8 总结

### 核心修改清单

1. **UpsertPanel.tsx** - 集成 formErrors store，处理服务端错误
2. **所有字段组件** - 使用 FormField 包装，确保错误能显示
3. **AuthFields.tsx** - email/password/passwordConfirm 使用 FormField 包装
4. **NumberField.tsx** - 添加 min/max/step 属性
5. **GeoPointField.tsx** - 添加经纬度 min/max 属性
6. **JsonField.tsx** - 添加校验状态图标
7. **ID 字段** - 添加 minlength/maxlength 属性

### 测试覆盖要求

| 测试文件 | 测试内容 |
|----------|----------|
| UpsertPanel.serverErrors.test.tsx | 服务端错误显示、清除、多字段错误 |
| FormFieldWrapper.test.tsx | 各字段组件错误显示 |
| AuthFields.errors.test.tsx | Auth 字段错误显示 |
| JsonField.validation.test.tsx | JSON 校验状态图标 |
| UpsertPanel.idField.test.tsx | ID 字段长度校验 |

### 与 UI 版本对齐检查点

- [ ] 服务端返回 400 + 字段错误时，错误显示在对应字段下方
- [ ] 用户输入时自动清除对应字段的错误
- [ ] 重新打开面板时清除所有错误
- [ ] NumberField 有 min/max/step 属性
- [ ] GeoPointField 有经纬度范围限制
- [ ] JsonField 有校验状态图标
- [ ] ID 字段有 minlength/maxlength 属性

---

## Phase 9: spec.md 遗漏细节补充 (2026-02-09 Review 补充)

**Purpose**: 补充 spec.md 中提到但 tasks.md 遗漏的细节

### 9.1 SecretGeneratorButton 完整实现

- [x] T9100 [P0] 🔴 创建 SecretGeneratorButton 测试
  ```typescript
  // webui/src/components/base/__tests__/SecretGeneratorButton.test.tsx
  describe('SecretGeneratorButton', () => {
    it('should generate random password when clicked', () => {
      const onGenerate = vi.fn()
      render(<SecretGeneratorButton onGenerate={onGenerate} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(onGenerate).toHaveBeenCalledWith(expect.any(String))
      expect(onGenerate.mock.calls[0][0].length).toBeGreaterThanOrEqual(12)
    })
    
    it('should generate password with special characters', () => {
      const onGenerate = vi.fn()
      render(<SecretGeneratorButton onGenerate={onGenerate} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      const password = onGenerate.mock.calls[0][0]
      // 应包含特殊字符
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true)
    })
  })
  ```

- [x] T9101 [P0] 🟢 实现 SecretGeneratorButton 组件
  ```tsx
  // webui/src/components/base/SecretGeneratorButton.tsx
  import { Button } from '@/components/ui/button'
  import { RefreshCw } from 'lucide-react'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

  interface SecretGeneratorButtonProps {
    onGenerate: (password: string) => void
    length?: number
  }

  const CHARS = {
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    numbers: '0123456789',
    special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  }

  function generatePassword(length: number = 16): string {
    const allChars = CHARS.lowercase + CHARS.uppercase + CHARS.numbers + CHARS.special
    let password = ''
    
    // 确保至少包含每种字符
    password += CHARS.lowercase[Math.floor(Math.random() * CHARS.lowercase.length)]
    password += CHARS.uppercase[Math.floor(Math.random() * CHARS.uppercase.length)]
    password += CHARS.numbers[Math.floor(Math.random() * CHARS.numbers.length)]
    password += CHARS.special[Math.floor(Math.random() * CHARS.special.length)]
    
    // 填充剩余长度
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    // 打乱顺序
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  export function SecretGeneratorButton({ 
    onGenerate, 
    length = 16 
  }: SecretGeneratorButtonProps) {
    const handleClick = () => {
      onGenerate(generatePassword(length))
    }
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClick}
            className="shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Generate random password
        </TooltipContent>
      </Tooltip>
    )
  }
  ```

### 9.2 字段跳过规则完整实现

- [x] T9200 [P0] 🔴 创建字段跳过规则测试
  ```typescript
  // webui/src/features/records/utils/__tests__/fieldSkipRules.test.ts
  import { getSkipFieldNames, filterRegularFields } from '../fieldSkipRules'
  
  describe('fieldSkipRules', () => {
    it('Base Collection should skip only id field', () => {
      const skipNames = getSkipFieldNames(false)
      expect(skipNames).toEqual(['id'])
    })
    
    it('Auth Collection should skip auth-related fields', () => {
      const skipNames = getSkipFieldNames(true)
      expect(skipNames).toContain('id')
      expect(skipNames).toContain('email')
      expect(skipNames).toContain('emailVisibility')
      expect(skipNames).toContain('verified')
      expect(skipNames).toContain('tokenKey')
      expect(skipNames).toContain('password')
    })
    
    it('should filter out autodate fields', () => {
      const fields = [
        { name: 'title', type: 'text' },
        { name: 'created', type: 'autodate' },
        { name: 'updated', type: 'autodate' },
      ]
      const result = filterRegularFields(fields, false)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('title')
    })
  })
  ```

- [x] T9201 [P0] 🟢 实现字段跳过规则工具函数
  ```typescript
  // webui/src/features/records/utils/fieldSkipRules.ts
  import type { CollectionField } from 'pocketbase'

  // 基础跳过字段
  const BASE_SKIP_FIELD_NAMES = ['id']

  // Auth Collection 额外跳过字段 (由 AuthFields 处理)
  const AUTH_SKIP_FIELD_NAMES = [
    ...BASE_SKIP_FIELD_NAMES,
    'email',
    'emailVisibility',
    'verified',
    'tokenKey',
    'password',
  ]

  /**
   * 获取需要跳过的字段名列表
   */
  export function getSkipFieldNames(isAuthCollection: boolean): string[] {
    return isAuthCollection ? AUTH_SKIP_FIELD_NAMES : BASE_SKIP_FIELD_NAMES
  }

  /**
   * 过滤出常规字段（排除跳过字段和 autodate 字段）
   */
  export function filterRegularFields(
    fields: CollectionField[] | undefined,
    isAuthCollection: boolean
  ): CollectionField[] {
    const skipFieldNames = getSkipFieldNames(isAuthCollection)
    
    return (fields || []).filter(
      f => !skipFieldNames.includes(f.name) && f.type !== 'autodate'
    )
  }
  ```

### 9.3 SelectField toggle 属性支持

- [x] T9300 [P1] 🔴 创建 SelectField toggle 测试
  ```typescript
  // webui/src/features/records/components/fields/__tests__/SelectField.toggle.test.tsx
  describe('SelectField toggle', () => {
    it('single select + required should NOT allow deselect (no toggle)', () => {
      const field = { name: 'status', type: 'select', required: true, maxSelect: 1 }
      render(<SelectField field={field} value="active" onChange={onChange} />)
      
      // 不应该有清除按钮
      expect(screen.queryByText('Clear')).not.toBeInTheDocument()
    })
    
    it('single select + not required should allow deselect (has toggle)', () => {
      const field = { name: 'status', type: 'select', required: false, maxSelect: 1 }
      render(<SelectField field={field} value="active" onChange={onChange} />)
      
      // 应该有清除选项
      expect(screen.getByText('-- Clear --')).toBeInTheDocument()
    })
    
    it('multi select should always allow deselect (has toggle)', () => {
      const field = { name: 'tags', type: 'select', required: true, maxSelect: 3 }
      render(<SelectField field={field} value={['tag1']} onChange={onChange} />)
      
      // 多选总是可以取消选择
    })
  })
  ```

- [x] T9301 [P1] 🟢 SelectField 添加 toggle 支持
  ```tsx
  // 在 SelectField 中
  // toggle = !required || isMultiple
  // 表示是否允许取消选择/清空
  const allowToggle = !field.required || isMultiple
  
  // 单选时
  {allowToggle && (
    <SelectItem value="">-- Clear --</SelectItem>
  )}
  ```

### 9.4 EditorField 完整 TinyMCE 配置

- [x] T9400 [P1] 🟢 EditorField 补充完整 TinyMCE 配置
  ```tsx
  // webui/src/features/records/components/fields/EditorField.tsx
  const editorConfig = useMemo(() => ({
    // 基础配置
    height: 300,
    menubar: false,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
    ],
    toolbar: 'undo redo | blocks | ' +
      'bold italic forecolor | alignleft aligncenter ' +
      'alignright alignjustify | bullist numlist outdent indent | ' +
      'removeformat | image link | help',
    
    // 重要：URL 转换配置
    convert_urls: field.convertURLs ?? false,  // 从字段配置获取
    relative_urls: false,  // 始终使用绝对 URL
    remove_script_host: false,
    
    // 图片选择器回调
    file_picker_callback: (callback, value, meta) => {
      if (meta.filetype === 'image') {
        // 打开 RecordFilePicker
        recordFilePickerRef.current?.show((selection) => {
          callback(selection.url, { alt: selection.name })
        })
      }
    },
  }), [field.convertURLs])
  ```

### 9.5 并发编辑策略说明

- [x] T9500 [P2] 📝 文档：并发编辑策略说明
  ```markdown
  ## 并发编辑策略
  
  当前实现采用 **Last Write Wins** 策略：
  - 如果两个用户同时编辑同一条记录
  - 后保存的用户会覆盖先保存的用户的修改
  - 不需要实现：乐观锁、版本控制、冲突提示
  
  这与 UI 版本保持一致，是有意为之的设计决策。
  ```

### 9.6 Flatpickr locale 完整配置

- [x] T9600 [P1] 🟢 DateField 补充 locale 配置
  ```tsx
  // webui/src/features/records/components/fields/DateField.tsx
  const flatpickrOptions = {
    dateFormat: 'Y-m-d H:i:S',
    enableTime: true,
    enableSeconds: true,
    time_24hr: true,
    allowInput: true,
    disableMobile: true,  // 强制使用自定义 picker，不使用移动端原生
    locale: {
      firstDayOfWeek: 1,  // 周一为一周第一天
    },
  }
  ```

### 9.7 Loading 状态完整实现

- [x] T9700 [P0] 🟢 面板 Header Loading 状态
  ```tsx
  // 在 UpsertPanel header 中
  // 加载中时在标题前显示 spinner
  <h4>
    {isLoading && (
      <span className="loader loader-sm mr-2" />
    )}
    <span className="txt">
      {isNew ? 'New' : 'Edit'} {collection?.name} record
    </span>
  </h4>
  ```

### 9.8 canSave 逻辑完整实现

- [x] T9800 [P0] 🔴 创建 canSave 逻辑测试
  ```typescript
  // webui/src/features/records/hooks/__tests__/useCanSave.test.ts
  describe('useCanSave', () => {
    it('should return false when loading', () => {
      // isLoading = true -> canSave = false
    })
    
    it('should return false when saving', () => {
      // isSaving = true -> canSave = false
    })
    
    it('should return false when no changes in edit mode', () => {
      // !isNew && !hasChanges -> canSave = false
    })
    
    it('should return true for new record even without changes', () => {
      // isNew -> canSave = true (可以创建空记录)
    })
  })
  ```

- [x] T9801 [P0] 🟢 实现 canSave 逻辑
  ```typescript
  // 在 UpsertPanel 中
  const canSave = useMemo(() => {
    if (isLoading || isSaving) return false
    if (!isNew && !hasChanges) return false
    return true
  }, [isLoading, isSaving, isNew, hasChanges])
  ```

---

## Phase 9 总结

### 核心补充点

1. **SecretGeneratorButton** - 密码生成组件
2. **字段跳过规则** - Auth Collection 特殊字段处理
3. **SelectField toggle** - 清空选择功能
4. **EditorField TinyMCE** - relative_urls 和 file_picker_callback
5. **Loading 状态** - Header spinner
6. **canSave 逻辑** - 保存按钮禁用条件

### 测试覆盖

| 测试文件 | 测试内容 |
|----------|----------|
| SecretGeneratorButton.test.tsx | 密码生成功能 |
| fieldSkipRules.test.ts | 字段跳过规则 |
| SelectField.toggle.test.tsx | 清空选择功能 |
| useCanSave.test.ts | 保存按钮禁用条件 |

---

## 完整验收检查清单（更新后）

### 功能完整性

- [ ] 所有 15+1 种字段类型正确渲染和交互（含 secret）
- [ ] Auth Collection 特殊字段正确处理
- [ ] 草稿自动保存和恢复功能
- [ ] 未保存变更确认弹窗
- [ ] Ctrl+S 快捷保存
- [ ] 编辑模式更多操作菜单
- [ ] Tab 切换 (Auth Collection)
- [ ] Save and continue 功能
- [ ] 复制/删除记录功能
- [ ] 发送验证/密码重置邮件
- [ ] **密码生成按钮** ✨ 新增
- [ ] **View Collection 限制** ✨ 新增
- [ ] **表单校验错误显示** ✨ 新增

### UI 一致性

- [ ] 字段图标与 UI 版本一致
- [ ] 字段布局与 UI 版本一致
- [ ] 按钮样式与 UI 版本一致
- [ ] 加载状态与 UI 版本一致（Header spinner）
- [ ] 错误提示与 UI 版本一致（字段下方红色文字）
- [ ] **Hidden 字段标签显示** ✨ 新增
- [ ] **SelectField 清空选项** ✨ 新增

### 测试覆盖

- [ ] 单元测试覆盖率 >= 80%
- [ ] 核心场景集成测试通过
- [ ] 无 TypeScript 类型错误
- [ ] 无 ESLint 错误
