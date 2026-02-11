/**
 * SubscriptionOptions — 订阅选项
 * 与 Go 版 subscriptions.SubscriptionOptions 对齐
 */
export interface SubscriptionOptions {
  query: Record<string, string>;
  headers: Record<string, string>;
}

/**
 * Client — 订阅客户端接口
 * 与 Go 版 subscriptions.Client 对齐
 */
export interface Client {
  /** 返回客户端唯一 ID */
  id(): string;

  /** 返回客户端的订阅，可按前缀过滤 */
  subscriptions(...prefixes: string[]): Map<string, SubscriptionOptions>;

  /** 订阅指定主题 */
  subscribe(...subs: string[]): void;

  /** 取消订阅，不传参则取消所有 */
  unsubscribe(...subs: string[]): void;

  /** 检查是否已订阅指定主题 */
  hasSubscription(sub: string): boolean;

  /** 存储任意值到客户端上下文 */
  set(key: string, value: unknown): void;

  /** 移除上下文中的值 */
  unset(key: string): void;

  /** 获取上下文中的值 */
  get(key: string): unknown;

  /** 标记客户端为已废弃（关闭通道） */
  discard(): void;

  /** 是否已废弃 */
  isDiscarded(): boolean;

  /** 发送消息到客户端通道 */
  send(m: Message): void;
}

import type { Message } from "./message";
import { randomString } from "../security/random";

/**
 * DefaultClient — 默认客户端实现
 * 与 Go 版 subscriptions.DefaultClient 对齐
 */
export class DefaultClient implements Client {
  private _id: string;
  private _store = new Map<string, unknown>();
  private _subscriptions = new Map<string, SubscriptionOptions>();
  private _discarded = false;
  private _listeners: Array<(msg: Message) => void> = [];

  constructor() {
    this._id = randomString(40);
  }

  id(): string {
    return this._id;
  }

  subscriptions(...prefixes: string[]): Map<string, SubscriptionOptions> {
    if (prefixes.length === 0) {
      return new Map(this._subscriptions);
    }

    const result = new Map<string, SubscriptionOptions>();
    for (const prefix of prefixes) {
      for (const [sub, options] of this._subscriptions) {
        // "?" 确保选项查询起始字符始终存在，用作结束分隔符
        if ((sub + "?").startsWith(prefix)) {
          result.set(sub, options);
        }
      }
    }
    return result;
  }

  subscribe(...subs: string[]): void {
    for (const s of subs) {
      if (s === "") continue;

      // 解析订阅选项
      const options: SubscriptionOptions = { query: {}, headers: {} };
      try {
        const url = new URL(s, "http://localhost");
        const raw = url.searchParams.get("options");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.query) {
            for (const [k, v] of Object.entries(parsed.query)) {
              options.query[k] = String(v);
            }
          }
          if (parsed.headers) {
            for (const [k, v] of Object.entries(parsed.headers)) {
              // 标准化 header 名：转为 snake_case
              options.headers[toSnakeCase(k)] = String(v);
            }
          }
        }
      } catch {
        // 忽略解析错误
      }

      this._subscriptions.set(s, options);
    }
  }

  unsubscribe(...subs: string[]): void {
    if (subs.length > 0) {
      for (const s of subs) {
        this._subscriptions.delete(s);
      }
    } else {
      this._subscriptions.clear();
    }
  }

  hasSubscription(sub: string): boolean {
    return this._subscriptions.has(sub);
  }

  set(key: string, value: unknown): void {
    this._store.set(key, value);
  }

  unset(key: string): void {
    this._store.delete(key);
  }

  get(key: string): unknown {
    return this._store.get(key);
  }

  discard(): void {
    if (this._discarded) return;
    this._discarded = true;
  }

  isDiscarded(): boolean {
    return this._discarded;
  }

  send(m: Message): void {
    if (this._discarded) return;
    for (const listener of this._listeners) {
      try {
        listener(m);
      } catch {
        // 忽略
      }
    }
  }

  /** 注册消息监听器 */
  onMessage(fn: (msg: Message) => void): void {
    this._listeners.push(fn);
  }

  /** 移除所有消息监听器 */
  removeAllListeners(): void {
    this._listeners = [];
  }
}

/** 将 header 名转为 snake_case（如 X-Token → x_token） */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .replace(/[-\s]+/g, "_")
    .replace(/^_/, "")
    .toLowerCase()
    .replace(/__+/g, "_");
}
