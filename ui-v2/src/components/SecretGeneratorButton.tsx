/**
 * SecretGeneratorButton - 随机密钥生成器按钮
 *
 * 点击后生成随机密钥并显示在下拉框中，支持复制和刷新
 */
import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Sparkles, RefreshCw, Copy, Check } from 'lucide-react'
import { cn, randomSecret } from '@/lib/utils'

export interface SecretGeneratorButtonProps {
  length?: number
  onGenerate?: (secret: string) => void
  className?: string
}

export function SecretGeneratorButton({
  length = 32,
  onGenerate,
  className,
}: SecretGeneratorButtonProps) {
  const [secret, setSecret] = useState('')
  const [copied, setCopied] = useState(false)
  const secretRef = useRef<HTMLSpanElement>(null)

  // 生成新密钥
  const generate = useCallback(() => {
    const newSecret = randomSecret(length)
    setSecret(newSecret)
    setCopied(false)
    onGenerate?.(newSecret)

    // 选中文本
    setTimeout(() => {
      if (secretRef.current) {
        const range = document.createRange()
        range.selectNode(secretRef.current)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    }, 0)
  }, [length, onGenerate])

  // 打开时自动生成
  const handleOpenChange = (open: boolean) => {
    if (open && !secret) {
      generate()
    }
  }

  // 复制到剪贴板
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = secret
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', className)}
                aria-label="Generate secret"
                data-testid="generator-trigger"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Generate</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent
        className="p-2"
        align="center"
        side="top"
        data-testid="generator-popover"
      >
        <div className="flex items-center gap-2">
          <span
            ref={secretRef}
            className="font-mono text-sm select-all"
            data-testid="generated-secret"
          >
            {secret}
          </span>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={copyToClipboard}
                  aria-label="Copy"
                  data-testid="copy-button"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{copied ? 'Copied!' : 'Copy'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={generate}
                  aria-label="Refresh"
                  data-testid="refresh-button"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
