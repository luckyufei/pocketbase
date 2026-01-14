/**
 * RecordFileThumb - 文件缩略图组件
 * 用于显示文件的缩略图预览
 */
import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { pb } from '@/lib/ApiClient'
import { FileIcon, VideoIcon, Music2Icon, FileTextIcon, ImageIcon, Loader2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface RecordFileThumbProps {
  record: {
    id: string
    collectionId: string
    collectionName?: string
    [key: string]: any
  }
  filename: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  onClick?: () => void
}

// 获取文件类型
function getFileType(filename: string): 'image' | 'video' | 'audio' | 'document' | 'file' {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
  const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv']
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']

  if (imageExts.includes(ext)) return 'image'
  if (videoExts.includes(ext)) return 'video'
  if (audioExts.includes(ext)) return 'audio'
  if (docExts.includes(ext)) return 'document'
  return 'file'
}

// 检查是否有图片扩展名
function hasImageExtension(filename: string): boolean {
  return getFileType(filename) === 'image'
}

// 获取尺寸类
function getSizeClass(size?: string): string {
  switch (size) {
    case 'sm':
      return 'w-12 h-12'
    case 'lg':
      return 'w-24 h-24'
    case 'xl':
      return 'w-32 h-32'
    default:
      return 'w-16 h-16'
  }
}

export function RecordFileThumb({
  record,
  filename,
  size = 'md',
  className,
  onClick,
}: RecordFileThumbProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const fileType = useMemo(() => getFileType(filename), [filename])
  const isImage = fileType === 'image'
  const hasPreview = ['image', 'audio', 'video'].includes(fileType) || filename.endsWith('.pdf')

  // 获取缩略图 URL
  const thumbUrl = useMemo(() => {
    if (!record.id || !filename) return ''
    try {
      return pb.files.getURL(record, filename, { thumb: '100x100' })
    } catch {
      return ''
    }
  }, [record, filename])

  // 获取完整文件 URL
  const fullUrl = useMemo(() => {
    if (!record.id || !filename) return ''
    try {
      return pb.files.getURL(record, filename)
    } catch {
      return ''
    }
  }, [record, filename])

  const handleImageLoad = useCallback(() => {
    setIsLoading(false)
    setHasError(false)
  }, [])

  const handleImageError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
  }, [])

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick()
    } else if (hasPreview) {
      setPreviewOpen(true)
    }
  }, [onClick, hasPreview])

  // 渲染文件图标
  const renderIcon = () => {
    const iconClass = 'w-6 h-6 text-muted-foreground'

    switch (fileType) {
      case 'video':
        return <VideoIcon className={iconClass} />
      case 'audio':
        return <Music2Icon className={iconClass} />
      case 'document':
        return <FileTextIcon className={iconClass} />
      case 'image':
        return <ImageIcon className={iconClass} />
      default:
        return <FileIcon className={iconClass} />
    }
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          'relative flex items-center justify-center rounded-md border bg-muted overflow-hidden cursor-pointer transition-colors hover:border-primary',
          getSizeClass(size),
          className
        )}
        title={hasPreview ? `Preview ${filename}` : `Download ${filename}`}
        onClick={handleClick}
      >
        {isImage && thumbUrl && !hasError ? (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            <img
              src={thumbUrl}
              alt={filename}
              className={cn('w-full h-full object-cover', isLoading && 'opacity-0')}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
              draggable={false}
            />
          </>
        ) : (
          renderIcon()
        )}
      </button>

      {/* 预览对话框 */}
      {hasPreview && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            {fileType === 'image' && (
              <img src={fullUrl} alt={filename} className="w-full h-full object-contain" />
            )}
            {fileType === 'video' && (
              <video src={fullUrl} controls className="w-full h-full" autoPlay />
            )}
            {fileType === 'audio' && (
              <div className="p-8">
                <audio src={fullUrl} controls className="w-full" autoPlay />
              </div>
            )}
            {filename.endsWith('.pdf') && (
              <iframe src={fullUrl} className="w-full h-[80vh]" title={filename} />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export { getFileType, hasImageExtension }
