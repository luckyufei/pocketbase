import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Provider } from 'jotai'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { router } from '@/router'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import '@/i18n'
import '@/index.css'
import 'react-day-picker/style.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <RouterProvider router={router} />
<Toaster richColors position="top-right" />
        </Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)
