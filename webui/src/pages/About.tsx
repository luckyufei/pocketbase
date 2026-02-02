import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'

export default function About() {
  const { t } = useTranslation()

  const techStack = [
    { key: 'vite', icon: '⚡' },
    { key: 'react', icon: '⚛️' },
    { key: 'typescript', icon: '📘' },
    { key: 'tailwind', icon: '🎨' },
    { key: 'shadcn', icon: '🎭' },
    { key: 'jotai', icon: '⚛️' },
    { key: 'router', icon: '🚦' },
  ] as const

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">{t('about.title')}</h1>
        <p className="text-muted-foreground">{t('about.subtitle')}</p>
        <div className="flex justify-center gap-2 mt-4">
          <Badge variant="secondary">{t('about.badges.modernStack')}</Badge>
          <Badge variant="outline">{t('about.badges.productionReady')}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('about.techStack.title')}</CardTitle>
          <CardDescription>{t('about.techStack.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {techStack.map((tech) => (
              <Card key={tech.key}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>{tech.icon}</span>
                    {t(`about.techStack.items.${tech.key}.name`)}
                  </CardTitle>
                  <CardDescription>
                    {t(`about.techStack.items.${tech.key}.description`)}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
