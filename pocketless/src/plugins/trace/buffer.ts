/**
 * Trace 插件 — RingBuffer
 * 对照 Go 版 plugins/trace/buffer.go
 *
 * 线程安全的环形缓冲区，用于暂存 Span 数据。
 * 溢出时丢弃最旧数据（FIFO），并记录丢弃计数。
 */

import type { Span } from "./register";

const DEFAULT_BUFFER_SIZE = 10000;

/**
 * RingBuffer — 固定容量的环形缓冲区。
 *
 * 写满时自动覆盖最旧条目，并累计 droppedCount。
 * 通过 flush(n) 按 FIFO 顺序取出最多 n 个 Span。
 */
export class RingBuffer {
  private data: (Span | null)[];
  private head = 0;     // 读取位置
  private tail = 0;     // 写入位置
  private count = 0;    // 当前元素数量
  private readonly capacity: number;
  private dropped = 0;  // 因缓冲区满而丢弃的数量

  constructor(size: number = DEFAULT_BUFFER_SIZE) {
    this.capacity = size > 0 ? size : DEFAULT_BUFFER_SIZE;
    this.data = new Array(this.capacity).fill(null);
  }

  /** 写入 span，若满则丢弃最旧条目 */
  push(span: Span): boolean {
    if (!span) return false;

    // 缓冲区满时，覆盖最旧数据
    if (this.count === this.capacity) {
      this.head = (this.head + 1) % this.capacity;
      this.count--;
      this.dropped++;
    }

    this.data[this.tail] = span;
    this.tail = (this.tail + 1) % this.capacity;
    this.count++;
    return true;
  }

  /** 取出最多 n 个 span（FIFO 顺序），取出后从缓冲区移除 */
  flush(n: number): Span[] {
    if (this.count === 0 || n <= 0) return [];

    const toFlush = Math.min(n, this.count);
    const result: Span[] = [];

    for (let i = 0; i < toFlush; i++) {
      result.push(this.data[this.head] as Span);
      this.data[this.head] = null;
      this.head = (this.head + 1) % this.capacity;
      this.count--;
    }

    return result;
  }

  /** 清空所有条目 */
  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.data[i] = null;
    }
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  len(): number {
    return this.count;
  }

  cap(): number {
    return this.capacity;
  }

  /** 因缓冲区满而丢弃的 span 总数 */
  droppedCount(): number {
    return this.dropped;
  }
}
