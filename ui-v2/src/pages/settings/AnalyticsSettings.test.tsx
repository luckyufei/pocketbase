/**
 * Analytics Settings 页面测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AnalyticsSettings } from './AnalyticsSettings'

// Mock API client
vi.mock('@/lib/ApiClient', () => ({
  getApiClient: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({
      analytics: { enabled: false },
    }),
  })),
}))

describe('Analytics Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render page elements after loading', async () => {
    render(<AnalyticsSettings />)

    // 等待加载完成
    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    })
  })

  it('should render enable toggle after loading', async () => {
    render(<AnalyticsSettings />)

    // 等待加载完成后检查 checkbox
    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })
  })

  it('should render save button after loading', async () => {
    render(<AnalyticsSettings />)

    // 等待加载完成后检查按钮
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})
