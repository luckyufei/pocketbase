/**
 * Backups Settings 页面
 * 数据库备份管理
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Download, Trash2, Plus, RefreshCw } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'

interface Backup {
  key: string
  size: number
  modified: string
}

export function Backups() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  const pb = getApiClient()

  const loadBackups = async () => {
    setIsLoading(true)
    try {
      const list = await pb.backups.getFullList()
      setBackups(list || [])
    } catch (err) {
      console.error('Failed to load backups:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBackups()
  }, [])

  const createBackup = async () => {
    setIsCreating(true)
    try {
      await pb.backups.create('')
      await loadBackups()
    } catch (err) {
      console.error('Failed to create backup:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const deleteBackup = async (key: string) => {
    if (!confirm(`Are you sure you want to delete backup "${key}"?`)) {
      return
    }
    try {
      await pb.backups.delete(key)
      await loadBackups()
    } catch (err) {
      console.error('Failed to delete backup:', err)
    }
  }

  const downloadBackup = async (key: string) => {
    try {
      const token = await pb.backups.getDownloadUrl(key, '')
      window.open(token, '_blank')
    } catch (err) {
      console.error('Failed to download backup:', err)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Backups</span>
        </nav>
      </header>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <Button onClick={createBackup} disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Create backup
        </Button>
        <Button variant="outline" onClick={loadBackups} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* 备份列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : backups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No backups found. Create your first backup to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map((backup) => (
              <TableRow key={backup.key}>
                <TableCell className="font-mono text-sm">{backup.key}</TableCell>
                <TableCell>{formatSize(backup.size)}</TableCell>
                <TableCell>{formatDate(backup.modified)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadBackup(backup.key)}
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteBackup(backup.key)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export default Backups
