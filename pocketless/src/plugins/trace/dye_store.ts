/**
 * Trace 插件 — 染色用户存储
 * 对照 Go 版 plugins/trace/dye/store.go + store_memory.go
 *
 * 染色（Dye）是一种调试功能：将指定用户标记为"染色"状态，
 * 使其所有请求在 conditional 模式下也被强制追踪。
 */

/** 染色用户记录 */
export interface DyedUser {
  userId: string;
  addedAt: number;   // UnixMs
  expiresAt: number; // UnixMs
  ttlMs: number;
  addedBy?: string;
  reason?: string;
}

/** 染色存储接口（对照 Go 版 dye.DyeStore） */
export interface DyeStore {
  add(userId: string, ttlMs: number, addedBy?: string, reason?: string): void;
  remove(userId: string): void;
  isDyed(userId: string): boolean;
  get(userId: string): DyedUser | null;
  list(): DyedUser[];
  updateTTL(userId: string, ttlMs: number): boolean;
  count(): number;
  close(): void;
}

/**
 * MemoryDyeStore — 内存实现。
 *
 * 对照 Go 版 dye.MemoryDyeStore。
 * 不含后台清理 timer（JS 单线程无需并发锁）。
 */
export class MemoryDyeStore implements DyeStore {
  private users: Map<string, DyedUser> = new Map();
  private readonly maxUsers: number;
  private readonly defaultTTL: number; // ms

  constructor(maxUsers: number = 100, defaultTTLSeconds: number = 3600) {
    this.maxUsers = maxUsers > 0 ? maxUsers : 100;
    this.defaultTTL = defaultTTLSeconds > 0 ? defaultTTLSeconds * 1000 : 3600_000;
  }

  add(userId: string, ttlMs: number, addedBy?: string, reason?: string): void {
    const existing = this.users.has(userId);
    if (!existing && this.users.size >= this.maxUsers) {
      // 超出上限，忽略（对照 Go: return ErrMaxDyedUsersReached）
      return;
    }

    const effectiveTTL = ttlMs > 0 ? ttlMs : this.defaultTTL;
    const now = Date.now();

    this.users.set(userId, {
      userId,
      addedAt: now,
      expiresAt: now + effectiveTTL,
      ttlMs: effectiveTTL,
      addedBy,
      reason,
    });
  }

  remove(userId: string): void {
    this.users.delete(userId);
  }

  isDyed(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    if (Date.now() > user.expiresAt) {
      // 懒过期删除
      this.users.delete(userId);
      return false;
    }
    return true;
  }

  get(userId: string): DyedUser | null {
    const user = this.users.get(userId);
    if (!user || Date.now() > user.expiresAt) return null;
    // 返回副本
    return { ...user };
  }

  list(): DyedUser[] {
    const now = Date.now();
    const result: DyedUser[] = [];
    for (const user of this.users.values()) {
      if (now <= user.expiresAt) result.push({ ...user });
    }
    return result;
  }

  updateTTL(userId: string, ttlMs: number): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.ttlMs = ttlMs;
    user.expiresAt = Date.now() + ttlMs;
    return true;
  }

  count(): number {
    return this.users.size;
  }

  close(): void {
    this.users.clear();
  }
}
