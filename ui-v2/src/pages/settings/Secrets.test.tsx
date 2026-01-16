/**
 * Secrets Settings 页面测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Secrets } from './Secrets'

// Mock API client
vi.mock('@/lib/ApiClient', () => ({
  getApiClient: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({ secrets: {} }),
  })),
}))

describe('Secrets Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render page elements', () => {
    render(<Secrets />)

    expect(screen.getByText('Secrets')).toBeInTheDocument()
  })

  it('should render action buttons', () => {
    render(<Secrets />)

    // 检查有按钮存在
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(3)
  })
})
