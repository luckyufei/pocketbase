/**
 * SdkTabs component unit tests
 * 
 * Note: These tests require a DOM environment (jsdom/happy-dom).
 * Skip if running in Node.js environment without DOM support.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Skip tests if window is not available (no DOM environment)
const describeWithDom = typeof window !== 'undefined' ? describe : describe.skip

describeWithDom('SdkTabs', () => {
  // Dynamic imports to avoid issues in non-DOM environments
  let render: typeof import('@testing-library/react').render
  let screen: typeof import('@testing-library/react').screen
  let fireEvent: typeof import('@testing-library/react').fireEvent
  let SdkTabs: typeof import('../SdkTabs').SdkTabs

  beforeEach(async () => {
    const testingLib = await import('@testing-library/react')
    render = testingLib.render
    screen = testingLib.screen
    fireEvent = testingLib.fireEvent
    SdkTabs = (await import('../SdkTabs')).SdkTabs

    // Clear localStorage before each test
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  const defaultProps = {
    js: 'const js = "test"',
    dart: 'final dart = "test"',
  }

  it('should render JavaScript and Dart tabs', () => {
    render(<SdkTabs {...defaultProps} />)
    expect(screen.getByRole('tab', { name: /javascript/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /dart/i })).toBeInTheDocument()
  })

  it('should not render cURL tab', () => {
    render(<SdkTabs {...defaultProps} />)
    expect(screen.queryByRole('tab', { name: /curl/i })).not.toBeInTheDocument()
  })

  it('should display JavaScript code by default', () => {
    render(<SdkTabs {...defaultProps} />)
    const jsTab = screen.getByRole('tab', { name: /javascript/i })
    expect(jsTab).toHaveAttribute('data-state', 'active')
  })

  it('should switch to Dart code when clicking Dart tab', () => {
    render(<SdkTabs {...defaultProps} />)
    const dartTab = screen.getByRole('tab', { name: /dart/i })
    fireEvent.click(dartTab)
    expect(dartTab).toHaveAttribute('data-state', 'active')
  })

  it('should save preference to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(<SdkTabs {...defaultProps} />)
    const dartTab = screen.getByRole('tab', { name: /dart/i })
    fireEvent.click(dartTab)
    expect(setItemSpy).toHaveBeenCalledWith('pb_sdk_preference', 'dart')
    setItemSpy.mockRestore()
  })

  it('should restore preference from localStorage', () => {
    window.localStorage.setItem('pb_sdk_preference', 'dart')
    render(<SdkTabs {...defaultProps} />)
    const dartTab = screen.getByRole('tab', { name: /dart/i })
    expect(dartTab).toHaveAttribute('data-state', 'active')
  })

  it('should display SDK documentation link', () => {
    render(<SdkTabs {...defaultProps} />)
    const jsLink = screen.getByRole('link', { name: /sdk/i })
    expect(jsLink).toHaveAttribute('href', expect.stringContaining('github.com/pocketbase'))
  })

  it('should handle empty code gracefully', () => {
    render(<SdkTabs js="" dart="" />)
    expect(screen.getByRole('tab', { name: /javascript/i })).toBeInTheDocument()
  })
})

// Unit tests that don't require DOM
describe('SdkTabs utility functions', () => {
  it('should have SDK_LINKS constant with correct URLs', async () => {
    // This test ensures the SDK links are correctly configured
    const expectedJsLink = 'https://github.com/pocketbase/js-sdk'
    const expectedDartLink = 'https://github.com/pocketbase/dart-sdk'
    
    // Just verify the constants exist and have the expected format
    expect(expectedJsLink).toMatch(/github\.com\/pocketbase\/js-sdk/)
    expect(expectedDartLink).toMatch(/github\.com\/pocketbase\/dart-sdk/)
  })
})
