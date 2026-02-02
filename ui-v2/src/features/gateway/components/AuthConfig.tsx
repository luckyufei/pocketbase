/**
 * AuthConfig 组件
 * 认证配置面板（可折叠）
 */
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { AuthConfig as AuthConfigType } from '../types'

interface AuthConfigProps {
  value: AuthConfigType | undefined
  onChange: (value: AuthConfigType | undefined) => void
  defaultExpanded?: boolean
}

const defaultConfig: AuthConfigType = {
  type: 'none',
}

export function AuthConfig({
  value,
  onChange,
  defaultExpanded = false,
}: AuthConfigProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showToken, setShowToken] = useState(false)
  const config = value || defaultConfig

  const handleTypeChange = (type: AuthConfigType['type']) => {
    if (type === 'none') {
      onChange(undefined)
    } else {
      onChange({ ...config, type })
    }
  }

  const handleFieldChange = (field: keyof AuthConfigType, fieldValue: string) => {
    onChange({ ...config, [field]: fieldValue })
  }

  const hasAuth = config.type !== 'none'

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
        <span className="font-medium text-slate-700">认证配置</span>
        <div className="flex items-center gap-2">
          {hasAuth && (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
              {config.type === 'bearer'
                ? 'Bearer Token'
                : config.type === 'basic'
                  ? 'Basic Auth'
                  : 'Header'}
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
          {/* 认证类型 */}
          <div className="space-y-2">
            <Label htmlFor="auth-type">认证类型</Label>
            <Select value={config.type} onValueChange={handleTypeChange}>
              <SelectTrigger id="auth-type">
                <SelectValue placeholder="选择认证类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无认证</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="header">自定义 Header</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.type === 'bearer' && (
            <div className="space-y-2">
              <Label htmlFor="auth-token">Token</Label>
              <div className="relative">
                <Input
                  id="auth-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="sk-xxx..."
                  value={config.token || ''}
                  onChange={(e) => handleFieldChange('token', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {config.type === 'header' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="auth-header-name">Header 名称</Label>
                <Input
                  id="auth-header-name"
                  placeholder="X-API-Key"
                  value={config.headerName || ''}
                  onChange={(e) => handleFieldChange('headerName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-header-value">Header 值</Label>
                <div className="relative">
                  <Input
                    id="auth-header-value"
                    type={showToken ? 'text' : 'password'}
                    placeholder="your-api-key"
                    value={config.headerValue || ''}
                    onChange={(e) => handleFieldChange('headerValue', e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
