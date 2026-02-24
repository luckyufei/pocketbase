/**
 * TimeoutConfig 组件
 * 超时配置面板（可折叠）
 */
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TimeoutConfig as TimeoutConfigType } from '../types'

interface TimeoutConfigProps {
  value: TimeoutConfigType | undefined
  onChange: (value: TimeoutConfigType | undefined) => void
  defaultExpanded?: boolean
}

const defaultConfig: TimeoutConfigType = {
  dial: 2,
  responseHeader: 30,
  idle: 90,
}

export function TimeoutConfig({
  value,
  onChange,
  defaultExpanded = false,
}: TimeoutConfigProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { t } = useTranslation()
  const config = value || defaultConfig

  const handleFieldChange = (field: keyof TimeoutConfigType, fieldValue: number) => {
    onChange({ ...config, [field]: fieldValue })
  }

  const isCustom =
    value &&
    (value.dial !== defaultConfig.dial ||
      value.responseHeader !== defaultConfig.responseHeader ||
      value.idle !== defaultConfig.idle)

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
        <span className="font-medium text-slate-700">{t('gateway.advancedTimeout')}</span>
        <div className="flex items-center gap-2">
          {isCustom && (
            <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
              {t('gateway.customized')}
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
          {/* 建连超时 */}
          <div className="space-y-2">
            <Label htmlFor="timeout-dial">{t('gateway.dialTimeout')}</Label>
            <Input
              id="timeout-dial"
              type="number"
              min={1}
              max={60}
              value={config.dial}
              onChange={(e) => handleFieldChange('dial', parseInt(e.target.value, 10) || 2)}
            />
            <p className="text-xs text-slate-400">{t('gateway.dialTimeoutDefault')}</p>
          </div>

          {/* 首字节超时 */}
          <div className="space-y-2">
            <Label htmlFor="timeout-response">{t('gateway.responseTimeout')}</Label>
            <Input
              id="timeout-response"
              type="number"
              min={0}
              max={3600}
              value={config.responseHeader}
              onChange={(e) =>
                handleFieldChange('responseHeader', parseInt(e.target.value, 10) || 0)
              }
            />
            <p className="text-xs text-slate-400">{t('gateway.responseTimeoutDefault')}</p>
          </div>

          {/* 空闲超时 */}
          <div className="space-y-2">
            <Label htmlFor="timeout-idle">{t('gateway.idleTimeout')}</Label>
            <Input
              id="timeout-idle"
              type="number"
              min={1}
              max={3600}
              value={config.idle}
              onChange={(e) => handleFieldChange('idle', parseInt(e.target.value, 10) || 90)}
            />
            <p className="text-xs text-slate-400">{t('gateway.idleTimeoutDefault')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
