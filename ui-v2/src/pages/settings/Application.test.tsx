/**
 * Application Settings 页面测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { MemoryRouter } from 'react-router-dom'
import { Application } from './Application'

// 创建 mock 函数
const mockLoadSettings = vi.fn()
const mockSaveSettings = vi.fn()
const mockUpdateSettings = vi.fn()
const mockResetSettings = vi.fn()
let mockHasChanges = false

vi.mock('@/features/settings', () => ({
  useSettings: () => ({
    settings: {
      meta: {
        appName: 'Test App',
        appURL: 'https://test.com',
        hideControls: false,
      },
      batch: {
        enabled: true,
        maxRequests: 50,
        timeout: 3,
        maxBodySize: 0,
      },
      trustedProxy: {
        headers: [],
        useLeftmostIP: false,
      },
      rateLimits: {
        enabled: false,
        rules: [],
      },
    },
    isLoading: false,
    isSaving: false,
    hasChanges: mockHasChanges,
    healthData: {
      databaseType: 'SQLite',
      version: '0.23.0',
    },
    loadSettings: mockLoadSettings,
    saveSettings: mockSaveSettings,
    updateSettings: mockUpdateSettings,
    resetSettings: mockResetSettings,
  }),
}))

describe('Application Settings Page', () => {
  let store: ReturnType<typeof createStore>

  const renderPage = () => {
    return render(
      <Provider store={store}>
        <MemoryRouter>
          <Application />
        </MemoryRouter>
      </Provider>
    )
  }

  beforeEach(() => {
    store = createStore()
    mockHasChanges = false
    vi.clearAllMocks()
  })

  it('should render page title', () => {
    renderPage()
    expect(screen.getByText('Application')).toBeInTheDocument()
  })

  it('should display app name input', () => {
    renderPage()
    expect(screen.getByLabelText(/Application name/i)).toBeInTheDocument()
  })

  it('should display app URL input', () => {
    renderPage()
    expect(screen.getByLabelText(/Application URL/i)).toBeInTheDocument()
  })

  it('should display database type', () => {
    renderPage()
    expect(screen.getByText('SQLite')).toBeInTheDocument()
  })

  it('should call loadSettings on mount', () => {
    renderPage()
    expect(mockLoadSettings).toHaveBeenCalled()
  })

  it('should call updateSettings when input changes', async () => {
    renderPage()
    const input = screen.getByLabelText(/Application name/i)
    fireEvent.change(input, { target: { value: 'New App Name' } })
    expect(mockUpdateSettings).toHaveBeenCalled()
  })

  it('should disable save button when no changes', () => {
    mockHasChanges = false
    renderPage()
    const saveButton = screen.getByRole('button', { name: /Save changes/i })
    expect(saveButton).toBeDisabled()
  })
})
