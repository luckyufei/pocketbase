import { expect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

// 扩展 vitest 的 expect 以支持 jest-dom matchers
expect.extend(matchers)
