# 双数据库测试覆盖分析报告

> **日期**: 2026-01-30  
> **作者**: AI Assistant  
> **状态**: 已完成分析，待执行改进计划

## 摘要

本报告全面分析了 PocketBase 项目中 SQLite 和 PostgreSQL 的测试覆盖情况。**目标是将 PostgreSQL 测试覆盖率提升到与 SQLite 相同的水平**。

当前差距：
- **SQLite 测试函数**: 1,549 个
- **PostgreSQL 测试函数**: 82 个
- **覆盖率差距**: 94.7%

---

## 1. 测试框架改进

### 1.1 新增的 API 方法

在 `/tests/api.go` 中新增了以下方法：

| 方法 | 签名 | 描述 |
|------|------|------|
| `TestBothDBs` | `(s *ApiScenario) TestBothDBs(t *testing.T)` | 顺序在 SQLite 和 PostgreSQL 上运行测试 |
| `TestBothDBsParallel` | `(s *ApiScenario) TestBothDBsParallel(t *testing.T)` | 并行在双数据库上运行测试 |
| `ApiScenariosTestBothDBs` | `func(t *testing.T, scenarios []ApiScenario)` | 批量处理测试场景 |
| `ApiScenariosTestBothDBsParallel` | `func(t *testing.T, scenarios []ApiScenario)` | 批量并行处理 |

### 1.2 使用示例

```go
// 原来的写法（只测试 SQLite）
func TestRecordCrudList(t *testing.T) {
    scenarios := []tests.ApiScenario{...}
    for _, scenario := range scenarios {
        scenario.Test(t)  // 只在 SQLite 上运行
    }
}

// 新的写法（双数据库测试）
func TestRecordCrudList(t *testing.T) {
    scenarios := []tests.ApiScenario{...}
    for _, scenario := range scenarios {
        scenario.TestBothDBs(t)  // 在 SQLite 和 PostgreSQL 上都运行
    }
}
```

### 1.3 环境变量

| 环境变量 | 描述 | 示例 |
|---------|------|------|
| `TEST_POSTGRES` | 启用 PostgreSQL 测试 | `TEST_POSTGRES=1` |
| `POSTGRES_DSN` | PostgreSQL 连接字符串 | `postgres://user:pass@localhost:5432/db` |

---

## 2. 当前测试覆盖情况

### 2.1 全模块覆盖差距总览

| 模块 | SQLite 测试文件 | PostgreSQL 测试文件 | SQLite 测试函数 | PostgreSQL 测试函数 | 覆盖率 | 缺口 |
|------|----------------|-------------------|----------------|-------------------|-------|------|
| **core** | 118 | 12 | 853 | 65 | 7.6% | 788 |
| **apis** | 49 | 0 | 170 | 0 | 0% | 170 |
| **tools** | 74 | 4 | 355 | 12 | 3.4% | 343 |
| **forms** | 4 | 0 | 12 | 0 | 0% | 12 |
| **mails** | 1 | 0 | 5 | 0 | 0% | 5 |
| **plugins** | 16 | 0 | 148 | 0 | 0% | 148 |
| **migrations** | 1 | 1 | 6 | 5 | 83% | 1 |
| **tests** | - | 12 | - | 75+ | N/A | - |
| **总计** | **263** | **29** | **1,549** | **82** | **5.3%** | **1,467** |

### 2.2 各模块详细分析

#### 2.2.1 Core 模块 (853 → 65，缺口 788)

**已覆盖的 PostgreSQL 测试**:
- `db_adapter_postgres_test.go` - 数据库适配器
- `db_backup_pg_test.go` - 备份功能
- `db_bootstrap_pg_test.go` - 启动引导
- `db_connect_pg_test.go` - 连接管理
- `db_container_pg_test.go` - Docker 容器
- `db_retry_pg_test.go` - 重试机制
- `db_table_postgres_test.go` - 表操作
- `collection_record_table_sync_postgres_test.go` - 同步
- `field_types_postgres_test.go` - 字段类型
- `record_field_resolver_pg_test.go` - 字段解析器
- `trace_repository_pg_test.go` - 追踪仓库
- `view_postgres_test.go` - 视图

**未覆盖的关键测试** (示例):
- `record_model_test.go` - Record 模型
- `collection_model_test.go` - Collection 模型
- `record_query_test.go` - 记录查询
- `db_cron_test.go` - 定时任务
- `field_*.go` - 所有字段类型测试

#### 2.2.2 APIs 模块 (170 → 0，缺口 170)

**完全没有 PostgreSQL 覆盖**:
- `record_crud_test.go` (119 KB) - 核心 CRUD
- `collection_test.go` (56 KB) - 集合管理
- `record_auth_with_oauth2_test.go` (54 KB) - OAuth2
- `batch_test.go` (22 KB) - 批量操作
- `realtime_test.go` (26 KB) - 实时订阅
- `file_test.go` - 文件处理
- 其他 43 个测试文件...

#### 2.2.3 Tools 模块 (355 → 12，缺口 343)

**已覆盖**:
- `dbutils/fulltext_pg_test.go`
- `dbutils/index_pg_test.go`
- `dbutils/json_pg_test.go`
- `search/filter_postgres_test.go`

**未覆盖的关键子模块**:
- `tools/auth/` - 35+ OAuth 提供商
- `tools/filesystem/` - 文件系统抽象
- `tools/subscriptions/` - 订阅管理
- `tools/cron/` - 定时任务
- `tools/security/` - 安全工具

#### 2.2.4 Forms 模块 (12 → 0，缺口 12)

**完全没有 PostgreSQL 覆盖**:
- `record_upsert_test.go` - 记录创建/更新
- `apple_client_secret_create_test.go`
- 其他表单测试...

#### 2.2.5 Plugins 模块 (148 → 0，缺口 148)

**完全没有 PostgreSQL 覆盖**:
- `jsvm/` - JavaScript VM (63 个测试函数)
- `migratecmd/` - 迁移命令
- `ghupdate/` - GitHub 更新
- `gateway/` - 网关插件
- `tofauth/` - TOF 认证

#### 2.2.6 Mails 模块 (5 → 0，缺口 5)

**完全没有 PostgreSQL 覆盖**:
- 邮件模板测试
- SMTP 测试

### 2.3 测试函数数量统计

| 类型 | 数量 |
|------|------|
| SQLite 测试函数（总） | 1,549 |
| PostgreSQL 专用测试函数 | 82 |
| **需要补充的测试函数** | **1,467** |

### 2.3 PostgreSQL 专用测试文件清单

```
core/
├── db_adapter_postgres_test.go      # 数据库适配器测试
├── db_backup_pg_test.go             # 备份功能测试
├── db_bootstrap_pg_test.go          # 启动引导测试
├── db_connect_pg_test.go            # 连接测试
├── db_container_pg_test.go          # Docker 容器测试
├── db_retry_pg_test.go              # 重试机制测试
├── db_table_postgres_test.go        # 表操作测试
├── collection_record_table_sync_postgres_test.go  # 同步测试
├── field_types_postgres_test.go     # 字段类型测试
├── record_field_resolver_pg_test.go # 字段解析器测试
├── trace_repository_pg_test.go      # 追踪仓库测试
└── view_postgres_test.go            # 视图测试

tests/
├── postgres_api_rules_e2e_test.go   # API 规则 E2E 测试
├── postgres_api_rules_test.go       # API 规则测试
├── postgres_concurrent_test.go      # 并发测试
├── postgres_crud_e2e_test.go        # CRUD E2E 测试 (新增)
├── postgres_errors_test.go          # 错误处理测试
├── postgres_gin_index_test.go       # GIN 索引测试
├── postgres_integration_test.go     # 集成测试
├── postgres_json_test.go            # JSON/JSONB 测试
├── postgres_observability_test.go   # 可观测性测试
├── postgres_pubsub_test.go          # PubSub 测试
├── postgres_rls_test.go             # 行级安全测试
└── postgres_test.go                 # 基础测试

tools/
├── dbutils/fulltext_pg_test.go      # 全文搜索测试
├── dbutils/index_pg_test.go         # 索引测试
├── dbutils/json_pg_test.go          # JSON 函数测试
└── search/filter_postgres_test.go   # 过滤器测试

migrations/
└── postgres_init_test.go            # 初始化迁移测试
```

---

## 3. 全量测试结果

### 3.1 SQLite 测试 (`go test ./...`)

| 状态 | 模块数 | 说明 |
|------|-------|------|
| ✅ 通过 | 35 | 主要模块 |
| ❌ 失败 | 3 | 预先存在的问题 |
| ⏭️ 跳过 | 2 | 无测试文件 |

**失败的测试（预先存在的问题）**：

| 模块 | 测试文件 | 错误原因 |
|------|---------|---------|
| `forms` | `record_upsert_test.go` | NOT NULL 约束失败 (created 字段) |
| `migrations` | `system_metrics_test.go` | NOT NULL 约束失败 (timestamp 字段) |
| `tools/types` | `datetime_test.go` | 预期值不匹配 |

### 3.2 PostgreSQL 测试 (`TEST_POSTGRES=1 go test ./... -run ".*Postgres.*"`)

| 模块 | 状态 | 测试数 | 耗时 |
|------|------|-------|------|
| `core` | ✅ 通过 | 12 文件 | ~2.0s |
| `tests` | ✅ 通过 | 12 文件 | ~82s |
| `tools/dbutils` | ✅ 通过 | 3 文件 | ~0.3s |
| `tools/search` | ✅ 通过 | 1 文件 | ~1.4s |
| `migrations` | ✅ 通过 | 1 文件 | ~2.7s |
| `plugins/gateway` | ✅ 通过 | 0 (不需要) | ~0.4s |

### 3.3 双数据库测试示例 (`-run ".*BothDBs.*"`)

```
=== RUN   TestRecordListBothDBs
    === RUN   TestRecordListBothDBs/demo2_列表_-_公开访问
        === RUN   TestRecordListBothDBs/demo2_列表_-_公开访问/SQLite
        --- PASS (0.06s)
        === RUN   TestRecordListBothDBs/demo2_列表_-_公开访问/PostgreSQL
        --- PASS (1.67s)
    === RUN   TestRecordListBothDBs/demo2_列表_-_带分页
        === RUN   TestRecordListBothDBs/demo2_列表_-_带分页/SQLite
        --- PASS (0.03s)
        === RUN   TestRecordListBothDBs/demo2_列表_-_带分页/PostgreSQL
        --- PASS (0.03s)
--- PASS: TestRecordListBothDBs (1.85s)
```

---

## 4. 风险分析

### 4.1 高风险未覆盖模块

| 模块 | 文件 | 大小 | 风险等级 | 原因 |
|------|-----|------|---------|------|
| `apis` | `record_crud_test.go` | 119.93 KB | 🔴 高 | 核心 CRUD 操作 |
| `apis` | `collection_test.go` | 55.88 KB | 🔴 高 | 集合管理 |
| `apis` | `record_auth_with_oauth2_test.go` | 54.03 KB | 🔴 高 | OAuth2 认证 |
| `apis` | `batch_test.go` | 22.13 KB | 🔴 高 | 批量操作 |
| `apis` | `realtime_test.go` | 25.55 KB | 🟡 中 | 实时订阅 |
| `apis` | `backup_test.go` | 27.39 KB | 🟡 中 | 备份功能 |

### 4.2 潜在问题类型

| 问题类型 | 描述 | 可能影响 |
|---------|------|---------|
| SQL 语法差异 | SQLite vs PostgreSQL 语法不兼容 | 查询失败 |
| JSON 处理 | `json_extract` vs `jsonb` 操作符 | 数据解析错误 |
| 类型转换 | 隐式类型转换差异 | 数据精度丢失 |
| 事务隔离 | 隔离级别行为差异 | 并发问题 |
| 索引策略 | B-tree vs GIN 索引 | 性能问题 |

---

## 5. 测试命令参考

### 5.1 常用命令

```bash
# SQLite 全量测试
go test ./... -count 1 -timeout 30m

# PostgreSQL 专用测试
export POSTGRES_DSN="postgres://postgres:postgres@localhost:5432/pocketbase_test?sslmode=disable"
export TEST_POSTGRES=1
go test ./... -run ".*Postgres.*|.*PG.*" -count 1 -timeout 30m

# 双数据库测试（新方法）
go test ./tests/... -run ".*BothDBs.*" -v

# 单个模块测试
go test ./core/... -v -run "TestRecordFieldResolver" -count 1

# 带覆盖率的测试
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### 5.2 CI/CD 配置示例

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test-sqlite:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
      - run: go test ./... -count 1 -timeout 30m

  test-postgres:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: pocketbase_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      TEST_POSTGRES: 1
      POSTGRES_DSN: postgres://postgres:postgres@localhost:5432/pocketbase_test?sslmode=disable
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
      - run: go test ./... -run ".*Postgres.*|.*PG.*|.*BothDBs.*" -count 1 -timeout 30m
```

---

## 6. 结论

### 6.1 主要发现

1. **APIs 模块零覆盖**：49 个测试文件全部只运行在 SQLite 上
2. **测试框架已就绪**：`DualDBTest` 和 `NewPostgresTestApp` 早已存在但未被充分利用
3. **迁移成本低**：新增的 `TestBothDBs()` 方法使迁移只需一行代码改动

### 6.2 行动建议

- **立即**：使用 `TestBothDBs()` 迁移高风险 APIs 测试
- **短期**：建立 CI 流程强制双数据库测试
- **长期**：APIs 模块 PostgreSQL 覆盖率达到 80%

---

## 附录

### A. 新增文件

| 文件 | 描述 |
|-----|------|
| `tests/api.go` (修改) | 新增 `TestBothDBs` 等方法 |
| `tests/api_both_dbs_example_test.go` | 双数据库测试示例 |
| `tests/postgres_crud_e2e_test.go` | PostgreSQL CRUD E2E 测试 |

### B. 相关文档

- [PostgreSQL 使用指南](../../docs/POSTGRESQL.md)
- [测试辅助函数](../../tests/dual_db_test_helper.go)
- [Docker PostgreSQL 容器](../../tests/postgres_container.go)
