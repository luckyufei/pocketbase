/**
 * App Store 单元测试
 * TDD: 红灯阶段
 */
import { describe, it, expect } from 'bun:test'
import { createStore } from 'jotai'
import {
  appNameAtom,
  pageTitleAtom,
  hideControlsAtom,
  appConfigAtom,
  setAppName,
  setPageTitle,
  setHideControls,
} from './app'

describe('App Store', () => {
  describe('appNameAtom', () => {
    it('应该有默认值 PocketBase', () => {
      const store = createStore()
      expect(store.get(appNameAtom)).toBe('PocketBase')
    })

    it('应该能设置应用名称', () => {
      const store = createStore()
      store.set(appNameAtom, 'My App')
      expect(store.get(appNameAtom)).toBe('My App')
    })
  })

  describe('pageTitleAtom', () => {
    it('应该有默认值空字符串', () => {
      const store = createStore()
      expect(store.get(pageTitleAtom)).toBe('')
    })

    it('应该能设置页面标题', () => {
      const store = createStore()
      store.set(pageTitleAtom, 'Collections')
      expect(store.get(pageTitleAtom)).toBe('Collections')
    })
  })

  describe('hideControlsAtom', () => {
    it('应该默认为 false', () => {
      const store = createStore()
      expect(store.get(hideControlsAtom)).toBe(false)
    })

    it('应该能设置隐藏控制', () => {
      const store = createStore()
      store.set(hideControlsAtom, true)
      expect(store.get(hideControlsAtom)).toBe(true)
    })
  })

  describe('appConfigAtom', () => {
    it('应该返回完整的应用配置', () => {
      const store = createStore()
      const config = store.get(appConfigAtom)
      expect(config).toEqual({
        appName: 'PocketBase',
        pageTitle: '',
        hideControls: false,
      })
    })

    it('应该反映各个 atom 的变化', () => {
      const store = createStore()
      store.set(appNameAtom, 'Custom App')
      store.set(pageTitleAtom, 'Dashboard')
      store.set(hideControlsAtom, true)

      const config = store.get(appConfigAtom)
      expect(config).toEqual({
        appName: 'Custom App',
        pageTitle: 'Dashboard',
        hideControls: true,
      })
    })
  })

  describe('Action Atoms', () => {
    it('setAppName 应该更新应用名称', () => {
      const store = createStore()
      store.set(setAppName, 'New App')
      expect(store.get(appNameAtom)).toBe('New App')
    })

    it('setPageTitle 应该更新页面标题', () => {
      const store = createStore()
      store.set(setPageTitle, 'Settings')
      expect(store.get(pageTitleAtom)).toBe('Settings')
    })

    it('setHideControls 应该更新隐藏控制', () => {
      const store = createStore()
      store.set(setHideControls, true)
      expect(store.get(hideControlsAtom)).toBe(true)
    })
  })
})
