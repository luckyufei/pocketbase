/**
 * ProxyForm 组件
 * 代理配置表单
 */
import { useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { CircuitBreakerConfig } from './CircuitBreakerConfig'
import { TimeoutConfig } from './TimeoutConfig'
import { AuthConfig } from './AuthConfig'
import type { Proxy, ProxyInput, CircuitBreakerConfig as CBConfig, TimeoutConfig as TOConfig } from '../types'

interface ProxyFormProps {
  initialData?: Proxy
  onSubmit: (data: ProxyInput) => Promise<void>
  isSubmitting?: boolean
}

interface FormErrors {
  name?: string
  path?: string
  upstream?: string
  maxConcurrent?: string
}

export interface ProxyFormHandle {
  submit: () => void
}

export const ProxyForm = forwardRef<ProxyFormHandle, ProxyFormProps>(function ProxyForm(
  { initialData, onSubmit, isSubmitting },
  ref
) {
  const { t } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const [formData, setFormData] = useState<ProxyInput>({
    name: initialData?.name || '',
    path: initialData?.path || '',
    upstream: initialData?.upstream || '',
    stripPath: initialData?.stripPath ?? true,
    active: initialData?.active ?? true,
    maxConcurrent: initialData?.maxConcurrent ?? 0,
    circuitBreaker: initialData?.circuitBreaker,
    timeoutConfig: initialData?.timeoutConfig,
    headers: initialData?.headers,
  })

  const [errors, setErrors] = useState<FormErrors>({})

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = t('gateway.nameRequired')
    }

    if (!formData.path.trim()) {
      newErrors.path = t('gateway.pathRequired')
    } else if (!formData.path.startsWith('/')) {
      newErrors.path = t('gateway.pathStartSlash')
    } else if (formData.path.startsWith('/api/') || formData.path === '/api') {
      newErrors.path = t('gateway.pathNoApi')
    } else if (formData.path.startsWith('/_/') || formData.path === '/_') {
      newErrors.path = t('gateway.pathNoAdmin')
    }

    if (!formData.upstream.trim()) {
      newErrors.upstream = t('gateway.upstreamRequired')
    } else {
      try {
        new URL(formData.upstream)
      } catch {
        newErrors.upstream = t('gateway.upstreamInvalid')
      }
    }

    if (formData.maxConcurrent !== undefined && formData.maxConcurrent < 0) {
      newErrors.maxConcurrent = t('gateway.concurrentNegative')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  // 暴露 submit 方法给父组件
  useImperativeHandle(ref, () => ({
    submit: () => {
      formRef.current?.requestSubmit()
    },
  }), [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (validate()) {
        await onSubmit(formData)
      }
    },
    [formData, validate, onSubmit]
  )

  const handleFieldChange = useCallback(
    (field: keyof ProxyInput, value: string | number | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      // 清除该字段的错误
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    },
    [errors]
  )

  const handleCircuitBreakerChange = useCallback((value: CBConfig | undefined) => {
    setFormData((prev) => ({ ...prev, circuitBreaker: value }))
  }, [])

  const handleTimeoutChange = useCallback((value: TOConfig | undefined) => {
    setFormData((prev) => ({ ...prev, timeoutConfig: value }))
  }, [])

  // AuthConfig 转换为 headers
  const handleAuthChange = useCallback((authConfig: { type: string; token?: string; headerName?: string; headerValue?: string } | undefined) => {
    if (!authConfig || authConfig.type === 'none') {
      setFormData((prev) => ({ ...prev, headers: undefined }))
      return
    }

    let headers: Record<string, string> = {}
    if (authConfig.type === 'bearer' && authConfig.token) {
      headers['Authorization'] = `Bearer ${authConfig.token}`
    } else if (authConfig.type === 'basic' && authConfig.token) {
      headers['Authorization'] = `Basic ${authConfig.token}`
    } else if (authConfig.type === 'header' && authConfig.headerName && authConfig.headerValue) {
      headers[authConfig.headerName] = authConfig.headerValue
    }

    setFormData((prev) => ({ ...prev, headers: Object.keys(headers).length > 0 ? headers : undefined }))
  }, [])

  // 从 headers 转换回 AuthConfig 用于显示
  const getAuthConfigFromHeaders = useCallback((): { type: 'none' | 'bearer' | 'basic' | 'header'; token?: string; headerName?: string; headerValue?: string } | undefined => {
    if (!formData.headers || Object.keys(formData.headers).length === 0) {
      return undefined
    }

    const auth = formData.headers['Authorization']
    if (auth) {
      if (auth.startsWith('Bearer ')) {
        return { type: 'bearer', token: auth.slice(7) }
      } else if (auth.startsWith('Basic ')) {
        return { type: 'basic', token: auth.slice(6) }
      }
    }

    // 其他自定义头
    const [headerName, headerValue] = Object.entries(formData.headers)[0] || []
    if (headerName && headerValue) {
      return { type: 'header', headerName, headerValue }
    }

    return undefined
  }, [formData.headers])

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* 基础配置 */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-700">{t('gateway.basicConfig')}</h3>

        {/* 名称 */}
        <div className="space-y-2">
          <Label htmlFor="name">
            {t('gateway.name')} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="OpenAI Proxy"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </div>

        {/* 拦截路径 */}
        <div className="space-y-2">
          <Label htmlFor="path">
            {t('gateway.interceptPath')} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="path"
            placeholder="/-/openai"
            value={formData.path}
            onChange={(e) => handleFieldChange('path', e.target.value)}
            className={errors.path ? 'border-red-500' : ''}
          />
          <p className="text-xs text-slate-400">{t('gateway.pathHint')}</p>
          {errors.path && <p className="text-xs text-red-500">{errors.path}</p>}
        </div>

        {/* 上游地址 */}
        <div className="space-y-2">
          <Label htmlFor="upstream">
            {t('gateway.upstreamUrl')} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="upstream"
            placeholder="https://api.openai.com"
            value={formData.upstream}
            onChange={(e) => handleFieldChange('upstream', e.target.value)}
            className={errors.upstream ? 'border-red-500' : ''}
          />
          {errors.upstream && <p className="text-xs text-red-500">{errors.upstream}</p>}
        </div>

        {/* 启用 */}
        <div className="flex items-center justify-between">
          <Label htmlFor="active">{t('gateway.enabled')}</Label>
          <Switch
            id="active"
            checked={formData.active}
            onCheckedChange={(checked) => handleFieldChange('active', checked)}
          />
        </div>

        {/* 移除前缀 */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="stripPath">{t('gateway.stripPath')}</Label>
            <p className="text-xs text-slate-400">{t('gateway.stripPathDesc')}</p>
          </div>
          <Switch
            id="stripPath"
            checked={formData.stripPath}
            onCheckedChange={(checked) => handleFieldChange('stripPath', checked)}
          />
        </div>
      </div>

      {/* 流量控制 */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-700">{t('gateway.trafficControl')}</h3>

        {/* 最大并发 */}
        <div className="space-y-2">
          <Label htmlFor="maxConcurrent">{t('gateway.maxConcurrent')}</Label>
          <Input
            id="maxConcurrent"
            type="number"
            min={0}
            max={10000}
            placeholder="0"
            value={formData.maxConcurrent}
            onChange={(e) =>
              handleFieldChange('maxConcurrent', parseInt(e.target.value, 10) || 0)
            }
            className={errors.maxConcurrent ? 'border-red-500' : ''}
          />
          <p className="text-xs text-slate-400">{t('gateway.noLimitHint')}</p>
          {errors.maxConcurrent && (
            <p className="text-xs text-red-500">{errors.maxConcurrent}</p>
          )}
        </div>
      </div>

      {/* 折叠面板 */}
      <div className="space-y-4">
        <CircuitBreakerConfig
          value={formData.circuitBreaker}
          onChange={handleCircuitBreakerChange}
        />

        <TimeoutConfig value={formData.timeoutConfig} onChange={handleTimeoutChange} />

        <AuthConfig value={getAuthConfigFromHeaders()} onChange={handleAuthChange} />
      </div>

      {/* 提交按钮（由父组件提供） */}
      <input type="submit" hidden disabled={isSubmitting} />
    </form>
  )
})
