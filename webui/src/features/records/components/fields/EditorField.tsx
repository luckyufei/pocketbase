/**
 * EditorField - 富文本编辑器字段组件
 *
 * 使用 TinyMCE 作为富文本编辑器，支持：
 * - 富文本格式化
 * - 图片插入
 * - 链接管理
 * - 代码块
 * - 表格
 */
import { useRef, useCallback, useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Editor } from '@tinymce/tinymce-react'

interface EditorFieldProps {
  field: {
    id?: string
    name: string
    type: string
    required?: boolean
    options?: {
      convertUrls?: boolean
      height?: number
    }
  }
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  useFallback?: boolean
  className?: string
}

// TinyMCE 默认配置
const defaultEditorConfig = {
  height: 300,
  menubar: false,
  plugins: [
    'advlist',
    'autolink',
    'lists',
    'link',
    'image',
    'charmap',
    'preview',
    'anchor',
    'searchreplace',
    'visualblocks',
    'code',
    'fullscreen',
    'insertdatetime',
    'media',
    'table',
    'code',
    'help',
    'wordcount',
  ],
  toolbar:
    'undo redo | blocks | ' +
    'bold italic forecolor | alignleft aligncenter ' +
    'alignright alignjustify | bullist numlist outdent indent | ' +
    'removeformat | help',
  content_style:
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; }',
  branding: false,
  promotion: false,
  convert_urls: false,
  relative_urls: false,
  remove_script_host: false,
}

export function EditorField({
  field,
  value,
  onChange,
  disabled = false,
  useFallback = false,
  className,
}: EditorFieldProps) {
  const editorRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const handleEditorChange = useCallback(
    (content: string) => {
      onChange(content)
    },
    [onChange]
  )

  const handleInit = useCallback((_evt: any, editor: any) => {
    editorRef.current = editor
    setIsLoading(false)
  }, [])

  const handleLoadError = useCallback(() => {
    setLoadError(true)
    setIsLoading(false)
  }, [])

  // 构建编辑器配置
  const editorConfig = {
    ...defaultEditorConfig,
    height: field.options?.height || defaultEditorConfig.height,
    convert_urls: field.options?.convertUrls ?? false,
    readonly: disabled,
  }

  // 回退到简单 textarea
  if (useFallback || loadError) {
    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={field.name} className="flex items-center gap-1">
          <span>{field.name}</span>
          {field.required && <span className="text-destructive">*</span>}
        </Label>
        <Textarea
          id={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={field.required}
          className="min-h-[200px] font-mono text-sm"
          placeholder="Enter HTML content..."
        />
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={field.name} className="flex items-center gap-1">
        <span>{field.name}</span>
        {field.required && <span className="text-destructive">*</span>}
      </Label>

      <div className={cn('rounded-md border', isLoading && 'animate-pulse bg-muted')}>
        <Editor
          id={field.id || field.name}
          value={value}
          onEditorChange={handleEditorChange}
          onInit={handleInit}
          disabled={disabled}
          init={editorConfig}
          tinymceScriptSrc="/libs/tinymce/tinymce.min.js"
        />
      </div>
    </div>
  )
}

export default EditorField
