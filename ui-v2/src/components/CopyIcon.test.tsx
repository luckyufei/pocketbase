/**
 * CopyIcon 组件测试
 * TDD: 红灯 -> 绿灯
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyIcon } from './CopyIcon'

// Mock clipboard API
const mockWriteText = vi.fn()

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: mockWriteText,
    },
    writable: true,
    configurable: true,
  })
})

describe('CopyIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteText.mockResolvedValue(undefined)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('渲染', () => {
    it('应该渲染复制图标按钮', () => {
      render(<CopyIcon value="test" />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('应该有正确的 aria-label', () => {
      render(<CopyIcon value="test" />)

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copy to clipboard')
    })

    it('应该显示复制图标', () => {
      render(<CopyIcon value="test" />)

      const button = screen.getByRole('button')
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('复制功能', () => {
    it('应该在点击时复制值到剪贴板', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<CopyIcon value="test-value" />)

      await user.click(screen.getByRole('button'))

      expect(mockWriteText).toHaveBeenCalledWith('test-value')
    })

    it('应该在值为空时不复制', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<CopyIcon value="" />)

      await user.click(screen.getByRole('button'))

      expect(mockWriteText).not.toHaveBeenCalled()
    })

    it('应该在复制成功后显示成功状态', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<CopyIcon value="test" successDuration={500} />)

      await user.click(screen.getByRole('button'))

      // 应该显示成功图标
      expect(screen.getByTestId('copy-success-icon')).toBeInTheDocument()
    })

    it('应该在成功持续时间后恢复初始状态', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<CopyIcon value="test" successDuration={500} />)

      await user.click(screen.getByRole('button'))

      // 等待成功持续时间
      vi.advanceTimersByTime(500)

      await waitFor(() => {
        expect(screen.getByTestId('copy-idle-icon')).toBeInTheDocument()
      })
    })
  })

  describe('自定义样式', () => {
    it('应该支持自定义 className', () => {
      render(<CopyIcon value="test" className="custom-class" />)

      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })

  describe('Tooltip', () => {
    it('应该有默认的 tooltip 文本', () => {
      render(<CopyIcon value="test" />)

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Copy')
    })

    it('应该支持自定义 tooltip', () => {
      render(<CopyIcon value="test" tooltip="Copy code" />)

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Copy code')
    })
  })
})
