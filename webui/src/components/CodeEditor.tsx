// T027: 代码编辑器组件
// Phase 0.8: 增强 SQL 语法支持
import { useCallback, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { sql, SQLite } from '@codemirror/lang-sql'
import { html } from '@codemirror/lang-html'
import { EditorView } from '@codemirror/view'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type Language = 'json' | 'javascript' | 'typescript' | 'sql' | 'html' | 'text'

interface CodeEditorProps {
  id?: string
  value?: string
  onChange?: (value: string) => void
  language?: Language
  readOnly?: boolean
  height?: string
  minHeight?: number | string
  maxHeight?: string | number
  placeholder?: string
  className?: string
  theme?: 'light' | 'dark'
  // SQL 专用：表名和列名用于自动补全
  sqlSchema?: {
    tables?: Array<{
      name: string
      columns?: string[]
    }>
  }
  // 是否显示加载状态
  loading?: boolean
  // 简洁模式：隐藏行号、折叠等功能，用于表单字段
  minimal?: boolean
}

/**
 * 代码编辑器组件
 * 基于 CodeMirror 封装，支持 JSON、JavaScript、SQL 等语言
 * 
 * Phase 0.8 增强功能：
 * - SQL 语法高亮
 * - SQL 自动补全（表名、列名、关键字）
 * - SQLite 方言支持
 */
export function CodeEditor({
  id,
  value = '',
  onChange,
  language = 'json',
  readOnly = false,
  height = '200px',
  minHeight,
  maxHeight,
  placeholder = '',
  className,
  theme = 'light',
  sqlSchema,
  loading = false,
  minimal = false,
}: CodeEditorProps) {
  const [focused, setFocused] = useState(false)
  
  // 语言扩展 - 添加错误处理防止多实例冲突
  const extensions = useMemo(() => {
    try {
      // 基础扩展：启用自动换行
      const baseExtensions = [EditorView.lineWrapping]
      
      switch (language) {
        case 'json':
          return [...baseExtensions, json()]
        case 'javascript':
          return [...baseExtensions, javascript()]
        case 'typescript':
          return [...baseExtensions, javascript({ typescript: true })]
        case 'html':
          return [...baseExtensions, html()]
        case 'sql': {
          // 构建 SQL schema 供自动补全使用
          const schema: Record<string, string[]> = {}
          if (sqlSchema?.tables) {
            for (const table of sqlSchema.tables) {
              schema[table.name] = table.columns || []
            }
          }
          return [
            ...baseExtensions,
            sql({
              dialect: SQLite,
              schema: Object.keys(schema).length > 0 ? schema : undefined,
              upperCaseKeywords: true,
            })
          ]
        }
        default:
          return baseExtensions
      }
    } catch (error) {
      console.warn('CodeEditor: Failed to create language extension, falling back to plain text', error)
      return [EditorView.lineWrapping]
    }
  }, [language, sqlSchema])

  // 变更处理
  const handleChange = useCallback(
    (val: string) => {
      onChange?.(val)
    },
    [onChange]
  )
  
  // 计算 minHeight 的样式值
  const minHeightStyle = useMemo(() => {
    if (typeof minHeight === 'number') {
      return `${minHeight}px`
    }
    return minHeight
  }, [minHeight])
  
  // 加载状态
  if (loading) {
    return (
      <div 
        className={cn(
          'border rounded-md overflow-hidden bg-slate-50 flex items-center justify-center',
          className
        )}
        style={{ height, minHeight: minHeightStyle, maxHeight }}
      >
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading editor...</span>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        'overflow-hidden transition-colors',
        !minimal && 'border rounded-md',
        !minimal && focused && 'ring-2 ring-blue-500 ring-offset-1',
        minimal && 'bg-transparent',
        className
      )}
    >
      <CodeMirror
        id={id}
        value={value}
        onChange={handleChange}
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        height={height}
        minHeight={minHeightStyle}
        maxHeight={typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight}
        placeholder={placeholder}
        theme={theme}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        basicSetup={minimal ? {
          // 简洁模式：关闭行号、折叠等
          lineNumbers: false,
          highlightActiveLineGutter: false,
          highlightSpecialChars: true,
          foldGutter: false,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: false,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: false,
          crosshairCursor: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: false,
          historyKeymap: true,
          foldKeymap: false,
          completionKeymap: false,
          lintKeymap: false,
        } : {
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  )
}

export default CodeEditor
