# PostgreSQL 测试指南

本文档总结了 PocketBase PostgreSQL 支持的测试覆盖情况，包括测试文件、测试场景和运行方法。

## 问题背景

PocketBase 最初只支持 SQLite，在添加 PostgreSQL 支持后，发现许多核心功能（如 `@collection` 跨集合查询、多值关联查询等）在 PostgreSQL 下缺乏测试覆盖。这导致了一些 PostgreSQL 特有的语法问题（如 `LEFT JOIN` 缺少 `ON` 条件）直到生产环境才被发现。

## 测试框架设计

### 双数据库测试框架

创建了 `tests/dual_db_test_helper.go`，支持同一套测试在 SQLite 和 PostgreSQL 上各运行一次：

```go
// 使用方式
func TestSomething(t *testing.T) {
    tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
        // 你的测试代码 - 会在 SQLite 和 PostgreSQL 上各运行一次
    })
}
```

### PostgreSQL 专用测试文件

| 文件路径 | 描述 |
|---------|------|
| `tests/dual_db_test_helper.go` | 双数据库测试框架 |
| `core/record_field_resolver_pg_test.go` | RecordFieldResolver PostgreSQL 测试 |
| `tests/postgres_api_rules_test.go` | PostgreSQL API Rules 测试 |
| `tests/postgres_api_rules_e2e_test.go` | PostgreSQL API Rules E2E 测试 |
| `tests/postgres_rls_test.go` | PostgreSQL 行级安全 (RLS) 测试 |
| `tools/dbutils/json_pg_test.go` | PostgreSQL JSON 函数测试 |
| `tools/dbutils/json_unified_test.go` | 统一 JSON API 测试 |

## 测试场景覆盖

### 1. RecordFieldResolver 测试 (`core/record_field_resolver_pg_test.go`)

| 测试函数 | 覆盖场景 |
|---------|---------|
| `TestRecordFieldResolverPostgres` | `@collection` 跨集合查询、单值/多值关联查询 |
| `TestCollectionCrossQueryPostgres` | `@collection.xxx.field` 语法的 SQL 生成 |
| `TestMultiMatchQueryPostgres` | `?=`, `?!=`, `?~`, `?!~` 多值匹配操作符 |
| `TestRequestInfoFieldsPostgres` | `@request.query`, `@request.headers` 字段 |

### 2. API Rules E2E 测试 (`tests/postgres_api_rules_e2e_test.go`)

| 测试函数 | 覆盖场景 |
|---------|---------|
| `TestPostgresAPIRulesBasic` | 基础列表和过滤查询 |
| `TestPostgresAPIRulesCollectionCrossQuery` | HTTP API 级别的 `@collection` 查询 |
| `TestPostgresAPIRulesComplexJoins` | 复杂关联查询 |
| `TestPostgresAPIRulesJSONField` | JSON 字段查询 |
| `TestPostgresAPIRulesMultiMatch` | 多值匹配操作符 |

### 3. JSON 函数测试 (`tools/dbutils/json_*_test.go`)

| 测试场景 | 描述 |
|---------|------|
| `JSONExtract` | JSON 字段提取 |
| `JSONArrayContains` | 数组包含查询 |
| `JSONBuildObject` | 构建 JSON 对象 |
| SQLite/PostgreSQL 语法差异 | 确保统一 API 在两种数据库下都能工作 |

## 运行测试

### 环境准备

1. **PostgreSQL 服务**: 需要一个可用的 PostgreSQL 15+ 实例
2. **环境变量配置**:

```bash
# 必须设置的环境变量
export POSTGRES_DSN="postgres://user:password@host:5432/database?sslmode=disable"
export TEST_POSTGRES=1
```

### 运行命令

#### 运行所有 PostgreSQL 测试

```bash
# 设置环境变量
export POSTGRES_DSN="postgres://user:password@localhost:5432/pocketbase_test?sslmode=disable"
export TEST_POSTGRES=1

# 运行所有 PostgreSQL 相关测试
go test ./tests/... -v -run "TestPostgres" -timeout 15m
go test ./core/... -v -run "TestRecordFieldResolverPostgres|TestCollectionCrossQueryPostgres|TestMultiMatchQueryPostgres" -timeout 10m
go test ./tools/dbutils/... -v -timeout 5m
```

#### 运行特定测试

```bash
# RecordFieldResolver 测试
go test ./core/... -v -run "TestRecordFieldResolverPostgres" -timeout 5m

# @collection 跨集合查询测试
go test ./core/... -v -run "TestCollectionCrossQueryPostgres" -timeout 5m

# API Rules E2E 测试
go test ./tests/... -v -run "TestPostgresAPIRules" -timeout 10m

# JSON 函数测试
go test ./tools/dbutils/... -v -run "TestJSON" -timeout 5m
```

#### 使用 Make 命令（推荐）

```bash
# 运行所有测试（包括 SQLite 和 PostgreSQL）
make test

# 仅运行 PostgreSQL 测试
TEST_POSTGRES=1 POSTGRES_DSN="..." go test ./... -run ".*Postgres.*"
```

### CI/CD 配置

`.github/workflows/test.yml` 已配置在 PostgreSQL 15 和 16 上运行测试：

```yaml
- name: Run PostgreSQL Tests
  run: |
    go test ./tests/... -v -race -timeout 15m -run "TestPostgres"
    go test ./tools/dbutils/... -v -race -timeout 5m
    go test ./core/... -v -race -timeout 10m -run "TestIsolation|TestRetry|TestLock|TestGIN|TestRecordFieldResolverPostgres|TestCollectionCrossQueryPostgres|TestMultiMatchQueryPostgres"
  env:
    DB_TYPE: postgres
    POSTGRES_DSN: postgres://postgres:postgres@localhost:5432/pocketbase_test?sslmode=disable
    TEST_POSTGRES: "1"
```

## 开发规范

### 新增功能测试要求

1. **必须添加 PostgreSQL 测试**: 修改 `RecordFieldResolver`、`dbutils` 等核心组件时，必须添加 `_pg_test.go` 文件
2. **使用 `DualDBTest`**: 新测试尽量使用双数据库测试框架
3. **CI 强制检查**: 确保 CI 配置中包含新测试

### 测试命名规范

- PostgreSQL 专用测试: `Test*Postgres` 或 `Test*PG`
- 双数据库测试: 使用 `DualDBTest` 框架，不需要特殊后缀

### 测试跳过逻辑

```go
func skipIfNoPostgres(t *testing.T) {
    t.Helper()
    if os.Getenv("TEST_POSTGRES") == "" && os.Getenv("POSTGRES_DSN") == "" {
        t.Skip("跳过 PostgreSQL 测试 (设置 TEST_POSTGRES=1 或 POSTGRES_DSN 启用)")
    }
}
```

## 常见问题

### 1. 测试跳过

如果看到 `--- SKIP: TestXxxPostgres`，检查是否设置了 `TEST_POSTGRES=1` 和 `POSTGRES_DSN` 环境变量。

### 2. 连接失败

```
无法创建 PostgreSQL 测试应用: ...
```

检查 PostgreSQL 服务是否运行，DSN 是否正确。

### 3. 权限问题

确保 PostgreSQL 用户有创建数据库和扩展的权限：

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## 测试覆盖的关键场景

| 场景 | SQLite 测试 | PostgreSQL 测试 | 状态 |
|------|------------|-----------------|------|
| `@collection.xxx.field` 跨集合查询 | ✅ | ✅ | 已覆盖 |
| `LEFT JOIN ON true` 语法 | N/A | ✅ | PostgreSQL 特有 |
| 多值关联 `?=`, `?!=`, `?~`, `?!~` | ✅ | ✅ | 已覆盖 |
| JSON 字段提取 | ✅ | ✅ | 已覆盖 |
| JSONB 数组包含 | N/A | ✅ | PostgreSQL 特有 |
| `@request.query`, `@request.headers` | ✅ | ✅ | 已覆盖 |
| API Rules E2E | ✅ | ✅ | 已覆盖 |
| 行级安全 (RLS) | N/A | ✅ | PostgreSQL 特有 |

## 参考资料

- [PostgreSQL 使用指南](../docs/POSTGRESQL.md)
- [PostgreSQL 适配方案](./postgresql-adaptation.md)
- [PostgreSQL 迁移兼容性](./migrations-postgresql-compatibility.md)
