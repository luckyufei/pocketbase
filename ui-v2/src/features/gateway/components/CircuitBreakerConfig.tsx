/**
 * CircuitBreakerConfig 组件
 * 熔断配置面板（可折叠）
 */
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { CircuitBreakerConfig as CircuitBreakerConfigType } from '../types'

interface CircuitBreakerConfigProps {
  value: CircuitBreakerConfigType | undefined
  onChange: (value: CircuitBreakerConfigType | undefined) => void
  defaultExpanded?: boolean
}

const defaultConfig: CircuitBreakerConfigType = {
  enabled: false,
  failureThreshold: 5,
  recoveryTimeout: 30,
  halfOpenRequests: 1,
}

export function CircuitBreakerConfig({
  value,
  onChange,
  defaultExpanded = false,
}: CircuitBreakerConfigProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const config = value || defaultConfig

  const handleEnabledChange = (enabled: boolean) => {
    onChange(enabled ? { ...config, enabled } : undefined)
  }

  const handleFieldChange = (field: keyof CircuitBreakerConfigType, fieldValue: number) => {
    onChange({ ...config, [field]: fieldValue })
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* 标题栏 */}
      <button
        type="button"
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between bg-slate-50',
          'hover:bg-slate-100 transition-colors'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-medium text-slate-700">熔断保护</span>
        <div className="flex items-center gap-2">
          {config.enabled && (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
              已启用
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* 配置内容 */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="cb-enabled">启用熔断</Label>
            <Switch
              id="cb-enabled"
              checked={config.enabled}
              onCheckedChange={handleEnabledChange}
            />
          </div>

          {config.enabled && (
            <>
              {/* 失败阈值 */}
              <div className="space-y-2">
                <Label htmlFor="cb-threshold">失败阈值（连续失败次数）</Label>
                <Input
                  id="cb-threshold"
                  type="number"
                  min={1}
                  max={100}
                  value={config.failureThreshold}
                  onChange={(e) =>
                    handleFieldChange('failureThreshold', parseInt(e.target.value, 10) || 5)
                  }
                />
              </div>

              {/* 恢复超时 */}
              <div className="space-y-2">
                <Label htmlFor="cb-recovery">恢复超时（秒）</Label>
                <Input
                  id="cb-recovery"
                  type="number"
                  min={1}
                  max={3600}
                  value={config.recoveryTimeout}
                  onChange={(e) =>
                    handleFieldChange('recoveryTimeout', parseInt(e.target.value, 10) || 30)
                  }
                />
              </div>

              {/* 半开探测数 */}
              <div className="space-y-2">
                <Label htmlFor="cb-halfopen">半开探测数</Label>
                <Input
                  id="cb-halfopen"
                  type="number"
                  min={1}
                  max={10}
                  value={config.halfOpenRequests}
                  onChange={(e) =>
                    handleFieldChange('halfOpenRequests', parseInt(e.target.value, 10) || 1)
                  }
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
