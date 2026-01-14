/**
 * OAuth2RedirectSuccess 页面
 * OAuth2 认证成功跳转页
 */
import { useEffect } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function OAuth2RedirectSuccess() {
  useEffect(() => {
    // 通知父窗口认证成功
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'oauth2-success',
          url: window.location.href,
        },
        '*'
      )
      // 关闭弹窗
      setTimeout(() => {
        window.close()
      }, 1000)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <CheckCircle className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle className="text-slate-900">认证成功</CardTitle>
          <CardDescription className="text-slate-500">
            OAuth2 认证已完成，正在返回应用...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    </div>
  )
}
