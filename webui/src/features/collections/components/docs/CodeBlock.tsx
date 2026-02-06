/**
 * CodeBlock component
 * Code block display with syntax highlighting
 */
import { useState, useCallback, useMemo } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-dart'
import 'prismjs/components/prism-json'
import 'prismjs/plugins/normalize-whitespace/prism-normalize-whitespace'
import './prism-light.css'

interface CodeBlockProps {
  content: string
  language?: 'javascript' | 'dart' | 'json' | 'html' | 'text'
  showCopy?: boolean
  className?: string
}

export function CodeBlock({
  content,
  language = 'javascript',
  showCopy = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const highlighted = useMemo(() => {
    if (language === 'text' || !Prism.languages[language]) {
      return content.trim()
    }

    // Normalize whitespace using Prism plugin
    // @see https://prismjs.com/plugins/normalize-whitespace
    const normalized = Prism.plugins.NormalizeWhitespace?.normalize(content, {
      'remove-trailing': true,
      'remove-indent': true,
      'left-trim': true,
      'right-trim': true,
    }) || content.trim()

    return Prism.highlight(normalized, Prism.languages[language], language)
  }, [content, language])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [content])

  return (
    <div className={cn('relative group prism-light', className)}>
      <pre className="p-3 bg-muted rounded-lg overflow-auto text-sm">
        <code
          className={`language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
      {showCopy && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  )
}
