/**
 * 邮件测试弹窗
 * 用于发送测试邮件验证邮件配置
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Send } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import pb from '@/lib/pocketbase'
import type { CollectionModel } from 'pocketbase'

const EMAIL_STORAGE_KEY = 'last_email_test'

const TEMPLATE_KEYS = [
  { labelKey: 'emailTest.verification', value: 'verification' },
  { labelKey: 'emailTest.passwordReset', value: 'password-reset' },
  { labelKey: 'emailTest.emailChange', value: 'email-change' },
  { labelKey: 'emailTest.otp', value: 'otp' },
  { labelKey: 'emailTest.loginAlert', value: 'login-alert' },
] as const

type TemplateType = (typeof TEMPLATE_KEYS)[number]['value']

interface EmailTestPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionIdOrName?: string
  initialEmail?: string
  initialTemplate?: TemplateType
}

export function EmailTestPopup({
  open,
  onOpenChange,
  collectionIdOrName: initialCollectionId = '',
  initialEmail = '',
  initialTemplate = 'verification',
}: EmailTestPopupProps) {
  const { t } = useTranslation()
  const [collectionIdOrName, setCollectionIdOrName] = useState(initialCollectionId)
  const [email, setEmail] = useState(initialEmail || localStorage.getItem(EMAIL_STORAGE_KEY) || '')
  const [template, setTemplate] = useState<TemplateType>(initialTemplate)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authCollections, setAuthCollections] = useState<CollectionModel[]>([])
  const [isLoadingCollections, setIsLoadingCollections] = useState(false)
  const [showCollectionSelect, setShowCollectionSelect] = useState(false)
  const testTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast } = useToast()

  const canSubmit = !!email && !!template && !!collectionIdOrName

  useEffect(() => {
    if (open) {
      setShowCollectionSelect(!initialCollectionId)
      setCollectionIdOrName(initialCollectionId)
      setEmail(initialEmail || localStorage.getItem(EMAIL_STORAGE_KEY) || '')
      setTemplate(initialTemplate)

      if (!initialCollectionId) {
        loadAuthCollections()
      }
    }

    return () => {
      if (testTimeoutRef.current) {
        clearTimeout(testTimeoutRef.current)
      }
    }
  }, [open, initialCollectionId, initialEmail, initialTemplate])

  const loadAuthCollections = async () => {
    setIsLoadingCollections(true)
    try {
      const collections = await pb.collections.getFullList({
        filter: "type='auth'",
        sort: '+name',
      })
      setAuthCollections(collections)
      if (collections.length > 0 && !collectionIdOrName) {
        // Prefer _superusers as default, fallback to first collection
        const superusers = collections.find((c) => c.name === '_superusers')
        setCollectionIdOrName(superusers ? superusers.id : collections[0].id)
      }
    } catch (err) {
      toast({
        title: t('emailTest.loadCollectionFailed'),
        description: err instanceof Error ? err.message : t('emailTest.retryHint'),
        variant: 'destructive',
      })
    } finally {
      setIsLoadingCollections(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    localStorage.setItem(EMAIL_STORAGE_KEY, email)

    // 30秒超时自动取消
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current)
    }
    testTimeoutRef.current = setTimeout(() => {
      setIsSubmitting(false)
      toast({
        title: t('emailTest.sendTimeout'),
        description: t('emailTest.sendTimeoutDesc'),
        variant: 'destructive',
      })
    }, 30000)

    try {
      await pb.settings.testEmail(collectionIdOrName, email, template)

      toast({
        title: t('emailTest.sendSuccess'),
        description: t('emailTest.sendSuccessDesc'),
      })
      setIsSubmitting(false)
      onOpenChange(false)
    } catch (err) {
      setIsSubmitting(false)
      toast({
        title: t('emailTest.sendFailed'),
        description: err instanceof Error ? err.message : t('emailTest.sendFailedDesc'),
        variant: 'destructive',
      })
    } finally {
      if (testTimeoutRef.current) {
        clearTimeout(testTimeoutRef.current)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{t('emailTest.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('emailTest.description')}</DialogDescription>
        </DialogHeader>

        <form id="email-test-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>{t('emailTest.template')}</Label>
            <RadioGroup
              value={template}
              onValueChange={(v) => setTemplate(v as TemplateType)}
              className="grid grid-cols-2 gap-2"
            >
              {TEMPLATE_KEYS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="font-normal">
                    {t(option.labelKey)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {showCollectionSelect && (
            <div className="space-y-2">
              <Label htmlFor="collection">{t('emailTest.authCollection')}</Label>
              <Select
                value={collectionIdOrName}
                onValueChange={setCollectionIdOrName}
                disabled={isLoadingCollections}
              >
                <SelectTrigger id="collection">
                  <SelectValue
                    placeholder={isLoadingCollections ? t('emailTest.loadingCollections') : t('emailTest.selectCollection')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {authCollections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t('emailTest.recipientEmail')}</Label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailTest.emailPlaceholder')}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('emailTest.close')}
          </Button>
          <Button type="submit" form="email-test-form" disabled={!canSubmit || isSubmitting}>
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? t('emailTest.sending') : t('emailTest.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
