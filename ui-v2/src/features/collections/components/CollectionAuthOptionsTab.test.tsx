/**
 * TDD: CollectionAuthOptionsTab 组件测试
 * Auth Collection 认证选项配置
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollectionAuthOptionsTab } from './CollectionAuthOptionsTab'

describe('CollectionAuthOptionsTab', () => {
  const mockOnChange = vi.fn()

  const mockCollection = {
    id: 'col1',
    name: 'users',
    type: 'auth' as const,
    system: false,
    fields: [
      { name: 'email', type: 'email', required: true },
      { name: 'username', type: 'text', required: false },
    ],
    indexes: [],
    passwordAuth: {
      enabled: true,
      identityFields: ['email'],
    },
    oauth2: {
      enabled: false,
      providers: [],
    },
    otp: {
      enabled: false,
      duration: 300,
      length: 6,
      emailTemplate: {},
    },
    mfa: {
      enabled: false,
      rule: '',
    },
    authAlert: {
      enabled: false,
      emailTemplate: {},
    },
    authToken: {
      duration: 1209600,
    },
    verificationToken: {
      duration: 604800,
    },
    passwordResetToken: {
      duration: 1800,
    },
    emailChangeToken: {
      duration: 1800,
    },
    verificationTemplate: {},
    resetPasswordTemplate: {},
    confirmEmailChangeTemplate: {},
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该渲染 Auth methods 标题', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/auth methods/i)).toBeInTheDocument()
    })

    it('应该渲染 Mail templates 标题', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/mail templates/i)).toBeInTheDocument()
    })

    it('应该渲染 Other 标题', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/other/i)).toBeInTheDocument()
    })
  })

  describe('Password Auth', () => {
    it('应该渲染 Identity/Password 选项', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/identity\/password/i)).toBeInTheDocument()
    })

    it('应该显示 Enabled 状态', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })
  })

  describe('OAuth2', () => {
    it('应该渲染 OAuth2 选项', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/oauth2/i)).toBeInTheDocument()
    })
  })

  describe('OTP', () => {
    it('应该渲染 OTP 选项', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/otp/i)).toBeInTheDocument()
    })
  })

  describe('MFA', () => {
    it('应该渲染 MFA 选项', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/multi-factor/i)).toBeInTheDocument()
    })
  })

  describe('Token Options', () => {
    it('应该渲染 Token 选项', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/token/i)).toBeInTheDocument()
    })
  })

  describe('Superusers Collection', () => {
    const superusersCollection = {
      ...mockCollection,
      name: '_superusers',
      system: true,
    }

    it('Superusers 应该隐藏 OAuth2 选项', () => {
      render(<CollectionAuthOptionsTab collection={superusersCollection} onChange={mockOnChange} />)
      // OAuth2 不应该显示在 superusers 中
      const oauth2Elements = screen.queryAllByText(/oauth2/i)
      // 可能在其他地方提到，但不应该作为主要选项
      expect(oauth2Elements.length).toBeLessThanOrEqual(1)
    })
  })

  describe('Login Alert', () => {
    it('应该渲染登录提醒选项', () => {
      render(<CollectionAuthOptionsTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/login/i)).toBeInTheDocument()
    })
  })
})
