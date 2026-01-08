这是为您梳理的 **PocketBase Secret Management (`_secrets`)** 需求说明书。

它遵循 **Speckit** 规范，将企业级密钥管理（类似 HashiCorp Vault 的简化版）内化为 PocketBase 的原生能力，彻底解决 AI Agent 开发中的安全隐患。

---

# Spec: PocketBase Secret Management (`_secrets`)

**Version**: 1.0.0 (Final)
**Type**: Core Security Module
**Target**: `v2.1` (Security Hardening)
**Core Concept**: Application-Level Encryption at Rest (应用层静态加密)

## 1. Problem Essence (核心问题)

AI Agent 开发强依赖第三方 API Keys（如 OpenAI SK）。目前开发者面临“两难”：

1. **硬编码**：极度不安全，代码库泄露即导致资损。
2. **环境变量**：运维僵化。修改 Key 需要重启服务，且无法实现多租户/多环境（Dev/Prod）的精细隔离。
我们需要一个动态的、加密的、对开发者透明的密钥托管中心。

## 2. Efficiency ROI (效能回报)

* **Security**: **Military Grade**. 数据库落盘的数据是 AES-256 加密的乱码。即使数据库被拖库，黑客也无法还原 Key。
* **Ops Agility**: **Hot Swap**. 在 Admin UI 更换 Key，所有运行中的 Agent 立即生效，无需重启 PocketBase 服务。
* **DX**: **Zero Config**. 开发者无需管理 `.env` 文件，代码中统一使用 `pb.secrets.get()`。

## 3. Spec/Design (系统设计)

### 3.1 Architecture: The Vault Logic (金库逻辑)

```mermaid
graph TD
    subgraph "Control Plane (PocketBase Go)"
        Admin[Admin UI] -->|1. Input Key| Crypto[Crypto Engine]
        Crypto -->|2. Encrypt (AES-GCM)| DB[(Postgres _secrets)]
        
        MasterKey[OS Env: PB_MASTER_KEY] -.->|Key Material| Crypto
    end

    subgraph "Runtime Plane (WASM/Serverless)"
        UserCode[JS Code] -->|3. Call pb.secrets.get| HostFunc[Host Function]
        HostFunc -->|4. Fetch & Decrypt| Crypto
        Crypto -->|5. Return Plaintext (Memory Only)| UserCode
    end

```

### 3.2 Encryption Strategy (加密策略)

采用 **Envelope Encryption (信封加密)** 的简化变体：

1. **Master Key (KEK)**:
* 存储于宿主机环境变量 `PB_MASTER_KEY` (32 bytes hex)。
* **决不落盘**。


2. **Data Encryption**:
* Algorithm: **AES-256-GCM** (Galois/Counter Mode)。
* Nonce: 每次加密随机生成，随密文一起存储。
* Storage Format: `Nonce (12 bytes) || Ciphertext`。



### 3.3 Schema Definition: `_secrets` Collection

这是一个系统级表，UI 上应有特殊标识（如锁图标）。

| Field | Type | Options | Description |
| --- | --- | --- | --- |
| **`key`** | `text` | Unique, Required | 键名，规范：`VENDOR_TYPE_ENV` (e.g. `OPENAI_API_KEY`) |
| **`value`** | `text` | **Encrypted** | 密文数据 (Base64 encoded blob) |
| **`env`** | `select` | `global`, `dev`, `prod` | 环境隔离标识 |
| **`description`** | `text` | Optional | 备注 (e.g. "Bill's Personal Key") |
| **`created`** | `date` | System | 创建时间 |
| **`updated`** | `date` | System | 最后更新时间 |

### 3.4 API Design (SDK)

在 Serverless (WASM) 环境中，通过 Host Function 暴露能力。

```typescript
// PocketBase-sdk definition

/**
 * 获取解密后的 Secret。
 * 如果 Key 不存在，抛出错误（Fail Fast）。
 */
const apiKey = pb.secrets.get('OPENAI_API_KEY'); 

// 支持带默认值的非敏感配置
const endpoint = pb.secrets.get('API_ENDPOINT', 'https://default.com');

```

**Host Function Logic (`pb_secret_get`)**:

1. 接收 WASM 传入的 Key 字符串指针。
2. Go 主进程查询 `_secrets` 表。
3. 利用 `PB_MASTER_KEY` 解密。
4. 将明文写入 WASM 线性内存。
5. **安全清除**: Go 侧在内存拷贝完成后，立即擦除临时解密的 buffer。

### 3.5 Admin UI Interaction (交互设计)

* **Write**: 输入框为密码类型 `******`。保存时自动触发加密。
* **Read**:
* 默认列表页显示：`sk-proj-****************` (仅显示前缀/掩码)。
* **禁止**在 UI 上直接查看完整明文（防止背后有人窥屏）。
* 支持 **"Overwrite" (覆盖)** 操作，不支持 "Reveal" (查看)。
* *Why*: 如果你忘记了 Key，就去 OpenAI 重新生成一个。安全大于便利。



## 4. Boundaries & Anti-Stupidity (边界与防愚蠢)

1. **NO Logging (日志清洗)**:
* PocketBase 的日志系统必须内置过滤器。如果检测到日志中包含 `pb.secrets.get` 返回的字符串片段，自动替换为 `[REDACTED]`。
* 虽然很难做到 100%，但要在文档中用大红字警告开发者：`console.log(apiKey)` 是违规操作。


2. **Size Limit**:
* Secrets 仅用于存储 Key、Token、ConnectionString。
* **限制**: Max 4KB。禁止把证书文件或大段 JSON 存进去（那应该用 File Storage）。


3. **Master Key Safety**:
* 如果没有配置`PB_MASTER_KEY`, 则
* 如果丢失 `PB_MASTER_KEY`，所有 Secrets 将**永久无法解密**。
* PocketBase 启动时必须检查 Master Key 是否存在，否则拒绝启动（Fail safe）。



## 5. Implementation Plan (实施计划)

1. **Core Crypto (Go)**:
* 实现 `core/security/crypto.go`：`Encrypt(text) -> blob`, `Decrypt(blob) -> text`。


2. **Schema**:
* 创建 `_secrets` 系统表。


3. **Host Function**:
* 在 WASM Runtime 注册 `pb_secret_get`。


4. **UI Component**:
* 开发 Admin UI 的 Secrets 管理面板（Masked Input）。

## 5. HTTP API

作为前端/客户端开发者，我希望能够通过 HTTP API 操作，以便在 JS SDK、移动端或第三方服务中使用