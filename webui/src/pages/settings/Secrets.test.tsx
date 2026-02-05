/**
 * Secrets Settings 页面测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Secrets } from './Secrets'

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback || key,
  }),
}))

// Mock API client
const mockSend = vi.fn()
vi.mock('@/lib/ApiClient', () => ({
  getApiClient: vi.fn(() => ({
    send: mockSend,
  })),
}))

describe('Secrets Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({ items: [], total: 0 })
  })

  it('should render page elements', async () => {
    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByText('Secrets')).toBeInTheDocument()
    })
  })

  it('should render action buttons', async () => {
    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByText('Add Secret')).toBeInTheDocument()
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })

  it('should show empty state when no secrets', async () => {
    mockSend.mockResolvedValue({ items: [], total: 0 })

    render(<Secrets />)

    await waitFor(() => {
      expect(
        screen.getByText('暂无 Secrets。点击 "Add Secret" 创建一个。')
      ).toBeInTheDocument()
    })
  })

  it('should show disabled alert when secrets feature is disabled', async () => {
    mockSend.mockRejectedValue({ status: 503, message: 'Service Unavailable' })

    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByText('Secrets 功能未启用')).toBeInTheDocument()
    })
  })

  it('should show secrets list when loaded', async () => {
    mockSend.mockResolvedValue({
      items: [
        {
          key: 'TEST_KEY',
          masked_value: 'sk-***',
          env: 'global',
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
        },
      ],
      total: 1,
    })

    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByText('TEST_KEY')).toBeInTheDocument()
      expect(screen.getByText('sk-***')).toBeInTheDocument()
      expect(screen.getByText('global')).toBeInTheDocument()
    })
  })

  it('should call /api/secrets endpoint', async () => {
    render(<Secrets />)

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith('/api/secrets', { method: 'GET' })
    })
  })
})
