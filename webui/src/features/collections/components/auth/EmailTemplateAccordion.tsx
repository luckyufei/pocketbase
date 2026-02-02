/**
 * 邮件模板配置组件
 * 用于配置认证集合的邮件模板（验证、密码重置、邮箱变更等）
 */
import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Mail, RotateCcw } from 'lucide-react'
import { CodeEditor } from '@/components/CodeEditor'

export interface EmailTemplate {
  subject: string
  body: string
  actionUrl: string
}

export interface EmailTemplatesSettings {
  verification: EmailTemplate
  passwordReset: EmailTemplate
  emailChange: EmailTemplate
  otp: EmailTemplate
  loginAlert: EmailTemplate
}

interface EmailTemplateAccordionProps {
  value: EmailTemplatesSettings
  onChange: (value: EmailTemplatesSettings) => void
  errors?: Record<string, string>
}

const TEMPLATE_TYPES = [
  { key: 'verification', label: '邮箱验证' },
  { key: 'passwordReset', label: '密码重置' },
  { key: 'emailChange', label: '邮箱变更' },
  { key: 'otp', label: 'OTP 验证码' },
  { key: 'loginAlert', label: '登录提醒' },
] as const

const TEMPLATE_PLACEHOLDERS = [
  { placeholder: '{APP_NAME}', description: '应用名称' },
  { placeholder: '{APP_URL}', description: '应用 URL' },
  { placeholder: '{TOKEN}', description: '验证令牌' },
  { placeholder: '{ACTION_URL}', description: '操作链接' },
  { placeholder: '{RECORD:*}', description: '记录字段，如 {RECORD:email}' },
]

const DEFAULT_TEMPLATES: EmailTemplatesSettings = {
  verification: {
    subject: '验证您的邮箱',
    body: `<p>您好，</p>
<p>感谢您注册 {APP_NAME}。</p>
<p>请点击下方链接验证您的邮箱地址：</p>
<p><a href="{ACTION_URL}">{ACTION_URL}</a></p>
<p>如果您没有注册账号，请忽略此邮件。</p>`,
    actionUrl: '{APP_URL}/auth/confirm-verification/{TOKEN}',
  },
  passwordReset: {
    subject: '重置您的密码',
    body: `<p>您好，</p>
<p>您请求重置 {APP_NAME} 账号的密码。</p>
<p>请点击下方链接重置密码：</p>
<p><a href="{ACTION_URL}">{ACTION_URL}</a></p>
<p>如果您没有请求重置密码，请忽略此邮件。</p>`,
    actionUrl: '{APP_URL}/auth/confirm-password-reset/{TOKEN}',
  },
  emailChange: {
    subject: '确认邮箱变更',
    body: `<p>您好，</p>
<p>您请求变更 {APP_NAME} 账号的邮箱地址。</p>
<p>请点击下方链接确认变更：</p>
<p><a href="{ACTION_URL}">{ACTION_URL}</a></p>
<p>如果您没有请求变更邮箱，请忽略此邮件。</p>`,
    actionUrl: '{APP_URL}/auth/confirm-email-change/{TOKEN}',
  },
  otp: {
    subject: '您的验证码',
    body: `<p>您好，</p>
<p>您的 {APP_NAME} 验证码是：</p>
<p style="font-size: 24px; font-weight: bold;">{TOKEN}</p>
<p>验证码有效期为 10 分钟。</p>`,
    actionUrl: '',
  },
  loginAlert: {
    subject: '新设备登录提醒',
    body: `<p>您好，</p>
<p>您的 {APP_NAME} 账号刚刚在新设备上登录。</p>
<p>如果这不是您本人操作，请立即修改密码。</p>`,
    actionUrl: '',
  },
}

export function EmailTemplateAccordion({
  value,
  onChange,
  errors = {},
}: EmailTemplateAccordionProps) {
  const [activeTemplate, setActiveTemplate] = useState<keyof EmailTemplatesSettings>('verification')

  const hasErrors = Object.keys(errors).some((key) => key.startsWith('emailTemplates'))

  const handleTemplateChange = (
    templateKey: keyof EmailTemplatesSettings,
    field: keyof EmailTemplate,
    fieldValue: string
  ) => {
    onChange({
      ...value,
      [templateKey]: {
        ...value[templateKey],
        [field]: fieldValue,
      },
    })
  }

  const handleReset = (templateKey: keyof EmailTemplatesSettings) => {
    onChange({
      ...value,
      [templateKey]: DEFAULT_TEMPLATES[templateKey],
    })
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="email-templates">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Mail className="h-4 w-4" />
            <span>邮件模板</span>
            <div className="flex-1" />
            {hasErrors && <Badge variant="destructive">有错误</Badge>}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4">
          <Tabs
            value={activeTemplate}
            onValueChange={(v) => setActiveTemplate(v as keyof EmailTemplatesSettings)}
          >
            <TabsList className="grid w-full grid-cols-5">
              {TEMPLATE_TYPES.map((type) => (
                <TabsTrigger key={type.key} value={type.key}>
                  {type.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {TEMPLATE_TYPES.map((type) => (
              <TabsContent key={type.key} value={type.key} className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReset(type.key)}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    重置为默认
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${type.key}-subject`}>邮件主题</Label>
                  <Input
                    id={`${type.key}-subject`}
                    value={value[type.key]?.subject || ''}
                    onChange={(e) => handleTemplateChange(type.key, 'subject', e.target.value)}
                    placeholder="输入邮件主题"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${type.key}-body`}>邮件内容 (HTML)</Label>
                  <CodeEditor
                    id={`${type.key}-body`}
                    language="html"
                    value={value[type.key]?.body || ''}
                    onChange={(v) => handleTemplateChange(type.key, 'body', v)}
                    minHeight={200}
                  />
                </div>

                {type.key !== 'otp' && type.key !== 'loginAlert' && (
                  <div className="space-y-2">
                    <Label htmlFor={`${type.key}-actionUrl`}>操作链接</Label>
                    <Input
                      id={`${type.key}-actionUrl`}
                      value={value[type.key]?.actionUrl || ''}
                      onChange={(e) => handleTemplateChange(type.key, 'actionUrl', e.target.value)}
                      placeholder="输入操作链接模板"
                    />
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">可用占位符：</p>
                  <ul className="grid grid-cols-2 gap-1">
                    {TEMPLATE_PLACEHOLDERS.map((p) => (
                      <li key={p.placeholder}>
                        <code>{p.placeholder}</code> - {p.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
