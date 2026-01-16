/**
 * T064: BackupUploadButton - 备份上传按钮组件
 * 用于上传备份文件
 */
import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirmation } from '@/hooks/useConfirmation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface BackupUploadButtonProps {
  onSuccess?: () => void
  className?: string
}

export function BackupUploadButton({ onSuccess, className }: BackupUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { confirm } = useConfirmation()

  const resetSelectedFile = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const upload = useCallback(
    async (file: File) => {
      if (isUploading || !file) return

      setIsUploading(true)

      try {
        const formData = new FormData()
        formData.set('file', file)

        const response = await fetch('/api/backups/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error?.file?.message || 'Upload failed')
        }

        toast.success('Successfully uploaded a new backup.')
        onSuccess?.()
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message)
        } else {
          toast.error('Failed to upload backup')
        }
      } finally {
        setIsUploading(false)
        resetSelectedFile()
      }
    },
    [isUploading, onSuccess, resetSelectedFile]
  )

  const uploadConfirm = useCallback(
    (file: File | undefined) => {
      if (!file) return

      confirm({
        title: 'Upload Backup',
        message: `Note that we don't perform validations for the uploaded backup files. Proceed with caution and only if you trust the source.\n\nDo you really want to upload "${file.name}"?`,
        onConfirm: () => upload(file),
        onCancel: resetSelectedFile,
      })
    },
    [confirm, upload, resetSelectedFile]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadConfirm(e.target.files?.[0])
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('rounded-full', className)}
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Upload backup</p>
        </TooltipContent>
      </Tooltip>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/zip"
        className="hidden"
        onChange={handleFileChange}
      />
    </TooltipProvider>
  )
}

export default BackupUploadButton
