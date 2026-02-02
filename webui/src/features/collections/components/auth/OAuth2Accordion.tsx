/**
 * OAuth2Accordion - OAuth2 认证配置组件
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Plus } from 'lucide-react'

interface OAuth2Provider {
  name: string
  clientId: string
  clientSecret: string
  authURL?: string
  tokenURL?: string
}

interface OAuth2Config {
  enabled: boolean
  providers: OAuth2Provider[]
}

interface OAuth2AccordionProps {
  oauth2: OAuth2Config
  onChange: (config: OAuth2Config) => void
}

export function OAuth2Accordion({ oauth2, onChange }: OAuth2AccordionProps) {
  const handleEnabledChange = (checked: boolean) => {
    onChange({
      ...oauth2,
      enabled: checked,
    })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="oauth2" className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Users className="h-4 w-4" />
            <span>OAuth2</span>
            <div className="flex-1" />
            <Badge variant={oauth2.enabled ? 'default' : 'secondary'}>
              {oauth2.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="oauth2-enabled"
              checked={oauth2.enabled}
              onCheckedChange={handleEnabledChange}
            />
            <Label htmlFor="oauth2-enabled">Enable</Label>
          </div>

          {oauth2.enabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Providers</Label>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add provider
                </Button>
              </div>

              {oauth2.providers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No OAuth2 providers configured.</p>
              ) : (
                <div className="space-y-2">
                  {oauth2.providers.map((provider, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="text-sm font-medium">{provider.name}</span>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
