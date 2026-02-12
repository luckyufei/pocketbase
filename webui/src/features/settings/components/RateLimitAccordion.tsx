/**
 * 速率限制配置组件
 * 用于配置 API 请求的速率限制规则
 */
import { useState, useMemo } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Activity, Plus, X, HelpCircle, AlertCircle } from 'lucide-react'
import { useCollections } from '@/features/collections/hooks/useCollections'

export interface RateLimitRule {
  label: string
  maxRequests: number
  duration: number
  audience: string
}

export interface RateLimitsSettings {
  enabled: boolean
  rules: RateLimitRule[]
}

interface RateLimitAccordionProps {
  value: RateLimitsSettings
  onChange: (value: RateLimitsSettings) => void
  errors?: Record<string, string>
}

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '@guest', label: 'Guest only' },
  { value: '@auth', label: 'Auth only' },
]

// Convert between UI value and API value
const audienceToUI = (value: string) => (value === '' ? 'all' : value)
const audienceToAPI = (value: string) => (value === 'all' ? '' : value)

const BASE_PREDEFINED_TAGS = [
  { value: '*:list' },
  { value: '*:view' },
  { value: '*:create' },
  { value: '*:update' },
  { value: '*:delete' },
  { value: '*:file', description: 'targets the files download endpoint' },
  { value: '*:listAuthMethods' },
  { value: '*:authRefresh' },
  { value: '*:auth', description: 'targets all auth methods' },
  { value: '*:authWithPassword' },
  { value: '*:authWithOAuth2' },
  { value: '*:authWithOTP' },
  { value: '*:requestOTP' },
  { value: '*:requestPasswordReset' },
  { value: '*:confirmPasswordReset' },
  { value: '*:requestVerification' },
  { value: '*:confirmVerification' },
  { value: '*:requestEmailChange' },
  { value: '*:confirmEmailChange' },
]

export function RateLimitAccordion({ value, onChange, errors = {} }: RateLimitAccordionProps) {
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const { collections } = useCollections()

  const hasErrors = Object.keys(errors).some((key) => key.startsWith('rateLimits'))

  // Generate predefined tags based on collections
  const predefinedTags = useMemo(() => {
    const tags: { value: string; description?: string }[] = []

    for (const collection of collections) {
      if (collection.system) continue

      tags.push({ value: `${collection.name}:list` })
      tags.push({ value: `${collection.name}:view` })

      if (collection.type !== 'view') {
        tags.push({ value: `${collection.name}:create` })
        tags.push({ value: `${collection.name}:update` })
        tags.push({ value: `${collection.name}:delete` })
      }

      if (collection.type === 'auth') {
        tags.push({ value: `${collection.name}:listAuthMethods` })
        tags.push({ value: `${collection.name}:authRefresh` })
        tags.push({ value: `${collection.name}:auth` })
        tags.push({ value: `${collection.name}:authWithPassword` })
        tags.push({ value: `${collection.name}:authWithOAuth2` })
        tags.push({ value: `${collection.name}:authWithOTP` })
        tags.push({ value: `${collection.name}:requestOTP` })
        tags.push({ value: `${collection.name}:requestPasswordReset` })
        tags.push({ value: `${collection.name}:confirmPasswordReset` })
        tags.push({ value: `${collection.name}:requestVerification` })
        tags.push({ value: `${collection.name}:confirmVerification` })
        tags.push({ value: `${collection.name}:requestEmailChange` })
        tags.push({ value: `${collection.name}:confirmEmailChange` })
      }

      const hasFileField = collection.fields?.some((f) => f.type === 'file')
      if (hasFileField) {
        tags.push({ value: `${collection.name}:file` })
      }
    }

    return [...tags, ...BASE_PREDEFINED_TAGS]
  }, [collections])

  const handleAddRule = () => {
    const newRules = [
      ...value.rules,
      {
        label: '',
        maxRequests: 300,
        duration: 10,
        audience: '',
      },
    ]
    onChange({
      ...value,
      rules: newRules,
    })
  }

  const handleRemoveRule = (index: number) => {
    const newRules = value.rules.filter((_, i) => i !== index)
    onChange({
      ...value,
      rules: newRules,
      enabled: newRules.length === 0 ? false : value.enabled,
    })
  }

  const handleRuleChange = (
    index: number,
    field: keyof RateLimitRule,
    fieldValue: string | number
  ) => {
    const newRules = [...value.rules]
    newRules[index] = { ...newRules[index], [field]: fieldValue }
    onChange({ ...value, rules: newRules })
  }

  return (
    <>
      <Accordion type="single" collapsible>
        <AccordionItem value="rate-limit" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 flex-1">
              <Activity className="h-4 w-4" />
              <span>Rate Limits</span>
              <div className="flex-1" />
              {hasErrors && <AlertCircle className="h-4 w-4 text-destructive" />}
              <Badge variant={value.enabled ? 'default' : 'secondary'}>
                {value.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="rate-limit-enabled"
                checked={value.enabled}
                onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
              />
              <Label htmlFor="rate-limit-enabled">
                Enable <span className="text-muted-foreground">(experimental)</span>
              </Label>
            </div>

            {value.rules.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rate limit label</TableHead>
                    <TableHead className="w-[120px]">
                      Max requests
                      <br />
                      <span className="text-xs text-muted-foreground">(per IP)</span>
                    </TableHead>
                    <TableHead className="w-[100px]">
                      Interval
                      <br />
                      <span className="text-xs text-muted-foreground">(in seconds)</span>
                    </TableHead>
                    <TableHead className="w-[140px]">Targeted users</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {value.rules.map((rule, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          list={`predefined-tags-${index}`}
                          required
                          placeholder="tag (users:create) or path (/api/)"
                          value={rule.label}
                          onChange={(e) => handleRuleChange(index, 'label', e.target.value)}
                          className={
                            errors[`rateLimits.rules.${index}.label`] ? 'border-destructive' : ''
                          }
                        />
                        <datalist id={`predefined-tags-${index}`}>
                          {predefinedTags.map((tag) => (
                            <option key={tag.value} value={tag.value}>
                              {tag.description}
                            </option>
                          ))}
                        </datalist>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          required
                          min={1}
                          step={1}
                          placeholder="Max requests"
                          value={rule.maxRequests}
                          onChange={(e) =>
                            handleRuleChange(index, 'maxRequests', parseInt(e.target.value) || 0)
                          }
                          className={
                            errors[`rateLimits.rules.${index}.maxRequests`]
                              ? 'border-destructive'
                              : ''
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          required
                          min={1}
                          step={1}
                          placeholder="Interval"
                          value={rule.duration}
                          onChange={(e) =>
                            handleRuleChange(index, 'duration', parseInt(e.target.value) || 0)
                          }
                          className={
                            errors[`rateLimits.rules.${index}.duration`] ? 'border-destructive' : ''
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={audienceToUI(rule.audience)}
                          onValueChange={(v) =>
                            handleRuleChange(index, 'audience', audienceToAPI(v))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AUDIENCE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRule(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex items-center justify-between">
              <Button type="button" variant="secondary" size="sm" onClick={handleAddRule}>
                <Plus className="h-4 w-4 mr-1" />
                Add rate limit rule
              </Button>

              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setShowInfoDialog(true)}
              >
                <HelpCircle className="h-4 w-4 mr-1" />
                Learn more about the rate limit rules
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rate limit label format</DialogTitle>
            <DialogDescription className="sr-only">Rate limit rules description</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p>
              The rate limit rules are resolved in the following order (stops on the first match):
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                exact tag (e.g. <code>users:create</code>)
              </li>
              <li>
                wildcard tag (e.g. <code>*:create</code>)
              </li>
              <li>
                METHOD + exact path (e.g. <code>POST /a/b</code>)
              </li>
              <li>
                METHOD + prefix path (e.g. <code>POST /a/b/</code>)
              </li>
              <li>
                exact path (e.g. <code>/a/b</code>)
              </li>
              <li>
                prefix path (e.g. <code>/a/b/</code>)
              </li>
            </ol>

            <p>
              In case of multiple rules with the same label but different target user audience (e.g.
              "guest" vs "auth"), only the matching audience rule is taken in consideration.
            </p>

            <hr />

            <p>The rate limit label could be in one of the following formats:</p>
            <ul className="space-y-2">
              <li>
                <code>[METHOD ]/my/path</code> - full exact route match (
                <strong>must be without trailing slash</strong>; "METHOD" is optional)
              </li>
              <li>
                <code>[METHOD ]/my/prefix/</code> - path prefix (
                <strong>must end with trailing slash</strong>; "METHOD" is optional)
              </li>
              <li>
                <code>collectionName:predefinedTag</code> - targets a specific action of a single
                collection. To apply the rule for all collections you can use the <code>*</code>{' '}
                wildcard.
              </li>
            </ul>

            <div>
              <p className="font-medium mb-2">The predefined collection tags are:</p>
              <ul className="grid grid-cols-2 gap-1 text-xs">
                {BASE_PREDEFINED_TAGS.map((tag) => (
                  <li key={tag.value}>
                    <code>{tag.value.replace('*:', ':')}</code>
                    {tag.description && (
                      <span className="text-muted-foreground ml-1">({tag.description})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowInfoDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
