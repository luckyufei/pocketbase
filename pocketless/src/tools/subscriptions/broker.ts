/**
 * Broker — 订阅客户端管理器
 * 与 Go 版 subscriptions.Broker 对齐
 */

import { Store } from "../store/store";
import type { Client } from "./client";

export class Broker {
  private store = new Store<Client>();

  /** 返回所有已注册客户端的浅拷贝 */
  clients(): Map<string, Client> {
    return this.store.getAll();
  }

  /** 将客户端分成指定大小的分块 */
  chunkedClients(chunkSize: number): Client[][] {
    const values = Array.from(this.store.getAll().values());
    if (values.length === 0) return [];

    const chunks: Client[][] = [];
    for (let i = 0; i < values.length; i += chunkSize) {
      chunks.push(values.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /** 返回已注册客户端总数 */
  totalClients(): number {
    return this.store.length();
  }

  /** 根据 ID 查找已注册客户端 */
  clientById(clientId: string): Client {
    const client = this.store.get(clientId);
    if (!client) {
      throw new Error(`no client associated with connection ID "${clientId}"`);
    }
    return client;
  }

  /** 注册新客户端 */
  register(client: Client): void {
    this.store.set(client.id(), client);
  }

  /** 注销客户端并标记为已废弃 */
  unregister(clientId: string): void {
    const client = this.store.get(clientId);
    if (!client) return;
    client.discard();
    this.store.delete(clientId);
  }
}
