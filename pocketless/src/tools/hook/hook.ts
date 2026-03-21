/**
 * Hook 系统 — 洋葱模型链式调用
 * 与 Go 版 tools/hook 一一对应
 */

export interface Handler<T> {
  id: string;
  priority: number;
  func: (event: T) => Promise<void>;
  tags?: string[];
}

/**
 * Hook — 通用事件钩子
 * 支持优先级排序、Handler ID 绑定/解绑、洋葱模型（反向链式）调用
 */
export class Hook<T> {
  protected handlers: Handler<T>[] = [];

  /** 绑定 Handler（函数式，返回自动生成的 ID） */
  bindFunc(fn: (event: T) => Promise<void>, priority: number = 0): string {
    const id = `__handler_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.handlers.push({ id, priority, func: fn });
    this.sortHandlers();
    return id;
  }

  /** 绑定 Handler（带 ID，覆盖同 ID） */
  bind(handler: Handler<T>): void {
    this.handlers = this.handlers.filter((h) => h.id !== handler.id);
    this.handlers.push(handler);
    this.sortHandlers();
  }

  /** 解绑 Handler */
  unbind(id: string): void {
    this.handlers = this.handlers.filter((h) => h.id !== id);
  }

  /**
   * 触发所有 Handler（洋葱模型）
   * 每个 Handler 必须调用 event.next() 才能继续链
   */
  async trigger(event: T & { next: () => Promise<void> }, filterTags?: string[]): Promise<void> {
    const originalNext = event.next;
    const filtered = filterTags
      ? this.handlers.filter((h) => !h.tags || h.tags.length === 0 || h.tags.some((t) => filterTags.includes(t)))
      : this.handlers;

    if (filtered.length === 0) {
      await originalNext();
      return;
    }

    const sorted = [...filtered];
    let index = 0;

    const executeNext = async (): Promise<void> => {
      if (index >= sorted.length) {
        await originalNext();
        return;
      }
      const handler = sorted[index++];
      (event as Record<string, unknown>).next = executeNext;
      await handler.func(event);
    };

    await executeNext();
  }

  /** 获取 Handler 数量 */
  length(): number {
    return this.handlers.length;
  }

  /** 清除所有 Handler */
  reset(): void {
    this.handlers = [];
  }

  /** 获取所有 Handler（只读） */
  getHandlers(): readonly Handler<T>[] {
    return this.handlers;
  }

  protected sortHandlers(): void {
    this.handlers.sort((a, b) => a.priority - b.priority);
  }
}

/**
 * TaggedHook — 标签过滤钩子
 * 当通过 onRecordCreate("users") 注册 handler 时，handler 会携带 tags=["users"]
 * 触发时通过 tags 过滤匹配的 handler
 */
export class TaggedHook<T> extends Hook<T> {
  private _boundTags: string[];

  constructor(...tags: string[]) {
    super();
    this._boundTags = tags;
  }

  /** 获取绑定的标签 */
  getTags(): string[] {
    return [...this._boundTags];
  }

  /** 检查是否匹配给定标签 */
  matchesTags(targetTags: string[]): boolean {
    if (this._boundTags.length === 0) return true;
    return this._boundTags.some((tag) => targetTags.includes(tag));
  }

  /** 绑定带标签的 Handler */
  bindFuncWithTags(fn: (event: T) => Promise<void>, tags: string[], priority: number = 0): string {
    const id = `__handler_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.handlers.push({ id, priority, func: fn, tags });
    this.sortHandlers();
    return id;
  }
}

/**
 * TaggedHookView — 具有特定标签的 TaggedHook 视图
 * 通过此视图绑定的 handler 自动携带标签
 * 此对象共享底层 TaggedHook 的 handlers 数组
 */
export class TaggedHookView<T> {
  private _hook: TaggedHook<T>;
  private _tags: string[];

  constructor(hook: TaggedHook<T>, tags: string[]) {
    this._hook = hook;
    this._tags = tags;
  }

  /** 绑定 Handler — 自动关联标签 */
  bindFunc(fn: (event: T) => Promise<void>, priority: number = 0): string {
    return this._hook.bindFuncWithTags(fn, this._tags, priority);
  }

  /** 绑定 Handler（带 ID） */
  bind(handler: Omit<Handler<T>, "tags"> & { tags?: string[] }): void {
    this._hook.bind({ ...handler, tags: handler.tags ?? this._tags });
  }

  /** 解绑 Handler */
  unbind(id: string): void {
    this._hook.unbind(id);
  }

  /** 触发（仅匹配当前标签的 handler） */
  async trigger(event: T & { next: () => Promise<void> }): Promise<void> {
    await this._hook.trigger(event, this._tags);
  }

  /** 获取此视图的标签 */
  getTags(): string[] {
    return [...this._tags];
  }
}
