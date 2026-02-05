/**
 * MailTemplatesSection - 邮件模板配置组件
 * 与 UI 版本对齐，支持编辑 Subject 和 Body (HTML)
 * 参考 UI 版本 EmailTemplateAccordion.svelte 实现
 * 默认模板内容参考 core/collection_model_auth_templates.go
 */
import { useCallback, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CodeEditor } from '@/components/CodeEditor'
import { Mail, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmailTemplate {
  subject?: string
  body?: string
  enabled?: boolean
}

interface MailTemplate {
  key: string
  label: string
  placeholders: string[]
  defaultSubject: string
  defaultBody: string
}

interface MailTemplatesSectionProps {
  collection: {
    otp?: { emailTemplate?: EmailTemplate }
    authAlert?: { emailTemplate?: EmailTemplate }
    resetPasswordTemplate?: EmailTemplate
    verificationTemplate?: EmailTemplate
    confirmEmailChangeTemplate?: EmailTemplate
  }
  onChange: (updates: any) => void
  isSuperusers?: boolean
}

// 默认邮件模板（与 core/collection_model_auth_templates.go 对齐）
const DEFAULT_TEMPLATES = {
  verification: {
    subject: 'Verify your {APP_NAME} email',
    body: `<p>Hello,</p>
<p>Thank you for joining us at {APP_NAME}.</p>
<p>Click on the button below to verify your email address.</p>
<p>
  <a class="btn" href="{APP_URL}/_/#/auth/confirm-verification/{TOKEN}" target="_blank" rel="noopener">Verify</a>
</p>
<p>
  Thanks,<br/>
  {APP_NAME} team
</p>`,
  },
  resetPassword: {
    subject: 'Reset your {APP_NAME} password',
    body: `<p>Hello,</p>
<p>Click on the button below to reset your password.</p>
<p>
  <a class="btn" href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}" target="_blank" rel="noopener">Reset password</a>
</p>
<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>
<p>
  Thanks,<br/>
  {APP_NAME} team
</p>`,
  },
  confirmEmailChange: {
    subject: 'Confirm your {APP_NAME} new email address',
    body: `<p>Hello,</p>
<p>Click on the button below to confirm your new email address.</p>
<p>
  <a class="btn" href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" target="_blank" rel="noopener">Confirm new email</a>
</p>
<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>
<p>
  Thanks,<br/>
  {APP_NAME} team
</p>`,
  },
  otp: {
    subject: 'OTP for {APP_NAME}',
    body: `<p>Hello,</p>
<p>Your one-time password is: <strong>{OTP}</strong></p>
<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>
<p>
  Thanks,<br/>
  {APP_NAME} team
</p>`,
  },
  authAlert: {
    subject: 'Login from a new location',
    body: `<p>Hello,</p>
<p>We noticed a login to your {APP_NAME} account from a new location:</p>
<p><em>{ALERT_INFO}</em></p>
<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>
<p>If this was you, you may disregard this email.</p>
<p>
  Thanks,<br/>
  {APP_NAME} team
</p>`,
  },
}

// Placeholder 复制按钮组件 - 与 UI 版本样式对齐
function PlaceholderButton({ placeholder }: { placeholder: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = useCallback(() => {
    const text = `{${placeholder.replace('*', '')}}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [placeholder])
  
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer',
        copied 
          ? 'bg-green-100 text-green-700' 
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      )}
    >
      {`{${placeholder}}`}
      {copied ? (
        <Check className="h-2.5 w-2.5 ml-0.5" />
      ) : (
        <Copy className="h-2.5 w-2.5 ml-0.5 opacity-60" />
      )}
    </button>
  )
}

// 单个邮件模板编辑组件
function EmailTemplateAccordion({
  templateKey,
  label,
  placeholders,
  config,
  defaultSubject,
  defaultBody,
  onChange,
}: {
  templateKey: string
  label: string
  placeholders: string[]
  config: EmailTemplate
  defaultSubject: string
  defaultBody: string
  onChange: (config: EmailTemplate) => void
}) {
  // 使用默认值填充空值
  const subject = config.subject || defaultSubject
  const body = config.body || defaultBody

  const handleSubjectChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...config,
      subject: e.target.value,
    })
  }, [config, onChange])
  
  const handleBodyChange = useCallback((value: string) => {
    onChange({
      ...config,
      body: value,
    })
  }, [config, onChange])
  
  return (
    <AccordionItem value={templateKey} className="border-b last:border-b-0">
      <AccordionTrigger className="py-2.5 px-0 hover:no-underline group">
        <div className="flex items-center gap-2 flex-1">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground group-hover:text-foreground transition-colors">
            {label}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-0">
        {/* 内容面板 - 带蓝色边框，与 UI 版本对齐 */}
        <div className="border-2 border-blue-400 rounded-lg p-4 space-y-4 bg-white">
          {/* Subject 输入框 */}
          <div className="space-y-1.5">
            <Label htmlFor={`${templateKey}-subject`} className="text-[12px] font-medium">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`${templateKey}-subject`}
              value={subject}
              onChange={handleSubjectChange}
              placeholder="Enter email subject..."
              className="h-9 text-[13px]"
              spellCheck={false}
            />
            {/* Placeholder 提示 */}
            <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1">
              <span>Available placeholder parameters:</span>
              {placeholders.map((p) => (
                <PlaceholderButton key={p} placeholder={p} />
              ))}
            </div>
          </div>
          
          {/* Body HTML 编辑器 */}
          <div className="space-y-1.5">
            <Label htmlFor={`${templateKey}-body`} className="text-[12px] font-medium">
              Body (HTML) <span className="text-red-500">*</span>
            </Label>
            <div className="border rounded-md overflow-hidden">
              <CodeEditor
                id={`${templateKey}-body`}
                value={body}
                onChange={handleBodyChange}
                language="html"
                height="200px"
                placeholder="Enter HTML email body..."
              />
            </div>
            {/* Placeholder 提示 */}
            <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1">
              <span>Available placeholder parameters:</span>
              {placeholders.map((p) => (
                <PlaceholderButton key={p} placeholder={p} />
              ))}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export function MailTemplatesSection({
  collection,
  onChange,
  isSuperusers = false,
}: MailTemplatesSectionProps) {
  // 根据是否是 superusers 确定显示的模板列表
  const templates: MailTemplate[] = isSuperusers
    ? [
        {
          key: 'resetPasswordTemplate',
          label: 'Default Password reset email template',
          placeholders: ['APP_NAME', 'APP_URL', 'RECORD:*', 'TOKEN'],
          defaultSubject: DEFAULT_TEMPLATES.resetPassword.subject,
          defaultBody: DEFAULT_TEMPLATES.resetPassword.body,
        },
        {
          key: 'otp.emailTemplate',
          label: 'Default OTP email template',
          placeholders: ['APP_NAME', 'APP_URL', 'RECORD:*', 'OTP', 'OTP_ID'],
          defaultSubject: DEFAULT_TEMPLATES.otp.subject,
          defaultBody: DEFAULT_TEMPLATES.otp.body,
        },
        {
          key: 'authAlert.emailTemplate',
          label: 'Default Login alert email template',
          placeholders: ['APP_NAME', 'APP_URL', 'RECORD:*', 'ALERT_INFO'],
          defaultSubject: DEFAULT_TEMPLATES.authAlert.subject,
          defaultBody: DEFAULT_TEMPLATES.authAlert.body,
        },
      ]
    : [
        {
          key: 'verificationTemplate',
          label: 'Default Verification email template',
          placeholders: ['APP_NAME', 'APP_URL', 'RECORD:*', 'TOKEN'],
          defaultSubject: DEFAULT_TEMPLATES.verification.subject,
          defaultBody: DEFAULT_TEMPLATES.verification.body,
        },
        {
          key: 'resetPasswordTemplate',
          label: 'Default Password reset email template',
          placeholders: ['APP_NAME', 'APP_URL', 'RECORD:*', 'TOKEN'],
          defaultSubject: DEFAULT_TEMPLATES.resetPassword.subject,
          defaultBody: DEFAULT_TEMPLATES.resetPassword.body,
        },
        {
          key: 'confirmEmailChangeTemplate',
          label: 'Default Confirm email change email template',
          placeholders: ['APP_NAME', 'APP_URL', 'RECORD:*', 'TOKEN'],
          defaultSubject: DEFAULT_TEMPLATES.confirmEmailChange.subject,
          defaultBody: DEFAULT_TEMPLATES.confirmEmailChange.body,
        },
        {
          key: 'otp.emailTemplate',
          label: 'Default OTP email template',
          placeholders: ['APP_NAME', 'APP_URL', 'RECORD:*', 'OTP', 'OTP_ID'],
          defaultSubject: DEFAULT_TEMPLATES.otp.subject,
          defaultBody: DEFAULT_TEMPLATES.otp.body,
        },
        {
          key: 'authAlert.emailTemplate',
          label: 'Default Login alert email template',
          placeholders: ['APP_NAME', 'APP_URL', 'RECORD:*', 'ALERT_INFO'],
          defaultSubject: DEFAULT_TEMPLATES.authAlert.subject,
          defaultBody: DEFAULT_TEMPLATES.authAlert.body,
        },
      ]

  // 获取模板配置
  const getTemplateConfig = useCallback((key: string): EmailTemplate => {
    if (key === 'otp.emailTemplate') {
      return collection.otp?.emailTemplate || { subject: '', body: '' }
    }
    if (key === 'authAlert.emailTemplate') {
      return collection.authAlert?.emailTemplate || { subject: '', body: '' }
    }
    const directKey = key as keyof typeof collection
    return (collection[directKey] as EmailTemplate) || { subject: '', body: '' }
  }, [collection])

  // 更新模板配置
  const handleTemplateChange = useCallback((key: string, config: EmailTemplate) => {
    if (key === 'otp.emailTemplate') {
      onChange({
        otp: {
          ...collection.otp,
          emailTemplate: config,
        },
      })
    } else if (key === 'authAlert.emailTemplate') {
      onChange({
        authAlert: {
          ...collection.authAlert,
          emailTemplate: config,
        },
      })
    } else {
      onChange({
        [key]: config,
      })
    }
  }, [collection, onChange])

  return (
    <Accordion type="single" collapsible className="w-full">
      {templates.map((template) => (
        <EmailTemplateAccordion
          key={template.key}
          templateKey={template.key}
          label={template.label}
          placeholders={template.placeholders}
          config={getTemplateConfig(template.key)}
          defaultSubject={template.defaultSubject}
          defaultBody={template.defaultBody}
          onChange={(config) => handleTemplateChange(template.key, config)}
        />
      ))}
    </Accordion>
  )
}
