/**
 * Z-Index 管理器
 * 用于管理 OverlayPanel 和 Dialog 的层级
 * 
 * 每次打开一个新的面板时，会分配一个递增的 z-index
 * 确保后打开的面板总是显示在先打开的面板之上
 */

// 基础 z-index
const BASE_Z_INDEX = 50

// 当前已分配的最高 z-index
let currentZIndex = BASE_Z_INDEX

// 活动面板的 z-index 映射
const activePanels = new Map<string, number>()

/**
 * 分配一个新的 z-index
 * @param id 面板的唯一标识符
 * @returns 分配的 z-index
 */
export function allocateZIndex(id: string): number {
  // 如果已经有分配的 z-index，返回它
  if (activePanels.has(id)) {
    return activePanels.get(id)!
  }
  
  // 分配新的 z-index
  currentZIndex += 10
  activePanels.set(id, currentZIndex)
  
  return currentZIndex
}

/**
 * 释放一个 z-index
 * @param id 面板的唯一标识符
 */
export function releaseZIndex(id: string): void {
  activePanels.delete(id)
  
  // 如果没有活动面板了，重置 z-index
  if (activePanels.size === 0) {
    currentZIndex = BASE_Z_INDEX
  }
}

/**
 * 获取当前最高的 z-index
 */
export function getHighestZIndex(): number {
  return currentZIndex
}

/**
 * 生成唯一的面板 ID
 */
let panelIdCounter = 0
export function generatePanelId(): string {
  return `panel_${++panelIdCounter}_${Date.now()}`
}
