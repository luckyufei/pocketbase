/**
 * TxApp — 事务感知的 App 实例
 * 与 Go 版 core/base.go 的 txApp 对齐
 * 浅拷贝 BaseApp，将 db() 绑定到事务连接
 */

import type { BaseApp } from "./base";
import type { DBAdapter } from "./db_adapter";
import type { QueryBuilder } from "./db_builder";

/**
 * 创建事务感知的 App 代理
 * 所有通过此代理执行的 DB 操作自动使用事务连接
 */
export function createTxApp(parentApp: BaseApp, txAdapter: DBAdapter): BaseApp {
  const txApp = Object.create(Object.getPrototypeOf(parentApp));
  Object.assign(txApp, parentApp);

  txApp._isTransactional = true;

  // 覆盖 dbAdapter() 返回事务适配器
  txApp.dbAdapter = () => txAdapter;

  // 覆盖 isTransactional()
  txApp.isTransactional = () => true;

  // 嵌套事务: 如果已在事务中，直接复用（对齐 Go 版行为）
  txApp.runInTransaction = async <T>(fn: (txApp: BaseApp) => Promise<T>): Promise<T> => {
    return fn(txApp);
  };

  return txApp;
}
