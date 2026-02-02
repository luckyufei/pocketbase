/**
 * 侧边栏组件
 */
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai'
import {
  Database,
  FileText,
  Settings,
  Activity,
  BarChart3,
  Search,
  LogOut,
  Moon,
  Sun,
  Network,
} from 'lucide-react'
import { appNameAtom } from '@/store/app'
import { superuserAtom } from '@/store/auth'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
}

function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          isActive
            ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        )
      }
      aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const appName = useAtomValue(appNameAtom)
  const user = useAtomValue(superuserAtom)
  const { logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className="w-64 border-r border-slate-200 bg-white flex flex-col"
      role="navigation"
      aria-label={t('nav.main', 'Main navigation')}
    >
      {/* Logo */}
      <div className="h-14 px-4 border-b border-slate-200 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center shadow-md shadow-blue-200/50">
            <Database className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">{appName}</h1>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav
        className="flex-1 p-4 space-y-1"
        role="menubar"
        aria-label={t('nav.menu', 'Navigation menu')}
      >
        <NavItem
          to="/collections"
          icon={<Database className="w-4 h-4" />}
          label={t('nav.collections', 'Collections')}
        />
        <NavItem to="/logs" icon={<FileText className="w-4 h-4" />} label={t('nav.logs', 'Logs')} />
        <NavItem
          to="/monitoring"
          icon={<Activity className="w-4 h-4" />}
          label={t('nav.monitoring', 'Monitoring')}
        />
        <NavItem
          to="/traces"
          icon={<Search className="w-4 h-4" />}
          label={t('nav.traces', 'Traces')}
        />
        <NavItem
          to="/analytics"
          icon={<BarChart3 className="w-4 h-4" />}
          label={t('nav.analytics', 'Analytics')}
        />
        <NavItem
          to="/gateway"
          icon={<Network className="w-4 h-4" />}
          label={t('nav.gateway', 'Gateway')}
        />

        <div className="pt-4 border-t mt-4">
          <NavItem
            to="/settings"
            icon={<Settings className="w-4 h-4" />}
            label={t('nav.settings', 'Settings')}
          />
        </div>
      </nav>

      {/* 用户信息 */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-sm font-semibold">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <span className="text-sm text-slate-600 truncate">{user?.email || 'Admin'}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-400 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
              title={isDark ? t('theme.light', 'Light mode') : t('theme.dark', 'Dark mode')}
              aria-label={
                isDark
                  ? t('theme.light', 'Switch to light mode')
                  : t('theme.dark', 'Switch to dark mode')
              }
              aria-pressed={isDark}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
              title={t('nav.logout', 'Logout')}
              aria-label={t('nav.logout', 'Logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
