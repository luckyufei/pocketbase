/**
 * RecordFilePicker - 文件选择器组件
 * 用于在编辑器中从已有记录选择文件/图片
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, Image as ImageIcon, File } from 'lucide-react'
import { usePocketbase } from '@/hooks/usePocketbase'
import { useCollections } from '@/features/collections/hooks/useCollections'
import { cn, getFileType, hasImageExtension } from '@/lib/utils'
import type { RecordModel, CollectionModel, CollectionField } from 'pocketbase'

export interface FileSelection {
  record: RecordModel
  name: string
  size: string
}

interface RecordFilePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  submitText?: string
  fileTypes?: ('image' | 'document' | 'video' | 'audio' | 'file')[]
  onSubmit: (selection: FileSelection) => void
}

export function RecordFilePicker({
  open,
  onOpenChange,
  title = 'Select a file',
  submitText = 'Insert',
  fileTypes = ['image', 'document', 'video', 'audio', 'file'],
  onSubmit,
}: RecordFilePickerProps) {
  const { pb } = usePocketbase()
  const { collections } = useCollections()
  
  const [filter, setFilter] = useState('')
  const [records, setRecords] = useState<RecordModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<CollectionModel | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ record: RecordModel; name: string } | null>(null)
  const [selectedSize, setSelectedSize] = useState('')

  // Find all collections with at least one non-protected file field
  const fileCollections = useMemo(() => {
    return collections.filter((c: CollectionModel) => {
      if (c.type === 'view') return false
      return c.fields?.some((f: CollectionField) => {
        return (
          f.type === 'file' &&
          !f.protected &&
          (!f.mimeTypes?.length || f.mimeTypes?.some((t: string) => t.startsWith('image/')))
        )
      })
    })
  }, [collections])

  // Get file fields for selected collection
  const fileFields = useMemo(() => {
    if (!selectedCollection) return []
    return selectedCollection.fields?.filter(
      (f: CollectionField) => f.type === 'file' && !f.protected
    ) || []
  }, [selectedCollection])

  // Get size options from selected file field
  const sizeOptions = useMemo(() => {
    if (!selectedFile?.name) return []
    
    // Find the field containing this file
    const field = fileFields.find((f: CollectionField) => {
      const files = Array.isArray(selectedFile.record[f.name])
        ? selectedFile.record[f.name]
        : [selectedFile.record[f.name]]
      return files.includes(selectedFile.name)
    })

    if (!field?.thumbs?.length) return []

    return field.thumbs.map((size: string) => ({
      value: size,
      label: `${size} thumb`,
    }))
  }, [selectedFile, fileFields])

  // Auto select first collection
  useEffect(() => {
    if (!selectedCollection && fileCollections.length > 0) {
      setSelectedCollection(fileCollections[0])
    }
  }, [fileCollections, selectedCollection])

  // Load records when collection or filter changes
  useEffect(() => {
    if (!open || !selectedCollection) return

    const loadRecords = async () => {
      setIsLoading(true)
      try {
        const result = await pb.collection(selectedCollection.name).getList(1, 50, {
          filter: filter || undefined,
          requestKey: null,
        })
        setRecords(result.items)
      } catch (err) {
        console.error('Failed to load records:', err)
        setRecords([])
      } finally {
        setIsLoading(false)
      }
    }

    loadRecords()
  }, [open, selectedCollection, filter, pb])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFilter('')
      setSelectedFile(null)
      setSelectedSize('')
    }
  }, [open])

  // Extract files from a record that match the allowed fileTypes
  const extractFiles = useCallback((record: RecordModel): string[] => {
    const result: string[] = []
    for (const field of fileFields) {
      const names = Array.isArray(record[field.name])
        ? record[field.name]
        : record[field.name] ? [record[field.name]] : []
      
      for (const name of names) {
        const type = getFileType(name)
        if (fileTypes.includes(type as any)) {
          result.push(name)
        }
      }
    }
    return result
  }, [fileFields, fileTypes])

  // Get file URL for preview
  const getFileUrl = useCallback((record: RecordModel, filename: string, thumb?: string) => {
    return pb.files.getURL(record, filename, { thumb })
  }, [pb])

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!selectedFile) return
    
    onSubmit({
      record: selectedFile.record,
      name: selectedFile.name,
      size: selectedSize,
    })
    onOpenChange(false)
  }, [selectedFile, selectedSize, onSubmit, onOpenChange])

  const canSubmit = !!selectedFile?.name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {fileCollections.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            You currently don't have any collection with <code>file</code> field.
          </div>
        ) : (
          <div className="flex gap-4 h-[420px]">
            {/* Sidebar - Collections list */}
            <aside className="w-48 shrink-0 border-r pr-4">
              <ScrollArea className="h-full">
                <div className="space-y-1">
                  {fileCollections.map((collection: CollectionModel) => (
                    <button
                      key={collection.id}
                      type="button"
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        selectedCollection?.id === collection.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => {
                        setSelectedCollection(collection)
                        setSelectedFile(null)
                      }}
                    >
                      {collection.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </aside>

            {/* Content - Files grid */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Search bar */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Record search term or filter..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Files grid */}
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : records.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No records with files found.
                  </div>
                ) : (
                  <div className="grid grid-cols-6 gap-2">
                    {records.map((record) => {
                      const files = extractFiles(record)
                      return files.map((filename) => {
                        const isSelected = 
                          selectedFile?.record.id === record.id && 
                          selectedFile?.name === filename
                        const isImage = hasImageExtension(filename)

                        return (
                          <button
                            key={`${record.id}-${filename}`}
                            type="button"
                            className={cn(
                              'aspect-square rounded-md border-2 overflow-hidden transition-all',
                              'hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring',
                              isSelected ? 'border-primary ring-2 ring-primary' : 'border-transparent'
                            )}
                            onClick={() => setSelectedFile({ record, name: filename })}
                            title={filename}
                          >
                            {isImage ? (
                              <img
                                src={getFileUrl(record, filename, '100x100')}
                                alt={filename}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-muted p-2">
                                <File className="h-6 w-6 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate w-full text-center mt-1">
                                  {filename.split('.').pop()?.toUpperCase()}
                                </span>
                              </div>
                            )}
                          </button>
                        )
                      })
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center gap-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="mr-auto">
            Cancel
          </Button>

          {/* Size selector for images */}
          {hasImageExtension(selectedFile?.name || '') && sizeOptions.length > 0 && (
            <Select value={selectedSize} onValueChange={setSelectedSize}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Original</SelectItem>
                {sizeOptions.map((opt: { value: string; label: string }) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
