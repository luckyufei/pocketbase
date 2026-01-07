# PocketBase PostgreSQL 迁移 - 文件修改清单

> **生成日期**: 2026-01-07
> **基于代码分析**: 完整代码库扫描

---

## 修改优先级说明

| 优先级 | 说明 | 颜色 |
|-------|------|------|
| P0 | 必须修改，阻塞其他任务 | 🔴 |
| P1 | 重要修改，核心功能 | 🟠 |
| P2 | 次要修改，增强功能 | 🟡 |
| P3 | 可选修改，优化改进 | 🟢 |

---

## 1. 新增文件

### 1.1 核心适配器 (P0)

| 文件路径 | 说明 | 行数估计 |
|---------|------|---------|
| `core/db_adapter.go` | 数据库适配器接口定义 | ~100 |
| `core/db_adapter_sqlite.go` | SQLite 适配器实现 | ~200 |
| `core/db_adapter_postgres.go` | PostgreSQL 适配器实现 | ~300 |
| `core/db_connect_postgres.go` | PostgreSQL 连接初始化 | ~50 |

### 1.2 JSON 工具 (P0)

| 文件路径 | 说明 | 行数估计 |
|---------|------|---------|
| `tools/dbutils/json_sqlite.go` | SQLite JSON 函数 | ~60 |
| `tools/dbutils/json_postgres.go` | PostgreSQL JSON 函数 | ~100 |

### 1.3 PostgreSQL 迁移 (P0)

| 文件路径 | 说明 | 行数估计 |
|---------|------|---------|
| `migrations/postgres/0001_extensions.go` | 扩展初始化 | ~30 |
| `migrations/postgres/0002_functions.go` | 兼容函数 | ~100 |
| `migrations/postgres/0003_init.go` | 主数据库初始化 | ~300 |
| `migrations/postgres/0004_aux_init.go` | 辅助数据库初始化 | ~100 |

### 1.4 测试辅助 (P1)

| 文件路径 | 说明 | 行数估计 |
|---------|------|---------|
| `tests/postgres_helper.go` | PostgreSQL 测试辅助 | ~100 |
| `tests/data/data.pg-dump.sql` | PostgreSQL 测试数据 | ~1000 |
| `tests/data/auxiliary.pg-dump.sql` | PostgreSQL 辅助测试数据 | ~100 |

---

## 2. 必须修改的文件 (P0)

### 2.1 `go.mod`

**修改类型**: 添加依赖

```diff
+ require (
+     github.com/jackc/pgx/v5 v5.x.x
+     github.com/ory/dockertest/v3 v3.x.x
+ )
```

### 2.2 `core/db_connect.go`

**当前代码**:
```go
//go:build !no_default_driver

package core

import (
    "github.com/pocketbase/dbx"
    _ "modernc.org/sqlite"
)

func DefaultDBConnect(dbPath string) (*dbx.DB, error) {
    pragmas := "?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)..."
    db, err := dbx.Open("sqlite", dbPath+pragmas)
    return db, nil
}
```

**修改方案**:
```go
// 重构为使用适配器模式
func DefaultDBConnect(config DBConfig) (*dbx.DB, error) {
    adapter := GetAdapter(config.Type)
    return adapter.Connect(config)
}
```

### 2.3 `core/db_table.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 14-16 | `PRAGMA_TABLE_INFO` | `information_schema.columns` |
| 37-39 | `PRAGMA_TABLE_INFO` | `information_schema.columns` |
| 62-69 | `sqlite_master` | `pg_indexes` |
| 113-118 | `sqlite_schema` | `information_schema.tables` |
| 133-136 | `VACUUM` | `VACUUM` (相同但行为不同) |

**详细修改**:

```go
// 行 14-18: TableColumns
// 当前
err := app.ConcurrentDB().NewQuery("SELECT name FROM PRAGMA_TABLE_INFO({:tableName})").
    Bind(dbx.Params{"tableName": tableName}).
    Column(&columns)

// PostgreSQL
err := app.ConcurrentDB().NewQuery(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = {:tableName}
    ORDER BY ordinal_position
`).Bind(dbx.Params{"tableName": tableName}).Column(&columns)
```

```go
// 行 62-69: TableIndexes
// 当前
err := app.ConcurrentDB().Select("name", "sql").
    From("sqlite_master").
    AndWhere(dbx.NewExp("sql is not null")).
    AndWhere(dbx.HashExp{"type": "index", "tbl_name": tableName}).
    All(&indexes)

// PostgreSQL
err := app.ConcurrentDB().Select("indexname as name", "indexdef as sql").
    From("pg_indexes").
    AndWhere(dbx.HashExp{"tablename": tableName}).
    All(&indexes)
```

```go
// 行 113-118: hasTable
// 当前
err := db.Select("(1)").
    From("sqlite_schema").
    AndWhere(dbx.HashExp{"type": []any{"table", "view"}}).
    AndWhere(dbx.NewExp("LOWER([[name]])=LOWER({:tableName})", ...)).
    Limit(1).Row(&exists)

// PostgreSQL
err := db.Select("(1)").
    From("information_schema.tables").
    AndWhere(dbx.NewExp("LOWER(table_name)=LOWER({:tableName})", ...)).
    Limit(1).Row(&exists)
```

### 2.4 `tools/dbutils/json.go`

**当前代码** (完整文件):
```go
package dbutils

import (
    "fmt"
    "strings"
)

func JSONEach(column string) string {
    return fmt.Sprintf(
        `json_each(CASE WHEN iif(json_valid([[%s]]), json_type([[%s]])='array', FALSE) THEN [[%s]] ELSE json_array([[%s]]) END)`,
        column, column, column, column,
    )
}

func JSONArrayLength(column string) string {
    return fmt.Sprintf(
        `json_array_length(CASE WHEN iif(json_valid([[%s]]), json_type([[%s]])='array', FALSE) THEN [[%s]] ELSE (CASE WHEN [[%s]] = '' OR [[%s]] IS NULL THEN json_array() ELSE json_array([[%s]]) END) END)`,
        column, column, column, column, column, column,
    )
}

func JSONExtract(column string, path string) string {
    if path != "" && !strings.HasPrefix(path, "[") {
        path = "." + path
    }
    return fmt.Sprintf(
        "(CASE WHEN json_valid([[%s]]) THEN JSON_EXTRACT([[%s]], '$%s') ELSE JSON_EXTRACT(json_object('pb', [[%s]]), '$.pb%s') END)",
        column, column, path, column, path,
    )
}
```

**修改方案**: 重构为接口 + 实现

```go
// json.go - 接口定义
package dbutils

type JSONHelper interface {
    JSONEach(column string) string
    JSONArrayLength(column string) string
    JSONExtract(column string, path string) string
}

var currentHelper JSONHelper = &SQLiteJSONHelper{}

func SetJSONHelper(h JSONHelper) {
    currentHelper = h
}

func JSONEach(column string) string {
    return currentHelper.JSONEach(column)
}

func JSONArrayLength(column string) string {
    return currentHelper.JSONArrayLength(column)
}

func JSONExtract(column string, path string) string {
    return currentHelper.JSONExtract(column, path)
}
```

### 2.5 `tools/search/filter.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 252-258 | `"true": "1", "false": "0"` | `"true": "TRUE", "false": "FALSE"` |
| 337-344 | `equalOp = "IS NOT"` | `equalOp = "IS DISTINCT FROM"` |

**详细修改**:

```go
// 行 252-258
// 当前
var normalizedIdentifiers = map[string]string{
    "null": "NULL",
    "true": "1",
    "false": "0",
}

// PostgreSQL (需要根据数据库类型动态选择)
func getNormalizedIdentifiers(dbType string) map[string]string {
    if dbType == "postgres" {
        return map[string]string{
            "null": "NULL",
            "true": "TRUE",
            "false": "FALSE",
        }
    }
    return map[string]string{
        "null": "NULL",
        "true": "1",
        "false": "0",
    }
}
```

```go
// 行 337-344
// 当前
if !equal {
    equalOp = "IS NOT"
    nullEqualOp = equalOp
    concatOp = "AND"
    nullExpr = "IS NOT NULL"
}

// PostgreSQL
if !equal {
    if dbType == "postgres" {
        equalOp = "IS DISTINCT FROM"
    } else {
        equalOp = "IS NOT"
    }
    nullEqualOp = equalOp
    concatOp = "AND"
    nullExpr = "IS NOT NULL"
}
```

### 2.6 `core/base_backup.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 81-82 | `PRAGMA wal_checkpoint(TRUNCATE)` | 移除或替换为 PostgreSQL 等效 |
| 44-114 | `CreateBackup` 整体 | 使用 `pg_dump` |
| 149-294 | `RestoreBackup` 整体 | 使用 `pg_restore` |

**详细修改**:

```go
// 行 77-86
// 当前
createErr := e.App.RunInTransaction(func(txApp App) error {
    return txApp.AuxRunInTransaction(func(txApp App) error {
        txApp.DB().NewQuery("PRAGMA wal_checkpoint(TRUNCATE)").Execute()
        txApp.AuxDB().NewQuery("PRAGMA wal_checkpoint(TRUNCATE)").Execute()
        return archive.Create(txApp.DataDir(), tempPath, e.Exclude...)
    })
})

// PostgreSQL
createErr := e.App.RunInTransaction(func(txApp App) error {
    if txApp.DBType() == "postgres" {
        // 使用 pg_dump
        return txApp.Adapter().CreateBackup(ctx, tempPath)
    }
    // SQLite 原有逻辑
    return txApp.AuxRunInTransaction(func(txApp App) error {
        txApp.DB().NewQuery("PRAGMA wal_checkpoint(TRUNCATE)").Execute()
        txApp.AuxDB().NewQuery("PRAGMA wal_checkpoint(TRUNCATE)").Execute()
        return archive.Create(txApp.DataDir(), tempPath, e.Exclude...)
    })
})
```

### 2.7 `core/record_field_resolver_runner.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 343 | `json_each({:%s})` | 使用 `dbutils.JSONEach` |
| 362 | `json_each({:%s})` | 使用 `dbutils.JSONEach` |
| 832 | `json_extract` 相关 | 使用 `dbutils.JSONExtract` |

### 2.8 `core/collection_record_table_sync.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 147 | `PRAGMA optimize` | `ANALYZE` (PostgreSQL) |
| 190-194 | `sqlite_schema` 查询视图 | `information_schema.views` |
| 231, 258 | `json_extract` | 使用 `dbutils.JSONExtract` |

### 2.9 `migrations/1640988000_init.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 39 | `'r'\|\|lower(hex(randomblob(7)))` | `pb_generate_id()` |
| 41 | `DEFAULT "base"` | `DEFAULT 'base'` |
| 43-44 | `JSON DEFAULT "[]"` | `JSONB DEFAULT '[]'::jsonb` |
| 51-52 | `strftime('%Y-%m-%d %H:%M:%fZ')` | `CURRENT_TIMESTAMP` |
| 110 | 同上 ID 生成 | `pb_generate_id()` |
| 112-113 | 同上时间戳 | `CURRENT_TIMESTAMP` |

---

## 3. 重要修改的文件 (P1)

### 3.1 `core/base.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 1174-1260 | 连接池配置 | 添加 PostgreSQL 连接池配置 |
| 1360 | `PRAGMA wal_checkpoint` | 条件执行 |
| 1365 | `PRAGMA wal_checkpoint` | 条件执行 |
| 1370 | `PRAGMA optimize` | `ANALYZE` (PostgreSQL) |

### 3.2 `core/record_query.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 553-556 | `COLLATE NOCASE` | `LOWER()` 函数 |

```go
// 当前
expr = dbx.NewExp("[["+FieldNameEmail+"]] = {:email} COLLATE NOCASE", dbx.Params{"email": email})

// PostgreSQL
expr = dbx.NewExp("LOWER([["+FieldNameEmail+"]]) = LOWER({:email})", dbx.Params{"email": email})
```

### 3.3 `core/field_text.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 158-163 | `ColumnType` 返回 SQLite 类型 | 根据数据库类型返回 |
| 203-206 | `COLLATE NOCASE` | `LOWER()` 函数 |

```go
// 行 158-163
// 当前
func (f *TextField) ColumnType(app App) string {
    if f.PrimaryKey {
        return "TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL"
    }
    return "TEXT DEFAULT '' NOT NULL"
}

// PostgreSQL
func (f *TextField) ColumnType(app App) string {
    if f.PrimaryKey {
        if app.DBType() == "postgres" {
            return "TEXT PRIMARY KEY DEFAULT pb_generate_id() NOT NULL"
        }
        return "TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL"
    }
    return "TEXT DEFAULT '' NOT NULL"
}
```

### 3.4 `apis/record_auth_with_password.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 129-131 | `COLLATE NOCASE` | `LOWER()` 函数 |

### 3.5 `apis/record_auth_with_oauth2.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 221-223 | `COLLATE NOCASE` | `LOWER()` 函数 |

### 3.6 `core/view.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 182 | `json_extract` | 使用 `dbutils.JSONExtract` |

### 3.7 `core/collection_validate.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 561-565 | `sqlite_master` 索引查询 | `pg_indexes` |

---

## 4. 次要修改的文件 (P2)

### 4.1 `modernc_versions_check.go`

**修改方案**: 删除或重写为通用数据库版本检查

### 4.2 `tools/search/provider_test.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 16 | `_ "modernc.org/sqlite"` | 条件导入 |

### 4.3 `core/log_query.go`

**修改点**:

| 行号 | 当前代码 | 修改后 |
|------|---------|--------|
| 42 | `strftime('%Y-%m-%d %H:00:00', created)` | `to_char(created, 'YYYY-MM-DD HH24:00:00')` |

### 4.4 其他迁移文件

| 文件 | 修改类型 |
|------|---------|
| `migrations/1717233556_v0.23_migrate.go` | 添加 PostgreSQL 分支 |
| `migrations/1717233557_v0.23_migrate2.go` | 添加 PostgreSQL 分支 |
| `migrations/1717233558_v0.23_migrate3.go` | 添加 PostgreSQL 分支 |
| `migrations/1717233559_v0.23_migrate4.go` | 添加 PostgreSQL 分支 |

---

## 5. 测试文件修改

### 5.1 需要新增测试

| 文件 | 说明 |
|------|------|
| `tools/dbutils/json_test.go` | JSON 函数测试 (双数据库) |
| `core/db_table_test.go` | 系统表查询测试 (双数据库) |
| `core/db_adapter_test.go` | 适配器测试 |
| `migrations/postgres/*_test.go` | PostgreSQL 迁移测试 |

### 5.2 需要修改的测试

| 文件 | 修改类型 |
|------|---------|
| `tests/app.go` | 添加 PostgreSQL 支持 |
| `core/record_field_resolver_test.go` | 更新 SQL 预期输出 |
| `tools/search/filter_test.go` | 更新布尔值和操作符预期 |

---

## 6. 配置文件修改

### 6.1 `Makefile`

```diff
+ test-postgres:
+     DB_TYPE=postgres go test ./...
+
+ test-all-db:
+     go test ./...
+     DB_TYPE=postgres go test ./...
```

### 6.2 `.github/workflows/test.yml` (如果存在)

```yaml
jobs:
  test:
    strategy:
      matrix:
        db: [sqlite, postgres]
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
```

---

## 7. 文件修改统计

| 类别 | 新增文件 | 修改文件 | 删除文件 |
|------|---------|---------|---------|
| 核心 | 4 | 12 | 0 |
| 工具 | 2 | 2 | 0 |
| 迁移 | 4 | 5 | 0 |
| 测试 | 4 | 5 | 0 |
| 配置 | 0 | 3 | 1 |
| **总计** | **14** | **27** | **1** |

---

## 8. 修改检查清单

### 8.1 代码修改前检查

- [ ] 备份当前代码分支
- [ ] 创建 `feature/postgresql-support` 分支
- [ ] 确认所有现有测试通过

### 8.2 每个文件修改后检查

- [ ] 代码编译通过
- [ ] 相关单元测试通过
- [ ] 无新增 lint 错误

### 8.3 阶段完成检查

- [ ] Phase 0: 适配器接口可用
- [ ] Phase 1: 所有 JSON 函数测试通过
- [ ] Phase 2: 迁移脚本可执行
- [ ] Phase 3: API 测试通过
- [ ] Phase 4: 集成测试通过
