/**
 * OAuth2Accordion - OAuth2 authentication configuration component
 */
import { useState, useMemo } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Users, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProviderByName } from '@/lib/providers'

interface OAuth2Provider {
  name: string
  clientId: string
  clientSecret: string
  authURL?: string
  tokenURL?: string
}

interface MappedFields {
  name?: string
  avatarURL?: string
  id?: string
  username?: string
}

interface OAuth2Config {
  enabled: boolean
  providers: OAuth2Provider[]
  mappedFields?: MappedFields
}

interface CollectionField {
  name: string
  type: string
}

interface OAuth2AccordionProps {
  oauth2: OAuth2Config
  onChange: (config: OAuth2Config) => void
  collectionName?: string
  fields?: CollectionField[]
  onAddProvider?: () => void
  onEditProvider?: (providerName: string) => void
}

// 排除的系统字段
const EXCLUDED_FIELD_NAMES = ['id', 'email', 'emailVisibility', 'verified', 'tokenKey', 'password']
// 允许映射的字段类型（文本类）
const ALLOWED_TEXT_TYPES = ['text', 'editor', 'url', 'email', 'json']
// 允许映射的字段类型（包含文件）
const ALLOWED_TEXT_AND_FILE_TYPES = [...ALLOWED_TEXT_TYPES, 'file']

export function OAuth2Accordion({
  oauth2,
  onChange,
  collectionName = 'collection',
  fields = [],
  onAddProvider,
  onEditProvider,
}: OAuth2AccordionProps) {
  const [showMappedFields, setShowMappedFields] = useState(false)

  const handleEnabledChange = (checked: boolean) => {
    onChange({
      ...oauth2,
      enabled: checked,
    })
  }

  const handleMappedFieldChange = (field: keyof MappedFields, value: string) => {
    onChange({
      ...oauth2,
      mappedFields: {
        ...oauth2.mappedFields,
        [field]: value === '__none__' ? '' : value,
      },
    })
  }

  // 获取可用的文本字段选项
  const textFieldOptions = useMemo(() => {
    return fields
      .filter(
        (f) =>
          ALLOWED_TEXT_TYPES.includes(f.type) && !EXCLUDED_FIELD_NAMES.includes(f.name)
      )
      .map((f) => f.name)
  }, [fields])

  // 获取可用的文本+文件字段选项（用于 avatar）
  const textAndFileFieldOptions = useMemo(() => {
    return fields
      .filter(
        (f) =>
          ALLOWED_TEXT_AND_FILE_TYPES.includes(f.type) && !EXCLUDED_FIELD_NAMES.includes(f.name)
      )
      .map((f) => f.name)
  }, [fields])

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="oauth2" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px]">OAuth2</span>
            <div className="flex-1" />
            {oauth2.enabled && oauth2.providers.length > 0 && (
              <Badge variant="secondary" className="mr-1.5 text-[10px] px-1.5 py-0 h-5">
                {oauth2.providers.length} {oauth2.providers.length === 1 ? 'provider' : 'providers'}
              </Badge>
            )}
            <Badge 
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-5 ${
                oauth2.enabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {oauth2.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              id="oauth2-enabled"
              checked={oauth2.enabled}
              onCheckedChange={handleEnabledChange}
              className="scale-75 origin-left"
            />
            <Label htmlFor="oauth2-enabled" className="text-[12px]">Enable</Label>
          </div>

          {oauth2.enabled && (
            <>
              {/* 提供商列表 */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {oauth2.providers.map((provider, index) => {
                    const providerInfo = getProviderByName(provider.name)
                    return (
                      <button
                        key={index}
                        type="button"
                        className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors text-left"
                        onClick={() => onEditProvider?.(provider.name)}
                      >
                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {providerInfo?.logo ? (
                            <img
                              src={`/images/oauth2/${providerInfo.logo}`}
                              alt={providerInfo.displayName}
                              className="w-4 h-4 object-contain"
                            />
                          ) : (
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {provider.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[11px] truncate">
                            {providerInfo?.displayName || provider.name}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 p-2 border border-dashed rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
                    onClick={onAddProvider}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Add provider</span>
                  </button>
                </div>
              </div>

              {/* 字段映射 */}
              <Collapsible open={showMappedFields} onOpenChange={setShowMappedFields}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant={showMappedFields ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-between mt-2 h-7 text-[11px]"
                  >
                    <span className="font-medium">
                      Optional {collectionName} create fields map
                    </span>
                    {showMappedFields ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* OAuth2 full name */}
                    <div className="space-y-1">
                      <Label htmlFor="mapped-name" className="text-[11px] text-muted-foreground">
                        OAuth2 full name
                      </Label>
                      <Select
                        value={oauth2.mappedFields?.name || '__none__'}
                        onValueChange={(value) => handleMappedFieldChange('name', value)}
                      >
                        <SelectTrigger id="mapped-name" className="h-7 text-[11px]">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Select field</span>
                          </SelectItem>
                          {textFieldOptions.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* OAuth2 avatar */}
                    <div className="space-y-1">
                      <Label htmlFor="mapped-avatar" className="text-[11px] text-muted-foreground">
                        OAuth2 avatar
                      </Label>
                      <Select
                        value={oauth2.mappedFields?.avatarURL || '__none__'}
                        onValueChange={(value) => handleMappedFieldChange('avatarURL', value)}
                      >
                        <SelectTrigger id="mapped-avatar" className="h-7 text-[11px]">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Select field</span>
                          </SelectItem>
                          {textAndFileFieldOptions.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* OAuth2 id */}
                    <div className="space-y-1">
                      <Label htmlFor="mapped-id" className="text-[11px] text-muted-foreground">
                        OAuth2 id
                      </Label>
                      <Select
                        value={oauth2.mappedFields?.id || '__none__'}
                        onValueChange={(value) => handleMappedFieldChange('id', value)}
                      >
                        <SelectTrigger id="mapped-id" className="h-7 text-[11px]">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Select field</span>
                          </SelectItem>
                          {textFieldOptions.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* OAuth2 username */}
                    <div className="space-y-1">
                      <Label htmlFor="mapped-username" className="text-[11px] text-muted-foreground">
                        OAuth2 username
                      </Label>
                      <Select
                        value={oauth2.mappedFields?.username || '__none__'}
                        onValueChange={(value) => handleMappedFieldChange('username', value)}
                      >
                        <SelectTrigger id="mapped-username" className="h-7 text-[11px]">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Select field</span>
                          </SelectItem>
                          {textFieldOptions.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
