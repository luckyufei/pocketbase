/**
 * 备份恢复面板
 * 用于确认和执行备份恢复操作
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import pb from '@/lib/pocketbase'

interface BackupRestorePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  backupName: string
}

export function BackupRestorePanel({ open, onOpenChange, backupName }: BackupRestorePanelProps) {
  const { t } = useTranslation()
  const [nameConfirm, setNameConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const reloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast } = useToast()

  const canSubmit = nameConfirm !== '' && backupName === nameConfirm

  useEffect(() => {
    if (open) {
      setNameConfirm('')
      setIsSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(backupName)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: t('backupRestore.copyFailed'),
        variant: 'destructive',
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canSubmit || isSubmitting) return

    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current)
    }

    setIsSubmitting(true)

    try {
      await pb.backups.restore(backupName)

      // 乐观重载页面
      reloadTimeoutRef.current = setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err) {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current)
      }
      setIsSubmitting(false)
      toast({
        title: t('backupRestore.restoreFailed'),
        description: err instanceof Error ? err.message : t('backupRestore.restoreError'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">
            {t('backupRestore.title')} <strong>{backupName}</strong>
          </DialogTitle>
          <DialogDescription className="sr-only">{t('backupRestore.description')}</DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-bold">{t('backupRestore.warning')}</p>
            <p>{t('backupRestore.experimental')}</p>
            <p dangerouslySetInnerHTML={{ __html: t('backupRestore.replaceNote') }} />
            <p dangerouslySetInnerHTML={{ __html: t('backupRestore.allDataReplace') }} />
            <p dangerouslySetInnerHTML={{ __html: t('backupRestore.invalidNote') }} />
            <p className="mt-2">{t('backupRestore.flowTitle')}</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li dangerouslySetInnerHTML={{ __html: t('backupRestore.step1') }} />
              <li>{t('backupRestore.step2')}</li>
              <li dangerouslySetInnerHTML={{ __html: t('backupRestore.step3') }} />
              <li>{t('backupRestore.step4')}</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="text-sm">
          {t('backupRestore.enterName')}{' '}
          <span className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs font-mono">
            {backupName}
            <button type="button" onClick={handleCopy} className="hover:text-primary">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </span>{' '}
          {t('backupRestore.toConfirm')}
        </div>

        <form id="backup-restore-form" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="backup-name-confirm">{t('backupRestore.backupName')}</Label>
            <Input
              id="backup-name-confirm"
              type="text"
              required
              value={nameConfirm}
              onChange={(e) => setNameConfirm(e.target.value)}
              placeholder={t('backupRestore.enterNamePlaceholder')}
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
            {t('backupRestore.cancel')}
          </Button>
          <Button
            type="submit"
            form="backup-restore-form"
            variant="destructive"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? t('backupRestore.restoring') : t('backupRestore.restore')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
