import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

function App() {
  const location = useLocation()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t('nav.title')}</h1>
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className={`transition-colors hover:text-foreground ${
                  location.pathname === '/'
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                }`}
              >
                {t('nav.home')}
              </Link>
              <Link
                to="/about"
                className={`transition-colors hover:text-foreground ${
                  location.pathname === '/about'
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                }`}
              >
                {t('nav.about')}
              </Link>
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-8 py-12">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-sm text-muted-foreground border-t">
        <p>{t('footer.editHint')}</p>
      </footer>
    </div>
  )
}

export default App
