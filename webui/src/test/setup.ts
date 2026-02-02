import { GlobalRegistrator } from '@happy-dom/global-registrator'
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

GlobalRegistrator.register()

// 每个测试后清理 mocks
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
