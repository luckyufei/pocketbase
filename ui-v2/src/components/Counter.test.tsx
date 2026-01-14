import { describe, it, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'jotai'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { Counter } from './Counter'

// 测试用的渲染包装器
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <Provider>{ui}</Provider>
    </I18nextProvider>
  )
}

describe('Counter', () => {
  it('renders with initial count of 0', () => {
    renderWithProviders(<Counter />)
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('increments count when increment button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Counter />)

    // 使用 i18n key 的翻译值或直接匹配按钮
    const incrementButton = screen.getByRole('button', { name: /increment/i })
    await user.click(incrementButton)

    expect(screen.getByText('1')).toBeTruthy()
  })

  it('increments and decrements count', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Counter />)

    const incrementButton = screen.getByRole('button', { name: /increment/i })
    const decrementButton = screen.getByRole('button', { name: /decrement/i })

    // Start at 0, increment to 1
    await user.click(incrementButton)
    expect(screen.getByText('1')).toBeTruthy()

    // Decrement back to 0
    await user.click(decrementButton)
    expect(screen.getByText('0')).toBeTruthy()
  })
})
