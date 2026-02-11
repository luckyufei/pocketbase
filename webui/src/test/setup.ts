import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

// 注册 happy-dom 全局变量（document, window 等）
GlobalRegistrator.register()

// 扩展 vitest 的 expect 以支持 jest-dom matchers
expect.extend(matchers)

// Create a real localStorage mock with actual storage
class LocalStorageMock implements Storage {
  private store: Record<string, string> = {}

  getItem(key: string): string | null {
    return this.store[key] ?? null
  }

  setItem(key: string, value: string): void {
    this.store[key] = value
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  clear(): void {
    this.store = {}
  }

  get length(): number {
    return Object.keys(this.store).length
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null
  }
}

Object.defineProperty(globalThis, 'localStorage', { 
  value: new LocalStorageMock(),
  writable: true,
  configurable: true,
})
