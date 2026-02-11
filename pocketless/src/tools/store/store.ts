/**
 * Store — 并发安全 KV 存储
 * 与 Go 版 store.Store 对齐
 */

export class Store<T = unknown> {
  private data: Map<string, T> = new Map();

  /** 获取值 */
  get(key: string): T | undefined {
    return this.data.get(key);
  }

  /** 获取值，不存在则使用工厂函数创建并存储 */
  getOrSet(key: string, factory: () => T): T {
    let value = this.data.get(key);
    if (value === undefined) {
      value = factory();
      this.data.set(key, value);
    }
    return value;
  }

  /** 设置值 */
  set(key: string, value: T): void {
    this.data.set(key, value);
  }

  /** 是否存在键 */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /** 删除键 */
  delete(key: string): void {
    this.data.delete(key);
  }

  /** 获取所有数据 */
  getAll(): Map<string, T> {
    return new Map(this.data);
  }

  /** 清空所有数据 */
  reset(): void {
    this.data.clear();
  }

  /** 获取数据数量 */
  length(): number {
    return this.data.size;
  }

  /** 遍历所有键值对 */
  forEach(fn: (value: T, key: string) => void): void {
    this.data.forEach(fn);
  }
}
