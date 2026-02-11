# API Contracts: Hook 体系 & TxApp

**Feature**: 033-pocketless-check  
**相关 FR**: FR-008, FR-009, FR-010, FR-011, FR-012

## 概述

Hook 体系补全和事务感知实例的行为契约。

---

## 新增 Hook 触发点

### Settings Hooks

```typescript
// GET /api/settings
app.onSettingsListRequest.trigger(event, async (e) => {
  // 可修改 settings 响应
  await e.next();
});

// PATCH /api/settings
app.onSettingsUpdateRequest.trigger(event, async (e) => {
  // 可修改或拒绝 settings 更新
  await e.next();
});
```

### Realtime Hooks

```typescript
// SSE 连接建立时
app.onRealtimeConnectRequest.trigger(event, async (e) => {
  // 可拒绝连接: throw new Error("rejected")
  await e.next();
});

// 客户端发送订阅请求时
app.onRealtimeSubscribeRequest.trigger(event, async (e) => {
  // 可修改订阅列表
  await e.next();
});

// 向客户端发送消息前
app.onRealtimeMessageSend.trigger(event, async (e) => {
  // 可修改消息内容或跳过发送
  await e.next();
});
```

### File Hooks

```typescript
// 文件下载请求
app.onFileDownloadRequest.trigger(event, async (e) => {
  // 可修改文件路径或拒绝下载
  await e.next();
});

// 文件 token 请求
app.onFileTokenRequest.trigger(event, async (e) => {
  await e.next();
});
```

### Batch Hook

```typescript
// 批量请求
app.onBatchRequest.trigger(event, async (e) => {
  await e.next();
});
```

### Backup Hooks

```typescript
// 创建备份
app.onBackupCreate.trigger(event, async (e) => {
  await e.next();
});

// 恢复备份
app.onBackupRestore.trigger(event, async (e) => {
  await e.next();
});
```

### Record Enrich Hook

```typescript
// Record 序列化为 JSON 响应时
app.onRecordEnrich.trigger(event, async (e) => {
  // e.record: 待序列化的记录
  // 可添加/移除/修改字段
  e.record.set("custom_field", "value");
  // 可隐藏字段
  e.record.hide("sensitive_field");
  await e.next();
});
```

---

## Error Hook 触发

### db.ts modelCreate 错误处理

```typescript
// 伪代码
async function modelCreate(app, model) {
  try {
    await app.onModelCreate.trigger(event, async () => {
      await validate(model);
      await app.onModelCreateExecute.trigger(event, async () => {
        await db.insert(model);
      });
      await app.onModelAfterCreateSuccess.trigger(event);
    });
  } catch (err) {
    // 新增: 触发 error hook
    await app.onModelAfterCreateError.trigger({
      ...event,
      error: err,
    });
    throw err;
  }
}
```

同理 `modelUpdate` 和 `modelDelete` 添加对应 error hook。

### Collection Error Hooks

```typescript
// 集合创建/更新/删除失败时
app.onCollectionAfterCreateError.trigger(event);
app.onCollectionAfterUpdateError.trigger(event);
app.onCollectionAfterDeleteError.trigger(event);
```

---

## TxApp 行为契约

### 基本用法

```typescript
await app.runInTransaction(async (txApp) => {
  // txApp 的 db() 绑定到事务
  const record1 = new RecordModel(collection);
  record1.set("title", "Post 1");
  await txApp.save(record1);  // 使用事务连接

  const record2 = new RecordModel(collection);
  record2.set("title", "Post 2");
  await txApp.save(record2);  // 使用同一事务
  
  // 如果任何操作失败，两条记录都不会被保存
});
```

### 回滚行为

```typescript
try {
  await app.runInTransaction(async (txApp) => {
    await txApp.save(record1);  // 成功
    await txApp.save(record2);  // 触发唯一约束冲突
    // → record1 也被回滚
  });
} catch (err) {
  // err 包含唯一约束冲突错误
  // 数据库中 record1 和 record2 都不存在
}
```

### 嵌套事务

```typescript
await app.runInTransaction(async (txApp) => {
  await txApp.save(record1);
  
  // 嵌套事务复用当前事务
  await txApp.runInTransaction(async (nestedTxApp) => {
    // nestedTxApp === txApp (或使用 SAVEPOINT)
    await nestedTxApp.save(record2);
  });
});
```

### isTransactional 标识

```typescript
app.isTransactional();  // false

await app.runInTransaction(async (txApp) => {
  txApp.isTransactional();  // true
});
```

---

## unsafeWithoutHooks 行为契约

```typescript
const noHookApp = app.unsafeWithoutHooks();

// 通过 noHookApp 执行的操作不触发任何 hook
await noHookApp.save(record);  // 不触发 onModelCreate / onRecordCreate
await noHookApp.delete(record);  // 不触发 onModelDelete / onRecordDelete
```
