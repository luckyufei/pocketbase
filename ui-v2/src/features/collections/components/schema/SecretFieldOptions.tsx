/**
 * SecretFieldOptions - Secret 字段 Schema 配置组件
 *
 * 配置选项:
 * - maxSize: 最大值大小（字节），默认 4096
 * - hidden: 默认 true
 * - required: 是否必填
 *
 * 警告提示:
 * - 使用 AES-256-GCM 加密，密钥来自 PB_MASTER_KEY
 * - 不能用于过滤和搜索
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, ShieldCheck, AlertTriangle } from 'lucide-react'

export interface SecretField {
  name: string
  type: 'secret'
  hidden?: boolean // 默认 true
  required?: boolean
  maxSize?: number // 默认 4096
  [key: string]: unknown
}

interface SecretFieldOptionsProps {
  field: SecretField
  onChange: (field: SecretField) => void
}

export function SecretFieldOptions({
  field,
  onChange,
}: SecretFieldOptionsProps) {
  // 确保 hidden 默认为 true
  if (field.hidden === undefined) {
    onChange({ ...field, hidden: true })
  }

  const handleChange = (key: keyof SecretField, value: unknown) => {
    onChange({ ...field, [key]: value })
  }

  return (
    <div className="space-y-4" data-testid="secret-field-options">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="secret-maxSize">Max size</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum size of the secret value in bytes. Default is 4096 (4KB).</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="secret-maxSize"
            type="number"
            min={1}
            max={4096}
            step={1}
            placeholder="Default: 4096"
            value={field.maxSize || ''}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10)
              handleChange('maxSize', isNaN(value) ? undefined : value)
            }}
            data-testid="secret-maxSize-input"
          />
        </div>
      </div>

      <Alert variant="default" className="border-amber-200 bg-amber-50">
        <ShieldCheck className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <p className="font-medium">Secret fields are encrypted</p>
          <p className="text-sm mt-1">
            Uses <code className="bg-amber-100 px-1 rounded">AES-256-GCM</code> encryption with the{' '}
            <code className="bg-amber-100 px-1 rounded">PB_MASTER_KEY</code> environment variable.
          </p>
          <p className="text-sm mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Secret fields cannot be used in filters or searches.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  )
}
