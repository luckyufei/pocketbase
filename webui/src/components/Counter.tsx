import { useAtom, useSetAtom } from 'jotai'
import { countAtom, incrementAtom, decrementAtom } from '@/store/counter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'

export function Counter() {
  const [count] = useAtom(countAtom)
  const increment = useSetAtom(incrementAtom)
  const decrement = useSetAtom(decrementAtom)
  const { t } = useTranslation()

  const getStatusKey = () => {
    if (count === 0) return 'zero'
    return count > 0 ? 'positive' : 'negative'
  }

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h2 className="text-2xl font-bold">{t('counter.title')}</h2>
      <div className="flex items-center gap-4">
        <div className="text-4xl font-mono">{count}</div>
        <Badge variant={count > 0 ? 'default' : count < 0 ? 'destructive' : 'secondary'}>
          {t(`counter.status.${getStatusKey()}`)}
        </Badge>
      </div>
      <div className="flex gap-2">
        <Button variant="destructive" onClick={() => decrement()}>
          {t('counter.buttons.decrement')}
        </Button>
        <Button onClick={() => increment()}>{t('counter.buttons.increment')}</Button>
      </div>
    </div>
  )
}
