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
            <span>TOF Auth</span>
            <div className="flex-1" />
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEnabled ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Enabled
              </Badge>
            ) : (
              <Badge variant="outline">Disabled</Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {isLoading ? (
            <div className="text-muted-foreground">Loading TOF configuration...</div>
          ) : isEnabled ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                TOF (Tencent Open Framework) authentication is enabled. Users can authenticate through the TOF gateway.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">TOF_APP_KEY</Label>
                  <Input value={tofStatus?.appKey || 'Not configured'} disabled className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">TOF_APP_TOKEN</Label>
                  <Input value={tofStatus?.appToken || 'Not configured'} disabled className="font-mono" />
                </div>
              </div>

              {tofStatus?.devMockUser && (
                <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <p>
                      <strong>Development mode enabled</strong>: Mock user is{' '}
                      <code className="bg-yellow-100 px-1 rounded">{tofStatus.devMockUser}</code>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Remove TOF_DEV_MOCK_USER environment variable for production
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground">
                <p>Auth endpoint:</p>
                <code className="font-mono bg-muted px-2 py-1 rounded">
                  GET /api/collections/{collection.name}/auth-with-tof
                </code>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                TOF authentication is not enabled. To enable TOF auth, set the following environment variables and restart the service:
              </p>
              <ul className="text-muted-foreground text-sm list-disc list-inside space-y-1">
                <li>
                  <code className="bg-muted px-1 rounded">TOF_APP_KEY</code> - TOF application key
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">TOF_APP_TOKEN</code> - TOF application token
                </li>
              </ul>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
