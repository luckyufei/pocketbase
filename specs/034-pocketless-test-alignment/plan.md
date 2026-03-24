# 规范: PocketLess 单测对齐计划

**Feature Branch**: `034-pocketless-test-alignment`  
**Created**: 2026-03-24  
**Status**: Active  
**Goal**: 确保 PocketLess (Bun.js 版) 与 PocketBase (Go 版) 的协议完全对齐，通过逐一分析 Go 版单测并在 PocketLess 中补充缺失或不一致的单测

---

## 📊 项目概览

### 测试现状对比

| 指标 | PocketBase (Go) | PocketLess (Bun) | 差异 |
|------|-----------------|-----------------|------|
| 源文件数 | 434 | 135 | Go 版 3.2 倍 |
| 测试文件数 | 331 | 128 | Go 版 2.6 倍 |
| APIs 包测试 | 37 个文件 | 16 个文件 | **缺 21 个** ⚠️ |
| Core 包测试 | 90 个文件 | 44 个文件 | **缺 46 个** ⚠️ |
| Tools 包测试 | 79 个文件 | 19 个文件 | **缺 60 个** ⚠️ |
| **总缺失** | — | — | **~127 个测试文件** |

### 核心问题

1. **APIs 层缺失** (缺 21 个测试文件):
   - Record Authentication (12 个认证相关测试)
   - Collection Import (1 个)
   - Middlewares (3 个)
   - 其他 (5 个)

2. **Core 层缺失** (缺 46 个测试文件):
   - Database Adapters (15 个)
   - Collection & Field (15 个)
   - Record Models (8 个)
   - Advanced Features (8 个)

3. **Tools 层缺失** (缺 60 个测试文件):
   - Filesystem (3 个)
   - Security (7 个)
   - Types (8 个)
   - Others (42 个)

---

## 🎯 实施策略

### 阶段划分 (5 个阶段，优先级递减)

```
Phase 1: APIs 认证与权限 (Priority: P1)
├─ Record Auth Methods (3 个测试文件)
├─ Record Auth Password (4 个测试文件)
├─ Record Auth OAuth2 (2 个测试文件)
├─ Record Auth OTP (2 个测试文件)
├─ Record Auth Email/Verification (2 个测试文件)
└─ 预计任务数: 13 个

Phase 2: APIs CRUD 与基础设施 (Priority: P1)
├─ Record CRUD (5 个测试文件，含 external auth/mfa/secret/superuser/otp)
├─ Collection (2 个测试文件)
├─ Batch & Realtime (2 个测试文件)
├─ Middlewares (3 个测试文件，含 rate limit)
├─ Logs & Backup (2 个测试文件)
└─ 预计任务数: 14 个

Phase 3: Core 数据库与字段 (Priority: P1)
├─ Database Adapters (15 个测试文件)
├─ Collection & Field Models (15 个测试文件)
├─ Record Models & Expand (8 个测试文件)
└─ 预计任务数: 38 个

Phase 4: Core 高级特性 (Priority: P2)
├─ Advanced Database Features (WAL, RLS, Pubsub 等)
├─ Auth Origins & External Auth (4 个测试文件)
├─ MFA, OTP, Crypto (6 个测试文件)
└─ 预计任务数: 12 个

Phase 5: Tools 工具库 (Priority: P2)
├─ Security (Crypto, JWT, Password, Random)
├─ Types (DateTime, GeoPoint, JSON)
├─ Filesystem (S3, Archive, Local)
├─ Search & Router
├─ Auth Providers (35+ providers)
└─ 预计任务数: 64 个
```

### 每个阶段的工作流

1. **分析阶段** (15-20 分钟)
   - 列出 Go 版该部分的所有测试文件
   - 逐一分析每个测试文件的关键测试场景
   - 创建"测试场景清单"文档

2. **对比阶段** (10-15 分钟)
   - 检查 PocketLess 中是否已有对应测试
   - 标记"已实现"、"部分实现"、"完全缺失"

3. **实现阶段** (45-90 分钟)
   - 优先实现 P1 缺失测试 (关键功能)
   - 为每个缺失测试创建独立的测试文件或补充到现有文件

4. **验证阶段** (10-20 分钟)
   - 运行所有新增测试：`bun test`
   - 对比测试结果与 Go 版行为

5. **文档更新** (5 分钟)
   - 更新本规范，标记该阶段为"已完成"
   - 记录发现的协议差异或 Bug

---

## 📋 Phase 1: APIs 认证与权限 (详细规划)

### 1.1 Record Auth Methods Tests

**Go 版文件**: `apis/record_auth_methods_test.go`

**关键测试场景**:
```
✓ GET /api/collections/users/auth-methods
  - 验证返回 authProviders 列表
  - 验证返回 emailPassword 配置
  - 验证返回 mfa 配置

✓ Auth 集合列表端点
  - 非 Auth 集合返回 404
  - Auth 集合返回 authProviders

✓ Token Types (5 种)
  - auth token
  - file token
  - verification token
  - passwordReset token
  - emailChange token
```

**PocketLess 现状**: ❌ 缺失（需新建 `src/apis/record_auth_methods.test.ts`）

**预计工作量**: 1 小时

---

### 1.2 Record Auth Password Tests

**Go 版文件**: 
- `apis/record_auth_with_password_test.go`
- `apis/record_auth_password_reset_request_test.go`
- `apis/record_auth_password_reset_confirm_test.go`
- `apis/record_auth_email_change_request_test.go`

**关键测试场景**:

```
✓ POST /api/collections/users/auth-with-password
  - 正确凭证返回 token + record
  - 错误密码返回 400
  - 不存在的 identity 返回 400
  - MFA 启用返回 mfaId

✓ POST /api/collections/users/auth-refresh
  - 有效 token 返回新 token
  - 过期 token 返回 401
  - 无效 token 返回 401

✓ POST /api/collections/users/request-password-reset
  - 发送重置邮件
  - 生成重置 token
  - 返回 204 No Content

✓ POST /api/collections/users/confirm-password-reset
  - 验证重置 token
  - 更新密码
  - 返回 token + record

✓ POST /api/collections/users/request-email-change
✓ POST /api/collections/users/confirm-email-change
```

**PocketLess 现状**: ✅ 部分实现（`record_auth_password.test.ts` 存在，但可能缺少某些场景）

**预计工作量**: 2-3 小时（补充缺失场景）

---

### 1.3 Record Auth OAuth2 Tests

**Go 版文件**: 
- `apis/record_auth_with_oauth2_test.go`
- `apis/record_auth_with_oauth2_redirect_test.go`

**关键测试场景**:

```
✓ GET /api/collections/users/oauth2-authorize
  - 返回 OAuth2 provider URL
  - 验证 state 参数

✓ GET /api/collections/users/oauth2-callback
  - 交换 code 获取 token
  - 创建或关联用户
  - 返回 auth token

✓ 35+ OAuth2 Provider 支持
  - Google, GitHub, Apple, Discord 等
  - 每个 provider 的 token 映射规则
```

**PocketLess 现状**: ✅ 部分实现（`record_auth_oauth2.test.ts` 存在）

**预计工作量**: 2-3 小时

---

### 1.4 Record Auth OTP Tests

**Go 版文件**: 
- `apis/record_auth_otp_request_test.go`
- `apis/record_crud_otp_test.go`

**关键测试场景**:

```
✓ POST /api/collections/users/auth-with-otp
  - 一次性密码验证
  - OTP 过期检查
  - OTP 重用检查

✓ POST /api/collections/users/request-otp
  - 生成 OTP
  - 发送邮件/短信
```

**PocketLess 现状**: ✅ 部分实现（`record_auth_otp.test.ts` 存在）

**预计工作量**: 1-2 小时

---

### 1.5 Record Auth Verification/Email Change Tests

**Go 版文件**:
- `apis/record_auth_verification_request_test.go`
- `apis/record_auth_verification_confirm_test.go`
- `apis/record_auth_email_change_request_test.go`
- `apis/record_auth_email_change_confirm_test.go`

**关键测试场景**:

```
✓ POST /api/collections/users/request-verification
  - 发送验证邮件
  - 生成验证 token

✓ POST /api/collections/users/confirm-verification
  - 验证 token
  - 标记邮箱已验证

✓ POST /api/collections/users/request-email-change
✓ POST /api/collections/users/confirm-email-change
```

**PocketLess 现状**: ✅ 部分实现

**预计工作量**: 1-2 小时

---

### Phase 1 总结

| 任务 | 现状 | 工作量 | 优先级 |
|------|------|--------|--------|
| Auth Methods | ❌ 缺失 | 1h | P1 |
| Auth Password | ✅ 部分 | 2-3h | P1 |
| Auth OAuth2 | ✅ 部分 | 2-3h | P1 |
| Auth OTP | ✅ 部分 | 1-2h | P1 |
| Auth Verification | ✅ 部分 | 1-2h | P1 |
| **Phase 1 合计** | — | **7-13h** | — |

---

## 📋 Phase 2: APIs CRUD 与基础设施

### 2.1 Record CRUD Extended Tests

**Go 版文件**:
- `apis/record_crud_external_auth_test.go`
- `apis/record_crud_mfa_test.go`
- `apis/record_crud_secret_test.go`
- `apis/record_crud_superuser_test.go`
- `apis/record_crud_otp_test.go`

**关键新增测试场景**:

```
✓ External Auth (Social Login)
  - 关联社交账号
  - 取消关联
  - 列出关联账号

✓ MFA (Multi-Factor Authentication)
  - 启用 MFA
  - 生成 MFA token
  - 验证第二因素
  - 列出 MFA 方式

✓ Secret Fields
  - 密钥字段存储
  - 密钥字段不返回给非所有者
  - Superuser 可访问密钥

✓ Superuser 特殊权限
  - Superuser 访问任何集合
  - Superuser 跳过权限检查
  - Superuser Impersonation

✓ OTP 集成
  - OTP 生成和验证
  - OTP 失效时间
```

**PocketLess 现状**: ✅ 基础实现（需补充详细场景）

**预计工作量**: 3-4 小时

---

### 2.2 Collection 与 Collection Import Tests

**Go 版文件**:
- `apis/collection_test.go`
- `apis/collection_import_test.go`

**关键测试场景**:

```
✓ POST /api/collections
  - 创建集合
  - 创建系统集合 vs 普通集合
  - 验证字段配置

✓ GET /api/collections
✓ GET /api/collections/:id
✓ PATCH /api/collections/:id
✓ DELETE /api/collections/:id

✓ POST /api/collections/import
  - JSON 格式导入
  - 覆盖现有集合选项
  - 字段映射
```

**PocketLess 现状**: ✅ 部分实现

**预计工作量**: 2-3 小时

---

### 2.3 Batch & Realtime Tests

**Go 版文件**:
- `apis/batch_test.go`
- `apis/realtime_test.go`

**关键测试场景**:

```
✓ POST /api/batch
  - 批量请求
  - 事务处理
  - 错误处理

✓ SSE /api/realtime
  - 订阅消息
  - 广播消息
  - 取消订阅
```

**PocketLess 现状**: ✅ 部分实现

**预计工作量**: 2-3 小时

---

### 2.4 Middlewares Tests

**Go 版文件**:
- `apis/middlewares_test.go`
- `apis/middlewares_rate_limit_test.go`

**关键测试场景**:

```
✓ Rate Limiting
  - 限流规则
  - 429 Too Many Requests

✓ CORS
  - Origin 检查

✓ Body Limit
  - 请求体大小限制
```

**PocketLess 现状**: ❌ 缺失或不完整

**预计工作量**: 1-2 小时

---

### Phase 2 总结

| 任务 | 现状 | 工作量 | 优先级 |
|------|------|--------|--------|
| Record CRUD Extended | ✅ 部分 | 3-4h | P1 |
| Collection Tests | ✅ 部分 | 2-3h | P1 |
| Batch & Realtime | ✅ 部分 | 2-3h | P1 |
| Middlewares | ❌ 缺失 | 1-2h | P1 |
| **Phase 2 合计** | — | **8-12h** | — |

---

## 📋 Phase 3: Core 数据库与字段

### 3.1 Database Adapter Tests (15 个文件)

**Go 版文件**:
```
db_test.go
db_adapter_test.go
db_adapter_sqlite_test.go
db_adapter_postgres_test.go
db_advisory_lock_test.go
db_backup_pg_test.go
db_bootstrap_pg_test.go
db_cache_invalidation_test.go
db_connect_pg_test.go
db_container_pg_test.go
db_lock_test.go
db_lock_query_test.go
db_model_test.go
db_retry_test.go
db_retry_pg_test.go
```

**关键测试场景**:

```
✓ SQLite vs PostgreSQL 适配
  - 类型映射 (TEXT, INTEGER, REAL, BLOB, JSON)
  - 约束差异处理
  - 函数差异 (AUTOINCREMENT vs SERIAL)

✓ Connection Management
  - 连接池
  - 重试机制
  - 超时处理

✓ Transaction Isolation
  - 并发控制
  - Deadlock 处理

✓ Backup & Recovery
  - PostgreSQL 备份
  - 增量备份
```

**PocketLess 现状**: ✅ 部分实现（`db_adapter_sqlite.test.ts`, `db_adapter_postgres.test.ts` 存在）

**预计工作量**: 5-8 小时

---

### 3.2 Collection & Field Model Tests (15 个文件)

**Go 版文件**:
```
collection_model_test.go
collection_model_auth_options_test.go
collection_model_view_options_test.go
collection_query_test.go
collection_record_table_sync_test.go
collection_record_table_sync_postgres_test.go
collection_validate_test.go
field_test.go
field_column_type_test.go
field_types_postgres_test.go
fields_list_test.go
view_test.go
view_postgres_test.go
```

**关键测试场景**:

```
✓ Field Type Mapping
  - 所有 17 种字段类型的 SQLite/PostgreSQL 列类型
  - 字段验证规则
  - 字段默认值

✓ Collection Validation
  - 字段名冲突检查
  - 系统字段保留
  - 关联字段验证

✓ View Support
  - SQL View 创建
  - View 字段解析
```

**PocketLess 现状**: ✅ 部分实现

**预计工作量**: 5-8 小时

---

### 3.3 Record Model Tests (8 个文件)

**Go 版文件**:
```
record_model_test.go
record_model_auth_test.go
record_model_superusers_test.go
record_query_test.go
record_query_expand_test.go
record_field_resolver_test.go
record_field_resolver_pg_test.go
record_tokens_test.go
```

**关键测试场景**:

```
✓ Record Lifecycle
  - 创建、读取、更新、删除
  - 时间戳管理 (created, updated)

✓ Record Expand
  - 关联字段展开
  - 嵌套展开 (3+ 层)
  - 循环关联处理

✓ Record Token
  - Auth token 签发和验证
  - File token 管理
  - Token Claims 结构

✓ Superuser & Auth
  - Auth 记录特殊权限
  - Superuser 特殊权限
```

**PocketLess 现状**: ✅ 部分实现

**预计工作量**: 4-6 小时

---

### Phase 3 总结

| 任务 | 现状 | 工作量 | 优先级 |
|------|------|--------|--------|
| Database Adapter | ✅ 部分 | 5-8h | P1 |
| Collection & Field | ✅ 部分 | 5-8h | P1 |
| Record Model | ✅ 部分 | 4-6h | P1 |
| **Phase 3 合计** | — | **14-22h** | — |

---

## 📋 Phase 4: Core 高级特性 (Priority: P2)

**预计工作量**: 8-12 小时

涵盖:
- WAL (Write-Ahead Log) 处理
- RLS (Row-Level Security)
- Pub/Sub 系统
- Auth Origins 管理
- External Auth 处理
- Crypto 操作

---

## 📋 Phase 5: Tools 工具库 (Priority: P2)

**预计工作量**: 32-48 小时

涵盖:
- Security (Crypto, JWT, Password)
- Types (DateTime, GeoPoint, JSON)
- Filesystem (S3, Archive, Local)
- Search 引擎
- Router
- Auth Providers (35+ providers)

---

## 📊 整体工作量估算

| Phase | 内容 | 工作量 | 优先级 |
|-------|------|--------|--------|
| 1 | APIs 认证与权限 | 7-13h | P1 |
| 2 | APIs CRUD 与基础设施 | 8-12h | P1 |
| 3 | Core 数据库与字段 | 14-22h | P1 |
| 4 | Core 高级特性 | 8-12h | P2 |
| 5 | Tools 工具库 | 32-48h | P2 |
| **总计** | — | **69-107h** | — |

---

## 🔄 执行流程

### 每周工作计划

```
Week 1: Phase 1 (认证系统)
- Day 1-2: 分析 + 实现 Auth Methods & Password (4-5h)
- Day 3-4: 实现 OAuth2 & OTP (4-5h)
- Day 5: 实现 Verification (2-3h) + 文档更新

Week 2: Phase 2 (CRUD 系统)
- Day 1-2: 实现 Record CRUD Extended (3-4h)
- Day 3-4: 实现 Collection & Import (2-3h)
- Day 5: 实现 Batch, Realtime, Middlewares (4-5h)

Week 3-4: Phase 3 (数据库系统)
- Database Adapters (5-8h)
- Collection & Field (5-8h)
- Record Model (4-6h)

Week 5+: Phase 4-5 (高级特性 & 工具库)
```

---

## ✅ 检查清单

### 每个测试文件完成时的验证清单

- [ ] 测试文件存在于正确位置
- [ ] 所有关键测试场景已实现
- [ ] 测试能正常运行：`bun test src/xxx/xxx.test.ts`
- [ ] 所有断言都通过
- [ ] 代码覆盖率检查
- [ ] 与 Go 版行为对比无差异
- [ ] 文档更新（规范文件中标记已完成）

---

## 📝 相关文档

- Go 版本测试参考: `/apis/*_test.go`, `/core/*_test.go`, `/tools/*_test.go`
- PocketLess 规范: `specs/032-pocketless/spec.md`
- PocketLess 快速开始: `specs/032-pocketless/quickstart.md`

---

**计划创建日期**: 2026-03-24  
**计划完成日期**: TBD (预计 4-8 周)  
**当前进度**: 0% (计划阶段)
