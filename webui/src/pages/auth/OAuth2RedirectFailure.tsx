/**
 * OAuth2RedirectFailure 页面
 * OAuth2 认证失败跳转页
 */
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function OAuth2RedirectFailure() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error') || 'unknown_error'
  const errorDescription = searchParams.get('error_description') || t('oauth2Redirect.defaultErrorDesc')

  useEffect(() => {
    // 通知父窗口认证失败
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'oauth2-failure',
          error,
          errorDescription,
        },
        '*'
      )
    }
  }, [error, errorDescription])

  const handleClose = () => {
    if (window.opener) {
      window.close()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <CardTitle className="text-slate-900">{t('oauth2Redirect.failureTitle')}</CardTitle>
          <CardDescription className="text-slate-500">{errorDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-slate-100 rounded-xl">
            <p className="text-xs text-slate-500">
              {t('oauth2Redirect.errorCode')}: <code className="text-slate-700">{error}</code>
            </p>
          </div>

          <Button variant="outline" className="w-full" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            {t('oauth2Redirect.closeWindow')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
