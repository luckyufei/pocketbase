/**
 * 邮件测试弹窗
 * 用于发送测试邮件验证邮件配置
 */
import { useState, useEffect, useRef } from 'react'
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

const TEMPLATE_OPTIONS = [
  { label: '邮箱验证', value: 'verification' },
  { label: '密码重置', value: 'password-reset' },
  { label: '邮箱变更确认', value: 'email-change' },
  { label: 'OTP 验证码', value: 'otp' },
  { label: '登录提醒', value: 'login-alert' },
] as const

type TemplateType = (typeof TEMPLATE_OPTIONS)[number]['value']

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
        title: '加载认证集合失败',
        description: err instanceof Error ? err.message : '请重试',
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
        title: '发送超时',
        description: '测试邮件发送超时，请检查邮件服务器配置',
        variant: 'destructive',
      })
    }, 30000)

    try {
      await pb.settings.testEmail(collectionIdOrName, email, template)

      toast({
        title: '发送成功',
        description: '测试邮件已成功发送',
      })
      setIsSubmitting(false)
      onOpenChange(false)
    } catch (err) {
      setIsSubmitting(false)
      toast({
        title: '发送失败',
        description: err instanceof Error ? err.message : '测试邮件发送失败',
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
          <DialogTitle className="text-center">发送测试邮件</DialogTitle>
          <DialogDescription className="sr-only">选择模板并发送测试邮件</DialogDescription>
        </DialogHeader>

        <form id="email-test-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>邮件模板</Label>
            <RadioGroup
              value={template}
              onValueChange={(v) => setTemplate(v as TemplateType)}
              className="grid grid-cols-2 gap-2"
            >
              {TEMPLATE_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="font-normal">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {showCollectionSelect && (
            <div className="space-y-2">
              <Label htmlFor="collection">认证集合</Label>
              <Select
                value={collectionIdOrName}
                onValueChange={setCollectionIdOrName}
                disabled={isLoadingCollections}
              >
                <SelectTrigger id="collection">
                  <SelectValue
                    placeholder={isLoadingCollections ? '加载认证集合中...' : '选择认证集合'}
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
            <Label htmlFor="email">收件人邮箱</Label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入收件人邮箱地址"
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
            关闭
          </Button>
          <Button type="submit" form="email-test-form" disabled={!canSubmit || isSubmitting}>
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? '发送中...' : '发送'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
