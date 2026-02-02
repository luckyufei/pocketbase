/**
 * ProxyDetailPage 组件
 * 代理详情/编辑页面
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProxyForm, type ProxyFormHandle } from './ProxyForm'
import { DeleteProxyDialog } from './DeleteProxyDialog'
import { getProxy, createProxy, updateProxy, deleteProxy } from '../api'
import type { Proxy, ProxyInput } from '../types'

export function ProxyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const isNewMode = id === 'new' || !id
  const [proxy, setProxy] = useState<Proxy | null>(null)
  const [isLoading, setIsLoading] = useState(!isNewMode)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formRef = useRef<ProxyFormHandle>(null)

  // 加载代理数据
  useEffect(() => {
    if (isNewMode) return

    const loadProxy = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getProxy(id!)
        setProxy(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setIsLoading(false)
      }
    }

    loadProxy()
  }, [id, isNewMode])

  // 保存
  const handleSubmit = useCallback(
    async (data: ProxyInput) => {
      try {
        setIsSubmitting(true)
        setError(null)

        if (isNewMode) {
          await createProxy(data)
        } else {
          await updateProxy(id!, data)
        }

        navigate('/gateway')
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存失败')
      } finally {
        setIsSubmitting(false)
      }
    },
    [id, isNewMode, navigate]
  )

  // 删除
  const handleDelete = useCallback(async () => {
    if (!id) return

    try {
      setIsSubmitting(true)
      await deleteProxy(id)
      navigate('/gateway')
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
      setShowDeleteDialog(false)
    } finally {
      setIsSubmitting(false)
    }
  }, [id, navigate])

  // 触发表单提交
  const handleSaveClick = useCallback(() => {
    // 通过 ref 调用 ProxyForm 的 submit 方法
    formRef.current?.submit()
  }, [])

  // 返回列表
  const handleBack = useCallback(() => {
    navigate('/gateway')
  }, [navigate])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 页面头部 */}
      <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {isNewMode ? '新建代理' : '编辑代理'}
            </h1>
            {!isNewMode && proxy && (
              <p className="text-xs text-slate-500">{proxy.path}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNewMode && (
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isSubmitting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              删除
            </Button>
          )}
          <Button
            onClick={handleSaveClick}
            disabled={isSubmitting}
            className="bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200/50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            保存
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 表单内容 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto">
          <ProxyForm
            ref={formRef}
            initialData={proxy || undefined}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {/* 删除确认对话框 */}
      {proxy && (
        <DeleteProxyDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          proxyName={proxy.path}
          onConfirm={handleDelete}
          isDeleting={isSubmitting}
        />
      )}
    </div>
  )
}
