import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Key, Info, Loader2 } from 'lucide-react'
import { pb } from '@/lib/pocketbase'
import { toast } from 'sonner'

interface AppleSecretPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId?: string
  onSubmit: (secret: string) => void
}

const MAX_DURATION = 15777000 // 6 months in seconds

export function AppleSecretPopup({
  open,
  onOpenChange,
  clientId: initialClientId = '',
  onSubmit,
}: AppleSecretPopupProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    clientId: initialClientId,
    teamId: '',
    keyId: '',
    privateKey: '',
    duration: MAX_DURATION,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await pb.settings.generateAppleClientSecret(
        formData.clientId,
        formData.teamId,
        formData.keyId,
        formData.privateKey.trim(),
        formData.duration
      )

      toast.success('Successfully generated client secret.')
      onSubmit(result.secret)
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to generate Apple secret:', err)
      toast.error('Failed to generate client secret.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center">Generate Apple client secret</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">
                Client ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="clientId"
                value={formData.clientId}
                onChange={(e) => updateField('clientId', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamId">
                Team ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="teamId"
                value={formData.teamId}
                onChange={(e) => updateField('teamId', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyId">
                Key ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="keyId"
                value={formData.keyId}
                onChange={(e) => updateField('keyId', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration" className="flex items-center gap-1">
                Duration (in seconds) <span className="text-red-500">*</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Max {MAX_DURATION} seconds (~{Math.floor(MAX_DURATION / (60 * 60 * 24 * 30))}{' '}
                      months).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id="duration"
                type="number"
                max={MAX_DURATION}
                value={formData.duration}
                onChange={(e) => updateField('duration', parseInt(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="privateKey">
              Private key <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="privateKey"
              rows={8}
              placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
              value={formData.privateKey}
              onChange={(e) => updateField('privateKey', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              The key is not stored on the server and it is used only for generating the signed JWT.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Close
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Key className="w-4 h-4 mr-2" />
              )}
              Generate and set secret
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
