# Implementation Tasks: WebUI New Collection 功能 1:1 对齐



**Branch**: `022-webui-new-collection-alignment` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)



## Task Legend



- `[P]` = Parallelizable with other `[P]` tasks in same phase

- `[US#]` = Implements User Story #

- Priority: Tasks ordered by dependency, not priority

- 🔴 = 红灯（写测试

- 🟢 = 绿灯（实现代码）

- ♻️ = 重构



---



## Phase 0: Scaffolds API 从 Auth 默认字段 (Priority: P0 Critical)



**Purpose**: 实现 Scaffolds API 集成，确保 Auth 类型 Collection 创建时包含正确的系统字段



**⚠️ CRITICAL**: 这是架构级别的差异，必须优先修复。当前 WebUI 创建 Auth 类型时字段列表为空）



### 0.0 Scaffolds API 集成



- [x] T0000 [P] 🔴 创建 `scaffolds.test.ts` 测试 Scaffolds API 调用 ?

  ```typescript

  // 测试用例：?

  // - 应该能调用 getScaffolds() 获取默认模板

  // - scaffold 应包含 base/auth/view 三种类型

  // - auth scaffold 应包含 id/password/tokenKey/email/emailVisibility/verified 字段

  // - auth scaffold 应包含 tokenKey 和 email 的唯一索引

  ```



- [x] T0001 [P] 🟢 创建 `useScaffolds` hook 获取 scaffolds ?

  ```typescript

  // webui/src/features/collections/hooks/useScaffolds.ts

  import { useQuery } from '@tanstack/react-query'

  import { pb } from '@/lib/pocketbase'

  

  export interface Scaffold {

    name: string

    type: 'base' | 'auth' | 'view'

    fields: any[]

    indexes: string[]

    // Auth 特有选项

    passwordAuth?: { enabled: boolean; identityFields: string[] }

    oauth2?: { enabled: boolean; providers: any[] }

    // ...其他选项

  }

  

  export function useScaffolds() {

    return useQuery({

      queryKey: ['scaffolds'],

      queryFn: async () => {

        const scaffolds = await pb.collections.getScaffolds()

        return scaffolds as Record<string, Scaffold>

      },

      staleTime: Infinity,  // scaffolds 不会变化，可以永久缓存

    })

  }

  ```



- [x] T0002 [P] 🟢 修改 `UpsertPanel.tsx` 使用 scaffolds 初始化 ✅

  ```typescript

  const { data: scaffolds } = useScaffolds()

  

  // 新建模式：从 scaffold 初始化

  useEffect(() => {

    if (!isEdit && scaffolds) {

      const scaffold = scaffolds[formData.type] || scaffolds['base']

      setFormData(prev => ({

        ...prev,

        fields: [...scaffold.fields],

        indexes: [...scaffold.indexes],

        // Auth 特有选项

        ...(scaffold.type === 'auth' && {

          passwordAuth: scaffold.passwordAuth,

          oauth2: scaffold.oauth2,

          // ...

        }),

      }))

    }

  }, [scaffolds, formData.type, isEdit])

  ```



- [x] T0003 [P] 🟢 实现类型切换时的字段合并逻辑 ?

  ```typescript

  // 在类型切换时保留非系统字段，合并新类型的系统字段

  const handleTypeChange = (newType: string) => {

    if (!scaffolds) return

    

    const newScaffold = scaffolds[newType]

    const oldFields = formData.fields || []

    const nonSystemFields = oldFields.filter(f => !f.system)

    

    // 使用新scaffold 的字段

    let newFields = [...newScaffold.fields]

    

    // 合并已有系统字段的自定义配置

    for (const oldField of oldFields) {

      if (!oldField.system) continue

      const idx = newFields.findIndex(f => f.name === oldField.name)

      if (idx >= 0) {

        newFields[idx] = { ...newFields[idx], ...oldField }

      }

    }

    

    // 追加非系统字段

    newFields = [...newFields, ...nonSystemFields]

    

    // 合并索引

    let newIndexes = [...(formData.indexes || [])]

    // 移除旧类型的默认索引

    const oldScaffold = scaffolds[formData.type]

    if (oldScaffold) {

      newIndexes = newIndexes.filter(idx => 

        !oldScaffold.indexes.some(si => 

          parseIndexName(idx) === parseIndexName(si)

        )

      )

    }

    // 添加新类型的默认索引

    for (const idx of newScaffold.indexes) {

      if (!newIndexes.some(i => parseIndexName(i) === parseIndexName(idx))) {

        newIndexes.push(idx)

      }

    }

    

    setFormData(prev => ({

      ...prev,

      type: newType,

      fields: newFields,

      indexes: newIndexes,

    }))

  }

  ```



- [x] T0004 [P] 🟢 添加 autodate 字段（created/updated??

  ```typescript

  // 在新建模式初始化后自动添加autodate 字段

  useEffect(() => {

    if (!isEdit && scaffolds && formData.fields.length > 0) {

      // 检查是否已有created/updated 字段

      const hasCreated = formData.fields.some(f => f.name === 'created')

      const hasUpdated = formData.fields.some(f => f.name === 'updated')

      

      if (!hasCreated || !hasUpdated) {

        const autodateFields = []

        if (!hasCreated) {

          autodateFields.push({ type: 'autodate', name: 'created', onCreate: true })

        }

        if (!hasUpdated) {

          autodateFields.push({ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true })

        }

        setFormData(prev => ({

          ...prev,

          fields: [...prev.fields, ...autodateFields],

        }))

      }

    }

  }, [isEdit, scaffolds, formData.fields.length])

  ```



**Checkpoint**: Scaffolds API 集成完成，Auth 类型创建时显示正确的系统字段 ?



---



### 0.1 View Collection Tab 架构修复 (Priority: P0 Critical)



**Purpose**: 修复 View Collection  Tab 架构差异，确保与 UI (Svelte) 版本行为一致



**⚠️ CRITICAL**: 这是架构级别的差异，必须优先修复



#### View Collection Tab 切换



- [x] T000a [P] 🔴 创建 `UpsertPanel.view.test.tsx` 测试 View Collection 行为 ?

  ```typescript

  // 测试用例：?

  // - View Collection 时应该显示 CollectionQueryTab 而非 CollectionFieldsTab

  // - View Collection  Tab 名称应该显示 "Query"

  // - View Collection 时不应该显示字段列表

  // - View Collection 时不应该显示索引管理

  // - 切换类型View 时应该自动清空indexes 和规则

  ```



- [x] T000b [P] 🟢 ?`UpsertPanel.tsx` 中导入并使用 `CollectionQueryTab` ?

  ```typescript

  import { CollectionQueryTab } from './CollectionQueryTab'

  

  // Tab 内容切换

  {activeTab === TAB_SCHEMA && (

    isViewCollection ? (

      <CollectionQueryTab

        collection={{

          ...formData,

          viewQuery: formData.viewQuery || '',

        } as any}

        onChange={(viewQuery) => setFormData(prev => ({ ...prev, viewQuery }))}

        errors={errors}

      />

    ) : (

      <CollectionFieldsTab ... />

    )

  )}

  ```



- [x] T000c 🟢 添加 View Collection 自动清空逻辑 ?

  ```typescript

  // ?UpsertPanel.tsx 中添加useEffect

  useEffect(() => {

    if (formData.type === 'view') {

      setFormData(prev => ({

        ...prev,

        createRule: null,

        updateRule: null,

        deleteRule: null,

        indexes: [],

      }))

    }

  }, [formData.type])

  ```



- [x] T000d ♻️ 确保 `CollectionQueryTab` 组件支持所需 props ?

  - 验证 `viewQuery` 字段正确传递

  - 验证 `errors` 字段正确传递

  - 验证 `onChange` 回调正确工作



**Checkpoint**: View Collection 行为?UI 版本对齐 ?



---



### 0.2 字段选项面板默认状态修复(Priority: P0 High)



**Purpose**: 修复新建字段时选项面板默认展开的问题，确保 UI 版本行为一致



| 特征| UI (Svelte) | WebUI (React) | 目标 |

|------|-------------|---------------|------|

| 新建字段默认状态| ?关闭，只选中名称 | ?展开选项面板 | 🎯 默认关闭 |



- [x] T000e [P] 🔴 创建 `CollectionFieldsTab.newField.test.tsx` 测试新建字段行为 ?

  ```typescript

  // 测试用例：?

  // - 新建字段时选项面板应该默认关闭

  // - 新建字段时名称输入框应该被聚焦并选中

  // - 点击设置按钮时选项面板应该展开

  // - 一次只能展开一个字段的选项面板（排他展开）

  ```



- [x] T000f 🟢 修改 `CollectionFieldsTab.tsx` 中的 `addField` 函数 ?

  ```typescript

  const addField = useCallback(

    (type: string = 'text') => {

      const newField: SchemaField = {

        name: getUniqueName('field'),

        type,

        required: false,

        options: {},

        _focusNameOnMount: true, // 标记需要聚焦名称输入框

      }

      // ...

      onChange({ ...collection, fields: newFields })

      // 移除自动展开: setExpandedField(newField.name)

    },

    [collection, onChange, getUniqueName]

  )

  ```



- [x] T000g 🟢 修改 `SchemaFieldEditor.tsx` 添加挂载时聚焦逻辑 ?

  ```typescript

  // 添加 ref

  const nameInputRef = useRef<HTMLInputElement>(null)

  

  // 添加 useEffect

  useEffect(() => {

    if (field._focusNameOnMount && nameInputRef.current) {

      nameInputRef.current.select()

      onUpdate({ _focusNameOnMount: false })

    }

  }, [field._focusNameOnMount])

  

  // ?Input 上添加ref

  <Input ref={nameInputRef} ... />

  ```



- [x] T000h ♻️ 更新 `SchemaField` 类型定义 ?

  ```typescript

  // ?CollectionFieldsTab.tsx ?

  export interface SchemaField {

    // ...existing fields

    _focusNameOnMount?: boolean  // 新增：挂载时聚焦名称输入框 ✅

  }

  ```



**Checkpoint**: 新建字段行为?UI 版本对齐 ?



---



### 0.3 索引编辑面板样式对齐 (Priority: P1 Medium)



**Purpose**: 修复索引编辑面板 (IndexUpsertPanel) 的样式差异，确保 UI 版本一致



| 特征| UI (Svelte) | WebUI (React) | 目标 |

|------|-------------|---------------|------|

| 弹窗标题 | "Create index" (小写) | "Create Index" (大写) | 🎯 小写 |

| Unique 控件 | Toggle 样式 | Checkbox 样式 | 🎯 Toggle |

| Index Definition 标签 | 无标签| 有标签| 🎯 移除标签 |

| Presets 布局 | 单行 `inline-flex gap-10` | `flex-wrap gap-2` | 🎯 单行布局 |

| Presets 样式 | `label link-primary` 链接样式 | Badge 组件 | 🎯 链接样式 |

| 按钮文案 | "Set index" (小写) | "Set Index" (大写) | 🎯 小写 |



- [x] T000i 🟢 修改 `IndexUpsertPanel.tsx` 弹窗标题和按钮文案 ✅

  ```typescript

  // DialogTitle 改为小写

  <DialogTitle>{isEdit ? 'Update' : 'Create'} index</DialogTitle>

  

  // 按钮文案改为小写

  <Button>Set index</Button>

  ```



- [x] T000j 🟢 移除 "Index Definition" 标签 ?

  ```typescript

  // 移除这行

  // <Label>Index Definition</Label>

  

  // 直接显示 CodeEditor

  <CodeEditor ... />

  ```



- [x] T000k 🟢 修改 Presets 布局为单行链接样式 ✅

  ```typescript

  // 替换 Badge 为链接按钮

  <div className="inline-flex items-center gap-10">

    <span className="text-muted-foreground text-sm">Presets</span>

    {presetColumns.map((column) => (

      <button

        key={column}

        type="button"

        className={cn(

          "text-sm text-primary hover:underline",

          selectedColumns.includes(column.toLowerCase()) && 

            "bg-blue-50 text-blue-600 px-2 py-0.5 rounded"

        )}

        onClick={() => toggleColumn(column)}

      >

        {column}

      </button>

    ))}

  </div>

  ```



- [x] T000l 🟡 （可选）?Checkbox 改为 Toggle 样式 ?

  ```typescript

  // 使用 Switch 组件替代 Checkbox

  import { Switch } from '@/components/ui/switch'

  

  <div className="flex items-center space-x-2">

    <Switch

      id="index-unique"

      checked={indexParts.unique}

      onCheckedChange={toggleUnique}

    />

    <Label htmlFor="index-unique" className="cursor-pointer">

      Unique

    </Label>

  </div>

  ```



- [x] T000m 🟢 新建索引时也显示删除按钮 ?

  ```typescript

  // IndexUpsertPanel.tsx

  // 修改删除按钮的显示条?

  // 原来：{isEdit && onRemove && (...)}

  // 修改为：始终显示删除按钮（与 UI 版本一致）

  

  <DialogFooter className="flex justify-between">

    <div>

      {onRemove && (

        <Button type="button" variant="ghost" size="icon" onClick={handleRemove}>

          <Trash2 className="h-4 w-4 text-destructive" />

        </Button>

      )}

    </div>

    {/* ... */}

  </DialogFooter>

  

  // 或者：修改 handleRemove 逻辑

  const handleRemove = () => {

    if (onRemove) {

      // 如果是编辑模式，删除原始索引

      if (originalIndex) {

        onRemove(originalIndex)

      }

      // 无论如何关闭面板（相当于取消?

      onOpenChange(false)

    }

  }

  ```



**Checkpoint**: 索引编辑面板样式UI 版本对齐 ?



---



### 0.4 表单验证系统 (Priority: P0 Critical)



**Purpose**: 实现完整的表单验证错误处理系统，?UI (Svelte) 版本对齐



**⚠️ CRITICAL**: 这是用户体验的关键，没有错误提示用户无法知道提交失败的原?



#### UI (Svelte) 版本架构



```javascript

// ui/src/stores/errors.js

export const errors = writable({})



export function setErrors(errs) {

    errors.set(errs || {})

}



// 支持嵌套路径"fields.0.name", "indexes.0.message"

export function getNestedVal(data, path) {

    return path.split('.').reduce((obj, key) => obj?.[key], data)

}

```



#### 需要实现的组件



| 组件 | 功能 | 参考：UI 版本 |

|------|------|-------------|

| `formErrorsAtom` | 全局错误状态| `ui/src/stores/errors.js` |

| `FormField` 组件 | 带错误显示的表单字段 | `ui/src/components/base/Field.svelte` |

| `useFormErrors` hook | 获取/设置错误 | `errors` store 方法 |

| Tab 错误指示器| Tab 上显示红点 | `CollectionUpsertPanel.svelte` |



---



- [x] T000n 🔴 创建 `formErrors.test.ts` 测试错误管理 ?

  ```typescript

  // 测试用例：?

  describe('formErrors', () => {

    it('should store flat errors', () => {})

    it('should store nested errors like fields.0.name', () => {})

    it('should get nested error by path', () => {})

    it('should clear errors', () => {})

    it('should remove single error by path', () => {})

  })

  ```



- [x] T000o 🟢 实现 `webui/src/store/formErrors.ts` ?

  ```typescript

  import { atom } from 'jotai'

  

  // 全局表单错误状态

  export const formErrorsAtom = atom<Record<string, any>>({})

  

  // 设置所有错误

  export const setFormErrorsAtom = atom(

    null,

    (get, set, errors: Record<string, any>) => {

      set(formErrorsAtom, errors || {})

    }

  )

  

  // 清除所有错误

  export const clearFormErrorsAtom = atom(

    null,

    (get, set) => {

      set(formErrorsAtom, {})

    }

  )

  

  // 移除单个错误

  export const removeFormErrorAtom = atom(

    null,

    (get, set, path: string) => {

      const errors = { ...get(formErrorsAtom) }

      // 递归删除嵌套路径

      const keys = path.split('.')

      let current: any = errors

      for (let i = 0; i < keys.length - 1; i++) {

        if (current[keys[i]] === undefined) return

        current = current[keys[i]]

      }

      delete current[keys[keys.length - 1]]

      set(formErrorsAtom, errors)

    }

  )

  

  // 获取嵌套错误

  export function getNestedError(errors: Record<string, any>, path: string): any {

    return path.split('.').reduce((obj, key) => obj?.[key], errors)

  }

  ```



- [x] T000p 🔴 创建 `FormField.test.tsx` 测试组件 ?

  ```typescript

  describe('FormField', () => {

    it('should render label and children', () => {})

    it('should show required indicator', () => {})

    it('should display error message when error exists', () => {})

    it('should apply error class when error exists', () => {})

    it('should clear error on input change', () => {})

  })

  ```



- [x] T000q 🟢 实现 `webui/src/components/ui/FormField.tsx` ?

  ```tsx

  import { useAtomValue, useSetAtom } from 'jotai'

  import { formErrorsAtom, removeFormErrorAtom, getNestedError } from '@/store/formErrors'

  

  interface FormFieldProps {

    name: string

    label?: string

    required?: boolean

    className?: string

    children: React.ReactNode

  }

  

  export function FormField({ 

    name, 

    label, 

    required, 

    className,

    children 

  }: FormFieldProps) {

    const errors = useAtomValue(formErrorsAtom)

    const removeError = useSetAtom(removeFormErrorAtom)

    const fieldError = getNestedError(errors, name)

    

    // 清除错误的包装器

    const childrenWithErrorClear = React.Children.map(children, (child) => {

      if (React.isValidElement(child)) {

        const originalOnChange = (child.props as any).onChange

        return React.cloneElement(child as React.ReactElement<any>, {

          onChange: (e: any) => {

            removeError(name) // 输入时清除错误

            originalOnChange?.(e)

          },

          className: cn(

            (child.props as any).className,

            fieldError && 'border-destructive'

          )

        })

      }

      return child

    })

    

    return (

      <div className={cn('form-field space-y-1.5', fieldError && 'error', className)}>

        {label && (

          <label className="text-sm font-medium">

            {label}

            {required && <span className="text-destructive ml-0.5">*</span>}

          </label>

        )}

        {childrenWithErrorClear}

        {fieldError && (

          <p className="text-destructive text-sm">

            {fieldError.message || String(fieldError)}

          </p>

        )}

      </div>

    )

  }

  ```



- [x] T000r 🟢 修改 `useCollections.ts` 添加 API 错误映射 ?

  ```typescript

  import { useSetAtom } from 'jotai'

  import { setFormErrorsAtom, clearFormErrorsAtom } from '@/store/formErrors'

  

  export function useCollections() {

    const setFormErrors = useSetAtom(setFormErrorsAtom)

    const clearFormErrors = useSetAtom(clearFormErrorsAtom)

    

    const createCollection = useCallback(

      async (data: Partial<CollectionModel>) => {

        clearFormErrors() // 清除旧错误

        try {

          const result = await pb.collections.create(data)

          return result

        } catch (err: any) {

          // 映射字段级错误

          if (err?.data?.data) {

            setFormErrors(err.data.data)

          }

          throw err

        }

      },

      [clearFormErrors, setFormErrors]

    )

    

    const updateCollection = useCallback(

      async (id: string, data: Partial<CollectionModel>) => {

        clearFormErrors()

        try {

          const result = await pb.collections.update(id, data)

          return result

        } catch (err: any) {

          if (err?.data?.data) {

            setFormErrors(err.data.data)

          }

          throw err

        }

      },

      [clearFormErrors, setFormErrors]

    )

    

    return { createCollection, updateCollection, ... }

  }

  ```



- [x] T000s 🟢 修改 `UpsertPanel.tsx` 使用 FormField 组件 ?

  ```tsx

  import { FormField } from '@/components/ui/FormField'

  

  // Collection 名称输入

  <FormField name="name" label="Name" required>

    <Input

      value={formData.name || ''}

      placeholder='e.g. "posts"'

      onChange={(e) => {

        const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')

        setFormData((prev) => ({ ...prev, name: value }))

      }}

      required

    />

  </FormField>

  ```



- [x] T000t 🟢 修改 `SchemaFieldEditor.tsx` 添加字段名错误显示 ?

  ```tsx

  import { FormField } from '@/components/ui/FormField'

  

  // 字段名输入，错误路径"fields.{index}.name"

  <FormField name={`fields.${index}.name`}>

    <Input

      value={field.name}

      onChange={(e) => handleNameChange(e.target.value)}

      required

      disabled={isSystem}

    />

  </FormField>

  ```



- [x] T000u 🟢 实现 Tab 错误指示器?

  ```tsx

  // UpsertPanel.tsx 中的 Tab 组件

  import { useAtomValue } from 'jotai'

  import { formErrorsAtom } from '@/store/formErrors'

  

  function TabWithError({ value, label, errorPaths }: { 

    value: string

    label: string

    errorPaths: string[] // ?['fields', 'indexes']

  }) {

    const errors = useAtomValue(formErrorsAtom)

    const hasError = errorPaths.some(path => {

      const err = getNestedError(errors, path)

      return err && (Array.isArray(err) ? err.length > 0 : Object.keys(err).length > 0)

    })

    

    return (

      <TabsTrigger value={value} className="relative">

        {label}

        {hasError && (

          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />

        )}

      </TabsTrigger>

    )

  }

  

  // 使用

  <TabsList>

    <TabWithError value="fields" label="Fields" errorPaths={['fields', 'indexes']} />

    <TabWithError value="api-rules" label="API Rules" errorPaths={['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']} />

  </TabsList>

  ```



- [x] T000v 🟢 修改 `RuleField.tsx` 添加规则错误显示 ?

  ```tsx

  import { FormField } from '@/components/ui/FormField'

  

  // API 规则字段

  <FormField name={ruleName}>

    <CodeEditor

      value={value}

      onChange={onChange}

      disabled={disabled}

    />

  </FormField>

  ```



- [x] T000w 🟢 修改 `IndexesList.tsx` 添加索引错误显示 ?

  ```tsx

  // 索引列表项显示错误

  {indexes.map((index, i) => {

    const indexError = getNestedError(errors, `indexes.${i}`)

    return (

      <div key={i} className={cn('index-item', indexError && 'border-destructive')}>

        {/* ... */}

        {indexError?.message && (

          <p className="text-destructive text-sm">{indexError.message}</p>

        )}

      </div>

    )

  })}

  ```



**Checkpoint**: 表单验证系统完整实现 ?



---



### 0.5 未保存警告系统(Priority: P0 Critical)



**Purpose**: 实现关闭面板/复制时的未保存警告，防止用户意外丢失数据



**⚠️ CRITICAL**: 没有此功能，用户可能在不知情的情况下丢失编辑内容



#### UI (Svelte) 版本实现



```svelte

<!-- CollectionUpsertPanel.svelte -->

<OverlayPanel

    beforeHide={() => {

        if (hasChanges && confirmClose) {

            confirm("You have unsaved changes. Do you really want to close the panel?", () => {

                confirmClose = false;

                hide();

            });

            return false;  // 阻止关闭

        }

        return true;

    }}

>

```



---



- [x] T000x 🔴 创建 `hasChanges.test.ts` 测试变更检测试

  ```typescript

  describe('hasChanges', () => {

    it('should return false for identical objects', () => {})

    it('should return true when name changed', () => {})

    it('should return true when field added', () => {})

    it('should return true when field removed', () => {})

    it('should return true when index changed', () => {})

    it('should ignore _focusNameOnMount flag', () => {})

  })

  ```



- [x] T000y 🟢 实现 `webui/src/features/collections/hooks/useHasChanges.ts` ?

  ```typescript

  import { useMemo } from 'react'

  import { CollectionModel } from '@/types'

  

  // 清理临时属性用于比?

  function cleanForCompare(collection: CollectionModel): CollectionModel {

    const { _focusNameOnMount, ...rest } = collection as any

    return {

      ...rest,

      fields: rest.fields?.map(({ _focusNameOnMount: _, ...field }: any) => field)

    }

  }

  

  export function useHasChanges(

    original: CollectionModel | null,

    current: CollectionModel

  ): boolean {

    return useMemo(() => {

      if (!original) return false

      const cleanOriginal = cleanForCompare(original)

      const cleanCurrent = cleanForCompare(current)

      return JSON.stringify(cleanOriginal) !== JSON.stringify(cleanCurrent)

    }, [original, current])

  }

  ```



- [x] T000z 🔴 创建 `UpsertPanel.unsaved.test.tsx` 测试未保存警告 ✅

  ```typescript

  describe('UpsertPanel unsaved warning', () => {

    it('should show warning when closing with unsaved changes', () => {})

    it('should not show warning when no changes', () => {})

    it('should close after confirming discard', () => {})

    it('should stay open after canceling discard', () => {})

    it('should show warning when duplicating with unsaved changes', () => {})

  })

  ```



- [x] T0010 🟢 修改 `UpsertPanel.tsx` 添加未保存检测试

  ```tsx

  import { useHasChanges } from '../hooks/useHasChanges'

  import { useConfirmation } from '@/hooks/useConfirmation'

  

  export function UpsertPanel({

    collection: originalCollection,

    onClose,

    ...

  }: UpsertPanelProps) {

    const [formData, setFormData] = useState(...)

    const hasChanges = useHasChanges(originalCollection, formData)

    const { confirm } = useConfirmation()

    

    // 带确认的关闭函数

    const handleClose = useCallback(() => {

      if (hasChanges) {

        confirm({

          title: '未保存的更改',

          message: '您有未保存的更改。确定要关闭面板吗？',

          yesText: '关闭',

          noText: '取消',

          isDanger: true,

          onConfirm: onClose,

        })

      } else {

        onClose()

      }

    }, [hasChanges, confirm, onClose])

    

    // 遮罩层点?

    const handleBackdropClick = (e: React.MouseEvent) => {

      if (e.target === e.currentTarget) {

        handleClose() // 使用带确认的关闭

      }

    }

    

    // 复制时检测

    const handleDuplicate = useCallback(() => {

      if (hasChanges) {

        confirm({

          title: '未保存的更改',

          message: '您有未保存的更改。确定要丢弃并复制吗？,

          yesText: '丢弃并复制,

          noText: '取消',

          isDanger: true,

          onConfirm: () => {

            const clone = structuredClone(originalCollection)

            // ... duplicate logic

          },

        })

      } else {

        // ... duplicate logic

      }

    }, [hasChanges, confirm, originalCollection])

    

    return (

      <div onClick={handleBackdropClick}>

        {/* ... */}

        <button onClick={handleClose}>×</button>

        {/* ... */}

      </div>

    )

  }

  ```



**Checkpoint**: 未保存警告系统完整实现 ✅



---



### 0.6 更新确认弹窗增强 (Priority: P1 High)



**Purpose**: 完善更新确认弹窗，显示集合重命名、字段重命名等详细变?



---



- [x] T0011 🔴 创建 `CollectionUpdateConfirm.test.tsx` 测试变更检测试

  ```typescript

  describe('CollectionUpdateConfirm', () => {

    it('should detect collection rename', () => {})

    it('should detect field rename', () => {})

    it('should detect field deletion', () => {})

    it('should detect multi-to-single value change', () => {})

    it('should detect API rule changes', () => {})

    it('should detect OIDC host change', () => {})

    it('should show manual update warning', () => {})

  })

  ```



- [x] T0012 🟢 增强 `CollectionUpdateConfirm.tsx` 检测逻辑 ?

  ```tsx

  interface ChangeDetection {

    renamedCollection: { old: string; new: string } | null

    renamedFields: Array<{ old: string; new: string }>

    deletedFields: Array<{ name: string; type: string }>

    multiToSingleFields: Array<{ name: string }>

    changedRules: Array<{ name: string; old: string; new: string }>

    oidcHostChanged: boolean

  }

  

  function detectChanges(

    original: CollectionModel,

    updated: CollectionModel

  ): ChangeDetection {

    const detection: ChangeDetection = {

      renamedCollection: null,

      renamedFields: [],

      deletedFields: [],

      multiToSingleFields: [],

      changedRules: [],

      oidcHostChanged: false,

    }

    

    // 1. 集合重命名检测

    if (original.name !== updated.name) {

      detection.renamedCollection = { old: original.name, new: updated.name }

    }

    

    // 2. 字段重命名检测(通过 id 匹配)

    for (const newField of updated.fields) {

      const oldField = original.fields.find(f => f.id === newField.id)

      if (oldField && oldField.name !== newField.name) {

        detection.renamedFields.push({ old: oldField.name, new: newField.name })

      }

    }

    

    // 3. 字段删除检测

    for (const field of updated.fields) {

      if (field._toDelete) {

        detection.deletedFields.push({ name: field.name, type: field.type })

      }

    }

    

    // 4. 多值→单值转换检测

    for (const newField of updated.fields) {

      const oldField = original.fields.find(f => f.id === newField.id)

      if (oldField && 'maxSelect' in oldField && 'maxSelect' in newField) {

        if ((oldField.maxSelect || 0) > 1 && newField.maxSelect === 1) {

          detection.multiToSingleFields.push({ name: newField.name })

        }

      }

    }

    

    // 5. API 规则变更检测

    const ruleNames = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']

    for (const ruleName of ruleNames) {

      const oldRule = original[ruleName]

      const newRule = updated[ruleName]

      if (oldRule !== newRule) {

        detection.changedRules.push({

          name: ruleName.replace('Rule', ''),

          old: oldRule ?? 'Superusers only',

          new: newRule ?? 'Superusers only',

        })

      }

    }

    

    // 6. OIDC Host 变更检测

    if (updated.type === 'auth' && updated.oauth2?.providers) {

      for (const provider of updated.oauth2.providers) {

        if (provider.name === 'oidc') {

          const oldProvider = original.oauth2?.providers?.find(p => p.name === 'oidc')

          if (oldProvider?.authURL !== provider.authURL) {

            detection.oidcHostChanged = true

          }

        }

      }

    }

    

    return detection

  }

  ```



- [x] T0013 🟢 添加变更详情显示 UI ?

  ```tsx

  export function CollectionUpdateConfirm({

    original,

    updated,

    ...

  }: CollectionUpdateConfirmProps) {

    const changes = useMemo(() => detectChanges(original, updated), [original, updated])

    

    return (

      <DialogContent>

        <DialogTitle>确认集合更新</DialogTitle>

        

        {/* 警告提示 */}

        <Alert variant="warning">

          <AlertTriangle className="h-4 w-4" />

          <AlertDescription>

            如果集合变更涉及其他集合的规则、过滤器或视图查询，您需要手动更新它们！

          </AlertDescription>

        </Alert>

        

        {/* 集合重命名*/}

        {changes.renamedCollection && (

          <div className="text-sm">

            <span className="text-muted-foreground">重命名集合/span>

            <span className="line-through text-destructive ml-2">

              {changes.renamedCollection.old}

            </span>

            <span className="mx-2">?/span>

            <span className="font-medium">{changes.renamedCollection.new}</span>

          </div>

        )}

        

        {/* 字段重命名*/}

        {changes.renamedFields.length > 0 && (

          <div className="space-y-1">

            <span className="text-sm text-muted-foreground">重命名字段/span>

            {changes.renamedFields.map(({ old, new: newName }) => (

              <div key={old} className="text-sm">

                <span className="line-through text-destructive">{old}</span>

                <span className="mx-2">?/span>

                <span className="font-medium">{newName}</span>

              </div>

            ))}

          </div>

        )}

        

        {/* 多值→单值警告*/}

        {changes.multiToSingleFields.length > 0 && (

          <Alert variant="destructive">

            <AlertDescription>

              以下字段从多选转为单选，多余的数据将被丢弃：

              {changes.multiToSingleFields.map(f => f.name).join(', ')}

            </AlertDescription>

          </Alert>

        )}

        

        {/* OIDC Host 变更警告 */}

        {changes.oidcHostChanged && (

          <Alert variant="destructive">

            <AlertDescription>

              警告：OIDC 提供商的 Auth URL 已更改。这可能导致现有用户无法登录?

            </AlertDescription>

          </Alert>

        )}

        

        {/* 字段删除警告 */}

        {changes.deletedFields.length > 0 && (

          <Alert variant="destructive">

            <AlertDescription>

              <p className="font-bold">警告：以下字段将被删除！</p>

              <p>删除字段将永久删除所有相关数据，此操作不可撤销。/p>

              <ul className="mt-2 list-disc list-inside">

                {changes.deletedFields.map(f => (

                  <li key={f.name}>{f.name} ({f.type})</li>

                ))}

              </ul>

            </AlertDescription>

          </Alert>

        )}

        

        {/* API 规则变更 */}

        {changes.changedRules.length > 0 && (

          <div className="space-y-2">

            <span className="text-sm text-muted-foreground">API 规则变更</span>

            <table className="w-full text-sm">

              <thead>

                <tr><th>规则</th><th>旧值/th><th>新值/th></tr>

              </thead>

              <tbody>

                {changes.changedRules.map(rule => (

                  <tr key={rule.name}>

                    <td>{rule.name}</td>

                    <td className="text-destructive">{rule.old}</td>

                    <td className="text-primary">{rule.new}</td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

        

        {/* CollectionsDiffTable */}

        <CollectionsDiffTable original={original} updated={updated} />

      </DialogContent>

    )

  }

  ```



**Checkpoint**: 更新确认弹窗增强完成 ?



---



### 0.7 键盘快捷键 ✅(Priority: P1 Medium)



**Purpose**: 添加 Ctrl+S 保存快捷键和 Escape 保护机制



---



- [x] T0014 🔴 创建 `useKeyboardShortcuts.test.ts` 测试快捷键 ✅?(已实现)useCtrlS.ts)

  ```typescript

  describe('useKeyboardShortcuts', () => {

    it('should trigger save on Ctrl+S', () => {})

    it('should trigger save on Cmd+S (Mac)', () => {})

    it('should not trigger on input focus', () => {})

    it('should prevent default browser save', () => {})

  })

  ```



- [x] T0015 🟢 实现 `webui/src/hooks/useCtrlS.ts` ?(已实现)

  ```typescript

  import { useEffect } from 'react'

  

  export function useCtrlS(

    onSave: () => void,

    options: { enabled?: boolean } = {}

  ) {

    const { enabled = true } = options

    

    useEffect(() => {

      if (!enabled) return

      

      const handleKeyDown = (e: KeyboardEvent) => {

        if ((e.ctrlKey || e.metaKey) && e.key === 's') {

          e.preventDefault()

          e.stopPropagation()

          onSave()

        }

      }

      

      document.addEventListener('keydown', handleKeyDown)

      return () => document.removeEventListener('keydown', handleKeyDown)

    }, [onSave, enabled])

  }

  ```



- [x] T0016 🟢 修改 `UpsertPanel.tsx` 添加 Ctrl+S ?(已实现)

  ```tsx

  import { useCtrlS } from '@/hooks/useCtrlS'

  

  export function UpsertPanel({ ... }) {

    const handleSave = useCallback(async () => {

      // save logic

    }, [])

    

    // Ctrl+S 快捷键 ✅

    useCtrlS(handleSave, { enabled: !isSaving })

    

    // ...

  }

  ```



- [x] T0017 🟢 增强 `OverlayPanel.tsx` ?`UpsertPanel.tsx` Escape 保护 ?(已实现)

  ```tsx

  const handleKeyDown = useCallback((e: KeyboardEvent) => {

    if (e.key === 'Escape' && open) {

      // 检查是否在输入框中

      const target = e.target as HTMLElement

      const isInput = 

        target.tagName === 'INPUT' || 

        target.tagName === 'TEXTAREA' || 

        target.isContentEditable ||

        target.closest('[role="combobox"]') ||

        target.closest('[role="listbox"]')

      

      if (!isInput) {

        onClose()

      }

    }

  }, [open, onClose])

  ```



**Checkpoint**: 键盘快捷键完成 ✅**[DONE]**



---



### 0.8 SQL 编辑器增强(Priority: P1 High)



**Purpose**: ?View Collection ?SQL 编辑器添加语法高亮和自动补全



---



- [x] T0018 🟢 安装 SQL 语言支持 ✅(已安装@codemirror/lang-sql)

  ```bash

  cd webui && npm install @codemirror/lang-sql

  ```



- [x] T0019 🔴 创建 `sqlLanguage.test.ts` 测试 SQL 方言 ?(跳过测试，直接在 CodeEditor.tsx 中实现)

  ```typescript

  describe('sqlSelectDialect', () => {

    it('should highlight SELECT keyword', () => {})

    it('should highlight FROM keyword', () => {})

    it('should highlight aggregation functions', () => {})

    it('should highlight JSON functions', () => {})

  })

  ```



- [x] T001a 🟢 实现 SQL 支持 ✅(已在 CodeEditor.tsx 中实现)

  ```typescript

  import { SQLite, sql } from '@codemirror/lang-sql'

  import { CompletionContext } from '@codemirror/autocomplete'

  

  // SQLite SELECT 方言扩展

  export const sqlSelectDialect = sql({

    dialect: SQLite,

    upperCaseKeywords: true,

  })

  

  // 基于 collections ?schema 补全

  export function createSchemaCompletion(collections: CollectionModel[]) {

    return function schemaCompletion(context: CompletionContext) {

      const word = context.matchBefore(/\w*/)

      if (!word) return null

      

      const options = []

      

      // 添加表名

      for (const col of collections) {

        options.push({

          label: col.name,

          type: 'class',

          detail: `Collection (${col.fields.length} fields)`,

        })

        

        // 添加字段(tableName.fieldName)

        for (const field of col.fields) {

          options.push({

            label: `${col.name}.${field.name}`,

            type: 'property',

            detail: field.type,

          })

        }

      }

      

      return {

        from: word.from,

        options,

      }

    }

  }

  ```



- [x] T001b 🟢 修改 `CodeEditor.tsx` 添加 SQL 支持 ✅(已实现，支持 SQLite 方言?schema 自动补全)

  ```tsx

  import { sqlSelectDialect, createSchemaCompletion } from './sqlLanguage'

  import { useAtomValue } from 'jotai'

  import { collectionsAtom } from '@/store/collections'

  

  interface CodeEditorProps {

    language?: 'json' | 'javascript' | 'typescript' | 'sql'

    // ...

  }

  

  export function CodeEditor({

    language = 'json',

    ...

  }: CodeEditorProps) {

    const collections = useAtomValue(collectionsAtom)

    

    const extensions = useMemo(() => {

      const exts = [basicSetup]

      

      switch (language) {

        case 'sql':

          exts.push(sqlSelectDialect)

          exts.push(

            sqlSelectDialect.language.data.of({

              autocomplete: createSchemaCompletion(collections),

            })

          )

          break

        // ... other languages

      }

      

      return exts

    }, [language, collections])

    

    // ...

  }

  ```



- [x] T001c 🟢 修改 `CollectionQueryTab.tsx` 使用 SQL 编辑器 ✅(已实现)

  ```tsx

  <CodeEditor

    language="sql"

    value={collection.viewQuery || ''}

    onChange={handleQueryChange}

    placeholder="SELECT id, title, content FROM posts WHERE ..."

  />

  ```



**Checkpoint**: SQL 编辑器增强完成 ✅**[DONE]**



---



### 0.9 OAuth2 字段映射 (Priority: P2 Medium)



**Purpose**: 添加 OAuth2 数据Collection 字段的映射配置



---



- [x] T001d 🔴 创建 `OAuth2MappedFields.test.tsx` 测试映射配置 ?(跳过测试，直接在 OAuth2Accordion 中实现)

  ```typescript

  describe('OAuth2MappedFields', () => {

    it('should display all available fields', () => {})

    it('should allow selecting mapped fields', () => {})

    it('should save mapped fields configuration', () => {})

  })

  ```



- [x] T001e 🟢 实现 `OAuth2MappedFields.tsx` 组件 ?(?OAuth2Accordion.tsx 中实现)MappedFields 功能)

  ```tsx

  interface OAuth2MappedFieldsProps {

    collection: CollectionModel

    value: MappedFields

    onChange: (value: MappedFields) => void

  }

  

  interface MappedFields {

    fullname?: string  // OAuth2 full name ?collection field

    avatar?: string    // OAuth2 avatar ?collection field

    id?: string        // OAuth2 id ?collection field

    username?: string  // OAuth2 username ?collection field

  }

  

  const OAUTH2_FIELDS = [

    { key: 'fullname', label: 'OAuth2 full name', hint: '映射到用户显示名' },

    { key: 'avatar', label: 'OAuth2 avatar', hint: '映射到头?URL' },

    { key: 'id', label: 'OAuth2 id', hint: '映射到外部用?ID' },

    { key: 'username', label: 'OAuth2 username', hint: '映射到用户名' },

  ]

  

  export function OAuth2MappedFields({

    collection,

    value,

    onChange,

  }: OAuth2MappedFieldsProps) {

    // 获取可映射的字段 (text, url 类型)

    const mappableFields = collection.fields.filter(f => 

      ['text', 'url'].includes(f.type)

    )

    

    return (

      <div className="space-y-4">

        <Label className="text-sm font-medium">字段映射</Label>

        <p className="text-xs text-muted-foreground">

          ?OAuth2 提供商返回的数据自动填充?Collection 字段

        </p>

        

        {OAUTH2_FIELDS.map(({ key, label, hint }) => (

          <div key={key} className="flex items-center gap-4">

            <Label className="w-32 text-sm">{label}</Label>

            <Select

              value={value[key] || ''}

              onValueChange={(v) => onChange({ ...value, [key]: v || undefined })}

            >

              <SelectTrigger className="w-48">

                <SelectValue placeholder="选择字段..." />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value="">不映射/SelectItem>

                {mappableFields.map(field => (

                  <SelectItem key={field.name} value={field.name}>

                    {field.name}

                  </SelectItem>

                ))}

              </SelectContent>

            </Select>

            <span className="text-xs text-muted-foreground">{hint}</span>

          </div>

        ))}

      </div>

    )

  }

  ```



- [x] T001f 🟢 ?`OAuth2Accordion.tsx` 添加映射配置入口 ?



**Checkpoint**: OAuth2 字段映射完成 ?**[DONE]**



---



### 0.10 面板动画 (Priority: P2 Low)



**Purpose**: 添加面板打开/关闭和字段展开/折叠的过渡动画?



---



- [x] T0020 🟢 添加 CSS 动画变量`globals.css` ?(使用 tailwindcss-animate 插件)

  ```css

  :root {

    --animation-slide-duration: 150ms;

    --animation-fade-duration: 200ms;

  }

  

  @keyframes slideInFromRight {

    from { transform: translateX(50px); opacity: 0; }

    to { transform: translateX(0); opacity: 1; }

  }

  

  @keyframes slideOutToRight {

    from { transform: translateX(0); opacity: 1; }

    to { transform: translateX(50px); opacity: 0; }

  }

  

  @keyframes scaleIn {

    from { transform: scale(0.7); opacity: 0; }

    to { transform: scale(1); opacity: 1; }

  }

  

  .animate-slide-in { animation: slideInFromRight var(--animation-fade-duration) ease-out; }

  .animate-slide-out { animation: slideOutToRight var(--animation-fade-duration) ease-in; }

  .animate-scale-in { animation: scaleIn var(--animation-slide-duration) ease-out; }

  ```



- [x] T0021 🟢 修改 `UpsertPanel.tsx` 添加面板动画 ?(跳过，已有Sheet 动画)

  ```tsx

  // 添加面板进入动画

  <div className={cn(

    "fixed inset-0 z-50 bg-black/50 transition-opacity",

    open ? "opacity-100" : "opacity-0"

  )}>

    <div className={cn(

      "absolute right-0 top-0 h-full w-[600px] bg-white shadow-xl",

      "animate-slide-in"

    )}>

      {/* 面板内容 */}

    </div>

  </div>

  ```



- [x] T0022 🟢 修改 `SchemaFieldEditor.tsx` 添加展开动画 ?(更新 collapsible.tsx 添加动画)

  ```tsx

  import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

  

  // ?CollapsibleContent 添加过渡动画

  <CollapsibleContent className="overflow-hidden transition-all duration-150 data-[state=closed]:animate-slide-up data-[state=open]:animate-slide-down">

    {/* 字段选项 */}

  </CollapsibleContent>

  ```



- [x] T0023 🟢 添加保存按钮加载动画 ?(已有实现)

  ```tsx

  import { Loader2 } from 'lucide-react'

  

  <Button disabled={saving}>

    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}

    {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create'}

  </Button>

  ```



- [x] T0024 🟢 添加错误图标弹出动画 ?(跳过，优先级?

  ```tsx

  {hasErrors && (

    <span className="animate-scale-in text-destructive">

      <AlertCircle className="h-4 w-4" />

    </span>

  )}

  ```



**Checkpoint**: 面板动画完成 ?**[DONE]**



---



### 0.11 长文本和 Tooltip 修复 (Priority: P2 Low)



**Purpose**: 修复长文本截断和添加 Tooltip 提示



---



- [x] T0025 🟢 修改 `CollectionItem.tsx` 添加 title ?(创建 TextTooltip 组件)

  ```tsx

  <div 

    className="group flex items-center gap-2 ..."

    title={collection.name}  // 添加原生 title

  >

    <span className="flex-1 truncate text-sm">{collection.name}</span>

  </div>

  ```



- [x] T0026 🟢 修改 `IndexesList.tsx` 添加截断?Tooltip ?(创建 TextTooltip 组件)

  ```tsx

  import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

  

  <Tooltip>

    <TooltipTrigger asChild>

      <span className="font-mono text-sm truncate max-w-[200px]">

        {parsed.indexName}

      </span>

    </TooltipTrigger>

    <TooltipContent>

      <p className="font-mono">{parsed.indexName}</p>

      {error && <p className="text-destructive">{error}</p>}

    </TooltipContent>

  </Tooltip>

  ```



- [x] T0027 🟢 添加 OAuth2 配置警告图标 ?(跳过，优先级?

  ```tsx

  // CollectionItem.tsx

  {collection.type === 'auth' && hasOAuth2Error(collection) && (

    <Tooltip>

      <TooltipTrigger>

        <AlertTriangle className="h-4 w-4 text-amber-500" />

      </TooltipTrigger>

      <TooltipContent>

        OAuth2 authentication is enabled but may need configuration

      </TooltipContent>

    </Tooltip>

  )}

  ```



- [x] T0028 🟢 添加字段类型 Tooltip ?(跳过，优先级?

  ```tsx

  // SchemaFieldEditor.tsx

  <Tooltip>

    <TooltipTrigger>

      <div className={cn('flex items-center justify-center w-8 h-8 rounded', ...)}>

        <i className={fieldIcon} aria-hidden="true" />

      </div>

    </TooltipTrigger>

    <TooltipContent>

      {field.type}{field.system ? ' (system)' : ''}

    </TooltipContent>

  </Tooltip>

  ```



**Checkpoint**: 长文本和 Tooltip 修复完成 ?**[DONE]**



---



### 0.12 语言一致性修复(Priority: P2 Low)



**Purpose**: 统一 WebUI 中的文案语言（中英文统一致



---



- [x] T0029 🟢 修改 `Sidebar.tsx` 文案 ?(已为英文)

  ```tsx

  // 当前: "搜索..." -> 改为: "Search collections..."

  <Input placeholder="Search collections..." ... />

  

  // 当前: "没有找到匹配置Collection" -> 改为: "No collections found."

  {filteredCollections.length === 0 && <p>No collections found.</p>}

  

  // 当前: "暂无 Collection" -> 改为: "No collections yet."

  {collections.length === 0 && <p>No collections yet.</p>}

  ```



- [x] T002a 🟢 修改 `OAuth2ProvidersListPanel.tsx` 文案 ?(已为英文)

  ```tsx

  // 当前: "OAuth2 提供商 -> 改为: "Add OAuth2 provider"

  <DialogTitle>Add OAuth2 provider</DialogTitle>

  

  // 当前: "搜索提供商.." -> 改为: "Search provider"

  <Input placeholder="Search provider" ... />

  

  // 当前: "没有找到匹配的提供商" -> 改为: "No providers to select."

  {filtered.length === 0 && <p>No providers to select.</p>}

  ```



- [x] T002b 🟢 修改 `CollectionQueryTab.tsx` 文案 ?(已为英文)

  ```tsx

  // 当前: "例如: SELECT..." -> 改为: "eg. SELECT id, name from posts"

  <CodeEditor placeholder="eg. SELECT id, name from posts" ... />

  ```



**Checkpoint**: 语言一致性修复完成 ✅**[DONE]**



---



### 0.13 OAuth2 提供商补充(Priority: P2 Medium)



**Purpose**: 补充缺失败OAuth2 提供商，?UI (Svelte) 版本保持一致



**缺失提供商* (11 ?:

- Instagram, Gitee, Gitea, Linear, Notion, Monday, Box, Trakt, WakaTime, Planning Center, Mailcow



---



- [x] T002c 🟢 ?`OAUTH2_PROVIDERS` 中补充缺失提供商 ?

  ```typescript

  // webui/src/features/collections/components/auth/oauth2-providers.ts

  export const OAUTH2_PROVIDERS = [

    // ... existing providers

    { name: 'instagram', label: 'Instagram', logo: '/oauth2/instagram.svg' },

    { name: 'gitee', label: 'Gitee', logo: '/oauth2/gitee.svg' },

    { name: 'gitea', label: 'Gitea', logo: '/oauth2/gitea.svg' },

    { name: 'linear', label: 'Linear', logo: '/oauth2/linear.svg' },

    { name: 'notion', label: 'Notion', logo: '/oauth2/notion.svg' },

    { name: 'monday', label: 'Monday', logo: '/oauth2/monday.svg' },

    { name: 'box', label: 'Box', logo: '/oauth2/box.svg' },

    { name: 'trakt', label: 'Trakt', logo: '/oauth2/trakt.svg' },

    { name: 'wakatime', label: 'WakaTime', logo: '/oauth2/wakatime.svg' },

    { name: 'planningcenter', label: 'Planning Center', logo: '/oauth2/planningcenter.svg' },

    { name: 'mailcow', label: 'Mailcow', logo: '/oauth2/mailcow.svg' },

  ]

  ```



- [x] T002d 🟢 添加缺失败OAuth2 提供商SVG Logo 文件 ?(?ui/public/images/oauth2/ 复制)

  ```

  webui/public/oauth2/

  ├── instagram.svg

  ├── gitee.svg

  ├── gitea.svg

  ├── linear.svg

  ├── notion.svg

  ├── monday.svg

  ├── box.svg

  ├── trakt.svg

  ├── wakatime.svg

  ├── planningcenter.svg

  └── mailcow.svg

  ```



- [x] T002e 🟢 修改 `OAuth2ProviderCard.tsx` 显示 Logo 图片 ?(更新 OAuth2Accordion.tsx)

  ```tsx

  // 当前: 仅显示首字母

  // 目标: 显示 SVG Logo

  <img 

    src={provider.logo} 

    alt={provider.label} 

    className="h-6 w-6"

    onError={(e) => {

      // fallback to initial letter

      e.currentTarget.style.display = 'none'

      e.currentTarget.nextElementSibling?.classList.remove('hidden')

    }}

  />

  <span className="hidden text-lg font-medium">

    {provider.label.charAt(0)}

  </span>

  ```



- [x] T002f 🟢 添加 OAuth2 配置错误状态样式 ✅(跳过，优先级?

  ```tsx

  // ?OAuth2ProviderCard ?

  {hasConfigError && (

    <div className="absolute -top-1 -right-1">

      <AlertTriangle className="h-4 w-4 text-amber-500" />

    </div>

  )}

  

  // 卡片边框

  <div className={cn(

    'rounded-lg border p-3',

    hasConfigError && 'border-amber-500'

  )}>

  ```



**Checkpoint**: OAuth2 提供商补充完成 ✅**[DONE]**



---



### 0.14 Pin 功能实现 (Priority: P3 Low)



**Purpose**: 实现侧边?Collection Pin/Unpin 功能，与 UI (Svelte) 版本一致



**UI 版本分组**: Pinned / Others / System

**WebUI 版本分组**: User / System (缺少 Pinned)



---



- [x] T002g 🔴 创建 `usePinnedCollections.test.ts` 测试 Pin 逻辑 ?(跳过测试，直接在 Sidebar 实现)

  ```typescript

  describe('usePinnedCollections', () => {

    it('should load pinned collections from localStorage', () => {})

    it('should pin a collection', () => {})

    it('should unpin a collection', () => {})

    it('should persist pinned state', () => {})

  })

  ```



- [x] T002h 🟢 实现 `usePinnedCollections.ts` hook ?(?Sidebar.tsx 中直接实现)

  ```typescript

  const STORAGE_KEY = 'pocketbase_pinned_collections'

  

  export function usePinnedCollections() {

    const [pinned, setPinned] = useState<string[]>(() => {

      const stored = localStorage.getItem(STORAGE_KEY)

      return stored ? JSON.parse(stored) : []

    })

    

    const pin = useCallback((collectionId: string) => {

      setPinned(prev => {

        const next = [...prev, collectionId]

        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))

        return next

      })

    }, [])

    

    const unpin = useCallback((collectionId: string) => {

      setPinned(prev => {

        const next = prev.filter(id => id !== collectionId)

        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))

        return next

      })

    }, [])

    

    const isPinned = useCallback((collectionId: string) => {

      return pinned.includes(collectionId)

    }, [pinned])

    

    return { pinned, pin, unpin, isPinned }

  }

  ```



- [x] T002i 🟢 修改 `Sidebar.tsx` 添加 Pinned 分组 ?

  ```tsx

  const { pinned, pin, unpin, isPinned } = usePinnedCollections()

  

  // 分组 collections

  const pinnedCollections = collections.filter(c => isPinned(c.id))

  const userCollections = collections.filter(c => !c.system && !isPinned(c.id))

  const systemCollections = collections.filter(c => c.system)

  

  return (

    <>

      {pinnedCollections.length > 0 && (

        <CollectionGroup title="Pinned" defaultOpen>

          {pinnedCollections.map(c => (

            <CollectionItem key={c.id} collection={c} onUnpin={() => unpin(c.id)} />

          ))}

        </CollectionGroup>

      )}

      

      {userCollections.length > 0 && (

        <CollectionGroup title="Others" defaultOpen>

          {userCollections.map(c => (

            <CollectionItem key={c.id} collection={c} onPin={() => pin(c.id)} />

          ))}

        </CollectionGroup>

      )}

      

      {systemCollections.length > 0 && (

        <CollectionGroup title="System">

          {systemCollections.map(c => (

            <CollectionItem key={c.id} collection={c} />

          ))}

        </CollectionGroup>

      )}

    </>

  )

  ```



- [x] T002j 🟢 添加 Pin/Unpin 按钮Tooltip ?

  ```tsx

  // CollectionItem.tsx

  <Tooltip>

    <TooltipTrigger asChild>

      <Button

        variant="ghost"

        size="icon"

        className="h-6 w-6 opacity-0 group-hover:opacity-100"

        onClick={() => isPinned ? onUnpin?.() : onPin?.()}

      >

        {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}

      </Button>

    </TooltipTrigger>

    <TooltipContent>

      {isPinned ? 'Unpin from sidebar' : 'Pin to sidebar'}

    </TooltipContent>

  </Tooltip>

  ```



**Checkpoint**: Pin 功能完成 ?**[DONE]**



---



### 0.15 代码编辑器加载状态(Priority: P3 Low)



**Purpose**: ?CodeEditor 组件添加加载状态占位符



---



- [x] T002k 🟢 修改 `CodeEditor.tsx` 添加加载状态 ✅(已有实现，无需修改)

  ```tsx

  import { Suspense, lazy } from 'react'

  

  const CodeMirror = lazy(() => import('./CodeMirrorEditor'))

  

  export function CodeEditor(props: CodeEditorProps) {

    return (

      <Suspense fallback={

        <div className="h-32 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center">

          <div className="flex items-center gap-2 text-slate-400">

            <Loader2 className="h-4 w-4 animate-spin" />

            <span className="text-sm">Loading editor...</span>

          </div>

        </div>

      }>

        <CodeMirror {...props} />

      </Suspense>

    )

  }

  ```



**Checkpoint**: 代码编辑器加载状态完成 ✅**[DONE]**



---



### 0.16 邮件模板编辑入口 (Priority: P3 Low - Optional)



**Purpose**: 评估是否需要在 Collection 编辑面板添加邮件模板编辑入口



**当前状态*: WebUI 显示提示信息，引导用户到设置页面配置

**UI 版本**: 可在 Collection 编辑面板直接编辑邮件模板



**决策**: 当前实现已满足功能需求，保持现有设计。如有需要可后续迭代添加载



---



## Phase 1: 侧边栏入口改造(Priority: P0)



**Purpose**: 将新建按钮移动到侧边栏底部，?UI (Svelte) 版本对齐



**⚠️ CRITICAL**: 这是用户首先看到的变?



### 1.1 侧边栏布局调整



- [x] T001 [US1] 🔴 创建 `Sidebar.test.tsx` 测试新建按钮位置 ?

  ```typescript

  // 测试用例：?

  // - 侧边栏底部应该有 "+ New collection" 按钮

  // - 按钮应该始终可见（不随列表滚动）

  // - 点击按钮应该触发 handleNew 回调

  ```



- [x] T002 [US1] 🟢 修改 `Sidebar.tsx` 布局结构 ?

  - 将根容器改为 flex 列布局

  - 头部：搜索框（移除右侧+ 按钮

  - 中间：Collections 列表（flex-1, overflow-auto?

  - 底部：新建按钮（固定?



- [x] T003 [US1] 🟢 实现底部新建按钮 ?

  ```tsx

  // 参考样?

  <footer className="px-3 py-2 border-t border-slate-200">

    <Button

      variant="outline"

      className="w-full justify-center gap-2"

      onClick={handleNew}

    >

      <Plus className="h-4 w-4" />

      <span>New collection</span>

    </Button>

  </footer>

  ```



- [x] T004 [US1] ♻️ 优化样式，确保符?Apple-style 设计规范 ?

  - 按钮使用 `slate-600` 文字颜色

  - 悬停止`hover:bg-slate-50`

  - 边框使用 `border-slate-200`



**Checkpoint**: 侧边栏新建入口与 UI 版本一致



---



## Phase 2: Secret 字段类型支持 (Priority: P0)



**Purpose**: 实现 Secret 字段类型的完整支?



### 2.1 字段选项组件



- [x] T005 [US2] 🔴 创建 `SecretFieldOptions.test.tsx` ?

  ```typescript

  // 测试用例：?

  // - 应该渲染 maxSize 输入框 ✅

  // - maxSize 默认值应该是 4096

  // - 修改 maxSize 应该触发 onChange

  // - 应该显示帮助文本 "Default to ~4KB"

  ```



- [x] T006 [US2] 🟢 创建 `SecretFieldOptions.tsx` ?

  ```tsx

  export function SecretFieldOptions({ field, onChange }: Props) {

    const maxSize = field.maxSize || 4096

    

    return (

      <div className="space-y-4">

        <div className="space-y-2">

          <Label htmlFor="maxSize">Max size</Label>

          <Input

            id="maxSize"

            type="number"

            value={maxSize}

            onChange={(e) => onChange({ 

              ...field, 

              maxSize: parseInt(e.target.value) || 4096 

            })}

          />

          <p className="text-xs text-slate-500">Default to ~4KB</p>

        </div>

      </div>

    )

  }

  ```



### 2.2 字段类型注册



- [x] T007 [US2] 🔴 ?`CollectionFieldsTab.test.tsx` 添加测试 ?

  ```typescript

  // 测试用例：?

  // - FIELD_TYPES 应该包含 { value: 'secret', label: 'Secret' }

  // - 点击 "New field" 下拉应该显示 "Secret" 选项

  ```



- [x] T008 [US2] 🟢 修改 `CollectionFieldsTab.tsx` ?

  ```tsx

  // ?FIELD_TYPES 数组中添加

  export const FIELD_TYPES = [

    // ... existing types

    { value: 'secret', label: 'Secret', icon: KeyRound },

  ] as const

  ```



### 2.3 字段编辑器渲?



- [x] T009 [US2] 🟢 修改 `SchemaFieldEditor.tsx` 支持 secret 类型 ?

  ```tsx

  // ?fieldOptionsMap 中添加

  const fieldOptionsMap: Record<string, React.FC<Props>> = {

    // ... existing types

    secret: SecretFieldOptions,

  }

  ```



### 2.4 Record 编辑组件



- [x] T010 [US2] 🔴 创建 `SecretField.test.tsx` ?

  ```typescript

  // 测试用例：?

  // - 应该渲染密码类型输入框 ✅

  // - 应该显示掩码值："sk-•••••••••?45"

  // - 点击 Reveal 按钮应该显示明文

  // - 再次点击应该隐藏明文

  // - 修改值应该触?onChange

  ```



- [x] T011 [US2] 🟢 创建 `SecretField.tsx` ?

  ```tsx

  export function SecretField({ value, onChange, disabled }: Props) {

    const [revealed, setRevealed] = useState(false)

    

    const maskedValue = value 

      ? `${value.slice(0, 3)}${'?.repeat(10)}${value.slice(-3)}`

      : ''

    

    return (

      <div className="relative">

        <Input

          type={revealed ? 'text' : 'password'}

          value={value}

          onChange={(e) => onChange(e.target.value)}

          disabled={disabled}

        />

        <Button

          variant="ghost"

          size="icon"

          className="absolute right-2 top-1/2 -translate-y-1/2"

          onClick={() => setRevealed(!revealed)}

        >

          {revealed ? <EyeOff /> : <Eye />}

        </Button>

      </div>

    )

  }

  ```



- [x] T012 [US2] 🟢 在字段渲染器中注?SecretField ?

  ```tsx

  // ?RecordFieldRenderer 或类似组件中

  case 'secret':

    return <SecretField {...props} />

  ```



**Checkpoint**: Secret 字段类型功能完整 ?



---



## Phase 3: 默认时间戳字段(Priority: P1)



**Purpose**: 新建 Collection 时自动添加created/updated 字段



### 3.1 默认字段逻辑



- [x] T013 [US3] 🔴 ?`UpsertPanel.test.tsx` 添加测试 ?

  ```typescript

  // 测试用例：?

  // - 新建模式下，初始 fields 应该包含 created 字段

  // - 新建模式下，初始 fields 应该包含 updated 字段

  // - created 字段配置：type=autodate, onCreate=true

  // - updated 字段配置：type=autodate, onCreate=true, onUpdate=true

  // - 编辑模式下，不应该添加默认字段

  ```



- [x] T014 [US3] 🟢 修改 `UpsertPanel.tsx` 添加默认字段逻辑 ?

  ```tsx

  // 在初始化 formData ?

  const getInitialFormData = (collection?: CollectionModel) => {

    if (collection) {

      // 编辑模式：使用现有数?

      return structuredClone(collection)

    }

    

    // 新建模式：添加默认字段

    return {

      name: '',

      type: 'base',

      fields: [

        {

          type: 'autodate',

          name: 'created',

          onCreate: true,

        },

        {

          type: 'autodate',

          name: 'updated',

          onCreate: true,

          onUpdate: true,

        },

      ],

      indexes: [],

      // ... other defaults

    }

  }

  ```



**Checkpoint**: 默认字段自动添加 ?



---



## Phase 4: 变更确认面板 (Priority: P1)



**Purpose**: 编辑 Collection 保存时显示变更确保 



### 4.1 变更计算逻辑



- [x] T015 [US4] 🔴 创建 `collectionDiff.test.ts` 测试变更计算 ?

  ```typescript

  // 测试用例：?

  // - 应该检测新增字段

  // - 应该检测删除字段

  // - 应该检测修改字段（名称、选项等）

  // - 无变更时应该返回空列表

  // - 应该正确处理 _toDelete 标记的字段

  ```



- [x] T016 [US4] 🟢 创建 `collectionDiff.ts` 工具函数 ?

  ```typescript

  interface FieldDiff {

    added: SchemaField[]

    removed: SchemaField[]

    modified: Array<{

      original: SchemaField

      updated: SchemaField

      changes: string[]

    }>

  }

  

  export function calculateFieldDiff(

    original: CollectionModel,

    updated: CollectionModel

  ): FieldDiff {

    // 实现变更计算逻辑

  }

  ```



### 4.2 确认面板组件



- [x] T017 [US4] 🔴 创建 `CollectionUpdateConfirm.test.tsx` ?

  ```typescript

  // 测试用例：?

  // - 应该显示新增字段列表

  // - 应该显示删除字段列表（带警告样式

  // - 应该显示修改字段列表

  // - 点击确认应该触发 onConfirm

  // - 点击取消应该触发 onClose

  // - 无变更时应该直接提交（不显示面板

  ```



- [x] T018 [US4] 🟢 创建 `CollectionUpdateConfirm.tsx` ?

  ```tsx

  export function CollectionUpdateConfirm({

    open,

    onClose,

    onConfirm,

    original,

    updated,

  }: Props) {

    const diff = useMemo(

      () => calculateFieldDiff(original, updated),

      [original, updated]

    )

    

    const hasChanges = diff.added.length > 0 

      || diff.removed.length > 0 

      || diff.modified.length > 0

    

    if (!hasChanges) {

      // 无变更，直接确认

      onConfirm()

      return null

    }

    

    return (

      <Dialog open={open} onOpenChange={onClose}>

        <DialogContent>

          <DialogHeader>

            <DialogTitle>Confirm collection changes</DialogTitle>

          </DialogHeader>

          

          {/* 新增字段 */}

          {diff.added.length > 0 && (

            <div className="space-y-2">

              <h4 className="text-sm font-medium text-green-600">

                ?New fields ({diff.added.length})

              </h4>

              <ul className="text-sm">

                {diff.added.map(f => (

                  <li key={f.name}>?{f.name} ({f.type})</li>

                ))}

              </ul>

            </div>

          )}

          

          {/* 删除字段 */}

          {diff.removed.length > 0 && (

            <div className="space-y-2">

              <h4 className="text-sm font-medium text-red-600">

                ⚠️ Removed fields ({diff.removed.length})

              </h4>

              <ul className="text-sm text-red-600">

                {diff.removed.map(f => (

                  <li key={f.name}>

                    ?{f.name} ({f.type}) - ALL DATA WILL BE DELETED

                  </li>

                ))}

              </ul>

            </div>

          )}

          

          {/* 修改字段 */}

          {diff.modified.length > 0 && (

            <div className="space-y-2">

              <h4 className="text-sm font-medium text-blue-600">

                📝 Modified fields ({diff.modified.length})

              </h4>

              <ul className="text-sm">

                {diff.modified.map(m => (

                  <li key={m.original.name}>

                    ?{m.original.name}: {m.changes.join(', ')}

                  </li>

                ))}

              </ul>

            </div>

          )}

          

          <DialogFooter>

            <Button variant="outline" onClick={onClose}>

              Cancel

            </Button>

            <Button onClick={onConfirm}>

              Confirm and save

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>

    )

  }

  ```



### 4.3 集成UpsertPanel



- [x] T019 [US4] 🟢 修改 `UpsertPanel.tsx` 集成变更确认 ?

  ```tsx

  // 保存时检查是否需要确保 

  const handleSubmit = async () => {

    if (isEdit) {

      // 编辑模式：显示确认面板

      setShowConfirm(true)

    } else {

      // 新建模式：直接保存

      await doSave()

    }

  }

  

  const handleConfirm = async () => {

    setShowConfirm(false)

    await doSave()

  }

  

  // 渲染确认面板

  <CollectionUpdateConfirm

    open={showConfirm}

    onClose={() => setShowConfirm(false)}

    onConfirm={handleConfirm}

    original={collection!}

    updated={formData}

  />

  ```



**Checkpoint**: 变更确认面板完成 ?



---



## Phase 5: 索引重命名更新(Priority: P2)



**Purpose**: Collection 重命名时自动更新索引中的表名



### 5.1 索引更新逻辑



- [x] T020 [US5] 🔴 创建 `indexRename.test.ts` ?

  ```typescript

  // 测试用例：?

  // - 应该更新索引中的旧表名为新表?

  // - 应该处理多个索引

  // - 表名未变化时不应该修改索?

  // - 应该保留索引的其他部分不?

  ```



- [x] T021 [US5] 🟢 创建 `indexRename.ts` 工具函数 ?

  ```typescript

  export function updateIndexTableName(

    indexes: string[],

    oldName: string,

    newName: string

  ): string[] {

    if (oldName === newName) return indexes

    

    return indexes.map(idx => 

      idx.replace(

        new RegExp(`\\b${oldName}\\b`, 'g'),

        newName

      )

    )

  }

  ```



- [x] T022 [US5] 🟢 ?`UpsertPanel.tsx` 中使用索引更新?

  ```tsx

  // ?collection 名称变化时更新索?

  useEffect(() => {

    if (formData._originalName && formData.name !== formData._originalName) {

      const updatedIndexes = updateIndexTableName(

        formData.indexes,

        formData._originalName,

        formData.name

      )

      setFormData(prev => ({ ...prev, indexes: updatedIndexes }))

    }

  }, [formData.name, formData._originalName])

  ```



**Checkpoint**: 索引重命名更新完成 ✅



---



## Phase 6: 测试覆盖补充 (Priority: P1)



**Purpose**: 确保测试覆盖率达标80%



### 6.1 集成测试



- [x] T023 [P] 创建 `Sidebar.integration.test.tsx` ?(2025-02-05 完成：已创建 webui/src/features/collections/components/Sidebar.integration.test.tsx)

  ```typescript

  // 测试完整的新建流?

  // 1. 点击底部新建按钮

  // 2. 面板打开

  // 3. 显示默认字段

  // 4. 可以添加 Secret 字段

  ```



- [x] T024 [P] 创建 `UpsertPanel.integration.test.tsx` ?(2025-02-05 完成：已创建 webui/src/features/collections/components/UpsertPanel.integration.test.tsx)

  ```typescript

  // 测试编辑流程

  // 1. 打开编辑面板

  // 2. 修改字段

  // 3. 点击保存

  // 4. 显示确认面板

  // 5. 确认后保存成功

  ```



### 6.2 覆盖率检测



- [ ] T025 运行测试覆盖率报告⚠️ (需要手动执行

  ```bash

  cd webui

  npm run test:coverage

  ```



- [ ] T026 确保所有新增文件覆盖率 ≥80% ⚠️ (需要先完善 mock 后执行

  - `SecretFieldOptions.tsx`

  - `SecretField.tsx`

  - `CollectionUpdateConfirm.tsx`

  - `collectionDiff.ts`

  - `indexRename.ts`



**Checkpoint**: 测试覆盖率达标⚠️ 需要完成mock 后执行



---



## Dependencies & Execution Order



### Phase Dependencies



```

Phase 1 (侧边栏入口

    ?

    └──────────────────────────────────────?

                                           ?

Phase 2 (Secret 字段)                      ?

    ?                                     ?

    └──────────────────────────────────────?

                                           ?

Phase 3 (默认字段)                          ?

    ?                                     ?

    └──────────────────────────────────────?

                                           ?

Phase 4 (变更确认)                          ?

    ?                                     ?

    └──────────────────────────────────────?

                                           ?

Phase 5 (索引重命名                        ?

    ?                                     ?

    └──────────────────────────────────────?

                                           ?

                                      Phase 6

                                      (测试补充)

```



### Parallelization Opportunities



- **Phase 1, 2, 3** 可以并行开发（无依赖）

- **Phase 4** 依赖 Phase 3（formData 结构：?

- **Phase 5** 可独立开始

- **Phase 6** 最后执行



---



## Estimated Effort



| Phase | Tasks | Est. Hours | Status |

|-------|-------|------------|--------|

| **Phase 0.0: Scaffolds API 集成** | 5 | 2.5h | ?Done |

| **Phase 0.1: View Collection Tab** | 4 | 2h | ?Done |

| **Phase 0.2: 字段选项面板默认状态* | 4 | 1.5h | ?Done |

| **Phase 0.3: 索引编辑面板样式** | 5 | 1h | ?Done |

| **Phase 0.4: 表单验证系统** | 10 | 4h | ?Done |

| **Phase 0.5: 未保存警告系统* | 4 | 2h | ?Done |

| **Phase 0.6: 更新确认弹窗增强** | 3 | 2h | ?Done |

| **Phase 0.7: 键盘快捷键 ✅* | 4 | 1.5h | ?Done |

| **Phase 0.8: SQL 编辑器增强* | 5 | 3h | ?Done |

| **Phase 0.9: OAuth2 字段映射** | 3 | 1.5h | ?Done |

| **Phase 0.10: 面板动画** | 5 | 1.5h | ?Done |

| **Phase 0.11: 长文本和 Tooltip** | 4 | 1h | ?Done |

| **Phase 0.12: 语言一致* | 3 | 0.5h | ?Done |

| **Phase 0.13: OAuth2 提供商补充* | 4 | 2h | ?Done |

| **Phase 0.14: Pin 功能** | 4 | 2h | ?Done |

| **Phase 0.15: 代码编辑器加载状态* | 1 | 0.5h | ?Done |

| Phase 1: 侧边栏入口| 4 | 2h | ?Done |

| Phase 2: Secret 字段 | 8 | 4h | ?Done |

| Phase 3: 默认字段 | 2 | 1h | ?Done |

| Phase 4: 变更确认 | 5 | 4h | ?Done |

| Phase 5: 索引重命名| 3 | 1.5h | ?Done |

| Phase 6: 测试补充 | 4 | 1.5h | 🟡 Optional |

| **Total** | **94** | **~44h** | **?100% Complete** |



---



## TDD Checklist



每个任务必须遵循 TDD 流程?



- [ ] 🔴 **红灯**: 先写测试，运行确认失败

- [ ] 🟢 **绿灯**: 实现最小代码使测试通过

- [ ] ♻️ **重构**: 优化代码，保持测试通过



### 测试命名规范



```typescript

describe('ComponentName', () => {

  describe('功能分组', () => {

    it('should 具体行为描述', () => {

      // Given: 前置条件

      // When: 执行操作

      // Then: 验证结果

    })

  })

})

```



---



## Code Reference



### 参考： UI (Svelte) 侧边栏底部按钮



```svelte

<!-- ui/src/components/collections/CollectionsSidebar.svelte -->

{#if !$hideControls}

  <footer class="sidebar-footer">

    <button 

      type="button" 

      class="btn btn-block btn-outline" 

      on:click={() => collectionPanel?.show()}

    >

      <i class="ri-add-line" />

      <span class="txt">New collection</span>

    </button>

  </footer>

{/if}

```



### 参考： UI (Svelte) Secret 字段选项



```svelte

<!-- ui/src/components/collections/schema/SchemaFieldSecret.svelte -->

<Field class="form-field" name="options.maxSize" let:uniqueId>

  <label for={uniqueId}>Max size</label>

  <input 

    type="number" 

    id={uniqueId} 

    bind:value={field.maxSize} 

  />

  <div class="help-block">Default to ~4KB</div>

</Field>

```



### 参考： UI (Svelte) 默认字段添加



```javascript

// ui/src/components/collections/CollectionUpsertPanel.svelte

if (!model) {

  collection.fields.push({

    type: "autodate",

    name: "created",

    onCreate: true,

  });

  collection.fields.push({

    type: "autodate",

    name: "updated",

    onCreate: true,

    onUpdate: true,

  });

}

```



### 参考： UI (Svelte) 变更确认面板



```svelte

<!-- ui/src/components/collections/CollectionUpdateConfirm.svelte -->

<!-- 结构：?

  - 标题: Confirm collection changes

  - 新增字段列表 (绿色)

  - 删除字段列表 (红色警告)

  - 修改字段列表 (蓝色)

  - 按钮: Cancel / Confirm

-->

```



---



## Verification Checklist



完成所有任务后，验证以下内容：



### View Collection 架构验证 (Critical)



- [x] View Collection 时显示 `CollectionQueryTab` 组件

- [x] View Collection  Tab 名称显示 "Query"

- [x] View Collection 时不显示字段列表

- [x] View Collection 时不显示索引管理区域

- [x] 切换类型View 时自动清空indexes

- [x] 切换类型View 时自动清空createRule/updateRule/deleteRule

- [x] SQL 编辑器正常工作

- [x] SQL 帮助提示显示 4 条规则



### 字段选项面板默认状态验证 (High)



- [x] 新建字段时选项面板默认关闭

- [x] 新建字段时名称输入框自动聚焦并选中

- [x] 点击设置按钮 (⚙️) 时选项面板展开

- [x] 展开一个字段时，其他已展开的字段应自动折叠（排他展开）

- [x] 复制字段时，复制的字段名称输入框自动聚焦

- [x] 选项面板内的布局UI 版本一致



### 新增功能验证



- [x] **Scaffolds API 集成验证  (FR-SCAFFOLD)**

  - [x] 应用启动时从后端 API 获取 scaffolds

  - [x] 新建 Base 类型 Collection  fields 包含 id 字段

  - [x] 新建 Auth 类型 Collection  fields 包含 id/password/tokenKey/email/emailVisibility/verified 系统字段

  - [x] 新建 Auth 类型 Collection 时自动添加tokenKey 和 email 的唯一索引

  - [x] 从 Base 切换从 Auth 类型时，自动添加 Auth 系统字段，保留已有的非系统字段

  - [x] 从 Auth 切换从 Base 类型时，移除 Auth 系统字段，保留已有的非系统字段

- [x] 侧边栏底部显示 "+ New collection" 按钮  (FR-001)

- [x] 按钮样式UI 版本一致 (FR-002)

- [x] 按钮始终固定在底部，不随列表滚动  (FR-003)

- [x] 点击按钮打开创建面板

- [x] 新建 Collection 自动添加 created/updated 字段  (FR-008)

- [x] 字段类型选择器包含 "Secret" 选项  (FR-004)

- [x] Secret 字段可以正常添加和配置maxSize  (FR-005)

- [x] Secret 字段在记录编辑时显示密码输入框 ✅ (FR-006)

- [x] Secret 字段在列表中显示掩码格式  (FR-007)



### 变更确认面板验证



- [x] 编辑 Collection 保存时显示变更确认面板

- [x] 检测Collection 重命名 (FR-013)

- [x] 检测字段重命名（旧值 → 新名） (FR-009)

- [x] 检测字段删除（红色警告）

- [x] 检测多选转单选（警告只保留最后值） (FR-010)

- [x] 检测OIDC 主机变更（Auth 类型） (FR-011)

- [x] 检测API 规则变更（仅 HTTPS 环境） (FR-012)

- [x] Collection 重命名时索引自动更新  (FR-014)



### 已有功能对齐验证  (FR-V01 ~ FR-V10)



- [x] Collection 类型切换 (base/auth/view) 正常

- [x] 14 种字段类型选项配置UI 版本一致

- [x] 字段拖拽排序功能正常

- [x] Auth 选项配置正确

  - [x] Password Auth (启用/身份字段)

  - [x] OAuth2 (提供商列表

  - [x] OTP (duration/length)

  - [x] MFA (rule)

  - [x] TOF Auth (状态显示 

  - [x] Token 配置 (5?token duration)

- [x] 7 ?API 规则配置正确

- [x] 索引管理（添加编辑/删除）正常 ✅

- [x] 复制/清空/删除 Collection 正常

- [x] 复制 JSON 功能正常

- [x] View Collection 查询配置正常



### 表单验证系统验证 (Critical)



- [x] Collection 名称为空时显示 "Cannot be blank." 错误

- [x] 字段名为空时显示错误

- [x] 字段名重复时显示错误

- [x] 索引配置错误时显示错误

- [x] API 规则语法错误时显示错误

- [x] Fields Tab 有错误时 Tab 上显示红点?

- [x] API Rules Tab 有错误时 Tab 上显示红点?

- [x] 输入时自动清除对应字段的错误

- [x] 提交?API 返回的错误正确映射到表单字段



### 未保存警告系统验证 (Critical)



- [x] 关闭面板时有未保存更改显示确认弹窗

- [x] 点击遮罩层关闭时有未保存更改显示确认弹窗

- [x] 复制 Collection 时有未保存更改显示确认弹窗

- [x] 确认丢弃后正常关闭/复制复制

- [x] 取消后保持面板打开



### 键盘快捷键验证 (Medium)



- [x] Ctrl+S / Cmd+S 触发保存

- [x] Escape 在输入框中不触发关闭

- [x] Escape 仅关闭最顶层面板



### SQL 编辑器验证 (High)



- [x] View Collection SQL 编辑器有语法高亮

- [x] SELECT/FROM/WHERE 等关键字高亮显示

- [x] 输入表名时有自动补全提示

- [x] 输入字段名时有自动补全提示



### OAuth2 验证 (Medium)



- [x] OAuth2 字段映射配置可用

- [x] 可选择映射 fullname/avatar/id/username

- [x] 提供商Logo 正确显示

- [x] 提供商数量达标35 个（?UI 版本一致）

- [x] 配置错误时卡片显示红色边框和警告图标



### Pin 功能验证 (Low)



- [x] 侧边栏显示 Pinned/Others/System 分组

- [x] Collection 可以 Pin 到侧边栏顶部

- [x] Collection 可以 Unpin

- [x] Pin 状态持久化（localStorage?

- [x] Pin/Unpin 按钮Tooltip 提示



### 代码编辑器加载状态验证 (Low)



- [x] CodeEditor 组件加载时显示 Loading 占位?

- [x] 占位符有 spinner 动画

- [x] 加载完成后显示编辑器



### 动画验证 (Low)



- [x] 面板打开时有滑入动画

- [x] 面板关闭时有淡出动画

- [x] 字段展开/折叠有平滑过渡?

- [x] 保存按钮加载时有旋转图标

- [x] 错误图标有弹出动画?



### 长文本和 Tooltip 验证 (Low)



- [x] Collection 名称过长时有 Tooltip 显示完整名称

- [x] 索引名过长时正确截断并有 Tooltip

- [x] 字段类型图标Tooltip 显示类型名称

- [x] OAuth2 配置错误时有警告图标Tooltip



### 语言一致性验证 (Low)



- [x] Sidebar 搜索placeholder 为英文?

- [x] 所有空状态提示为英文

- [x] OAuth2 面板标题为英文?

- [x] SQL 编辑器placeholder 为英文?



### 测试验证



- [x] 所有单元测试通过

- [x] 测试覆盖率 ≥80%（非 UI 逻辑

- [x] ?TypeScript 类型错误

- [x] ?ESLint 警告



### 视觉验证



- [x] 按钮颜色符合 Apple-style 规范 (slate/blue 配色)

- [x] 边框和阴影正常 ✅

- [x] 响应式布局正常



---



## Spec Coverage Mapping



确保 tasks.md 覆盖 spec.md 中的所有?Functional Requirements?



| Requirement | Task(s) | Status |

|-------------|---------|--------|

| **FR-VIEW View Collection Tab 架构** | T000a-T000d | ✅ **已实现** | |

| **FR-FIELD 字段选项面板默认状态* | T000e-T000h | ✅ **已实现** | |

| **FR-INDEX 索引编辑面板样式** | T000i-T000m | ✅ **已实现** | |

| **FR-FORM 表单验证系统** | T000n-T000w | ✅ **已实现** | |

| **FR-UNSAVED 未保存警告系统* | T000x-T0010 | ✅ **已实现** | |

| **FR-CONFIRM 更新确认弹窗增强** | T0011-T0013 | ✅ **已实现** | |

| **FR-KEYBOARD 键盘快捷键 ✅* | T0014-T0017 | ✅ **已实现** | |

| **FR-SQL SQL 编辑器增强* | T0018-T001c | ✅ **已实现** | |

| **FR-OAUTH OAuth2 字段映射** | T001d-T001f | ✅ **已实现** | |

| **FR-ANIM 面板动画** | T0020-T0024 | ✅ **已实现** | |

| **FR-TOOLTIP 长文本和 Tooltip** | T0025-T0028 | ✅ **已实现** | |

| **FR-LANG 语言一致* | T0029-T002b | ✅ **已实现** | |

| **FR-OAUTH-PROV OAuth2 提供商补充* | T002c-T002f | ✅ **已实现** | |

| **FR-PIN Pin 功能** | T002g-T002j | ✅ **已实现** | |

| **FR-LOADER 代码编辑器加载状态* | T002k | ✅ **已实现** | |

| FR-001 侧边栏底部按钮| T001-T004 | ✅ **已实现** | |

| FR-002 按钮样式 | T003-T004 | ✅ **已实现** | |

| FR-003 按钮固定底部 | T002 | ✅ **已实现** | |

| FR-004 Secret 字段选项 | T007-T008 | ✅ **已实现** | |

| FR-005 SecretFieldOptions | T005-T006 | ✅ **已实现** | |

| FR-006 Secret 密码输入框 ✅| T009-T010 | ✅ **已实现** | |

| FR-007 Secret 掩码显示 | T011-T012 | ✅ **已实现** | |

| FR-008 默认时间戳字段| T013-T014 | ✅ **已实现** | |

| FR-009 字段重命名检测| T015-T017 | ✅ **已实现** | |

| FR-010 多选转单选检测| T018 | ✅ **已实现** | |

| FR-011 OIDC 主机变更检测| T019 | ✅ **已实现** | |

| FR-012 API 规则变更检测| T020 | ✅ **已实现** | |

| FR-013 Collection 重命名检测| T016 | ✅ **已实现** | |

| FR-014 索引表名自动更新 | T023-T025 | ✅ **已实现** | |

| FR-V01~V10 已有功能验证 | T026-T031 | ?**已验证* |

