/**
 * Export Settings 页面
 * 导出 Collections 配置
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, Download, Copy, Check } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'
import { useAtomValue } from 'jotai'
import { collectionsAtom } from '@/store/collections'

export function Export() {
  const collections = useAtomValue(collectionsAtom)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exportData, setExportData] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const pb = getApiClient()

  const toggleCollection = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const selectAll = () => {
    setSelectedIds(new Set(collections.map((c) => c.id)))
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const selectedCollections = collections.filter((c) => selectedIds.has(c.id))
      const data = JSON.stringify(selectedCollections, null, 2)
      setExportData(data)
    } catch (err) {
      console.error('Failed to export:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportData)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const downloadAsFile = () => {
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pb_schema_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Export</span>
        </nav>
      </header>

      <div className="space-y-6">
        {/* 选择 Collections */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h3 className="font-medium">Select collections to export</h3>
            <Button variant="link" size="sm" onClick={selectAll}>
              Select all
            </Button>
            <Button variant="link" size="sm" onClick={selectNone}>
              Select none
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-auto border rounded-md p-4">
            {collections.map((collection) => (
              <div key={collection.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`col-${collection.id}`}
                  checked={selectedIds.has(collection.id)}
                  onCheckedChange={() => toggleCollection(collection.id)}
                />
                <Label htmlFor={`col-${collection.id}`} className="text-sm">
                  {collection.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* 导出按钮 */}
        <Button onClick={handleExport} disabled={selectedIds.size === 0 || isExporting}>
          {isExporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Export ({selectedIds.size} collections)
        </Button>

        {/* 导出结果 */}
        {exportData && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyToClipboard}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </Button>
              <Button variant="outline" onClick={downloadAsFile}>
                <Download className="w-4 h-4 mr-2" />
                Download as file
              </Button>
            </div>
            <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
              {exportData}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default Export
