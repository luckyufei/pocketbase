/**
 * Monitoring Atoms (STORY-7.1)
 *
 * 系统监控状态管理
 * - T-7.1.1: monitoringAtom (系统指标)
 * - T-7.1.2: Monitoring state management
 */

import { atom } from "jotai";

// ============================================================================
// Types
// ============================================================================

/**
 * 系统指标接口
 */
export interface SystemMetrics {
  /** CPU 使用率 (百分比 0-100) */
  cpu: number;
  /** 内存使用量 (MB) */
  memory: number;
  /** 内存使用率 (百分比 0-100) */
  memoryPercent: number;
  /** Goroutine 数量 */
  goroutines: number;
  /** 活跃连接数 */
  activeConnections: number;
  /** 运行时间 (秒) */
  uptime: number;
  /** 时间戳 (ISO 8601 格式) */
  timestamp: string;
}

// ============================================================================
// Base Atoms
// ============================================================================

/**
 * 系统指标 Atom
 * null 表示尚未获取指标
 */
export const monitoringAtom = atom<SystemMetrics | null>(null);

/**
 * 监控加载状态 Atom
 */
export const isMonitoringLoadingAtom = atom<boolean>(false);

/**
 * 监控错误信息 Atom
 */
export const monitoringErrorAtom = atom<string | null>(null);

// ============================================================================
// Write Atoms (Actions)
// ============================================================================

/**
 * 设置系统指标
 */
export const setMonitoringAtom = atom(
  null,
  (_get, set, metrics: SystemMetrics) => {
    set(monitoringAtom, metrics);
  }
);

/**
 * 设置加载状态
 */
export const setMonitoringLoadingAtom = atom(
  null,
  (_get, set, loading: boolean) => {
    set(isMonitoringLoadingAtom, loading);
  }
);

/**
 * 设置错误信息
 */
export const setMonitoringErrorAtom = atom(
  null,
  (_get, set, error: string | null) => {
    set(monitoringErrorAtom, error);
  }
);

/**
 * 清除所有监控状态
 */
export const clearMonitoringAtom = atom(null, (_get, set) => {
  set(monitoringAtom, null);
  set(isMonitoringLoadingAtom, false);
  set(monitoringErrorAtom, null);
});
