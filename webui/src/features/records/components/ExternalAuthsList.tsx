/**
 * 外部认证列表组件
 * 展示用户关联的 OAuth2 提供商列表，支持解除关联
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSetAtom } from 'jotai'
import { addToast as addToastAtom } from '@/store/toasts'
import { useConfirmation } from '@/hooks/useConfirmation'
import { getProviderByName, getProviderDisplayName } from '@/lib/providers'
import pb from '@/lib/pocketbase'
import type { RecordModel } from 'pocketbase'

interface ExternalAuth {
  id: string
  provider: string
  providerId: string
  collectionRef: string
  recordRef: string
}

interface ExternalAuthsListProps {
  record: RecordModel
  onUnlink?: (provider: string) => void
}

export function ExternalAuthsList({ record, onUnlink }: ExternalAuthsListProps) {
  const { t } = useTranslation()
  const [externalAuths, setExternalAuths] = useState<ExternalAuth[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const addToast = useSetAtom(addToastAtom)
  const { confirm } = useConfirmation()

  const getProviderTitle = (provider: string) => {
    return getProviderDisplayName(provider)
  }

  const getProviderLogo = (provider: string) => {
    const config = getProviderByName(provider)
    return config?.logo || 'default.svg'
  }

  const loadExternalAuths = async () => {
    if (!record?.id) {
      setExternalAuths([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const auths = await pb.collection('_externalAuths').getFullList({
        filter: pb.filter('collectionRef = {:collectionId} && recordRef = {:recordId}', {
          collectionId: record.collectionId,
          recordId: record.id,
        }),
      })
      setExternalAuths(auths as unknown as ExternalAuth[])
    } catch (err) {
      addToast({
        type: 'error',
        message: t('externalAuths.loadError', { error: err instanceof Error ? err.message : t('externalAuths.loadErrorRetry') }),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const unlinkExternalAuth = async (externalAuth: ExternalAuth) => {
    if (!record?.id || !externalAuth) return

    const providerTitle = getProviderTitle(externalAuth.provider)

    confirm({
      title: t('externalAuths.unlinkTitle'),
      message: t('externalAuths.unlinkConfirm', { provider: providerTitle }),
      confirmText: t('externalAuths.unlinkBtn'),
      isDanger: true,
      onConfirm: async () => {
        try {
          await pb.collection('_externalAuths').delete(externalAuth.id)
          addToast({
            type: 'success',
            message: t('externalAuths.unlinkSuccess', { provider: providerTitle }),
          })
          onUnlink?.(externalAuth.provider)
          loadExternalAuths()
        } catch (err) {
          addToast({
            type: 'error',
            message: t('externalAuths.unlinkError', { error: err instanceof Error ? err.message : t('externalAuths.loadErrorRetry') }),
          })
        }
      },
    })
  }

  useEffect(() => {
    loadExternalAuths()
  }, [record?.id])

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!record?.id || externalAuths.length === 0) {
    return <p className="text-center text-muted-foreground py-4">{t('externalAuths.noProviders')}</p>
  }

  return (
    <div className="space-y-2">
      {externalAuths.map((auth) => (
        <div key={auth.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <img
            src={`/images/oauth2/${getProviderLogo(auth.provider)}`}
            alt={`${getProviderTitle(auth.provider)} logo`}
            className="h-8 w-8 rounded"
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{getProviderTitle(auth.provider)}</div>
            <div className="text-sm text-muted-foreground truncate">ID: {auth.providerId}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={() => unlinkExternalAuth(auth)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}
