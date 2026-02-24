/**
 * ConfirmEmailChange 页面
 * 用户邮箱变更确认
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiClient } from '@/lib/ApiClient'

type Status = 'input' | 'loading' | 'success' | 'error'

export default function ConfirmEmailChange() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const collection = searchParams.get('collection') || 'users'

  const [status, setStatus] = useState<Status>('input')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const confirmEmailChange = useCallback(async () => {
    if (!token) {
      setStatus('error')
      setError(t('confirmEmailChange.invalidLink'))
      return
    }

    if (!password) {
      setError(t('confirmEmailChange.enterPassword'))
      return
    }

    setStatus('loading')

    try {
      const pb = getApiClient()
      await pb.collection(collection).confirmEmailChange(token, password)
      setStatus('success')
    } catch (err: unknown) {
      setStatus('error')
      const message = err instanceof Error ? err.message : t('confirmEmailChange.failedDefault')
      setError(message)
    }
  }, [token, collection, password, t])

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <CardTitle className="text-slate-900">{t('confirmEmailChange.invalidLinkTitle')}</CardTitle>
            <CardDescription className="text-slate-500">
              {t('confirmEmailChange.invalidLinkDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button className="w-full">{t('confirmEmailChange.backToLogin')}</Button>
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
            <CardTitle className="text-slate-900">{t('confirmEmailChange.processing')}</CardTitle>
            <CardDescription className="text-slate-500">{t('confirmEmailChange.processingDesc')}</CardDescription>
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
            <CardTitle className="text-slate-900">{t('confirmEmailChange.successTitle')}</CardTitle>
            <CardDescription className="text-slate-500">
              {t('confirmEmailChange.successDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button className="w-full">{t('confirmEmailChange.goToLogin')}</Button>
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
            <CardTitle className="text-slate-900">{t('confirmEmailChange.failedTitle')}</CardTitle>
            <CardDescription className="text-slate-500">{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500 text-center">
              {t('confirmEmailChange.failedHint')}
            </p>
            <Link to="/login">
              <Button className="w-full">{t('confirmEmailChange.backToLogin')}</Button>
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
          <CardTitle className="text-slate-900">{t('confirmEmailChange.title')}</CardTitle>
          <CardDescription className="text-slate-500">
            {t('confirmEmailChange.desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-900">
                {t('confirmEmailChange.currentPassword')}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={t('confirmEmailChange.passwordPlaceholder')}
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
              {t('confirmEmailChange.confirmBtn')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
