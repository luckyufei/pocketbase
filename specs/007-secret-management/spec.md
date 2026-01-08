# Feature Specification: PocketBase Secret Management (`_secrets`)

**Feature Branch**: `007-secret-management`  
**Created**: 2026-01-08  
**Status**: Ready for Dev  
**Input**: Research document: `specs/_research/secret-management.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 密钥存储与加密 (Priority: P1)

作为开发者，我希望能够安全地存储 API Keys（如 OpenAI SK），以便在代码中使用而无需硬编码或管理 `.env` 文件。

**Why this priority**: 这是 Secret Management 的核心功能，是所有其他能力的基础。

**Independent Test**: 可以通过 Admin UI 创建 Secret，然后在代码中调用 `pb.secrets.get()` 验证。

**Acceptance Scenarios**:

1. **Given** Master Key 已配置, **When** 在 Admin UI 输入 `OPENAI_API_KEY = sk-xxx`, **Then** 数据以 AES-256-GCM 加密后存入数据库
2. **Given** Secret 已存储, **When** 查看数据库 `_secrets` 表, **Then** `value` 字段为加密密文（Base64 编码）
3. **Given** Secret 已存储, **When** 调用 `pb.secrets.get("OPENAI_API_KEY")`, **Then** 返回解密后的明文 `sk-xxx`
4. **Given** Key 不存在, **When** 调用 `pb.secrets.get("NONEXISTENT")`, **Then** 抛出错误（Fail Fast）
5. **Given** 提供默认值, **When** 调用 `pb.secrets.get("NONEXISTENT", "default")`, **Then** 返回 `"default"`

---

### User Story 2 - Master Key 管理 (Priority: P1)

作为运维人员，我希望通过环境变量配置 Master Key，以便加密密钥永不落盘。

**Why this priority**: Master Key 是整个加密体系的根基，必须确保安全。

**Independent Test**: 可以通过设置/不设置 `PB_MASTER_KEY` 环境变量验证功能行为。

**Acceptance Scenarios**:

1. **Given** 未设置 `PB_MASTER_KEY`, **When** 启动 PocketBase, **Then** 服务正常启动，但 Secrets 功能不可用
2. **Given** 未设置 `PB_MASTER_KEY`, **When** 尝试创建 Secret, **Then** 返回错误提示需要配置 Master Key
3. **Given** 未设置 `PB_MASTER_KEY`, **When** 访问 Admin UI Secrets 页面, **Then** 显示提示信息引导配置
4. **Given** `PB_MASTER_KEY` 长度不足 32 字节, **When** 启动 PocketBase, **Then** 服务正常启动，但 Secrets 功能不可用并记录警告日志
5. **Given** `PB_MASTER_KEY` 配置正确, **When** 启动 PocketBase, **Then** Secrets 功能完全可用
6. **Given** 更换 `PB_MASTER_KEY`, **When** 尝试解密旧 Secrets, **Then** 解密失败（数据不可恢复）
7. **Given** 服务运行中, **When** 查看进程环境变量, **Then** `PB_MASTER_KEY` 可见（运维责任）

---

### User Story 3 - 环境隔离 (Priority: P2)

作为开发者，我希望能够为不同环境（Dev/Prod）配置不同的 Secrets，以便实现多环境管理。

**Why this priority**: 多环境隔离是企业级应用的标准需求，但不阻塞核心功能。

**Independent Test**: 可以通过创建同名但不同 `env` 的 Secrets 验证隔离。

**Acceptance Scenarios**:

1. **Given** 创建 `OPENAI_API_KEY` with `env=dev`, **When** 在 dev 环境调用 `pb.secrets.get()`, **Then** 返回 dev 环境的 Key
2. **Given** 创建 `OPENAI_API_KEY` with `env=prod`, **When** 在 prod 环境调用 `pb.secrets.get()`, **Then** 返回 prod 环境的 Key
3. **Given** 创建 `OPENAI_API_KEY` with `env=global`, **When** 在任意环境调用, **Then** 返回 global 的 Key（作为 fallback）
4. **Given** dev 和 global 都存在, **When** 在 dev 环境调用, **Then** 优先返回 dev 环境的 Key
5. **Given** 仅 global 存在, **When** 在 dev 环境调用, **Then** 返回 global 的 Key

---

### User Story 4 - Admin UI 安全交互 (Priority: P1)

作为管理员，我希望在 Admin UI 中安全地管理 Secrets，以便防止密钥泄露。

**Why this priority**: Admin UI 是主要的 Secret 管理入口，必须确保安全。

**Independent Test**: 可以通过 Admin UI 创建、查看、更新 Secret 验证交互。

**Acceptance Scenarios**:

1. **Given** 在 Admin UI 创建 Secret, **When** 输入 Value, **Then** 输入框为密码类型 `******`
2. **Given** Secret 已存储, **When** 在列表页查看, **Then** 显示掩码 `sk-proj-****************`
3. **Given** Secret 已存储, **When** 尝试查看完整值, **Then** 不提供 "Reveal" 功能
4. **Given** Secret 已存储, **When** 点击 "Overwrite", **Then** 可以输入新值覆盖
5. **Given** 在 Admin UI, **When** 查看 `_secrets` 表, **Then** 显示锁图标标识为系统安全表

---

### User Story 5 - WASM/Serverless 集成 (Priority: P1)

作为 Serverless 函数开发者，我希望通过 Host Function 获取 Secrets，以便在 WASM 环境中安全使用 API Keys。

**Why this priority**: WASM 是 PocketBase Serverless 的核心运行时，必须提供安全的 Secret 访问能力。

**Independent Test**: 可以在 WASM 函数中调用 `pb.secrets.get()` 验证。

**Acceptance Scenarios**:

1. **Given** Secret 已存储, **When** WASM 调用 `pb_secret_get("OPENAI_API_KEY")`, **Then** Host Function 返回解密后的明文
2. **Given** 解密完成, **When** 明文写入 WASM 线性内存, **Then** Go 侧立即擦除临时 buffer
3. **Given** Key 不存在, **When** WASM 调用 `pb_secret_get()`, **Then** Host Function 返回错误
4. **Given** 多个 WASM 实例, **When** 并发调用 `pb_secret_get()`, **Then** 各实例独立获取，互不干扰
5. **Given** 解密后的明文, **When** WASM 函数结束, **Then** 明文仅存在于 WASM 内存中

---

### User Story 6 - HTTP API (Priority: P1)

作为前端/客户端开发者，我希望能够通过 HTTP API 操作 Secrets，以便在 JS SDK、移动端或第三方服务中使用。

**Why this priority**: HTTP API 是 Secret 功能对外暴露的核心接口，JS SDK 依赖此能力。

**Independent Test**: 可以通过 curl 或 JS SDK 调用 HTTP 端点验证功能。

**Acceptance Scenarios**:

1. **Given** 已认证 Superuser, **When** `POST /api/secrets` with `{"key": "OPENAI_API_KEY", "value": "sk-xxx"}`, **Then** Secret 加密存储
2. **Given** Secret 已存储, **When** `GET /api/secrets/:key`, **Then** 返回解密后的值（仅 Superuser）
3. **Given** Secret 已存储, **When** `PUT /api/secrets/:key`, **Then** 可以更新 Secret 值
4. **Given** Secret 已存储, **When** `DELETE /api/secrets/:key`, **Then** Secret 被删除
5. **Given** 非 Superuser, **When** 调用任意 Secrets API, **Then** 返回 `403 Forbidden`
6. **Given** 未认证用户, **When** 调用任意 Secrets API, **Then** 返回 `401 Unauthorized`
7. **Given** Superuser, **When** `GET /api/secrets`, **Then** 返回 Secret 列表（值显示掩码）

**HTTP API 端点设计**:

```
# Secret 管理（仅 Superuser）
POST   /api/secrets           - 创建 Secret (body: {key, value, env?, description?})
GET    /api/secrets           - 列出所有 Secrets（值显示掩码）
GET    /api/secrets/:key      - 获取 Secret 值（解密）
PUT    /api/secrets/:key      - 更新 Secret 值
DELETE /api/secrets/:key      - 删除 Secret

# Serverless 内部调用（Host Function）
pb_secret_get(key)            - WASM Host Function
```

---

### Edge Cases

- Master Key 丢失后如何处理？所有 Secrets 永久无法解密，需重新创建
- Secret Value 超过 4KB 如何处理？返回 `ErrValueTooLarge` / HTTP 400
- Key 命名不规范如何处理？建议 `VENDOR_TYPE_ENV` 格式，但不强制
- 并发更新同一 Secret 如何处理？最后写入者胜出（Last Write Wins）
- 加密失败如何处理？返回错误，不存储明文
- 解密失败（密文损坏）如何处理？返回错误，记录日志

---

### Assumptions

1. Master Key 由运维人员通过环境变量安全配置
2. Master Key 丢失后数据不可恢复（设计如此）
3. Admin UI 不提供查看完整 Secret 值的功能
4. Secret Value 限制最大 4KB
5. 仅 Superuser 可以管理 Secrets
6. WASM 函数可以读取 Secrets，但不能写入
7. 日志系统会过滤 Secret 值，防止泄露

---

## Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | 支持 AES-256-GCM 加密存储 Secret | P1 | US1 |
| FR-002 | 支持通过 `pb.secrets.get()` 获取解密值 | P1 | US1 |
| FR-003 | 支持 Master Key 环境变量配置 | P1 | US2 |
| FR-004 | 缺少 Master Key 时 Secrets 功能不可用（服务正常启动） | P1 | US2 |
| FR-005 | 支持 env 字段实现环境隔离 | P2 | US3 |
| FR-006 | Admin UI 密码输入框 | P1 | US4 |
| FR-007 | Admin UI 值掩码显示 | P1 | US4 |
| FR-008 | Admin UI 禁止查看完整值 | P1 | US4 |
| FR-009 | WASM Host Function `pb_secret_get` | P1 | US5 |
| FR-010 | Go 侧解密后擦除临时 buffer | P1 | US5 |
| FR-011 | HTTP API CRUD 端点 | P1 | US6 |
| FR-012 | HTTP API 仅 Superuser 访问 | P1 | US6 |
| FR-013 | Secret Value 大小限制 4KB | P2 | - |
| FR-014 | 日志过滤 Secret 值 | P2 | - |

---

## Success Criteria

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | 加密算法安全性 | AES-256-GCM | 代码审查 |
| SC-002 | Master Key 不落盘 | 100% | 代码审查 + 安全测试 |
| SC-003 | 解密延迟 | < 1ms | Benchmark 测试 |
| SC-004 | Admin UI 无明文泄露 | 100% | 安全测试 |
| SC-005 | WASM 调用成功率 | 100% | 集成测试 |
| SC-006 | 测试覆盖率 | > 80% | go test -cover |
| SC-007 | HTTP API 响应延迟 | < 10ms (P99) | Benchmark 测试 |

---

## Schema Definition: `_secrets` Collection

这是一个系统级表，UI 上应有特殊标识（如锁图标）。

| Field | Type | Options | Description |
| --- | --- | --- | --- |
| **`key`** | `text` | Unique, Required | 键名，规范：`VENDOR_TYPE_ENV` (e.g. `OPENAI_API_KEY`) |
| **`value`** | `text` | **Encrypted** | 密文数据 (Base64 encoded blob: `Nonce (12 bytes) \|\| Ciphertext`) |
| **`env`** | `select` | `global`, `dev`, `prod` | 环境隔离标识 |
| **`description`** | `text` | Optional | 备注 (e.g. "Bill's Personal Key") |
| **`created`** | `date` | System | 创建时间 |
| **`updated`** | `date` | System | 最后更新时间 |

---

## JS SDK API 设计

### SecretsService 实现

在 `jssdk/src/services/` 目录下新增 `SecretsService.ts`：

```typescript
// jssdk/src/services/SecretsService.ts
import { BaseService } from "@/services/BaseService";
import { SendOptions } from "@/tools/options";

export interface SecretModel {
    key: string;
    value: string;      // 列表时为掩码，get 时为明文
    env: "global" | "dev" | "prod";
    description?: string;
    created: string;
    updated: string;
}

export interface SecretCreateParams {
    key: string;
    value: string;
    env?: "global" | "dev" | "prod";
    description?: string;
}

export interface SecretUpdateParams {
    value?: string;
    env?: "global" | "dev" | "prod";
    description?: string;
}

export class SecretsService extends BaseService {
    /**
     * 获取 Secret 解密值（仅 Superuser）
     */
    async get(key: string, options?: SendOptions): Promise<string> {
        return this.client
            .send(`/api/secrets/${encodeURIComponent(key)}`, {
                method: "GET",
                ...options,
            })
            .then((res) => res.value);
    }

    /**
     * 获取 Secret，不存在时返回默认值
     */
    async getWithDefault(key: string, defaultValue: string, options?: SendOptions): Promise<string> {
        try {
            return await this.get(key, options);
        } catch (err: any) {
            if (err?.status === 404) {
                return defaultValue;
            }
            throw err;
        }
    }

    /**
     * 列出所有 Secrets（值显示掩码）
     */
    async list(options?: SendOptions): Promise<SecretModel[]> {
        return this.client.send("/api/secrets", {
            method: "GET",
            ...options,
        });
    }

    /**
     * 创建 Secret
     */
    async create(params: SecretCreateParams, options?: SendOptions): Promise<SecretModel> {
        return this.client.send("/api/secrets", {
            method: "POST",
            body: params,
            ...options,
        });
    }

    /**
     * 更新 Secret
     */
    async update(key: string, params: SecretUpdateParams, options?: SendOptions): Promise<SecretModel> {
        return this.client.send(`/api/secrets/${encodeURIComponent(key)}`, {
            method: "PUT",
            body: params,
            ...options,
        });
    }

    /**
     * 删除 Secret
     */
    async delete(key: string, options?: SendOptions): Promise<boolean> {
        return this.client
            .send(`/api/secrets/${encodeURIComponent(key)}`, {
                method: "DELETE",
                ...options,
            })
            .then(() => true);
    }

    /**
     * 检查 Secret 是否存在
     */
    async exists(key: string, options?: SendOptions): Promise<boolean> {
        try {
            await this.client.send(`/api/secrets/${encodeURIComponent(key)}`, {
                method: "HEAD",
                ...options,
            });
            return true;
        } catch {
            return false;
        }
    }
}
```

### Client 集成

在 `jssdk/src/Client.ts` 中注册 SecretsService：

```typescript
// Client.ts 新增
import { SecretsService } from "@/services/SecretsService";

export default class Client {
    // ... 现有属性 ...

    /**
     * SecretsService 实例，用于管理加密密钥
     */
    readonly secrets: SecretsService;

    constructor(baseURL = "/", authStore?: BaseAuthStore | null) {
        // ... 现有初始化 ...
        this.secrets = new SecretsService(this);
    }
}
```

### 使用示例

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://localhost:8090');

// 以 Superuser 身份认证
await pb.collection('_superusers').authWithPassword('admin@example.com', 'password');

// 创建 Secret
await pb.secrets.create({
    key: 'OPENAI_API_KEY',
    value: 'sk-proj-xxx',
    env: 'prod',
    description: 'Production OpenAI Key'
});

// 获取 Secret（解密值）
const apiKey = await pb.secrets.get('OPENAI_API_KEY');
console.log(apiKey); // 'sk-proj-xxx'

// 带默认值获取
const endpoint = await pb.secrets.getWithDefault('API_ENDPOINT', 'https://api.default.com');

// 更新 Secret
await pb.secrets.update('OPENAI_API_KEY', { 
    value: 'sk-proj-new-key',
    description: 'Updated key'
});

// 列出所有 Secrets（值显示掩码）
const secrets = await pb.secrets.list();
// [{ key: 'OPENAI_API_KEY', value: 'sk-***', env: 'prod', ... }]

// 检查是否存在
const exists = await pb.secrets.exists('OPENAI_API_KEY');

// 删除 Secret
await pb.secrets.delete('OPENAI_API_KEY');
```

### TypeScript 类型导出

在 `jssdk/src/index.ts` 中导出类型：

```typescript
export { SecretsService, SecretModel, SecretCreateParams, SecretUpdateParams } from "@/services/SecretsService";
```
