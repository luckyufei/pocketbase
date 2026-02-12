/**
 * Email Test Popup 组件
 * 用于发送测试邮件
 */
import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Loader2, Send } from 'lucide-react'
import { pb } from '@/lib/pocketbase'
import { toast } from 'sonner'

const EMAIL_STORAGE_KEY = 'last_email_test'

const templateOptions = [
  { label: 'Verification', value: 'verification' },
  { label: 'Password reset', value: 'password-reset' },
  { label: 'Confirm email change', value: 'email-change' },
  { label: 'OTP', value: 'otp' },
  { label: 'Login alert', value: 'login-alert' },
]

interface AuthCollection {
  id: string
  name: string
}

export interface EmailTestPopupRef {
  show: (collection?: string, email?: string, template?: string) => void
  hide: () => void
}

interface EmailTestPopupProps {
  onSubmit?: () => void
}

export const EmailTestPopup = forwardRef<EmailTestPopupRef, EmailTestPopupProps>(
  ({ onSubmit }, ref) => {
    const [open, setOpen] = useState(false)
    const [template, setTemplate] = useState(templateOptions[0].value)
    const [email, setEmail] = useState('')
    const [collectionId, setCollectionId] = useState('')
    const [authCollections, setAuthCollections] = useState<AuthCollection[]>([])
    const [isLoadingCollections, setIsLoadingCollections] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const canSubmit = !!email && !!template && !!collectionId

    // Debug: log current state
    useEffect(() => {
      console.log('EmailTestPopup state:', { open, canSubmit, email, template, collectionId, authCollections })
    }, [open, canSubmit, email, template, collectionId, authCollections])

    useImperativeHandle(ref, () => ({
      show: (collectionArg = '', emailArg = '', templateArg = '') => {
        setCollectionId(collectionArg)
        setEmail(emailArg || localStorage.getItem(EMAIL_STORAGE_KEY) || '')
        setTemplate(templateArg || templateOptions[0].value)
        
        if (!collectionArg) {
          loadAuthCollections()
        }
        
        setOpen(true)
      },
      hide: () => {
        setOpen(false)
      },
    }))

    const loadAuthCollections = async () => {
      setIsLoadingCollections(true)
      try {
        const collections = await pb.collections.getFullList({
          filter: "type='auth'",
          sort: '+name',
        })
        setAuthCollections(collections.map(c => ({ id: c.id, name: c.name })))
        if (collections.length > 0) {
          setCollectionId(collections[0].id)
        }
      } catch (err) {
        console.error('Failed to load auth collections:', err)
        toast.error('Failed to load auth collections')
      } finally {
        setIsLoadingCollections(false)
      }
    }

    const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
      e?.preventDefault()
      
      if (!canSubmit || isSubmitting) {
        console.log('Cannot submit:', { canSubmit, isSubmitting })
        return
      }

      setIsSubmitting(true)

      // Store email in localStorage for later use
      localStorage.setItem(EMAIL_STORAGE_KEY, email)

      // Create timeout for auto-cancel after 30 seconds
      const timeoutId = setTimeout(() => {
        toast.error('Test email send timeout.')
        setIsSubmitting(false)
      }, 30000)

      try {
        await pb.settings.testEmail(collectionId, email, template)
        
        clearTimeout(timeoutId)
        toast.success('Successfully sent test email.')
        onSubmit?.()
        setOpen(false)
      } catch (err: any) {
        clearTimeout(timeoutId)
        console.error('Failed to send test email:', err)
        // Extract detailed error message from PocketBase response
        // PocketBase SDK stores the error in response.data.message or response.message
        let errorMessage = 'Failed to send test email'
        if (err?.response?.data?.message) {
          errorMessage = err.response.data.message
        } else if (err?.response?.message) {
          errorMessage = err.response.message
        } else if (err?.data?.message) {
          errorMessage = err.data.message
        } else if (err?.message) {
          errorMessage = err.message
        }
        console.log('Toast error message:', errorMessage)
        toast.error(errorMessage)
      } finally {
        setIsSubmitting(false)
      }
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Send test email</DialogTitle>
          </DialogHeader>
          
          <form id="email-test-form" onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Template Selection */}
            <div className="space-y-4">
              <RadioGroup value={template} onValueChange={setTemplate} className="space-y-3">
                {templateOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Auth Collection Selection - Always show */}
            <div className="space-y-3">
                <Label htmlFor="authCollection">
                  Auth collection <span className="text-destructive">*</span>
                </Label>
                <Select value={collectionId} onValueChange={setCollectionId}>
                  <SelectTrigger id="authCollection">
                    <SelectValue 
                      placeholder={isLoadingCollections ? 'Loading auth collections...' : 'Select auth collection'} 
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

            {/* Email Input */}
            <div className="space-y-3">
              <Label htmlFor="testEmail">
                To email address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="testEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                required
                autoFocus
              />
            </div>
          </form>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={!canSubmit || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
)

EmailTestPopup.displayName = 'EmailTestPopup'

export default EmailTestPopup
