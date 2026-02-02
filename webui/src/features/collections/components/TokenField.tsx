/**
 * Token 字段组件
 * 用于展示和复制 Token 值
 */
import { useState } from 'react'
import { Copy, Check, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'

interface TokenFieldProps {
  label: string
  value: string
  onChange?: (value: string) => void
  onRegenerate?: () => void
  readOnly?: boolean
  showRegenerateButton?: boolean
  className?: string
}

export function TokenField({
  label,
  value,
  onChange,
  onRegenerate,
  readOnly = false,
  showRegenerateButton = false,
  className = '',
}: TokenFieldProps) {
  const [showValue, setShowValue] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: '已复制到剪贴板',
      })
    } catch {
      toast({
        title: '复制失败',
        variant: 'destructive',
      })
    }
  }

  const displayValue = showValue ? value : value ? '•'.repeat(Math.min(value.length, 40)) : ''

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={showValue ? 'text' : 'password'}
            value={displayValue}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            readOnly={readOnly}
            className="pr-20 font-mono text-sm"
            placeholder={readOnly ? '未设置' : '输入 Token'}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowValue(!showValue)}
            >
              {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
              disabled={!value}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {showRegenerateButton && onRegenerate && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRegenerate}
            title="重新生成"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
