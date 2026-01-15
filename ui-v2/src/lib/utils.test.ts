/**
 * utils.test.ts - 工具函数测试
 * TDD: 红灯 🔴 - 先写测试
 */
import { describe, expect, it } from 'bun:test'
import {
  cn,
  truncate,
  isEmpty,
  toArray,
  randomSecret,
  maskSecret,
  getFieldTypeIcon,
} from './utils'

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('should handle tailwind merge', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})

describe('truncate', () => {
  it('should truncate long strings', () => {
    expect(truncate('hello world', 5)).toBe('hello')
  })

  it('should add ellipsis when requested', () => {
    expect(truncate('hello world', 5, true)).toBe('hello...')
  })

  it('should return original string if shorter than maxLength', () => {
    expect(truncate('hi', 10)).toBe('hi')
  })
})

describe('isEmpty', () => {
  it('should return true for null', () => {
    expect(isEmpty(null)).toBe(true)
  })

  it('should return true for undefined', () => {
    expect(isEmpty(undefined)).toBe(true)
  })

  it('should return true for empty string', () => {
    expect(isEmpty('')).toBe(true)
  })

  it('should return true for empty array', () => {
    expect(isEmpty([])).toBe(true)
  })

  it('should return false for non-empty values', () => {
    expect(isEmpty('hello')).toBe(false)
    expect(isEmpty([1])).toBe(false)
  })
})

describe('toArray', () => {
  it('should convert single value to array', () => {
    expect(toArray('hello')).toEqual(['hello'])
  })

  it('should return array as-is', () => {
    expect(toArray([1, 2])).toEqual([1, 2])
  })

  it('should return empty array for null/undefined', () => {
    expect(toArray(null)).toEqual([])
    expect(toArray(undefined)).toEqual([])
  })
})

// T004: randomSecret 测试
describe('randomSecret', () => {
  it('should generate secret with default length 15', () => {
    const secret = randomSecret()
    expect(secret.length).toBe(15)
  })

  it('should generate secret with custom length', () => {
    const secret = randomSecret(32)
    expect(secret.length).toBe(32)
  })

  it('should generate different secrets each time', () => {
    const secret1 = randomSecret(20)
    const secret2 = randomSecret(20)
    expect(secret1).not.toBe(secret2)
  })

  it('should only contain alphanumeric characters', () => {
    const secret = randomSecret(100)
    expect(/^[a-zA-Z0-9]+$/.test(secret)).toBe(true)
  })
})

// T005: maskSecret 测试
describe('maskSecret', () => {
  it('should return empty string for empty input', () => {
    expect(maskSecret('')).toBe('')
  })

  it('should mask entire value if length <= 8', () => {
    expect(maskSecret('short')).toBe('•••••')
    expect(maskSecret('12345678')).toBe('••••••••')
  })

  it('should show first 3 and last 3 chars for longer values', () => {
    expect(maskSecret('sk-1234567890')).toBe('sk-•••••••890')
  })

  it('should limit middle mask to 10 characters', () => {
    const longSecret = 'abc' + 'x'.repeat(20) + 'xyz'
    const masked = maskSecret(longSecret)
    expect(masked).toBe('abc••••••••••xyz')
  })
})

// T005: getFieldTypeIcon 测试
describe('getFieldTypeIcon', () => {
  it('should return correct icon for secret type', () => {
    expect(getFieldTypeIcon('secret')).toBe('ri-shield-keyhole-line')
  })

  it('should return correct icon for text type', () => {
    expect(getFieldTypeIcon('text')).toBe('ri-text')
  })

  it('should return correct icon for number type', () => {
    expect(getFieldTypeIcon('number')).toBe('ri-hashtag')
  })

  it('should return correct icon for password type', () => {
    expect(getFieldTypeIcon('password')).toBe('ri-lock-password-line')
  })

  it('should return default icon for unknown type', () => {
    expect(getFieldTypeIcon('unknown')).toBe('ri-file-text-line')
  })
})
