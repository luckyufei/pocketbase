/**
 * Settings Layout
 * 设置页面布局（侧边栏 + 内容区）
 */
import { Outlet, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Settings,
  Mail,
  HardDrive,
  Database,
  Clock,
  Key,
  BarChart3,
  Users,
  Coins,
  Download,
  Upload,
  Activity,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { to: '/settings/application', label: 'Application', icon: <Settings className="w-4 h-4" /> },
  { to: '/settings/mail', label: 'Mail', icon: <Mail className="w-4 h-4" /> },
  { to: '/settings/storage', label: 'Storage', icon: <HardDrive className="w-4 h-4" /> },
  { to: '/settings/backups', label: 'Backups', icon: <Database className="w-4 h-4" /> },
  { to: '/settings/crons', label: 'Cron Jobs', icon: <Clock className="w-4 h-4" /> },
  { to: '/settings/processes', label: 'Processes', icon: <Activity className="w-4 h-4" /> },
  { to: '/settings/secrets', label: 'Secrets', icon: <Key className="w-4 h-4" /> },
  { to: '/settings/analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { to: '/settings/admins', label: 'Admins', icon: <Users className="w-4 h-4" /> },
  { to: '/settings/tokens', label: 'Tokens', icon: <Coins className="w-4 h-4" /> },
  { to: '/settings/export', label: 'Export', icon: <Download className="w-4 h-4" /> },
  { to: '/settings/import', label: 'Import', icon: <Upload className="w-4 h-4" /> },
]

export function SettingsLayout() {
  return (
    <div className="flex h-full">
      {/* 侧边栏 */}
      <aside className="w-56 border-r border-slate-200 bg-slate-50/50 p-4">
        <h2 className="text-lg font-semibold mb-4 text-slate-900">Settings</h2>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 内容区 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default SettingsLayout
