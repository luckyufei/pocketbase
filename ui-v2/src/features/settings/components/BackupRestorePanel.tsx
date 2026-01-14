/**
 * 备份恢复面板
 * 用于确认和执行备份恢复操作
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
        title: '复制失败',
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
        title: '恢复失败',
        description: err instanceof Error ? err.message : '备份恢复操作失败，请重试',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">
            恢复备份 <strong>{backupName}</strong>
          </DialogTitle>
          <DialogDescription className="sr-only">确认恢复备份操作</DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-bold">请谨慎操作，仅使用可信的备份文件！</p>
            <p>备份恢复是实验性功能，仅在 UNIX 系统上有效。</p>
            <p>
              恢复操作将尝试用备份中的内容替换现有的 <code>pb_data</code> 目录，并重启应用进程。
            </p>
            <p>
              这意味着成功后，所有数据（包括应用设置、用户、超级用户等）都将被备份中的数据替换。
            </p>
            <p>
              如果备份无效（如缺少 <code>data.db</code> 文件），则不会发生任何变化。
            </p>
            <p className="mt-2">以下是恢复流程的简化版本：</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>
                用备份内容替换当前的 <code>pb_data</code>
              </li>
              <li>触发应用重启</li>
              <li>
                应用恢复的 <code>pb_data</code> 中缺失的迁移
              </li>
              <li>像往常一样初始化应用服务器</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="text-sm">
          输入备份名称{' '}
          <span className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs font-mono">
            {backupName}
            <button type="button" onClick={handleCopy} className="hover:text-primary">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </span>{' '}
          以确认：
        </div>

        <form id="backup-restore-form" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="backup-name-confirm">备份名称</Label>
            <Input
              id="backup-name-confirm"
              type="text"
              required
              value={nameConfirm}
              onChange={(e) => setNameConfirm(e.target.value)}
              placeholder="输入备份名称以确认"
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
            取消
          </Button>
          <Button
            type="submit"
            form="backup-restore-form"
            variant="destructive"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? '恢复中...' : '恢复备份'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
