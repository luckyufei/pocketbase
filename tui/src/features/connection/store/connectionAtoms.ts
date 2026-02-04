/**
 * Connection Atoms (STORY-8.1)
 *
 * 连接状态管理
 * - T-8.1.1: Connection state (connecting, connected, error)
 * - T-8.1.2: URL and token management
 */

import { atom } from "jotai";

// ============================================================================
// Types
// ============================================================================

/**
 * 连接状态类型
 */
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// ============================================================================
// Base Atoms
// ============================================================================

/**
 * 连接状态 Atom
 */
export const connectionStateAtom = atom<ConnectionState>("disconnected");

/**
 * PocketBase URL Atom
 */
export const connectionUrlAtom = atom<string>("http://127.0.0.1:8090");

/**
 * 认证 Token Atom
 */
export const connectionTokenAtom = atom<string | null>(null);

/**
 * 连接错误信息 Atom
 */
export const connectionErrorAtom = atom<string | null>(null);

// ============================================================================
// Write Atoms (Actions)
// ============================================================================

/**
 * 设置连接状态
 */
export const setConnectionStateAtom = atom(
  null,
  (_get, set, state: ConnectionState) => {
    set(connectionStateAtom, state);
  }
);

/**
 * 设置 PocketBase URL
 */
export const setConnectionUrlAtom = atom(null, (_get, set, url: string) => {
  set(connectionUrlAtom, url);
});

/**
 * 设置认证 Token
 */
export const setConnectionTokenAtom = atom(
  null,
  (_get, set, token: string | null) => {
    set(connectionTokenAtom, token);
  }
);

/**
 * 设置连接错误
 */
export const setConnectionErrorAtom = atom(
  null,
  (_get, set, error: string | null) => {
    set(connectionErrorAtom, error);
  }
);

/**
 * 重置所有连接状态到默认值
 */
export const resetConnectionAtom = atom(null, (_get, set) => {
  set(connectionStateAtom, "disconnected");
  set(connectionUrlAtom, "http://127.0.0.1:8090");
  set(connectionTokenAtom, null);
  set(connectionErrorAtom, null);
});
