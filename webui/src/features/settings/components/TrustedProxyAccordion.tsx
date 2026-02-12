/**
 * T067: TrustedProxyAccordion - 可信代理配置组件
 * 用于配置用户 IP 代理头
 */
import { useMemo } from 'react'
import { Route, AlertTriangle, Info, X } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface TrustedProxySettings {
  headers: string[]
  useLeftmostIP: boolean
}

interface HealthData {
  realIP?: string
  possibleProxyHeader?: string
}

interface TrustedProxyAccordionProps {
  settings: TrustedProxySettings
  healthData?: HealthData
  onChange: (settings: TrustedProxySettings) => void
  errors?: Record<string, string>
}

const commonProxyHeaders = ['X-Forwarded-For', 'Fly-Client-IP', 'CF-Connecting-IP']

export function TrustedProxyAccordion({
  settings,
  healthData = {},
  onChange,
  errors,
}: TrustedProxyAccordionProps) {
  const isEnabled = settings.headers.length > 0
  const hasErrors = errors && Object.keys(errors).length > 0

  const suggestedProxyHeaders = useMemo(() => {
    if (!healthData.possibleProxyHeader) return commonProxyHeaders
    return [
      healthData.possibleProxyHeader,
      ...commonProxyHeaders.filter((h) => h !== healthData.possibleProxyHeader),
    ]
  }, [healthData.possibleProxyHeader])

  const setHeader = (val: string) => {
    onChange({ ...settings, headers: [val] })
  }

  const clearHeaders = () => {
    onChange({ ...settings, headers: [] })
  }

  const handleHeadersChange = (value: string) => {
    const headers = value
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
    onChange({ ...settings, headers })
  }

  const handleUseLeftmostIPChange = (value: string) => {
    onChange({ ...settings, useLeftmostIP: value === 'true' })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="trusted-proxy" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Route className="h-4 w-4" />
            <span>Trusted Proxy</span>
            {!isEnabled && healthData.possibleProxyHeader && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Detected proxy header.</p>
                    <p>It is recommend to list it as trusted.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-2 mr-2">
            <Badge variant={isEnabled ? 'default' : 'secondary'}>
              {isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
            {hasErrors && <AlertTriangle className="h-4 w-4 text-destructive" />}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span>Resolved user IP:</span>
                  <strong>{healthData.realIP || 'N/A'}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span>Detected proxy header:</span>
                  <strong>{healthData.possibleProxyHeader || 'N/A'}</strong>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              When PocketBase is deployed on platforms like Fly or it is accessible through proxies
              such as NGINX, requests from different users will originate from the same IP address
              (the IP of the proxy connecting to your PocketBase app).
            </p>
            <p>
              In this case to retrieve the actual user IP (used for rate limiting, logging, etc.)
              you need to properly configure your proxy and list below the trusted headers that
              PocketBase could use to extract the user IP.
            </p>
            <p className="font-medium">
              When using such proxy, to avoid spoofing it is recommended to:
            </p>
            <ul className="list-disc list-inside font-medium">
              <li>
                use headers that are controlled only by the proxy and cannot be manually set by the
                users
              </li>
              <li>make sure that the PocketBase server can be accessed only through the proxy</li>
            </ul>
            <p>You can clear the headers field if PocketBase is not deployed behind a proxy.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 space-y-2">
              <Label>Trusted IP proxy headers</Label>
              <div className="relative">
                <Input
                  placeholder="Leave empty to disable"
                  value={settings.headers.join(', ')}
                  onChange={(e) => handleHeadersChange(e.target.value)}
                />
                {settings.headers.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                    onClick={clearHeaders}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="text-sm text-muted-foreground">Suggested:</span>
                {suggestedProxyHeaders.map((header) => (
                  <Button
                    key={header}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs font-mono"
                    onClick={() => setHeader(header)}
                  >
                    {header}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                IP priority selection
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        This is in case the proxy returns more than 1 IP as header value. The
                        rightmost IP is usually considered to be the more trustworthy but this could
                        vary depending on the proxy.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Select
                value={settings.useLeftmostIP ? 'true' : 'false'}
                onValueChange={handleUseLeftmostIPChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Use leftmost IP</SelectItem>
                  <SelectItem value="false">Use rightmost IP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export default TrustedProxyAccordion
