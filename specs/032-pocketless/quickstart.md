# Quickstart: Pocketless

**Feature**: 032-pocketless  
**Date**: 2026-02-10

## 概述

Pocketless 是 PocketBase 的 Bun.js + Hono + TypeScript 版本，100% 兼容 Go 版的 REST API、数据库表结构和 SDK。

## 快速开始

### 1. 安装

```bash
# 方式 1: npx 直接运行
npx pocketless serve

# 方式 2: 全局安装
bun add -g pocketless
pocketless serve

# 方式 3: 项目依赖
bun add pocketless
```

### 2. 启动服务

```bash
# SQLite 模式（默认）
pocketless serve

# 指定端口和数据目录
pocketless serve --http=127.0.0.1:8090 --dir=./my_data

# PostgreSQL 模式
pocketless serve --pg="postgres://user:pass@localhost:5432/pocketbase"

# 开发模式
pocketless serve --dev
```

服务启动后：
- API 服务运行在 `http://localhost:8090`
- Admin UI 访问 `http://localhost:8090/_/`
- 数据库自动创建在 `./pb_data/data.db`

### 3. 创建管理员

```bash
pocketless superuser create admin@example.com MySecurePassword123
```

### 4. 使用 JS SDK

```typescript
import PocketBase from "pocketbase";

const pb = new PocketBase("http://localhost:8090");

// 认证
await pb.collection("users").authWithPassword("user@example.com", "password");

// CRUD
const record = await pb.collection("posts").create({
  title: "Hello Pocketless",
  content: "100% compatible with PocketBase",
});

// 实时订阅
pb.collection("posts").subscribe("*", (e) => {
  console.log(e.action, e.record);
});
```

## 作为库使用

```typescript
import { PocketLess } from "pocketless";

const app = new PocketLess();

// 注册 Hook
app.onRecordCreate("posts").bindFunc(async (e) => {
  console.log("New post:", e.record.get("title"));
  await e.next();
});

// 注册插件
import { register as registerSecrets } from "pocketless/plugins/secrets";
registerSecrets(app, { masterKey: process.env.PB_MASTER_KEY });

// 启动
await app.start();
```

## CLI 命令

```bash
# 启动服务
pocketless serve [domains...] --http=HOST:PORT

# 管理超级用户
pocketless superuser create|upsert|update|delete EMAIL [PASSWORD]
pocketless superuser otp EMAIL

# 数据库迁移
pocketless migrate up|down|create|collections|history-sync
```

### 全局标志

| Flag | Default | Description |
|------|---------|-------------|
| `--dir` | `./pb_data` | 数据目录 |
| `--dev` | `false` | 开发模式 |
| `--pg` | - | PostgreSQL DSN |
| `--encryptionEnv` | - | 加密密钥环境变量名 |
| `--queryTimeout` | `30` | 查询超时（秒） |
| `--http` | `127.0.0.1:8090` | 监听地址 |

## 与 Go 版互操作

Pocketless 和 Go 版 PocketBase 可以**交替启动同一个数据库**：

```bash
# Step 1: Go 版创建数据
./pocketbase serve --dir=./shared_data
# ... 创建 Collections 和 Records

# Step 2: 关闭 Go 版，启动 Pocketless
pocketless serve --dir=./shared_data
# 所有数据完整可用，无需迁移
```

**注意事项**：
- SQLite 模式下，两个版本**不能同时**连接同一数据库（WAL 锁限制）
- PostgreSQL 模式下可同时连接但**不推荐同时写入**
- 加密数据（`encryptionEnv`）两个版本完全互通

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        Pocketless                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               CLI Layer (Commander.js)                  │  │
│  │   serve | superuser | migrate                           │  │
│  └──────────┬─────────────────────────────────────────────┘  │
│             │                                                │
│  ┌──────────▼─────────────────────────────────────────────┐  │
│  │               API Layer (Hono)                          │  │
│  │  Records CRUD │ Auth (5 flows) │ Files │ SSE │ Batch   │  │
│  │  Middleware: Logger→Panic→Rate→Auth→Security→Body      │  │
│  └──────────┬─────────────────────────────────────────────┘  │
│             │                                                │
│  ┌──────────▼─────────────────────────────────────────────┐  │
│  │               Core Layer                                │  │
│  │  App │ Hook System │ Fields │ Models │ Store │ Settings │  │
│  │  Search/Filter Parser │ Subscriptions Broker            │  │
│  └──────────┬─────────────────────────────────────────────┘  │
│             │                                                │
│  ┌──────────▼─────────────────────────────────────────────┐  │
│  │          Database Abstraction Layer                      │  │
│  │  SQLite (bun:sqlite) │ PostgreSQL (Bun.SQL)             │  │
│  │  QueryBuilder (Kysely)                                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Plugin System (opt-in)                    │  │
│  │  Secrets │ Jobs │ Gateway │ KV │ Analytics │ Metrics    │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 故障排查

### 启动报错 "database is locked"

SQLite 模式下，确保没有其他进程（包括 Go 版 PocketBase）正在使用同一数据库文件。

### Go 版数据无法读取

确保两个版本使用相同的 `--encryptionEnv` 密钥。加密数据使用 AES-256-GCM，密钥不一致会导致解密失败。

### 插件路由返回 404

检查是否已注册对应插件。Pocketless 与 Go 版一样，插件需要显式注册：

```typescript
import { register as registerJobs } from "pocketless/plugins/jobs";
registerJobs(app, { workers: 10 });
```

### Admin UI 不加载

确保 `webui/dist/` 构建产物存在。开发模式下运行：

```bash
cd webui && npm run build
```

## 配置选项

| 环境变量 | Description | Default |
|---------|-------------|---------|
| `PB_POSTGRES_DSN` | PostgreSQL 连接字符串 | - |
| `PB_ENCRYPTION_KEY` | 数据库加密密钥 | - |
| `PB_DEV` | 开发模式 | `false` |
