/**
 * EditorField - 富文本编辑器字段组件
 *
 * 使用 TinyMCE 作为富文本编辑器，支持：
 * - 富文本格式化
 * - 图片插入（包括从已有记录选择）
 * - 链接管理
 * - 代码块
 * - 表格
 */
import { useRef, useCallback, useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/FormField'
import { FieldLabel } from './FieldLabel'
import { cn } from '@/lib/utils'
import { Editor } from '@tinymce/tinymce-react'
import { RecordFilePicker, type FileSelection } from '../RecordFilePicker'
import { usePocketbase } from '@/hooks/usePocketbase'

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

// TinyMCE 默认配置 - 匹配 PocketBase 原始配置
const defaultEditorConfig = {
  branding: false,
  promotion: false,
  menubar: false,
  min_height: 270,
  height: 270,
  max_height: 700,
  autoresize_bottom_margin: 30,
  convert_unsafe_embeds: true, // GHSA-5359 安全修复
  skin: 'pocketbase',
  content_style: 'body { font-size: 14px }',
  plugins: [
    'autoresize',
    'autolink',
    'lists',
    'link',
    'image',
    'searchreplace',
    'fullscreen',
    'media',
    'table',
    'code',
    'codesample',
    'directionality',
  ],
  codesample_global_prismjs: true,
  codesample_languages: [
    { text: 'HTML/XML', value: 'markup' },
    { text: 'CSS', value: 'css' },
    { text: 'SQL', value: 'sql' },
    { text: 'JavaScript', value: 'javascript' },
    { text: 'Go', value: 'go' },
    { text: 'Dart', value: 'dart' },
    { text: 'Zig', value: 'zig' },
    { text: 'Rust', value: 'rust' },
    { text: 'Lua', value: 'lua' },
    { text: 'PHP', value: 'php' },
    { text: 'Ruby', value: 'ruby' },
    { text: 'Python', value: 'python' },
    { text: 'Java', value: 'java' },
    { text: 'C', value: 'c' },
    { text: 'C#', value: 'csharp' },
    { text: 'C++', value: 'cpp' },
    { text: 'Markdown', value: 'markdown' },
    { text: 'Swift', value: 'swift' },
    { text: 'Kotlin', value: 'kotlin' },
    { text: 'Elixir', value: 'elixir' },
    { text: 'Scala', value: 'scala' },
    { text: 'Julia', value: 'julia' },
    { text: 'Haskell', value: 'haskell' },
  ],
  toolbar:
    'styles | alignleft aligncenter alignright | bold italic forecolor backcolor | ' +
    'bullist numlist | link image table codesample ltr rtl | code fullscreen',
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
  const { pb } = usePocketbase()
  const editorRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showFilePicker, setShowFilePicker] = useState(false)

  const handleEditorChange = useCallback(
    (content: string) => {
      onChange(content)
    },
    [onChange]
  )

  const handleInit = useCallback((_evt: any, editor: any) => {
    editorRef.current = editor
    setIsLoading(false)
    
    // Register custom event for file picker
    editor.on('collections_file_picker', () => {
      setShowFilePicker(true)
    })
  }, [])

  const handleLoadError = useCallback(() => {
    setLoadError(true)
    setIsLoading(false)
  }, [])

  // Handle file selection from picker
  const handleFileSelect = useCallback((selection: FileSelection) => {
    if (!editorRef.current) return
    
    const url = pb.files.getURL(selection.record, selection.name, {
      thumb: selection.size || undefined,
    })
    
    editorRef.current.execCommand('InsertImage', false, url)
  }, [pb])

  // 构建编辑器配置
  const editorConfig = {
    ...defaultEditorConfig,
    height: field.options?.height || defaultEditorConfig.height,
    convert_urls: field.options?.convertUrls ?? false,
    readonly: disabled,
    // Add custom setup for file picker button
    setup: (editor: any) => {
      // Add custom button to trigger file picker
      editor.ui.registry.addButton('pbfilepicker', {
        icon: 'gallery',
        tooltip: 'Select image from records',
        onAction: () => {
          editor.fire('collections_file_picker')
        },
      })
    },
    // Update toolbar to include the custom button
    toolbar:
      'styles | alignleft aligncenter alignright | bold italic forecolor backcolor | ' +
      'bullist numlist | link image pbfilepicker table codesample ltr rtl | code fullscreen',
  }

  // 回退到简单 textarea
  if (useFallback || loadError) {
    return (
      <FormField name={field.name} className={cn('', className)}>
        <FieldLabel field={field as any} htmlFor={field.name} />
        <Textarea
          id={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={field.required}
          className="min-h-[200px] font-mono text-sm"
          placeholder="Enter HTML content..."
        />
      </FormField>
    )
  }

  return (
    <>
      <FormField name={field.name} className={cn('', className)}>
        <FieldLabel field={field as any} htmlFor={field.name} />

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
      </FormField>

      {/* File Picker Dialog */}
      <RecordFilePicker
        open={showFilePicker}
        onOpenChange={setShowFilePicker}
        title="Select an image"
        fileTypes={['image']}
        onSubmit={handleFileSelect}
      />
    </>
  )
}

export default EditorField
