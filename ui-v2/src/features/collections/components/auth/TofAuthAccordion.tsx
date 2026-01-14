import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react'
import { pb } from '@/lib/pocketbase'
import type { Collection } from '@/types'

interface TofAuthAccordionProps {
  collection: Collection
}

interface TofStatus {
  enabled: boolean
  appKey?: string
  appToken?: string
  devMockUser?: string
}

export function TofAuthAccordion({ collection }: TofAuthAccordionProps) {
  const { t } = useTranslation()
  const [tofStatus, setTofStatus] = useState<TofStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadTofStatus() {
      setIsLoading(true)
      try {
        // @ts-expect-error tof API 可能不存在
        const status = await pb.send('/api/tof/status', { method: 'GET' })
        setTofStatus(status)
      } catch (err) {
        // TOF 插件未启用或请求失败
        setTofStatus(null)
      }
      setIsLoading(false)
    }
    loadTofStatus()
  }, [])

  // 如果 TOF 未配置，不显示此组件
  if (!isLoading && tofStatus === null) {
    return null
  }

  const isEnabled = tofStatus?.enabled || false

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="tof-auth">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <ShieldCheck className="w-4 h-4" />
            <span>TOF 认证</span>
            <div className="flex-1" />
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEnabled ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                已启用
              </Badge>
            ) : (
              <Badge variant="outline">未启用</Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {isLoading ? (
            <div className="text-muted-foreground">正在加载 TOF 配置...</div>
          ) : isEnabled ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                TOF (腾讯统一身份认证) 已启用。用户可通过 TOF 网关进行身份验证。
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">TOF_APP_KEY</Label>
                  <Input value={tofStatus?.appKey || '未配置'} disabled className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">TOF_APP_TOKEN</Label>
                  <Input value={tofStatus?.appToken || '未配置'} disabled className="font-mono" />
                </div>
              </div>

              {tofStatus?.devMockUser && (
                <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <p>
                      <strong>开发模式已启用</strong>：模拟用户为{' '}
                      <code className="bg-yellow-100 px-1 rounded">{tofStatus.devMockUser}</code>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      生产环境请移除 TOF_DEV_MOCK_USER 环境变量
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground">
                <p>认证端点：</p>
                <code className="font-mono bg-muted px-2 py-1 rounded">
                  GET /api/collections/{collection.name}/auth-with-tof
                </code>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                TOF 认证未启用。要启用 TOF 认证，请设置以下环境变量后重启服务：
              </p>
              <ul className="text-muted-foreground text-sm list-disc list-inside space-y-1">
                <li>
                  <code className="bg-muted px-1 rounded">TOF_APP_KEY</code> - 太湖应用 Key
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">TOF_APP_TOKEN</code> - 太湖应用 Token
                </li>
              </ul>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
