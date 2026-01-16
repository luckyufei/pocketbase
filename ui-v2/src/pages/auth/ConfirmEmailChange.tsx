/**
 * ConfirmEmailChange 页面
 * 用户邮箱变更确认
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiClient } from '@/lib/ApiClient'

type Status = 'input' | 'loading' | 'success' | 'error'

export default function ConfirmEmailChange() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const collection = searchParams.get('collection') || 'users'

  const [status, setStatus] = useState<Status>('input')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const confirmEmailChange = useCallback(async () => {
    if (!token) {
      setStatus('error')
      setError('验证链接无效')
      return
    }

    if (!password) {
      setError('请输入密码')
      return
    }

    setStatus('loading')

    try {
      const pb = getApiClient()
      await pb.collection(collection).confirmEmailChange(token, password)
      setStatus('success')
    } catch (err: unknown) {
      setStatus('error')
      const message = err instanceof Error ? err.message : '邮箱变更失败，链接可能已过期'
      setError(message)
    }
  }, [token, collection, password])

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <CardTitle className="text-slate-900">无效的链接</CardTitle>
            <CardDescription className="text-slate-500">
              邮箱变更链接无效或已过期。请重新请求邮箱变更。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button className="w-full">返回登录</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            </div>
            <CardTitle className="text-slate-900">正在处理...</CardTitle>
            <CardDescription className="text-slate-500">请稍候，正在确认邮箱变更。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle className="h-6 w-6 text-blue-500" />
            </div>
            <CardTitle className="text-slate-900">邮箱变更成功</CardTitle>
            <CardDescription className="text-slate-500">
              您的邮箱地址已成功变更。请使用新邮箱登录。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button className="w-full">前往登录</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <CardTitle className="text-slate-900">变更失败</CardTitle>
            <CardDescription className="text-slate-500">{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500 text-center">
              邮箱变更链接可能已过期或密码不正确。
            </p>
            <Link to="/login">
              <Button className="w-full">返回登录</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Mail className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle className="text-slate-900">确认邮箱变更</CardTitle>
          <CardDescription className="text-slate-500">
            请输入您的当前密码以确认邮箱变更。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-900">
                当前密码
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="输入您的密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <Button className="w-full" onClick={confirmEmailChange}>
              确认变更
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
