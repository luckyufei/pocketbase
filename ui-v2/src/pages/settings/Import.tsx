/**
 * Import Settings 页面
 * 导入 Collections 配置
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Upload, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getApiClient } from '@/lib/ApiClient'

export function Import() {
  const [importData, setImportData] = useState<string>('')
  const [parsedData, setParsedData] = useState<any[] | null>(null)
  const [parseError, setParseError] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(
    null
  )

  const pb = getApiClient()

  const handleTextChange = (value: string) => {
    setImportData(value)
    setParseError('')
    setParsedData(null)
    setImportResult(null)

    if (!value.trim()) {
      return
    }

    try {
      const data = JSON.parse(value)
      if (!Array.isArray(data)) {
        setParseError('Invalid format: expected an array of collections')
        return
      }
      setParsedData(data)
    } catch (err) {
      setParseError('Invalid JSON format')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      handleTextChange(content)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!parsedData) return

    setIsImporting(true)
    setImportResult(null)

    try {
      await pb.collections.import(parsedData, false)
      setImportResult({
        success: true,
        message: `Successfully imported ${parsedData.length} collections`,
      })
      setImportData('')
      setParsedData(null)
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.message || 'Failed to import collections',
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Import</span>
        </nav>
      </header>

      <div className="space-y-6">
        {/* 警告 */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Importing collections will overwrite existing collections with the same name. Make sure
            to backup your data before importing.
          </AlertDescription>
        </Alert>

        {/* 文件上传 */}
        <div className="space-y-2">
          <Label htmlFor="fileUpload">Upload JSON file</Label>
          <div className="flex gap-2">
            <input
              id="fileUpload"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('fileUpload')?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose file
            </Button>
          </div>
        </div>

        {/* 文本输入 */}
        <div className="space-y-2">
          <Label htmlFor="importData">Or paste JSON directly</Label>
          <textarea
            id="importData"
            className="w-full min-h-[200px] px-3 py-2 border rounded-md bg-background font-mono text-sm"
            value={importData}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder='[{"name": "posts", "type": "base", ...}]'
          />
        </div>

        {/* 解析错误 */}
        {parseError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}

        {/* 解析结果 */}
        {parsedData && (
          <div className="bg-muted p-4 rounded-md">
            <p className="text-sm">
              Found <strong>{parsedData.length}</strong> collections to import:
            </p>
            <ul className="mt-2 text-sm text-muted-foreground">
              {parsedData.slice(0, 10).map((col, i) => (
                <li key={i}>• {col.name || 'unnamed'}</li>
              ))}
              {parsedData.length > 10 && <li>• ... and {parsedData.length - 10} more</li>}
            </ul>
          </div>
        )}

        {/* 导入结果 */}
        {importResult && (
          <Alert variant={importResult.success ? 'default' : 'destructive'}>
            <AlertDescription>{importResult.message}</AlertDescription>
          </Alert>
        )}

        {/* 导入按钮 */}
        <Button onClick={handleImport} disabled={!parsedData || isImporting}>
          {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Import collections
        </Button>
      </div>
    </div>
  )
}

export default Import
