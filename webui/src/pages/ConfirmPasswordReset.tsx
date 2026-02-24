/**
 * ConfirmPasswordReset 页面
 * 确认密码重置
 */
import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiClient } from '@/lib/ApiClient'

export default function ConfirmPasswordReset() {
  const { t } = useTranslation()
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
        setError(t('confirmPasswordReset.passwordMismatch'))
        return
      }

      if (password.length < 8) {
        setError(t('confirmPasswordReset.passwordTooShort'))
        return
      }

      setLoading(true)

      try {
        const pb = getApiClient()
        await pb.collection('_superusers').confirmPasswordReset(token!, password, passwordConfirm)
        setSuccess(true)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('confirmPasswordReset.failedDefault')
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [token, password, passwordConfirm, t]
  )

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <CardTitle className="text-slate-900">{t('confirmPasswordReset.invalidLinkTitle')}</CardTitle>
            <CardDescription className="text-slate-500">
              {t('confirmPasswordReset.invalidLinkDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/request-password-reset">
              <Button className="w-full">{t('confirmPasswordReset.requestNewLink')}</Button>
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
            <CardTitle className="text-slate-900">{t('confirmPasswordReset.successTitle')}</CardTitle>
            <CardDescription className="text-slate-500">
              {t('confirmPasswordReset.successDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/login')}>
              {t('confirmPasswordReset.goToLogin')}
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
          <CardTitle className="text-slate-900">{t('confirmPasswordReset.title')}</CardTitle>
          <CardDescription className="text-slate-500">{t('confirmPasswordReset.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-900">
                {t('confirmPasswordReset.newPassword')}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={t('confirmPasswordReset.newPasswordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm" className="text-slate-900">
                {t('confirmPasswordReset.confirmPassword')}
              </Label>
              <Input
                id="passwordConfirm"
                type="password"
                placeholder={t('confirmPasswordReset.confirmPasswordPlaceholder')}
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
              {loading ? t('confirmPasswordReset.resetting') : t('confirmPasswordReset.resetBtn')}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors"
              >
                <ArrowLeft className="h-3 w-3 inline mr-1" />
                {t('confirmPasswordReset.backToLogin')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
