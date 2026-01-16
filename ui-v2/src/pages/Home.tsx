import { Counter } from '@/components/Counter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'

export default function Home() {
  const { t } = useTranslation()

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">{t('home.title')}</h1>
        <p className="text-muted-foreground">{t('home.subtitle')}</p>
        <div className="flex justify-center gap-2 mt-4">
          <Badge>{t('home.badges.react')}</Badge>
          <Badge variant="secondary">{t('home.badges.typescript')}</Badge>
          <Badge variant="outline">{t('home.badges.tailwind')}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('home.counter.title')}</CardTitle>
          <CardDescription>{t('home.counter.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Counter />
        </CardContent>
      </Card>
    </div>
  )
}
