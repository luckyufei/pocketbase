/**
 * Tokens Settings 页面
 * API Token 管理
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Loader2, RefreshCw, Plus, Trash2, Copy, Check } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'

interface Token {
  id: string
  name: string
  token?: string
  created: string
  lastUsed?: string
}

export function Tokens() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const pb = getApiClient()

  const loadTokens = async () => {
    setIsLoading(true)
    try {
      const list = await pb.send('/api/settings/tokens', { method: 'GET' })
      setTokens(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('Failed to load tokens:', err)
      setTokens([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTokens()
  }, [])

  const createToken = async () => {
    if (!newTokenName.trim()) return

    setIsCreating(true)
    try {
      const result = await pb.send('/api/settings/tokens', {
        method: 'POST',
        body: { name: newTokenName },
      })
      setCreatedToken(result.token)
      await loadTokens()
    } catch (err) {
      console.error('Failed to create token:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const deleteToken = async (id: string) => {
    if (!confirm('Are you sure you want to delete this token?')) {
      return
    }
    try {
      await pb.send(`/api/settings/tokens/${id}`, { method: 'DELETE' })
      await loadTokens()
    } catch (err) {
      console.error('Failed to delete token:', err)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  const closeDialog = () => {
    setShowDialog(false)
    setNewTokenName('')
    setCreatedToken(null)
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Tokens</span>
        </nav>
      </header>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Token
        </Button>
        <Button variant="outline" onClick={loadTokens} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Token 列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No API tokens found. Create your first token to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell className="font-medium">{token.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(token.created)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {token.lastUsed ? formatDate(token.lastUsed) : 'Never'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteToken(token.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 创建 Token 对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdToken ? 'Token Created' : 'Create API Token'}</DialogTitle>
          </DialogHeader>

          {createdToken ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copy this token now. You won't be able to see it again.
              </p>
              <div className="flex gap-2">
                <Input value={createdToken} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(createdToken, 'new')}
                >
                  {copiedId === 'new' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tokenName">Token Name</Label>
                <Input
                  id="tokenName"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="My API Token"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {createdToken ? (
              <Button onClick={closeDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={createToken} disabled={isCreating || !newTokenName.trim()}>
                  {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Tokens
