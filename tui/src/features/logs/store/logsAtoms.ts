/**
 * Logs Atoms (STORY-6.1)
 *
 * 日志状态管理
 * - T-6.1.1: logsAtom (日志列表)
 * - T-6.1.3: logsLevelFilterAtom (级别过滤)
 */

import { atom } from "jotai";

// ============================================================================
// Types
// ============================================================================

/**
 * 日志级别类型
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 日志条目接口
 */
export interface LogEntry {
  /** 日志唯一标识 */
  id: string;
  /** 时间戳 (ISO 8601 格式) */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 附加数据 (可选) */
  data?: Record<string, unknown>;
}

// ============================================================================
// Base Atoms
// ============================================================================

/**
 * 日志列表 Atom
 * 存储所有日志条目
 */
export const logsAtom = atom<LogEntry[]>([]);

/**
 * 日志级别过滤器 Atom
 * null 表示显示所有级别
 */
export const logsLevelFilterAtom = atom<LogLevel | null>(null);

/**
 * 日志加载状态 Atom
 */
export const isLogsLoadingAtom = atom<boolean>(false);

/**
 * 日志错误信息 Atom
 */
export const logsErrorAtom = atom<string | null>(null);

// ============================================================================
// Write Atoms (Actions)
// ============================================================================

/**
 * 设置日志列表
 */
export const setLogsAtom = atom(null, (_get, set, logs: LogEntry[]) => {
  set(logsAtom, logs);
});

/**
 * 添加单条日志
 */
export const addLogAtom = atom(null, (get, set, log: LogEntry) => {
  const currentLogs = get(logsAtom);
  set(logsAtom, [...currentLogs, log]);
});

/**
 * 设置级别过滤器
 */
export const setLevelFilterAtom = atom(
  null,
  (_get, set, level: LogLevel | null) => {
    set(logsLevelFilterAtom, level);
  }
);

/**
 * 设置加载状态
 */
export const setLoadingAtom = atom(null, (_get, set, loading: boolean) => {
  set(isLogsLoadingAtom, loading);
});

/**
 * 设置错误信息
 */
export const setErrorAtom = atom(null, (_get, set, error: string | null) => {
  set(logsErrorAtom, error);
});

/**
 * 清除所有日志状态
 * 重置日志列表、过滤器、加载状态和错误信息
 */
export const clearLogsAtom = atom(null, (_get, set) => {
  set(logsAtom, []);
  set(logsLevelFilterAtom, null);
  set(isLogsLoadingAtom, false);
  set(logsErrorAtom, null);
});
