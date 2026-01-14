/**
 * 速率限制配置组件
 * 用于配置 API 请求的速率限制规则
 */
import { useState, useEffect } from 'react'
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
  audience: '' | '@guest' | '@auth'
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
  { value: '', label: '全部' },
  { value: '@guest', label: '仅游客' },
  { value: '@auth', label: '仅已认证用户' },
]

const BASE_PREDEFINED_TAGS = [
  { value: '*:list' },
  { value: '*:view' },
  { value: '*:create' },
  { value: '*:update' },
  { value: '*:delete' },
  { value: '*:file', description: '针对文件下载端点' },
  { value: '*:listAuthMethods' },
  { value: '*:authRefresh' },
  { value: '*:auth', description: '针对所有认证方法' },
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
  const [predefinedTags, setPredefinedTags] = useState(BASE_PREDEFINED_TAGS)
  const { collections } = useCollections()

  const hasErrors = Object.keys(errors).some((key) => key.startsWith('rateLimits'))

  // 根据集合生成预定义标签
  useEffect(() => {
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

    setPredefinedTags([...tags, ...BASE_PREDEFINED_TAGS])
  }, [collections])

  const handleAddRule = () => {
    const newRules = [
      ...value.rules,
      {
        label: '',
        maxRequests: 300,
        duration: 10,
        audience: '' as const,
      },
    ]
    onChange({
      ...value,
      rules: newRules,
      enabled: newRules.length > 0 ? true : value.enabled,
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
        <AccordionItem value="rate-limit">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2 flex-1">
              <Activity className="h-4 w-4" />
              <span>速率限制</span>
              <div className="flex-1" />
              {hasErrors && <AlertCircle className="h-4 w-4 text-destructive" />}
              <Badge variant={value.enabled ? 'default' : 'secondary'}>
                {value.enabled ? '已启用' : '已禁用'}
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
                启用 <span className="text-muted-foreground">(实验性)</span>
              </Label>
            </div>

            {value.rules.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>速率限制标签</TableHead>
                    <TableHead className="w-[120px]">
                      最大请求数
                      <br />
                      <span className="text-xs text-muted-foreground">(每 IP)</span>
                    </TableHead>
                    <TableHead className="w-[100px]">
                      时间间隔
                      <br />
                      <span className="text-xs text-muted-foreground">(秒)</span>
                    </TableHead>
                    <TableHead className="w-[140px]">目标用户</TableHead>
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
                          placeholder="标签 (users:create) 或路径 (/api/)"
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
                          placeholder="最大请求数"
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
                          placeholder="间隔"
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
                          value={rule.audience}
                          onValueChange={(v) =>
                            handleRuleChange(index, 'audience', v as RateLimitRule['audience'])
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
                添加速率限制规则
              </Button>

              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setShowInfoDialog(true)}
              >
                <HelpCircle className="h-4 w-4 mr-1" />
                了解更多
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>速率限制标签格式</DialogTitle>
            <DialogDescription className="sr-only">速率限制规则说明</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p>速率限制规则按以下顺序解析（在第一个匹配时停止）：</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                精确标签 (如 <code>users:create</code>)
              </li>
              <li>
                通配符标签 (如 <code>*:create</code>)
              </li>
              <li>
                METHOD + 精确路径 (如 <code>POST /a/b</code>)
              </li>
              <li>
                METHOD + 前缀路径 (如 <code>POST /a/b/</code>)
              </li>
              <li>
                精确路径 (如 <code>/a/b</code>)
              </li>
              <li>
                前缀路径 (如 <code>/a/b/</code>)
              </li>
            </ol>

            <p>
              如果存在多个相同标签但不同目标用户的规则（如 "guest" vs
              "auth"），只有匹配的用户规则会被考虑。
            </p>

            <hr />

            <p>速率限制标签可以是以下格式之一：</p>
            <ul className="space-y-2">
              <li>
                <code>[METHOD ]/my/path</code> - 完整精确路由匹配（
                <strong>必须不带尾部斜杠</strong>；"METHOD" 可选）
              </li>
              <li>
                <code>[METHOD ]/my/prefix/</code> - 路径前缀（
                <strong>必须以斜杠结尾</strong>；"METHOD" 可选）
              </li>
              <li>
                <code>collectionName:predefinedTag</code> - 针对单个集合的特定操作。使用{' '}
                <code>*</code> 通配符可应用于所有集合。
              </li>
            </ul>

            <div>
              <p className="font-medium mb-2">预定义的集合标签：</p>
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
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
