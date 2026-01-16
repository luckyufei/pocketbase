/**
 * AuthOptions 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthOptions } from './AuthOptions'

describe('AuthOptions', () => {
  const mockOptions = {
    manageRule: '',
    authRule: '',
    authAlert: {},
    oauth2: { enabled: false, providers: [] },
    passwordAuth: { enabled: true, identityFields: ['email'] },
    mfa: { enabled: false },
    otp: { enabled: false },
    authToken: { duration: 1209600 },
    passwordResetToken: { duration: 1800 },
    emailChangeToken: { duration: 1800 },
    verificationToken: { duration: 604800 },
    fileToken: { duration: 120 },
  }

  it('should render auth options', () => {
    render(<AuthOptions options={mockOptions} onChange={() => {}} />)

    expect(screen.getByText('Authentication Methods')).toBeInTheDocument()
    expect(screen.getByText('Token Settings')).toBeInTheDocument()
  })

  it('should show password auth toggle', () => {
    render(<AuthOptions options={mockOptions} onChange={() => {}} />)

    // 展开 accordion - 点击触发器
    const trigger = screen.getByText('Authentication Methods')
    fireEvent.click(trigger)

    // 等待内容展开后检查
    const label = screen.getByText('Password Auth')
    expect(label).toBeInTheDocument()
  })

  it('should call onChange when option is toggled', () => {
    const handleChange = vi.fn()
    render(<AuthOptions options={mockOptions} onChange={handleChange} />)

    // 展开 accordion
    const trigger = screen.getByText('Authentication Methods')
    fireEvent.click(trigger)

    // 找到 OAuth2 的 checkbox 并点击
    const checkbox = screen.getByRole('checkbox', { name: 'OAuth2' })
    fireEvent.click(checkbox)

    expect(handleChange).toHaveBeenCalled()
  })

  it('should show MFA option', () => {
    render(<AuthOptions options={mockOptions} onChange={() => {}} />)

    // 展开 accordion
    const trigger = screen.getByText('Authentication Methods')
    fireEvent.click(trigger)

    expect(screen.getByText('MFA (Multi-Factor Authentication)')).toBeInTheDocument()
  })
})
