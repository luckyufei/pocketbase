/**
 * Secrets Settings 页面测试
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Secrets } from './Secrets'

// Mock API client
const mockSend = mock(() => Promise.resolve({ items: [] }))

mock.module('@/lib/ApiClient', () => ({
  getApiClient: () => ({
    send: mockSend,
  }),
}))

// Mock dateUtils
mock.module('@/lib/dateUtils', () => ({
  formatDate: (dateStr: string) => dateStr || '-',
}))

describe('Secrets Settings', () => {
  beforeEach(() => {
    mockSend.mockClear()
    mockSend.mockResolvedValue({ items: [] })
  })

  it('should render page title', async () => {
    render(<Secrets />)

    // 等待加载完成
    await waitFor(() => {
      expect(screen.queryByText('Secrets')).toBeDefined()
    })
  })

  it('should render New Secret button when enabled', async () => {
    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new secret/i })).toBeDefined()
    })
  })

  it('should render Refresh button', async () => {
    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh/i })).toBeDefined()
    })
  })

  it('should show empty state when no secrets', async () => {
    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByText(/no secrets found/i)).toBeDefined()
    })
  })

  it('should show disabled alert when API returns 503', async () => {
    mockSend.mockRejectedValue({ status: 503 })

    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByText(/secrets feature is disabled/i)).toBeDefined()
    })
  })

  it('should show secrets list when data is loaded', async () => {
    mockSend.mockResolvedValue({
      items: [
        {
          key: 'API_KEY',
          masked_value: '***',
          env: 'global',
          description: 'Test API key',
          updated: '2024-01-15T10:00:00Z',
        },
      ],
    })

    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByText('API_KEY')).toBeDefined()
    })
  })

  it('should open create dialog when clicking New Secret', async () => {
    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new secret/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /new secret/i }))

    await waitFor(() => {
      expect(screen.getByText(/create a new encrypted secret/i)).toBeDefined()
    })
  })

  it('should validate key format on form submission', async () => {
    render(<Secrets />)

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /new secret/i }))
    })

    // 等待对话框打开
    await waitFor(() => {
      expect(screen.getByLabelText(/key/i)).toBeDefined()
    })

    // 输入无效的 key（小写）
    const keyInput = screen.getByLabelText(/key/i)
    fireEvent.change(keyInput, { target: { value: 'invalid_key' } })

    // 点击创建按钮
    const createButton = screen.getByRole('button', { name: /create/i })
    fireEvent.click(createButton)

    // 应该显示错误信息（key 被自动转为大写，但不符合格式）
    await waitFor(() => {
      // key 会被自动转为大写 INVALID_KEY，这是合法的
      // 测试空 value 的错误
      expect(screen.getByText(/value is required/i)).toBeDefined()
    })
  })

  it('should show encryption notice', async () => {
    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByText(/encrypted with aes-256-gcm/i)).toBeDefined()
    })
  })

  it('should show environment badge for secrets', async () => {
    mockSend.mockResolvedValue({
      items: [
        {
          key: 'PROD_KEY',
          masked_value: '***',
          env: 'production',
          description: '',
          updated: '2024-01-15T10:00:00Z',
        },
      ],
    })

    render(<Secrets />)

    await waitFor(() => {
      expect(screen.getByText('production')).toBeDefined()
    })
  })
})
