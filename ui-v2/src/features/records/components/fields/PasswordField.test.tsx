/**
 * PasswordField 组件测试
 *
 * 测试密码输入字段，包括显示/隐藏、强度提示等功能
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasswordField } from './PasswordField'

describe('PasswordField', () => {
  const mockField = {
    id: 'field1',
    name: 'password',
    type: 'password',
    required: true,
    min: 8,
    max: 72,
  }

  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该渲染密码输入框', () => {
      render(<PasswordField field={mockField} value="" onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText(/password/i)
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'password')
    })

    it('应该显示字段标签', () => {
      render(<PasswordField field={mockField} value="" onChange={mockOnChange} />)

      expect(screen.getByText('password')).toBeInTheDocument()
    })

    it('应该显示必填标记', () => {
      render(
        <PasswordField field={{ ...mockField, required: true }} value="" onChange={mockOnChange} />
      )

      expect(screen.getByText('*')).toBeInTheDocument()
    })
  })

  describe('显示/隐藏密码', () => {
    it('应该有切换密码可见性按钮', () => {
      render(<PasswordField field={mockField} value="test123" onChange={mockOnChange} />)

      const toggleButton =
        screen.getByRole('button', { name: /toggle/i }) || screen.getByLabelText(/show|hide/i)
      expect(toggleButton).toBeInTheDocument()
    })

    it('点击切换按钮应该显示密码', async () => {
      const user = userEvent.setup()
      render(<PasswordField field={mockField} value="test123" onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText(/password/i)
      expect(input).toHaveAttribute('type', 'password')

      const toggleButton = screen.getByRole('button')
      await user.click(toggleButton)

      expect(input).toHaveAttribute('type', 'text')
    })
  })

  describe('值变更', () => {
    it('输入时应该调用 onChange', async () => {
      const user = userEvent.setup()
      render(<PasswordField field={mockField} value="" onChange={mockOnChange} />)

      const input = screen.getByPlaceholderText(/password/i)
      await user.type(input, 'newpassword')

      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe('密码强度提示', () => {
    it('弱密码应该显示弱强度', () => {
      render(<PasswordField field={mockField} value="123" onChange={mockOnChange} showStrength />)

      // 应该有强度指示器
      expect(screen.getByTestId('password-strength') || screen.getByText(/weak|弱/i)).toBeTruthy()
    })

    it('强密码应该显示强强度', () => {
      render(
        <PasswordField
          field={mockField}
          value="MyStr0ng!P@ssw0rd"
          onChange={mockOnChange}
          showStrength
        />
      )

      // 应该有强度指示器
      expect(screen.getByTestId('password-strength') || screen.getByText(/strong|强/i)).toBeTruthy()
    })
  })

  describe('密码确认', () => {
    it('启用确认时应该显示确认输入框', () => {
      render(<PasswordField field={mockField} value="" onChange={mockOnChange} showConfirm />)

      expect(screen.getByPlaceholderText(/confirm/i)).toBeInTheDocument()
    })

    it('密码不匹配时应该显示错误', async () => {
      const user = userEvent.setup()
      render(
        <PasswordField field={mockField} value="password1" onChange={mockOnChange} showConfirm />
      )

      const confirmInput = screen.getByPlaceholderText(/confirm/i)
      await user.type(confirmInput, 'password2')

      expect(screen.getByText(/match|不匹配/i)).toBeInTheDocument()
    })
  })

  describe('生成密码', () => {
    it('应该有生成密码按钮', () => {
      render(<PasswordField field={mockField} value="" onChange={mockOnChange} showGenerator />)

      const generateButton =
        screen.getByRole('button', { name: /generate/i }) || screen.getByLabelText(/generate/i)
      expect(generateButton).toBeInTheDocument()
    })

    it('点击生成应该生成随机密码', async () => {
      const user = userEvent.setup()
      render(<PasswordField field={mockField} value="" onChange={mockOnChange} showGenerator />)

      const generateButton =
        screen.getByRole('button', { name: /generate/i }) || screen.getByLabelText(/generate/i)
      await user.click(generateButton)

      expect(mockOnChange).toHaveBeenCalled()
      // 生成的密码应该满足最小长度
      const callArg = mockOnChange.mock.calls[0][0]
      expect(callArg.length).toBeGreaterThanOrEqual(mockField.min)
    })
  })

  describe('禁用状态', () => {
    it('禁用时输入框不可编辑', () => {
      render(<PasswordField field={mockField} value="test" onChange={mockOnChange} disabled />)

      const input = screen.getByPlaceholderText(/password/i)
      expect(input).toBeDisabled()
    })
  })

  describe('遮罩模式', () => {
    it('遮罩模式应该显示占位符', () => {
      render(<PasswordField field={mockField} value="existing" onChange={mockOnChange} masked />)

      // 遮罩模式显示禁用的输入框
      const input = screen.getByPlaceholderText('******')
      expect(input).toBeInTheDocument()
      expect(input).toBeDisabled()
    })

    it('点击解锁应该允许编辑', async () => {
      const user = userEvent.setup()
      render(<PasswordField field={mockField} value="existing" onChange={mockOnChange} masked />)

      const unlockButton = screen.getByRole('button', { name: /set new value/i })
      await user.click(unlockButton)

      const input = screen.getByPlaceholderText(/password/i)
      expect(input).not.toBeDisabled()
    })
  })
})
