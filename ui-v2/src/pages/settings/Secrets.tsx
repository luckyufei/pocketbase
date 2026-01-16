/**
 * Secrets Settings 页面
 * 环境变量/密钥管理
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, RefreshCw, Plus, Trash2, Eye, EyeOff, Save } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'

interface Secret {
  key: string
  value: string
  isNew?: boolean
}

export function Secrets() {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showValues, setShowValues] = useState<Set<string>>(new Set())

  const pb = getApiClient()

  const loadSecrets = async () => {
    setIsLoading(true)
    try {
      const settings = await pb.send('/api/settings', { method: 'GET' })
      // 解析 secrets（通常是 key-value 对象）
      const secretsObj = settings?.secrets || {}
      const secretsList = Object.entries(secretsObj).map(([key, value]) => ({
        key,
        value: value as string,
      }))
      setSecrets(secretsList)
    } catch (err) {
      console.error('Failed to load secrets:', err)
      setSecrets([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSecrets()
  }, [])

  const addSecret = () => {
    setSecrets((prev) => [...prev, { key: '', value: '', isNew: true }])
  }

  const removeSecret = (index: number) => {
    setSecrets((prev) => prev.filter((_, i) => i !== index))
  }

  const updateSecret = (index: number, field: 'key' | 'value', value: string) => {
    setSecrets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  const toggleShowValue = (key: string) => {
    setShowValues((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const saveSecrets = async () => {
    setIsSaving(true)
    try {
      const secretsObj = secrets.reduce(
        (acc, s) => {
          if (s.key) {
            acc[s.key] = s.value
          }
          return acc
        },
        {} as Record<string, string>
      )

      await pb.send('/api/settings', {
        method: 'PATCH',
        body: { secrets: secretsObj },
      })
      await loadSecrets()
    } catch (err) {
      console.error('Failed to save secrets:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Secrets</span>
        </nav>
      </header>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <Button onClick={addSecret}>
          <Plus className="w-4 h-4 mr-2" />
          Add Secret
        </Button>
        <Button variant="outline" onClick={loadSecrets} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button onClick={saveSecrets} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save
        </Button>
      </div>

      {/* Secrets 列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secrets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No secrets configured. Click "Add Secret" to create one.
                </TableCell>
              </TableRow>
            ) : (
              secrets.map((secret, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      value={secret.key}
                      onChange={(e) => updateSecret(index, 'key', e.target.value)}
                      placeholder="SECRET_KEY"
                      className="font-mono"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Input
                        type={showValues.has(secret.key) ? 'text' : 'password'}
                        value={secret.value}
                        onChange={(e) => updateSecret(index, 'value', e.target.value)}
                        placeholder="secret value"
                        className="font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleShowValue(secret.key)}
                      >
                        {showValues.has(secret.key) ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeSecret(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export default Secrets
