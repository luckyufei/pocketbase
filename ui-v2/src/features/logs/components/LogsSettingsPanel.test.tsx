/**
 * LogsSettingsPanel 组件测试
 * TDD: 红灯 -> 绿灯
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogsSettingsPanel } from './LogsSettingsPanel'

// Mock API client
const mockGetAll = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/ApiClient', () => ({
  pb: {
    settings: {
      getAll: () => mockGetAll(),
      update: (data: unknown) => mockUpdate(data),
    },
  },
}))

// Mock toast
vi.mock('@/store/toasts', () => ({
  addToast: {
    write: vi.fn(),
  },
}))

describe('LogsSettingsPanel', () => {
  const defaultSettings = {
    logs: {
      maxDays: 7,
      minLevel: 0,
      logIP: true,
      logAuthId: false,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAll.mockResolvedValue(defaultSettings)
    mockUpdate.mockResolvedValue(defaultSettings)
  })

  describe('渲染', () => {
    it('应该渲染日志设置面板', async () => {
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Logs settings')).toBeInTheDocument()
      })
    })

    it('应该在加载时显示加载状态', () => {
      mockGetAll.mockImplementation(() => new Promise(() => {}))
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('应该加载并显示设置值', async () => {
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Max days retention/i)).toHaveValue(7)
        expect(screen.getByLabelText(/Min log level/i)).toHaveValue(0)
        expect(screen.getByLabelText(/Enable IP logging/i)).toBeChecked()
        expect(screen.getByLabelText(/Enable Auth Id logging/i)).not.toBeChecked()
      })
    })
  })

  describe('表单交互', () => {
    it('应该能修改最大保留天数', async () => {
      const user = userEvent.setup()
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Max days retention/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/Max days retention/i)
      await user.clear(input)
      await user.type(input, '14')

      expect(input).toHaveValue(14)
    })

    it('应该能修改最小日志级别', async () => {
      const user = userEvent.setup()
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Min log level/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/Min log level/i)
      await user.clear(input)
      await user.type(input, '2')

      expect(input).toHaveValue(2)
    })

    it('应该能切换 IP 日志开关', async () => {
      const user = userEvent.setup()
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Enable IP logging/i)).toBeInTheDocument()
      })

      const checkbox = screen.getByLabelText(/Enable IP logging/i)
      await user.click(checkbox)

      expect(checkbox).not.toBeChecked()
    })

    it('应该能切换 Auth Id 日志开关', async () => {
      const user = userEvent.setup()
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Enable Auth Id logging/i)).toBeInTheDocument()
      })

      const checkbox = screen.getByLabelText(/Enable Auth Id logging/i)
      await user.click(checkbox)

      expect(checkbox).toBeChecked()
    })
  })

  describe('保存功能', () => {
    it('应该在有变更时启用保存按钮', async () => {
      const user = userEvent.setup()
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Max days retention/i)).toBeInTheDocument()
      })

      // 初始状态保存按钮应该禁用
      expect(screen.getByRole('button', { name: /Save changes/i })).toBeDisabled()

      // 修改值后应该启用
      const input = screen.getByLabelText(/Max days retention/i)
      await user.clear(input)
      await user.type(input, '14')

      expect(screen.getByRole('button', { name: /Save changes/i })).not.toBeDisabled()
    })

    it('应该调用保存 API', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} onSave={onSave} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Max days retention/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/Max days retention/i)
      await user.clear(input)
      await user.type(input, '14')

      await user.click(screen.getByRole('button', { name: /Save changes/i }))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          logs: expect.objectContaining({
            maxDays: 14,
          }),
        })
      })
    })

    it('应该在保存成功后调用 onSave 回调', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} onSave={onSave} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Max days retention/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/Max days retention/i)
      await user.clear(input)
      await user.type(input, '14')

      await user.click(screen.getByRole('button', { name: /Save changes/i }))

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled()
      })
    })
  })

  describe('取消功能', () => {
    it('应该能取消并关闭面板', async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      render(<LogsSettingsPanel open={true} onOpenChange={onOpenChange} />)

      await waitFor(() => {
        expect(screen.getByText('Logs settings')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /Cancel/i }))

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('日志级别信息', () => {
    it('应该显示日志级别说明', async () => {
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(/Default log levels/i)).toBeInTheDocument()
      })
    })
  })

  describe('错误处理', () => {
    it('应该处理加载错误', async () => {
      mockGetAll.mockRejectedValue(new Error('Load failed'))
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load settings/i)).toBeInTheDocument()
      })
    })

    it('应该处理保存错误', async () => {
      const user = userEvent.setup()
      mockUpdate.mockRejectedValue(new Error('Save failed'))
      render(<LogsSettingsPanel open={true} onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Max days retention/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/Max days retention/i)
      await user.clear(input)
      await user.type(input, '14')

      await user.click(screen.getByRole('button', { name: /Save changes/i }))

      await waitFor(() => {
        expect(screen.getByText(/Failed to save settings/i)).toBeInTheDocument()
      })
    })
  })
})
