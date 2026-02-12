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

const navGroups: NavGroup[] = [
  {
    title: 'System',
    items: [
      { to: '/settings/application', label: 'Application', icon: <Settings className="w-4 h-4" /> },
      { to: '/settings/mail', label: 'Mail settings', icon: <Mail className="w-4 h-4" /> },
      { to: '/settings/storage', label: 'Files storage', icon: <HardDrive className="w-4 h-4" /> },
      { to: '/settings/backups', label: 'Backups', icon: <Database className="w-4 h-4" /> },
      { to: '/settings/crons', label: 'Crons', icon: <Clock className="w-4 h-4" /> },
      { to: '/settings/jobs', label: 'Jobs', icon: <Activity className="w-4 h-4" /> },
      { to: '/settings/secrets', label: 'Secrets', icon: <Key className="w-4 h-4" /> },
      { to: '/settings/analytics-settings', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Security',
    items: [
      { to: '/settings/admins', label: 'Admins', icon: <Users className="w-4 h-4" /> },
      { to: '/settings/tokens', label: 'Tokens', icon: <Coins className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { to: '/settings/gateway', label: 'Gateway', icon: <Network className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Sync',
    hideWhenControlsHidden: true,
    items: [
      { to: '/settings/export', label: 'Export collections', icon: <Download className="w-4 h-4" /> },
      { to: '/settings/import', label: 'Import collections', icon: <Upload className="w-4 h-4" /> },
    ],
  },
]

export function SettingsLayout() {
  const hideControls = useAtomValue(hideControlsAtom)

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 border-r border-slate-200 bg-slate-50/50 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-slate-900">Settings</h2>
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
