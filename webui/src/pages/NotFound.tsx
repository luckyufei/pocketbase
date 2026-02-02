import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-slate-50">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-6xl font-bold mb-2 text-slate-900">404</CardTitle>
          <CardTitle className="text-2xl text-slate-900">{t('notFound.title')}</CardTitle>
          <CardDescription className="text-slate-500">{t('notFound.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to="/">{t('notFound.goHome')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
