/**
 * RequestPasswordReset 页面
 * 请求密码重置
 */
import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiClient } from '@/lib/ApiClient'

export default function RequestPasswordReset() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')
      setLoading(true)

      try {
        const pb = getApiClient()
        await pb.collection('_superusers').requestPasswordReset(email)
        setSuccess(true)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('requestPasswordReset.failedDefault')
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [email, t]
  )

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle className="h-6 w-6 text-blue-500" />
            </div>
            <CardTitle className="text-slate-900">{t('requestPasswordReset.successTitle')}</CardTitle>
            <CardDescription className="text-slate-500">
              {t('requestPasswordReset.successDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('requestPasswordReset.backToLogin')}
              </Button>
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
          <CardTitle className="text-slate-900">{t('requestPasswordReset.title')}</CardTitle>
          <CardDescription className="text-slate-500">
            {t('requestPasswordReset.desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-900">
                {t('requestPasswordReset.email')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('requestPasswordReset.sending') : t('requestPasswordReset.sendLink')}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors"
              >
                <ArrowLeft className="h-3 w-3 inline mr-1" />
                {t('requestPasswordReset.backToLogin')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
