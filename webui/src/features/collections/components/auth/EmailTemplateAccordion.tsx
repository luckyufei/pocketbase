/**
 * Email template configuration component
 * For configuring auth collection email templates (verification, password reset, email change, etc.)
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
  { key: 'verification', label: 'Verification' },
  { key: 'passwordReset', label: 'Password reset' },
  { key: 'emailChange', label: 'Email change' },
  { key: 'otp', label: 'OTP' },
  { key: 'loginAlert', label: 'Login alert' },
] as const

const TEMPLATE_PLACEHOLDERS = [
  { placeholder: '{APP_NAME}', description: 'Application name' },
  { placeholder: '{APP_URL}', description: 'Application URL' },
  { placeholder: '{TOKEN}', description: 'Verification token' },
  { placeholder: '{ACTION_URL}', description: 'Action URL' },
  { placeholder: '{RECORD:*}', description: 'Record field, e.g. {RECORD:email}' },
]

const DEFAULT_TEMPLATES: EmailTemplatesSettings = {
  verification: {
    subject: 'Verify your email',
    body: `<p>Hello,</p>
<p>Thank you for registering with {APP_NAME}.</p>
<p>Please click the link below to verify your email address:</p>
<p><a href="{ACTION_URL}">{ACTION_URL}</a></p>
<p>If you did not register an account, please ignore this email.</p>`,
    actionUrl: '{APP_URL}/auth/confirm-verification/{TOKEN}',
  },
  passwordReset: {
    subject: 'Reset your password',
    body: `<p>Hello,</p>
<p>You requested to reset your {APP_NAME} account password.</p>
<p>Please click the link below to reset your password:</p>
<p><a href="{ACTION_URL}">{ACTION_URL}</a></p>
<p>If you did not request a password reset, please ignore this email.</p>`,
    actionUrl: '{APP_URL}/auth/confirm-password-reset/{TOKEN}',
  },
  emailChange: {
    subject: 'Confirm email change',
    body: `<p>Hello,</p>
<p>You requested to change your {APP_NAME} account email address.</p>
<p>Please click the link below to confirm the change:</p>
<p><a href="{ACTION_URL}">{ACTION_URL}</a></p>
<p>If you did not request an email change, please ignore this email.</p>`,
    actionUrl: '{APP_URL}/auth/confirm-email-change/{TOKEN}',
  },
  otp: {
    subject: 'Your verification code',
    body: `<p>Hello,</p>
<p>Your {APP_NAME} verification code is:</p>
<p style="font-size: 24px; font-weight: bold;">{TOKEN}</p>
<p>This code is valid for 10 minutes.</p>`,
    actionUrl: '',
  },
  loginAlert: {
    subject: 'New device login alert',
    body: `<p>Hello,</p>
<p>Your {APP_NAME} account was just logged in from a new device.</p>
<p>If this was not you, please change your password immediately.</p>`,
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
            <span>Email templates</span>
            <div className="flex-1" />
            {hasErrors && <Badge variant="destructive">Has errors</Badge>}
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
                    Reset to default
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${type.key}-subject`}>Subject</Label>
                  <Input
                    id={`${type.key}-subject`}
                    value={value[type.key]?.subject || ''}
                    onChange={(e) => handleTemplateChange(type.key, 'subject', e.target.value)}
                    placeholder="Enter email subject"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${type.key}-body`}>Body (HTML)</Label>
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
                    <Label htmlFor={`${type.key}-actionUrl`}>Action URL</Label>
                    <Input
                      id={`${type.key}-actionUrl`}
                      value={value[type.key]?.actionUrl || ''}
                      onChange={(e) => handleTemplateChange(type.key, 'actionUrl', e.target.value)}
                      placeholder="Enter action URL template"
                    />
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Available placeholders:</p>
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
