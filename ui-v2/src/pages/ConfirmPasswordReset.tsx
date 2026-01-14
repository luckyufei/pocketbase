/**
 * ConfirmPasswordReset 页面
 * 确认密码重置
 */
import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Lock, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiClient } from '@/lib/ApiClient'

export default function ConfirmPasswordReset() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')

      if (password !== passwordConfirm) {
        setError('两次输入的密码不一致')
        return
      }

      if (password.length < 8) {
        setError('密码长度至少为 8 个字符')
        return
      }

      setLoading(true)

      try {
        const pb = getApiClient()
        await pb.collection('_superusers').confirmPasswordReset(token!, password, passwordConfirm)
        setSuccess(true)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '重置密码失败，链接可能已过期'
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [token, password, passwordConfirm]
  )

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
              密码重置链接无效或已过期。请重新请求密码重置。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/request-password-reset">
              <Button className="w-full">请求新的重置链接</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle className="h-6 w-6 text-blue-500" />
            </div>
            <CardTitle className="text-slate-900">密码已重置</CardTitle>
            <CardDescription className="text-slate-500">
              您的密码已成功重置。现在可以使用新密码登录。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/login')}>
              前往登录
            </Button>
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
            <Lock className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle className="text-slate-900">设置新密码</CardTitle>
          <CardDescription className="text-slate-500">请输入您的新密码。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-900">
                新密码
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="至少 8 个字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm" className="text-slate-900">
                确认密码
              </Label>
              <Input
                id="passwordConfirm"
                type="password"
                placeholder="再次输入密码"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '重置中...' : '重置密码'}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors"
              >
                <ArrowLeft className="h-3 w-3 inline mr-1" />
                返回登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
