/**
 * CodeBlock 组件
 * 代码块展示
 */
import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface CodeBlockProps {
  content: string
  language?: string
  showCopy?: boolean
  className?: string
}

export function CodeBlock({
  content,
  language = 'text',
  showCopy = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

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
    <div className={cn('relative group', className)}>
      <pre className="p-3 bg-muted rounded-lg overflow-auto text-sm font-mono">
        <code className={`language-${language}`}>{content.trim()}</code>
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
