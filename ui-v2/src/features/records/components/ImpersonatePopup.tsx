/**
 * 模拟登录弹窗
 * 生成用于模拟用户身份的认证令牌
 */
import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/useToast'
import { getApiExampleUrl } from '@/lib/apiDocsUtils'
import pb from '@/lib/pocketbase'
import type { RecordModel, CollectionModel } from 'pocketbase'

interface ImpersonatePopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection: CollectionModel
  record: RecordModel
}

export function ImpersonatePopup({
  open,
  onOpenChange,
  collection,
  record,
}: ImpersonatePopupProps) {
  const [duration, setDuration] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const backendAbsUrl = getApiExampleUrl(pb.baseURL)
  const defaultDuration =
    (collection as { authToken?: { duration?: number } })?.authToken?.duration || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting || !collection || !record) return

    setIsSubmitting(true)

    try {
      const client = await pb.collection(collection.name).impersonate(record.id, duration)
      setToken(client.authStore.token)
    } catch (err) {
      toast({
        title: '生成令牌失败',
        description: err instanceof Error ? err.message : '请重试',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: '复制失败',
        variant: 'destructive',
      })
    }
  }

  const handleReset = () => {
    setToken(null)
    setDuration(0)
  }

  const handleClose = () => {
    onOpenChange(false)
    handleReset()
  }

  const jsCode = `import PocketBase from 'pocketbase';

const token = "...";

const pb = new PocketBase('${backendAbsUrl}');

pb.authStore.save(token, null);`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final token = "...";

final pb = PocketBase('${backendAbsUrl}');

pb.authStore.save(token, null);`

  const displayValue = record.email || record.username || record.name || record.id

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>模拟认证令牌</DialogTitle>
          <DialogDescription className="sr-only">生成用于模拟用户身份的认证令牌</DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="flex items-center gap-2">
                <code className="flex-1 text-xs break-all select-all">{token}</code>
                <Button type="button" variant="ghost" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </AlertDescription>
            </Alert>

            <Tabs defaultValue="javascript">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="dart">Dart</TabsTrigger>
              </TabsList>
              <TabsContent value="javascript">
                <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                  <code>{jsCode}</code>
                </pre>
              </TabsContent>
              <TabsContent value="dart">
                <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                  <code>{dartCode}</code>
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <form id="impersonate-form" onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm">
              为 <strong>{displayValue}</strong> 生成一个不可续期的认证令牌：
            </p>

            <div className="space-y-2">
              <Label htmlFor="duration">令牌有效期（秒）</Label>
              <Input
                id="duration"
                type="number"
                min={0}
                step={1}
                placeholder={`默认使用集合设置 (${defaultDuration}s)`}
                value={duration || ''}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              />
            </div>
          </form>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            关闭
          </Button>
          {token ? (
            <Button type="button" variant="secondary" onClick={handleReset} disabled={isSubmitting}>
              <RefreshCw className="h-4 w-4 mr-2" />
              生成新令牌
            </Button>
          ) : (
            <Button type="submit" form="impersonate-form" disabled={isSubmitting}>
              {isSubmitting ? '生成中...' : '生成令牌'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
