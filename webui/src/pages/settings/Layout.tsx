/**
 * Settings Layout
 * 设置页面布局（侧边栏 + 内容区）
 * 
 * Design features:
 * - Grouped navigation (from UI version)
 * - Conditional rendering for Sync group (from UI version)
 * - Modern visual style (from WebUI version)
 * - Gateway moved here from main sidebar
 */
import { Outlet, NavLink } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { hideControlsAtom } from '@/store/app'
import {
  Settings,
  Mail,
  HardDrive,
  Database,
  Clock,
  Key,
  Users,
  Download,
  Upload,
  Activity,
  BarChart3,
  Coins,
  Network,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

interface NavGroup {
  title: string
  items: NavItem[]
  /** If true, this group will be hidden when hideControls is enabled */
  hideWhenControlsHidden?: boolean
}

export function SettingsLayout() {
  const { t } = useTranslation()
  const hideControls = useAtomValue(hideControlsAtom)

  const navGroups: NavGroup[] = [
    {
      title: t('settingsLayout.system'),
      items: [
        { to: '/settings/application', label: t('settingsLayout.application'), icon: <Settings className="w-4 h-4" /> },
        { to: '/settings/mail', label: t('settingsLayout.mailSettings'), icon: <Mail className="w-4 h-4" /> },
        { to: '/settings/storage', label: t('settingsLayout.filesStorage'), icon: <HardDrive className="w-4 h-4" /> },
        { to: '/settings/backups', label: t('settingsLayout.backups'), icon: <Database className="w-4 h-4" /> },
        { to: '/settings/crons', label: t('settingsLayout.crons'), icon: <Clock className="w-4 h-4" /> },
        { to: '/settings/jobs', label: t('settingsLayout.jobs'), icon: <Activity className="w-4 h-4" /> },
        { to: '/settings/secrets', label: t('settingsLayout.secrets'), icon: <Key className="w-4 h-4" /> },
        { to: '/settings/analytics-settings', label: t('settingsLayout.analytics'), icon: <BarChart3 className="w-4 h-4" /> },
      ],
    },
    {
      title: t('settingsLayout.security'),
      items: [
        { to: '/settings/admins', label: t('settingsLayout.admins'), icon: <Users className="w-4 h-4" /> },
        { to: '/settings/tokens', label: t('settingsLayout.tokens'), icon: <Coins className="w-4 h-4" /> },
      ],
    },
    {
      title: t('settingsLayout.infrastructure'),
      items: [
        { to: '/settings/gateway', label: t('settingsLayout.gateway'), icon: <Network className="w-4 h-4" /> },
      ],
    },
    {
      title: t('settingsLayout.sync'),
      hideWhenControlsHidden: true,
      items: [
        { to: '/settings/export', label: t('settingsLayout.exportCollections'), icon: <Download className="w-4 h-4" /> },
        { to: '/settings/import', label: t('settingsLayout.importCollections'), icon: <Upload className="w-4 h-4" /> },
      ],
    },
  ]

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 border-r border-slate-200 bg-slate-50/50 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-slate-900">{t('settingsLayout.title')}</h2>
        <nav className="space-y-5">
          {navGroups.map((group) => {
            // Conditional rendering: hide groups when hideControls is enabled
            if (group.hideWhenControlsHidden && hideControls) {
              return null
            }

            return (
              <div key={group.title} className="space-y-1">
                {/* Group title */}
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {group.title}
                </div>
                {/* Group items */}
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                        isActive
                          ? 'bg-blue-50 text-blue-600 font-medium shadow-sm ring-1 ring-blue-100'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Content area */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default SettingsLayout
