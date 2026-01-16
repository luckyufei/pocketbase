/**
 * 应用全局状态
 * 管理应用名称、页面标题、控制显示等
 */
import { atom } from 'jotai'

// ============ 基础 Atoms ============

/**
 * 应用名称
 */
export const appNameAtom = atom<string>('PocketBase')

/**
 * 当前页面标题
 */
export const pageTitleAtom = atom<string>('')

/**
 * 是否隐藏控制按钮
 */
export const hideControlsAtom = atom<boolean>(false)

// ============ 派生 Atoms ============

/**
 * 应用配置（只读）
 */
export const appConfigAtom = atom((get) => ({
  appName: get(appNameAtom),
  pageTitle: get(pageTitleAtom),
  hideControls: get(hideControlsAtom),
}))

// ============ Action Atoms ============

/**
 * 设置应用名称
 */
export const setAppName = atom(null, (_get, set, name: string) => {
  set(appNameAtom, name)
})

/**
 * 设置页面标题
 */
export const setPageTitle = atom(null, (_get, set, title: string) => {
  set(pageTitleAtom, title)
})

/**
 * 设置隐藏控制
 */
export const setHideControls = atom(null, (_get, set, hide: boolean) => {
  set(hideControlsAtom, hide)
})
