/**
 * SecretField - Secret 字段编辑组件
 * Phase 2.4: 实现 Secret 字段的密码输入和显示/隐藏功能
 */
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SecretFieldProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function SecretField({ value, onChange, disabled = false }: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false)
  
  // 生成掩码值：sk-•••••••••345
  const maskedValue = value 
    ? `${value.slice(0, 3)}${'•'.repeat(10)}${value.slice(-3)}`
    : ''
  
  return (
    <div className="relative">
      <Input
        type={revealed ? 'text' : 'password'}
        value={revealed ? value : maskedValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="pr-20"
      />
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
        onClick={() => setRevealed(!revealed)}
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  )
}
