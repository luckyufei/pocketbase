/**
 * ConfirmVerification 页面
 * 用户邮箱验证确认
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiClient } from '@/lib/ApiClient'

type Status = 'loading' | 'success' | 'error'

export default function ConfirmVerification() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const collection = searchParams.get('collection') || 'users'

  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')

  const confirmVerification = useCallback(async () => {
    if (!token) {
      setStatus('error')
      setError(t('confirmVerification.invalidLink'))
      return
    }

    try {
      const pb = getApiClient()
      await pb.collection(collection).confirmVerification(token)
      setStatus('success')
    } catch (err: unknown) {
      setStatus('error')
      const message = err instanceof Error ? err.message : t('confirmVerification.failedDefault')
      setError(message)
    }
  }, [token, collection, t])

  useEffect(() => {
    confirmVerification()
  }, [confirmVerification])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            </div>
            <CardTitle className="text-slate-900">{t('confirmVerification.verifying')}</CardTitle>
            <CardDescription className="text-slate-500">
              {t('confirmVerification.verifyingDesc')}
            </CardDescription>
          </CardHeader>
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
            <CardTitle className="text-slate-900">{t('confirmVerification.failedTitle')}</CardTitle>
            <CardDescription className="text-slate-500">{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500 text-center">
              {t('confirmVerification.failedHint')}
            </p>
            <Link to="/login">
              <Button className="w-full">{t('confirmVerification.goToLogin')}</Button>
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
            <CheckCircle className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle className="text-slate-900">{t('confirmVerification.successTitle')}</CardTitle>
          <CardDescription className="text-slate-500">
            {t('confirmVerification.successDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/login">
            <Button className="w-full">{t('confirmVerification.goToLogin')}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
