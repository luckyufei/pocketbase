/**
 * 登录页面
 */
import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/useAuth'

export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading, error, clearError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // 获取重定向目标
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/collections'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()

    const success = await login(email, password)
    if (success) {
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/_/images/logo.svg" alt="PocketBase" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-900">PocketBase</h1>
          <p className="text-slate-500 mt-2">{t('login.subtitle', '管理后台')}</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 错误提示 */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-200">
              {error}
            </div>
          )}

          {/* 邮箱 */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-900">
              {t('login.email', '邮箱')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder', '请输入邮箱')}
              required
              autoComplete="email"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* 密码 */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-900">
              {t('login.password', '密码')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder', '请输入密码')}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* 提交按钮 */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('login.loading', '登录中...') : t('login.submit', '登录')}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default Login
