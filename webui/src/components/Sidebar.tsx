/**
 * 侧边栏组件
 * 主菜单不需要分组，直接显示所有菜单项
 * Settings模块使用独立入口，点进去后显示分组菜单
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
  Languages,
  UserRound,
} from 'lucide-react'
import { appNameAtom } from '@/store/app'
import { superuserAtom } from '@/store/auth'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200',
          'outline-none',
          isActive
            ? 'bg-accent text-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const appName = useAtomValue(appNameAtom)
  const user = useAtomValue(superuserAtom)
  const { logout } = useAuth()
  // TODO: 暂时隐藏深色模式切换，保留 hook 以便后续启用
  // const { isDark, toggleTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(newLang)
  }

  return (
    <aside
      className="w-56 border-r border-border bg-background flex flex-col"
      role="navigation"
      aria-label={t('nav.main', 'Main navigation')}
    >
      {/* Logo */}
      <div className="h-14 px-4 border-b border-border flex items-center">
        <div className="flex items-center gap-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <rect
              x="25.536"
              y="13.4861"
              width="1.71467"
              height="16.7338"
              transform="rotate(45.9772 25.536 13.4861)"
              fill="white"
            />
            <path
              d="M26 14H36.8C37.4628 14 38 14.5373 38 15.2V36.8C38 37.4628 37.4628 38 36.8 38H15.2C14.5373 38 14 37.4628 14 36.8V26"
              fill="white"
            />
            <path
              d="M26 14H36.8C37.4628 14 38 14.5373 38 15.2V36.8C38 37.4628 37.4628 38 36.8 38H15.2C14.5373 38 14 37.4628 14 36.8V26"
              stroke="#16161a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M26 14V3.2C26 2.53726 25.4628 2 24.8 2H3.2C2.53726 2 2 2.53726 2 3.2V24.8C2 25.4628 2.53726 26 3.2 26H14"
              fill="white"
            />
            <path
              d="M26 14V3.2C26 2.53726 25.4628 2 24.8 2H3.2C2.53726 2 2 2.53726 2 3.2V24.8C2 25.4628 2.53726 26 3.2 26H14"
              stroke="#16161a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 20C9.44772 20 9 19.5523 9 19V8C9 7.44772 9.44772 7 10 7H13.7531C14.4801 7 15.1591 7.07311 15.7901 7.21932C16.4348 7.35225 16.9904 7.58487 17.4568 7.91718C17.9369 8.2362 18.3141 8.6682 18.5885 9.21319C18.8628 9.74489 19 10.4029 19 11.1871C19 11.9448 18.856 12.6028 18.5679 13.161C18.2936 13.7193 17.9163 14.1779 17.4362 14.5368C16.9561 14.8957 16.4005 15.1616 15.7695 15.3344C15.1385 15.5072 14.4664 15.5936 13.7531 15.5936H13.0247C12.4724 15.5936 12.0247 16.0413 12.0247 16.5936V19C12.0247 19.5523 11.577 20 11.0247 20H10ZM12.0247 12.2607C12.0247 12.813 12.4724 13.2607 13.0247 13.2607H13.5679C15.214 13.2607 16.037 12.5695 16.037 11.1871C16.037 10.5092 15.8244 10.0307 15.3992 9.75153C14.9877 9.47239 14.3772 9.33282 13.5679 9.33282H13.0247C12.4724 9.33282 12.0247 9.78054 12.0247 10.3328V12.2607Z"
              fill="#16161a"
            />
            <path
              d="M22 33C21.4477 33 21 32.5523 21 32V21C21 20.4477 21.4477 20 22 20H25.4877C26.1844 20 26.8265 20.0532 27.4139 20.1595C28.015 20.2526 28.5342 20.4254 28.9713 20.6779C29.4085 20.9305 29.75 21.2628 29.9959 21.6748C30.2555 22.0869 30.3852 22.6053 30.3852 23.2301C30.3852 23.5225 30.3374 23.8149 30.2418 24.1074C30.1598 24.3998 30.0232 24.6723 29.832 24.9248C29.6407 25.1774 29.4016 25.4034 29.1148 25.6028C28.837 25.7958 28.5081 25.939 28.1279 26.0323C28.1058 26.0378 28.0902 26.0575 28.0902 26.0802V26.0802C28.0902 26.1039 28.1073 26.1242 28.1306 26.1286C29.0669 26.3034 29.7774 26.6332 30.2623 27.1181C30.7541 27.6099 31 28.2945 31 29.1718C31 29.8364 30.8702 30.408 30.6107 30.8865C30.3511 31.365 29.9891 31.7638 29.5246 32.0828C29.0601 32.3885 28.5137 32.6212 27.8852 32.7807C27.2705 32.9269 26.6011 33 25.8771 33H22ZM24.0123 24.2239C24.0123 24.7762 24.46 25.2239 25.0123 25.2239H25.3443C26.082 25.2239 26.6148 25.0844 26.9426 24.8052C27.2705 24.5261 27.4344 24.1339 27.4344 23.6288C27.4344 23.1503 27.2637 22.8113 26.9221 22.612C26.5943 22.3993 26.0751 22.2929 25.3648 22.2929H25.0123C24.46 22.2929 24.0123 22.7407 24.0123 23.2929V24.2239ZM24.0123 29.7071C24.0123 30.2593 24.46 30.7071 25.0123 30.7071H25.6311C27.2432 30.7071 28.0492 30.1222 28.0492 28.9525C28.0492 28.3809 27.8511 27.9688 27.4549 27.7163C27.0724 27.4637 26.4645 27.3374 25.6311 27.3374H25.0123C24.46 27.3374 24.0123 27.7851 24.0123 28.3374V29.7071Z"
              fill="#16161a"
            />
          </svg>
          <h1 className="text-base font-bold text-foreground">{appName}</h1>
        </div>
      </div>

      {/* 导航菜单 - 无分组，直接列出所有菜单项 */}
      <nav
        className="flex-1 p-3 space-y-1 overflow-y-auto"
        role="menubar"
        aria-label={t('nav.menu', 'Navigation menu')}
      >
        <NavItem
          to="/collections"
          icon={<Database className="w-4 h-4" />}
          label={t('nav.collections', 'Collections')}
        />
        <NavItem
          to="/logs"
          icon={<FileText className="w-4 h-4" />}
          label={t('nav.logs', '日志')}
        />
        <NavItem
          to="/monitoring"
          icon={<Activity className="w-4 h-4" />}
          label={t('nav.monitoring', '监控')}
        />
        <NavItem
          to="/traces"
          icon={<Search className="w-4 h-4" />}
          label={t('nav.traces', '追踪')}
        />
        <NavItem
          to="/analytics"
          icon={<BarChart3 className="w-4 h-4" />}
          label={t('nav.analytics', '分析')}
        />
        <NavItem
          to="/settings"
          icon={<Settings className="w-4 h-4" />}
          label={t('nav.settings', '设置')}
        />
      </nav>

      {/* 用户信息 - Vercel 极简风格头像 */}
      <div className="p-3 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center text-background text-sm font-semibold hover:bg-foreground/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
              title={user?.email || 'Admin'}
              aria-label={t('nav.userMenu', 'User menu')}
            >
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            {/* User email display */}
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground truncate">
              {user?.email || 'Admin'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Manage superusers */}
            <DropdownMenuItem 
              onClick={() => navigate('/collections/_superusers')} 
              className="cursor-pointer"
            >
              <UserRound className="w-4 h-4 mr-2" />
              {t('nav.manageSuperusers', 'Manage superusers')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleLanguage} className="cursor-pointer">
              <Languages className="w-4 h-4 mr-2" />
              {i18n.language === 'zh' ? 'English' : '中文'}
            </DropdownMenuItem>
            {/* TODO: 暂时隐藏深色模式切换，默认使用浅色模式
            <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  {t('theme.light', 'Light mode')}
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 mr-2" />
                  {t('theme.dark', 'Dark mode')}
                </>
              )}
            </DropdownMenuItem>
            */}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              {t('nav.logout', 'Logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

export default Sidebar
