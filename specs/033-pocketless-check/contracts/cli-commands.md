# API Contracts: CLI 命令

**Feature**: 033-pocketless-check  
**相关 FR**: FR-022, FR-023

## 概述

`superuser` 和 `migrate` CLI 命令的完整执行逻辑契约。

---

## superuser create

```bash
pocketless superuser create admin@example.com password123
```

**行为**:
1. Bootstrap app (初始化数据库)
2. 在 `_superusers` 集合中查找是否已存在该 email
3. 如果已存在 → 错误退出
4. 创建新 Record：email + bcrypt(password) + tokenKey + verified=true
5. 调用 `app.save(record)`
6. 输出: `Successfully created superuser "admin@example.com"!`

**错误**:
- email 格式无效 → `Error: Invalid email format.`
- 密码太短 (< 8 chars) → `Error: Password must be at least 8 characters.`
- 已存在 → `Error: Superuser with email "admin@example.com" already exists.`

---

## superuser upsert

```bash
pocketless superuser upsert admin@example.com password123
```

**行为**: 与 create 相同，但如果已存在则更新密码。

---

## superuser update

```bash
pocketless superuser update admin@example.com newpassword123
```

**行为**:
1. 查找该 email 的 superuser record
2. 不存在 → 错误
3. 更新密码 hash + tokenKey
4. `app.save(record)`

---

## superuser delete

```bash
pocketless superuser delete admin@example.com
```

**行为**:
1. 查找该 email 的 superuser record
2. 不存在 → 错误
3. `app.delete(record)`

---

## superuser otp

```bash
pocketless superuser otp admin@example.com
```

**行为**:
1. 查找该 email 的 superuser record
2. 创建 OTP 记录
3. 输出: `OTP: 123456 (valid for 5 minutes)`

---

## migrate up

```bash
pocketless migrate up
```

**行为**:
1. 读取 migrations 目录（默认 `pb_migrations/`）
2. 查询 `_migrations` 表获取已执行的迁移列表
3. 找出未执行的迁移文件，按文件名排序
4. 逐个执行每个迁移的 `up()` 函数
5. 每成功执行一个，写入 `_migrations` 表
6. 输出: `Applied N migration(s).`

---

## migrate down

```bash
pocketless migrate down [count]
```

**行为**:
1. 查询 `_migrations` 表获取已执行列表
2. 取最后 `count` 个（默认 1）
3. 逐个执行对应迁移的 `down()` 函数
4. 从 `_migrations` 表删除记录
5. 输出: `Reverted N migration(s).`

---

## migrate create

```bash
pocketless migrate create add_user_avatar
```

**行为**:
1. 在 migrations 目录创建文件: `{timestamp}_add_user_avatar.ts`
2. 文件内容为迁移模板

**模板**:
```typescript
import { type App } from "../src/core/base";

export async function up(app: App): Promise<void> {
  // Add migration logic here
}

export async function down(app: App): Promise<void> {
  // Add rollback logic here
}
```

---

## migrate collections

```bash
pocketless migrate collections
```

**行为**:
1. 读取当前所有集合定义
2. 生成一个迁移文件，包含创建所有集合的代码
3. 输出: `Created collections migration: {timestamp}_collections_snapshot.ts`

---

## migrate history-sync

```bash
pocketless migrate history-sync
```

**行为**:
1. 比较 `_migrations` 表记录与文件系统中的迁移文件
2. 删除不存在于文件系统的记录
3. 输出: `Synced migration history. Removed N stale record(s).`
