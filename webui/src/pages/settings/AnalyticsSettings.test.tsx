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
      analytics: {
        enabled: true,
        retention: 90,
        s3Bucket: '',
      },
    }),
  })),
}))

describe('Analytics Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render page elements after loading', async () => {
    render(<AnalyticsSettings />)

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    })

    // Check description text
    expect(
      screen.getByText('Configure analytics data collection and retention settings.')
    ).toBeInTheDocument()
  })

  it('should render enable analytics toggle after loading', async () => {
    render(<AnalyticsSettings />)

    // Wait for loading to complete and check switch
    await waitFor(() => {
      const switchElement = screen.getByRole('switch')
      expect(switchElement).toBeInTheDocument()
    })

    // Check label
    expect(screen.getByText('Enable analytics')).toBeInTheDocument()
  })

  it('should render retention and s3Bucket fields when enabled', async () => {
    render(<AnalyticsSettings />)

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByLabelText(/Data retention/i)).toBeInTheDocument()
    })

    // Check s3Bucket field
    expect(screen.getByLabelText(/S3 Bucket/i)).toBeInTheDocument()
  })

  it('should render save button after loading', async () => {
    render(<AnalyticsSettings />)

    // Wait for loading to complete and check button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save changes/i })).toBeInTheDocument()
    })
  })
})
