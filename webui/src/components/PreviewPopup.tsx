/**
 * T017: PreviewPopup - 文件预览弹窗组件
 * 用于预览图片和其他文件类型
 */
import { useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PreviewPopupProps {
  className?: string
  onShow?: () => void
  onHide?: () => void
}

export interface PreviewPopupRef {
  show: (urlOrFactory: string | (() => Promise<string>) | Promise<string>) => Promise<void>
  hide: () => void
}

/**
 * 根据文件名获取文件类型
 */
function getFileType(filename: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
  const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi']
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac']
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']

  if (imageExts.includes(ext)) return 'image'
  if (videoExts.includes(ext)) return 'video'
  if (audioExts.includes(ext)) return 'audio'
  if (docExts.includes(ext)) return 'document'
  return 'other'
}

export const PreviewPopup = forwardRef<PreviewPopupRef, PreviewPopupProps>(function PreviewPopup(
  { className, onShow, onHide },
  ref
) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [urlOrFactory, setUrlOrFactory] = useState<
    string | (() => Promise<string>) | Promise<string> | null
  >(null)

  const resolveUrlOrFactory = useCallback(async () => {
    if (!urlOrFactory) return ''
    if (typeof urlOrFactory === 'function') {
      return await urlOrFactory()
    }
    return await urlOrFactory
  }, [urlOrFactory])

  const show = useCallback(
    async (newUrlOrFactory: string | (() => Promise<string>) | Promise<string>) => {
      if (!newUrlOrFactory) return

      setUrlOrFactory(newUrlOrFactory)

      let resolvedUrl: string
      if (typeof newUrlOrFactory === 'function') {
        resolvedUrl = await newUrlOrFactory()
      } else {
        resolvedUrl = await newUrlOrFactory
      }

      setUrl(resolvedUrl)
      setOpen(true)
      onShow?.()
    },
    [onShow]
  )

  const hide = useCallback(() => {
    setOpen(false)
    onHide?.()
  }, [onHide])

  useImperativeHandle(ref, () => ({
    show,
    hide,
  }))

  const queryParamsIndex = url.indexOf('?')
  const filename = url.substring(
    url.lastIndexOf('/') + 1,
    queryParamsIndex > 0 ? queryParamsIndex : undefined
  )
  const type = getFileType(filename)

  const openInNewTab = async () => {
    try {
      const newUrl = await resolveUrlOrFactory()
      window.open(newUrl, '_blank', 'noreferrer,noopener')
    } catch (err) {
      console.warn('openInNewTab file token failure:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={cn('max-w-4xl max-h-[90vh] p-0 overflow-hidden', className)}>
        <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
          <DialogTitle className="sr-only">Preview {filename}</DialogTitle>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4" onClick={hide}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[300px]">
          {type === 'image' ? (
            <img
              src={url}
              alt={`Preview ${filename}`}
              className="max-w-full max-h-[70vh] object-contain"
            />
          ) : (
            <object title={filename} data={url} className="w-full h-[70vh]">
              Cannot preview the file.
            </object>
          )}
        </div>

        <DialogFooter className="p-4 pt-0 flex items-center justify-between">
          <button
            type="button"
            title={filename}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate max-w-[300px]"
            onClick={openInNewTab}
          >
            {filename}
            <ExternalLink className="h-3 w-3" />
          </button>
          <div className="flex-1" />
          <Button variant="outline" onClick={hide}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export default PreviewPopup
