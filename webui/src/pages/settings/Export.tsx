/**
 * Export Collections Settings 页面
 * 导出 Collections 配置
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Download, Loader2 } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'
import { toast } from 'sonner'
import type { RecordModel } from 'pocketbase'

interface CollectionData extends RecordModel {
  name: string
  type: string
  oauth2?: {
    providers?: unknown
    [key: string]: unknown
  }
}

// Sort collections by type (auth -> base -> view) and then by name
function sortCollections(collections: CollectionData[]): CollectionData[] {
  const auth: CollectionData[] = []
  const base: CollectionData[] = []
  const view: CollectionData[] = []

  for (const collection of collections) {
    if (collection.type === 'auth') {
      auth.push(collection)
    } else if (collection.type === 'base') {
      base.push(collection)
    } else {
      view.push(collection)
    }
  }

  const sortByName = (a: CollectionData, b: CollectionData) => {
    if (a.name > b.name) return 1
    if (a.name < b.name) return -1
    return 0
  }

  return [...auth.sort(sortByName), ...base.sort(sortByName), ...view.sort(sortByName)]
}

// Download JSON file
function downloadJson(obj: unknown, name: string) {
  const fileName = name.endsWith('.json') ? name : name + '.json'
  const blob = new Blob([JSON.stringify(obj, null, 4)], {
    type: 'application/json',
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

export function Export() {
  const [collections, setCollections] = useState<CollectionData[]>([])
  const [bulkSelected, setBulkSelected] = useState<Record<string, CollectionData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const pb = getApiClient()

  // Computed values
  const schema = JSON.stringify(Object.values(bulkSelected), null, 4)
  const totalSelected = Object.keys(bulkSelected).length
  const areAllSelected = collections.length > 0 && totalSelected === collections.length

  // Load collections on mount
  useEffect(() => {
    loadCollections()
  }, [])

  const loadCollections = async () => {
    setIsLoading(true)
    try {
      const result = await pb.collections.getFullList<CollectionData>({
        batch: 100,
      })

      // Sort collections
      const sorted = sortCollections(result)

      // Clean data - remove timestamps and oauth2 providers
      for (const collection of sorted) {
        delete (collection as any).created
        delete (collection as any).updated
        if (collection.oauth2) {
          delete collection.oauth2.providers
        }
      }

      setCollections(sorted)

      // Select all by default
      const selected: Record<string, CollectionData> = {}
      for (const collection of sorted) {
        selected[collection.id] = collection
      }
      setBulkSelected(selected)
    } catch (err) {
      console.error('Failed to load collections:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSelectAll = () => {
    if (areAllSelected) {
      setBulkSelected({})
    } else {
      const selected: Record<string, CollectionData> = {}
      for (const collection of collections) {
        selected[collection.id] = collection
      }
      setBulkSelected(selected)
    }
  }

  const toggleSelectCollection = (collection: CollectionData) => {
    setBulkSelected((prev) => {
      const newSelected = { ...prev }
      if (newSelected[collection.id]) {
        delete newSelected[collection.id]
      } else {
        newSelected[collection.id] = collection
      }
      return newSelected
    })
  }

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(schema)
      toast.success('The configuration was copied to your clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('Failed to copy to clipboard')
    }
  }, [schema])

  const handleDownload = () => {
    downloadJson(Object.values(bulkSelected), 'pb_schema')
  }

  // Handle Ctrl+A in preview area
  const handlePreviewKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault()
      const selection = window.getSelection()
      const range = document.createRange()
      if (previewRef.current) {
        range.selectNodeContents(previewRef.current)
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    }
  }

  return (
    <div className="p-6 flex-1 flex flex-col min-h-0">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Export collections</span>
        </nav>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* 说明文字 */}
          <p className="text-base mb-6">
            Below you'll find your current collections configuration that you could import in another
            PocketBase environment.
          </p>

          {/* 主体区域 - 左右两栏 */}
          <div className="flex h-[550px] border rounded-lg overflow-hidden">
            {/* 左侧选择列表 */}
            <div className="w-[220px] flex-shrink-0 bg-muted/50 overflow-auto p-3 border-r">
              {/* Select all */}
              <div className="mb-4 pb-3 border-b">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={areAllSelected}
                    onCheckedChange={toggleSelectAll}
                    disabled={collections.length === 0}
                  />
                  <span className="text-sm font-medium">Select all</span>
                </label>
              </div>

              {/* Collections 列表 */}
              <div className="space-y-2">
                {collections.map((collection) => (
                  <label
                    key={collection.id}
                    className="flex items-center gap-2 cursor-pointer"
                    title={collection.name}
                  >
                    <Checkbox
                      checked={!!bulkSelected[collection.id]}
                      onCheckedChange={() => toggleSelectCollection(collection)}
                    />
                    <span className="text-sm truncate">{collection.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 右侧预览区域 */}
            <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
              {/* Copy 按钮 - 只有选中时才显示 */}
              {totalSelected > 0 && (
                <div className="flex justify-end p-2 pb-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={handleCopy}
                  >
                    Copy
                  </Button>
                </div>
              )}

              {/* JSON 预览 */}
              <div
                ref={previewRef}
                tabIndex={0}
                className="flex-1 p-4 pt-2 overflow-auto font-mono text-sm focus:outline-none"
                onKeyDown={handlePreviewKeyDown}
              >
                <pre className="whitespace-pre">{schema}</pre>
              </div>
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="flex justify-end mt-4">
            <Button disabled={totalSelected === 0} onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download as JSON
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default Export
