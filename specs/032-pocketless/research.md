# Research: Pocketless — Bun.js 版 PocketBase

**Feature**: 032-pocketless  
**Date**: 2026-02-10

---

## 1. bun:sqlite WAL 模式与 Go 版兼容性

### Decision
使用 `bun:sqlite` 原生 API，启用 WAL 模式 + 写入 Mutex，PRAGMA 设置与 Go 版完全对齐。

### Rationale
- bun:sqlite 是 Bun 内置的 SQLite 绑定（基于 libsql），同步 API，性能 3-6x 优于 better-sqlite3
- Go 版使用 `modernc.org/sqlite`（纯 Go 实现），两者底层都是 SQLite 3.x
- WAL 模式下两个版本产生的 data.db 文件格式完全相同

### Implementation Details

```typescript
import { Database } from "bun:sqlite";

const db = new Database("./pb_data/data.db", { create: true, strict: true });

// 与 Go 版完全一致的 PRAGMA 设置
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 10000");
db.run("PRAGMA foreign_keys = ON");
db.run("PRAGMA cache_size = -16000");      // 16MB cache
db.run("PRAGMA synchronous = NORMAL");
```

### Key Differences
- Go 版使用双连接（concurrent + nonconcurrent），bun:sqlite 使用单实例 + 写 Mutex
- bun:sqlite 是同步 API，不会出现 async 导致的竞态问题
- bun:sqlite 支持 `db.transaction()` 语法糖

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| better-sqlite3 | 需要编译原生模块，与 `bun build --compile` 不兼容 |
| sql.js (wasm) | 不支持 WAL 模式，性能差 |
| libsql (turso) | 引入额外依赖，功能超出需求 |

---

## 2. PostgreSQL 连接：Bun.SQL vs pg/node-postgres

### Decision
使用 Bun 内置的 `Bun.SQL` API 连接 PostgreSQL。

### Rationale
- Bun 1.2+ 内置 SQL 支持，零额外依赖
- 自带连接池管理（max/idle 配置）
- 与 bun:sqlite 同属 Bun 原生 API，架构统一

### Implementation Details

```typescript
import { SQL } from "bun";

const db = new SQL({
  url: "postgres://user:pass@localhost:5432/pocketbase",
  max: 25,        // 最大连接数（Go 版默认 25）
  idleTimeout: 300, // 空闲超时 5 分钟
});

// 初始化 PG 扩展（与 Go 版对齐）
await db.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
await db.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| pg (node-postgres) | 额外依赖，Bun.SQL 已内置 |
| postgres.js (porsager) | 良好但 Bun.SQL 更原生 |
| drizzle-orm/pg | ORM 层不适合动态 schema |

---

## 3. Kysely 查询构建器 + DBAdapter 封装

### Decision
使用 Kysely 作为查询构建器，但通过 `QueryBuilder` 接口封装为与 Go 版 `dbx` 兼容的 API。

### Rationale
- PocketBase 的 Collection/Field 是动态 schema（运行时用户定义），Drizzle 的静态 schema 不适用
- Kysely 支持动态查询构建、多方言、类型安全
- 封装层允许在 Kysely 无法表达的查询场景中 fallback 到 raw SQL

### Implementation Details

```typescript
import { Kysely, SqliteDialect, PostgresDialect } from "kysely";

// QueryBuilder 包装
export interface QueryBuilder {
  newQuery(sql: string): QueryExecutor;
  select(...columns: string[]): SelectQueryBuilder;
  insert(table: string): InsertQueryBuilder;
  update(table: string): UpdateQueryBuilder;
  deleteFrom(table: string): DeleteQueryBuilder;
  transaction<T>(fn: (tx: QueryBuilder) => Promise<T>): Promise<T>;
}

// Kysely 方言配置
// SQLite
const sqliteDialect = new SqliteDialect({ database: bunSqliteDb });
// PostgreSQL
const pgDialect = new PostgresDialect({ pool: bunSqlPool });
```

### Key Design: DBAdapter 抽象差异

```typescript
export interface DBAdapter {
  type(): "sqlite" | "postgres";
  
  // 类型差异
  boolValue(val: any): boolean;          // SQLite: truthy, PG: boolean
  formatBool(val: boolean): any;          // SQLite: 0/1, PG: true/false
  formatTime(val: Date): string;          // SQLite: "Y-m-d H:i:s.000Z", PG: ISO
  
  // JSON 函数差异
  jsonExtract(column: string, path: string): string;  // JSON_EXTRACT vs ->>
  jsonArrayLength(column: string): string;             // JSON_ARRAY_LENGTH vs jsonb_array_length
  
  // 排序差异
  noCaseCollation(): string;              // COLLATE NOCASE vs COLLATE "default"
  
  // 错误检测差异
  isUniqueViolation(err: Error): boolean;
  isForeignKeyViolation(err: Error): boolean;
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Drizzle ORM | 静态 schema 不适合 PocketBase 动态集合 |
| Knex.js | 功能足够但 Kysely 类型安全更好 |
| Raw SQL only | 维护成本高，容易出现 SQL 注入 |

---

## 4. JWT 签发/验证：jose 库

### Decision
使用 `jose` 库处理所有 JWT 操作（签发、验证、解码）。

### Rationale
- 完整实现 JOSE 标准（JWS, JWE, JWK, JWT）
- Go 版使用 HS256 签名，jose 完整支持
- 纯 TypeScript 实现，无原生依赖
- 积极维护，无已知安全漏洞

### Implementation Details

```typescript
import * as jose from "jose";

// 签发 JWT（与 Go 版 Claims 完全对齐）
const secret = new TextEncoder().encode(signingKey);
const jwt = await new jose.SignJWT({
  id: record.id,
  type: "auth",
  collectionId: collection.id,
  refreshable: true,
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime(expiry)
  .sign(secret);

// 验证 JWT
// 先解码获取 id → 查询 record → 用 record.tokenKey 构建密钥 → 验证
const { payload } = await jose.jwtVerify(token, secret);
```

### Key Compatibility: 5 种 Token 类型

| Type | Signing Key Structure |
|------|----------------------|
| auth | `record.tokenKey + collection.authToken.secret` |
| file | `record.tokenKey + collection.fileToken.secret` |
| verification | `record.tokenKey + collection.verificationToken.secret` |
| passwordReset | `record.tokenKey + collection.passwordResetToken.secret` |
| emailChange | `record.tokenKey + collection.emailChangeToken.secret` |

Go 版签发的 Token 必须能被 Pocketless 验证，反之亦然。密钥结构完全一致确保互通。

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| jsonwebtoken | 安全维护不如 jose，不支持完整 JOSE 标准 |
| node:crypto 手动实现 | 过于底层，容易出错 |
| fast-jwt | 功能够用但社区不如 jose |

---

## 5. 密码哈希：Bun.password 兼容性

### Decision
使用 `Bun.password.hash()` 和 `Bun.password.verify()` 进行 bcrypt 操作。

### Rationale
- Bun 原生内置，零依赖
- 支持 bcrypt 和 argon2id
- Go 版使用标准 bcrypt (cost=12)，Bun.password 完全兼容

### Implementation Details

```typescript
// 哈希（与 Go 版 cost=12 对齐）
const hash = await Bun.password.hash(password, {
  algorithm: "bcrypt",
  cost: 12,
});

// 验证（可验证 Go 版产生的 bcrypt 哈希）
const isValid = await Bun.password.verify(password, goGeneratedHash);
```

### Compatibility Verification
bcrypt 输出格式为 `$2a$12$...` 或 `$2b$12$...`，两个版本的哈希互相可验证。Go 版使用 `golang.org/x/crypto/bcrypt` 输出 `$2a$`，Bun.password 输出 `$2b$`，但验证时两者均能互相识别。

---

## 6. AES-256-GCM 加密互通

### Decision
使用 `node:crypto` 实现 AES-256-GCM，密钥派生和 nonce 格式与 Go 版完全对齐。

### Rationale
- Go 版使用 `crypto/aes` + `cipher.NewGCM`
- node:crypto 的 `createCipheriv('aes-256-gcm')` 完全兼容
- 两者都使用 12 字节 nonce + 16 字节 auth tag

### Implementation Details

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// 加密（与 Go 版 security.Encrypt 对齐）
function encrypt(data: string, key: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(key), nonce);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 格式: nonce(12) + ciphertext + tag(16) → base64
  return Buffer.concat([nonce, encrypted, tag]).toString("base64");
}

// 解密（可解密 Go 版加密的数据）
function decrypt(encoded: string, key: string): string {
  const buf = Buffer.from(encoded, "base64");
  const nonce = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(key), nonce);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
```

### Critical: Key Derivation
Go 版的密钥派生方式必须精确对齐。Go 版使用 SHA256 对 encryptionKey 做哈希得到 32 字节密钥：

```go
// Go 版 security.Encrypt
hash := sha256.Sum256([]byte(key))
block, _ := aes.NewCipher(hash[:])
```

TypeScript 对应：

```typescript
import { createHash } from "node:crypto";
function deriveKey(key: string): Buffer {
  return createHash("sha256").update(key).digest();
}
```

---

## 7. 过滤表达式解析器 (fexpr) 移植

### Decision
手动移植 Go 版 `ganigeorgiev/fexpr` 解析器到 TypeScript。

### Rationale
- fexpr 是 PocketBase 的核心组件，必须 100% 语法兼容
- 没有现成的 JS 库能完全覆盖 fexpr 的语法（Any 变体、修饰符、宏等）
- Go 版有 200+ 测试用例可直接移植作为验证

### Implementation Details

fexpr 的核心是一个递归下降解析器：

```
Expression = Group { ("&&" | "||") Group }
Group      = "(" Expression ")" | Term
Term       = Identifier Operator Value
Identifier = "@request.auth.id" | "name" | "tags:each" | ...
Operator   = "=" | "!=" | ">" | ">=" | "<" | "<=" | "~" | "!~"
           | "?=" | "?!=" | "?>" | ... (Any variants)
Value      = String | Number | Boolean | Identifier
```

关键组件：
1. **Scanner/Tokenizer** — 词法分析，处理字符串引号、转义、标识符
2. **Parser** — 递归下降，生成 AST
3. **FieldResolver** — 将字段路径解析为 SQL 列引用，处理 JOIN
4. **FilterResolver** — 将 AST 转换为 SQL WHERE 子句

### Complexity
- 8 标准运算符 + 8 Any 变体 = 16 运算符
- 5 修饰符（:isset, :changed, :length, :each, :lower）
- 17 日期宏（@now, @yesterday, @todayStart, ...）
- 2 函数（geoDistance, strftime）
- 特殊标识符（@request.*, @collection.*）

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| 使用 PEG.js/Ohm | 生成的解析器不够灵活，难以完全对齐 fexpr 语法 |
| 调用 Go 编译的 WASM | 架构不合理，性能损耗 |
| 使用 SQL 解析库 | fexpr 不是标准 SQL，是自定义 DSL |

---

## 8. OAuth2 提供商策略

### Decision
使用 `arctic` 库作为 OAuth2 基础，编写适配层对齐 Go 版 `BaseProvider` 接口。

### Rationale
- arctic 支持 50+ 提供商，覆盖 Go 版的 35+ 提供商
- 轻量级（无重型依赖），积极维护
- 需要适配层将 arctic 的接口映射到 Go 版的 `BaseProvider` 接口

### Implementation Details

```typescript
// Go 版接口
interface AuthProvider {
  displayName(): string;
  clientId(): string;
  clientSecret(): string;
  redirectURL(): string;
  authURL(): string;
  tokenURL(): string;
  userInfoURL(): string;
  fetchAuthUser(token: AuthToken): Promise<AuthUser>;
}

// 适配层示例
class GoogleProvider implements AuthProvider {
  private arctic: GoogleOAuth2;  // from arctic

  async fetchAuthUser(token: AuthToken): Promise<AuthUser> {
    const arcticUser = await this.arctic.getUser(token.accessToken);
    // 映射到 Go 版的 AuthUser 格式
    return {
      id: arcticUser.sub,
      name: arcticUser.name,
      email: arcticUser.email,
      avatarURL: arcticUser.picture,
      rawUser: arcticUser,
    };
  }
}
```

### Coverage Analysis
arctic 覆盖了 Go 版全部 35+ 提供商。少数提供商（如 Lark/飞书、Gitee）可能需要自定义实现。

---

## 9. 图片缩略图生成

### Decision
使用 `sharp` 库生成缩略图。

### Rationale
- Go 版使用标准库 `image` 包 + 第三方 resize 库
- sharp 基于 libvips，性能极佳（比 canvas 快 10x）
- 支持 JPEG, PNG, WebP, AVIF, GIF
- 6 种缩略图格式需要精确对齐

### Implementation Details

6 种缩略图格式：

| Format | Behavior | sharp API |
|--------|----------|-----------|
| `WxH` | 缩放填充 + 居中裁剪 | `resize(W, H, { fit: 'cover' })` |
| `WxHt` | 顶部对齐裁剪 | `resize(W, H, { fit: 'cover', position: 'top' })` |
| `WxHb` | 底部对齐裁剪 | `resize(W, H, { fit: 'cover', position: 'bottom' })` |
| `WxHf` | 缩放适应（不裁剪） | `resize(W, H, { fit: 'inside' })` |
| `0xH` | 按高度缩放 | `resize(null, H)` |
| `Wx0` | 按宽度缩放 | `resize(W, null)` |

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| jimp | 纯 JS 实现，性能差 |
| canvas (node-canvas) | 需要 Cairo，原生依赖重 |
| Bun 内置图片 API | 尚不支持缩放/裁剪 |

---

## 10. 单二进制编译策略

### Decision
使用 `bun build --compile` 编译为单个可执行文件。

### Rationale
- Bun 原生支持将 TS 项目编译为单二进制
- 嵌入 Admin UI 静态文件通过 Bun 的 embed 特性
- 输出文件约 50-80MB（含 Bun 运行时）

### Implementation Details

```bash
# 编译命令
bun build --compile --minify src/pocketless.ts --outfile pocketless

# 嵌入静态文件（Admin UI）
# 方式 1: Bun 的 embed 特性
import adminUI from "./webui/dist" with { type: "file" };

# 方式 2: 编译时打包
bun build --compile --asset-naming="[name]-[hash].[ext]" \
  --embed ./webui/dist
```

### Size Estimation
- Bun 运行时: ~50MB
- 应用代码: ~5MB
- Admin UI: ~10MB
- 总计: ~65MB

### Cross-platform
```bash
# Linux x64
bun build --compile --target=bun-linux-x64 src/pocketless.ts --outfile pocketless-linux
# macOS ARM
bun build --compile --target=bun-darwin-arm64 src/pocketless.ts --outfile pocketless-macos
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| pkg (vercel) | 已停止维护 |
| nexe | 不支持 Bun |
| Docker 容器 | 不是"单二进制"，违反部署简便性要求 |

---

## 11. SSE 实时订阅实现

### Decision
使用 Bun 原生 `ReadableStream` 实现 SSE，不依赖第三方库。

### Rationale
- Bun 对 Web Streams API 有原生支持
- SSE 协议简单（text/event-stream），无需库
- 需要精确控制连接管理（分块广播、权限检查、超时）

### Implementation Details

```typescript
// SSE 连接
app.get("/api/realtime", (c) => {
  const stream = new ReadableStream({
    start(controller) {
      const client = broker.register(controller);
      // 发送 clientId
      controller.enqueue(`data: ${JSON.stringify({ clientId: client.id })}\n\n`);
    },
    cancel() {
      broker.unregister(clientId);
    },
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
```

### Broadcast Strategy (与 Go 版对齐)
1. 分块处理客户端（150/chunk），避免大循环阻塞
2. 每个客户端检查订阅匹配 + API 规则权限
3. 删除操作使用 "dry cache" 模式（删前缓存消息）
4. 5 分钟空闲超时自动断开

---

## 12. npm 包发布策略

### Decision
单包发布 (`pocketless`)。

### Rationale
- PocketBase Go 版就是单仓库单包
- Pocketless 作为完整后端服务，不需要拆分
- 用户使用 `npx pocketless serve` 或 `import { PocketLess } from "pocketless"` 即可

### Package Structure
```json
{
  "name": "pocketless",
  "bin": { "pocketless": "./dist/cli.js" },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./core": "./dist/core/index.js",
    "./plugins/*": "./dist/plugins/*/index.js"
  }
}
```
