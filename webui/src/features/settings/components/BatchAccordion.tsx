/**
 * T068: BatchAccordion - 批量操作配置组件
 * 用于配置批量 API 设置
 */
import { Archive, AlertTriangle, Info } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface BatchSettings {
  enabled: boolean
  maxRequests: number
  timeout: number
  maxBodySize?: number
}

interface BatchAccordionProps {
  settings: BatchSettings
  onChange: (settings: BatchSettings) => void
  hideControls: boolean
  onHideControlsChange: (value: boolean) => void
  errors?: Record<string, string>
}

export function BatchAccordion({ settings, onChange, hideControls, onHideControlsChange, errors }: BatchAccordionProps) {
  const hasErrors = errors && Object.keys(errors).length > 0

  const handleChange = (field: keyof BatchSettings, value: unknown) => {
    onChange({ ...settings, [field]: value })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="batch" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Archive className="h-4 w-4" />
            <span>Batch Requests</span>
          </div>
          <div className="flex items-center gap-2 mr-2">
            <Badge variant={settings.enabled ? 'default' : 'secondary'}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            {hasErrors && <AlertTriangle className="h-4 w-4 text-destructive" />}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="batch-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => handleChange('enabled', checked)}
            />
            <Label htmlFor="batch-enabled" className="flex items-center gap-1">
              Enable
              <span className="text-muted-foreground text-xs">(experimental)</span>
            </Label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="batch-maxRequests"
                className={cn(settings.enabled && 'after:content-["*"] after:text-destructive')}
              >
                <span className="flex items-center gap-1">
                  Max requests in a batch
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          Rate limiting (if enabled) also applies for the batch
                          create/update/upsert/delete requests.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </Label>
              <Input
                id="batch-maxRequests"
                type="number"
                min={0}
                step={1}
                required={settings.enabled}
                value={settings.maxRequests}
                onChange={(e) => handleChange('maxRequests', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="batch-timeout"
                className={cn(settings.enabled && 'after:content-["*"] after:text-destructive')}
              >
                Max processing time (in seconds)
              </Label>
              <Input
                id="batch-timeout"
                type="number"
                min={0}
                step={1}
                required={settings.enabled}
                value={settings.timeout}
                onChange={(e) => handleChange('timeout', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-maxBodySize">Max body size (in bytes)</Label>
              <Input
                id="batch-maxBodySize"
                type="number"
                min={0}
                step={1}
                placeholder="Default to 128MB"
                value={settings.maxBodySize || ''}
                onChange={(e) =>
                  handleChange('maxBodySize', e.target.value ? parseInt(e.target.value) : undefined)
                }
              />
            </div>
          </div>

          {/* Hide collection create and edit controls */}
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="batch-hideControls"
              checked={hideControls}
              onCheckedChange={onHideControlsChange}
            />
            <Label htmlFor="batch-hideControls" className="flex items-center gap-1">
              Hide collection create and edit controls
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      This could prevent making accidental schema changes when in production
                      environment.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export default BatchAccordion
