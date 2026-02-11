/**
 * MFA 两阶段认证
 * 与 Go 版 apis/record_helpers.go checkMFA() 对齐
 *
 * 设计：MFA 不是独立端点，而是嵌入在 RecordAuthResponse 中
 * - 第一次认证（无 mfaId）→ 创建 MFA record → 返回 401 + {mfaId}
 * - 第二次认证（带 mfaId, 不同方法）→ 验证 → 删除 MFA → 正常 200
 */

import type { CollectionModel } from "../core/collection_model";
import type { RecordModel } from "../core/record_model";
import { generateId } from "../tools/security/random";
import { badRequestError } from "./errors";

// ─── MFA 方法常量 ───

export const MFA_METHOD_PASSWORD = "password";
export const MFA_METHOD_OAUTH2 = "oauth2";
export const MFA_METHOD_OTP = "otp";

// ─── MFA 配置 ───

interface MFAConfig {
  enabled: boolean;
  duration: number; // 秒
}

export function getMFAConfig(collection: CollectionModel): MFAConfig {
  const config = collection.options.mfa as MFAConfig | undefined;
  return config ?? { enabled: false, duration: 1800 };
}

// ─── MFA Store（内存） ───

export interface MFAEntry {
  id: string;
  collectionRef: string;
  recordRef: string;
  method: string;
  createdAt: number;
  expiresAt: number;
}

/** MFA 存储（Map<mfaId, MFAEntry>） */
export type MFAStore = Map<string, MFAEntry>;

// ─── MFA 检查核心逻辑 ───

export interface CheckMFAResult {
  /** 非空时表示需要 MFA，返回此 mfaId 给客户端 */
  mfaId: string;
}

/**
 * 检查 MFA
 * - 若 MFA 未启用或 authMethod 为空，跳过
 * - 若无 mfaId（第一次认证），创建 MFA record，返回 mfaId
 * - 若有 mfaId（第二次认证），验证后删除 MFA record，返回空 mfaId
 */
export function checkMFA(
  store: MFAStore,
  collection: CollectionModel,
  authRecord: RecordModel,
  currentAuthMethod: string,
  mfaId?: string,
): CheckMFAResult {
  const config = getMFAConfig(collection);

  // MFA 未启用或 authMethod 为空 → 跳过
  if (!config.enabled || !currentAuthMethod) {
    return { mfaId: "" };
  }

  // 第一次认证（无 mfaId）→ 创建 MFA record
  if (!mfaId) {
    const id = generateId();
    const now = Date.now();
    store.set(id, {
      id,
      collectionRef: collection.id,
      recordRef: authRecord.id,
      method: currentAuthMethod,
      createdAt: now,
      expiresAt: now + config.duration * 1000,
    });
    return { mfaId: id };
  }

  // 第二次认证（有 mfaId）→ 验证
  const mfaEntry = store.get(mfaId);

  const deleteMFA = () => {
    if (mfaEntry) store.delete(mfaId);
  };

  if (!mfaEntry) {
    throw badRequestError("Invalid or expired MFA session.", {});
  }

  // 检查过期
  if (Date.now() > mfaEntry.expiresAt) {
    deleteMFA();
    throw badRequestError("Invalid or expired MFA session.", {});
  }

  // 检查 record 和 collection 匹配
  if (
    mfaEntry.recordRef !== authRecord.id ||
    mfaEntry.collectionRef !== collection.id
  ) {
    throw badRequestError("Invalid MFA session.", {});
  }

  // 检查方法不同
  if (mfaEntry.method === currentAuthMethod) {
    throw badRequestError(
      "A different authentication method is required.",
      {},
    );
  }

  // 验证通过，删除 MFA record
  deleteMFA();

  return { mfaId: "" };
}
