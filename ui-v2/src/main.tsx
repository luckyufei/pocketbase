import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Provider } from 'jotai'
import { router } from '@/router'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import '@/i18n'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider>
        <RouterProvider router={router} />
      </Provider>
    </ErrorBoundary>
  </StrictMode>
)
