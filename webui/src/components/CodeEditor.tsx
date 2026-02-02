// T027: 代码编辑器组件
import { useCallback, useMemo } from 'react'
import CodeMirror, { type ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { cn } from '@/lib/utils'

type Language = 'json' | 'javascript' | 'typescript' | 'text'

interface CodeEditorProps {
  value?: string
  onChange?: (value: string) => void
  language?: Language
  readOnly?: boolean
  height?: string
  minHeight?: string
  maxHeight?: string
  placeholder?: string
  className?: string
  theme?: 'light' | 'dark'
}

/**
 * 代码编辑器组件
 * 基于 CodeMirror 封装，支持 JSON、JavaScript 等语言
 */
export function CodeEditor({
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
}: CodeEditorProps) {
  // 语言扩展
  const extensions = useMemo(() => {
    switch (language) {
      case 'json':
        return [json()]
      case 'javascript':
        return [javascript()]
      case 'typescript':
        return [javascript({ typescript: true })]
      default:
        return []
    }
  }, [language])

  // 变更处理
  const handleChange = useCallback(
    (val: string) => {
      onChange?.(val)
    },
    [onChange]
  )

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
      <CodeMirror
        value={value}
        onChange={handleChange}
        extensions={extensions}
        readOnly={readOnly}
        height={height}
        minHeight={minHeight}
        maxHeight={maxHeight}
        placeholder={placeholder}
        theme={theme}
        basicSetup={{
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
