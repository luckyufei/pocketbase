# PocketBase SQLite → PostgreSQL 代码分析报告

> **生成日期**: 2026-01-07
> **分析范围**: 完整代码库扫描
> **目标**: 识别所有需要修改的 SQLite 依赖点

---

## 1. 数据库驱动和连接

### 1.1 SQLite 驱动导入位置

| 文件路径 | 说明 | 迁移优先级 |
|---------|------|-----------|
| `core/db_connect.go` | 主驱动导入 `modernc.org/sqlite` | P0 |
| `core/db_connect_nodefaultdriver.go` | 无默认驱动的替代实现 | P0 |
| `tools/search/provider_test.go` | 测试用驱动导入 | P1 |
| `go.mod` | 依赖声明 `modernc.org/sqlite v1.41.0` | P0 |
| `modernc_versions_check.go` | SQLite 版本检查 | P0 (删除或重写) |

### 1.2 数据库连接初始化

**核心文件**: `core/db_connect.go`

```go
// 当前 SQLite 实现
func DefaultDBConnect(dbPath string) (*dbx.DB, error) {
    pragmas := "?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)&_pragma=journal_size_limit(200000000)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)&_pragma=temp_store(MEMORY)&_pragma=cache_size(-32000)"
    db, err := dbx.Open("sqlite", dbPath+pragmas)
    return db, nil
}
```

**迁移方案**:
```go
// PostgreSQL 实现
func DefaultDBConnect(connString string) (*dbx.DB, error) {
    db, err := dbx.Open("pgx", connString)
    if err != nil {
        return nil, err
    }
    // PostgreSQL 配置通过连接字符串或 SET 语句完成
    return db, nil
}
```

### 1.3 连接池配置

**核心文件**: `core/base.go` (行 1174-1260)

| 参数 | SQLite 当前值 | PostgreSQL 建议值 |
|------|--------------|------------------|
| `MaxOpenConns` | `DataMaxOpenConns` (可配置) | 25-50 |
| `MaxIdleConns` | `DataMaxIdleConns` (可配置) | 10-25 |
| `ConnMaxIdleTime` | 3 分钟 | 5-10 分钟 |
| `ConnMaxLifetime` | 无限制 | 1 小时 |

**特殊处理**:
- SQLite 非并发模式设置 `MaxOpenConns=1`，PostgreSQL 不需要此限制
- 需要添加 `ConnMaxLifetime` 配置防止连接过期

---

## 2. SQL 语法差异点

### 2.1 JSON 函数 (高风险)

**核心文件**: `tools/dbutils/json.go`

| SQLite 函数 | PostgreSQL 等效 | 使用位置 |
|------------|----------------|---------|
| `json_each(col)` | `jsonb_array_elements(col::jsonb)` | 关系字段查询 |
| `json_array_length(col)` | `jsonb_array_length(col::jsonb)` | 数组长度计算 |
| `JSON_EXTRACT(col, '$.path')` | `col::jsonb #> '{path}'` 或 `jsonb_path_query_first` | JSON 字段访问 |
| `json_valid(col)` | `(col IS NOT NULL AND col::jsonb IS NOT NULL)` | JSON 有效性检查 |
| `json_type(col)` | `jsonb_typeof(col::jsonb)` | JSON 类型检查 |
| `json_array(col)` | `jsonb_build_array(col)` | 数组构建 |
| `json_object('key', val)` | `jsonb_build_object('key', val)` | 对象构建 |
| `iif(cond, a, b)` | `CASE WHEN cond THEN a ELSE b END` | 条件判断 |

**当前 `JSONEach` 实现**:
```go
func JSONEach(column string) string {
    return fmt.Sprintf(
        `json_each(CASE WHEN iif(json_valid([[%s]]), json_type([[%s]])='array', FALSE) THEN [[%s]] ELSE json_array([[%s]]) END)`,
        column, column, column, column,
    )
}
```

**PostgreSQL 迁移方案**:
```go
func JSONEach(column string) string {
    return fmt.Sprintf(
        `jsonb_array_elements(CASE WHEN jsonb_typeof([[%s]]::jsonb) = 'array' THEN [[%s]]::jsonb ELSE jsonb_build_array([[%s]]) END)`,
        column, column, column,
    )
}
```

**使用 JSON 函数的文件**:
- `core/record_field_resolver_runner.go` (行 343, 362, 481, 578, 619, 675, 717, 763, 781, 837)
- `core/collection_record_table_sync.go` (行 231, 258)
- `core/view.go` (行 182)
- `tools/search/filter.go` (多处)

### 2.2 COLLATE NOCASE (中风险)

| 文件路径 | 行号 | 用途 |
|---------|------|------|
| `core/record_query.go` | 553-556 | 邮箱大小写不敏感查询 |
| `core/field_text.go` | 203-206 | ID 唯一性检查 |
| `apis/record_auth_with_password.go` | 129-131 | 身份验证字段查询 |
| `apis/record_auth_with_oauth2.go` | 221-223 | 用户名查询 |
| `migrations/1717233556_v0.23_migrate.go` | 498 | 用户名唯一索引 |

**迁移方案**:
```sql
-- 方案 1: 创建 ICU collation
CREATE COLLATION IF NOT EXISTS nocase (
    provider = icu,
    locale = 'und-u-ks-level2',
    deterministic = false
);

-- 方案 2: 使用 LOWER() 函数
WHERE LOWER(email) = LOWER(:email)

-- 方案 3: 使用 citext 扩展
CREATE EXTENSION IF NOT EXISTS citext;
-- 将 email 字段类型改为 citext
```

### 2.3 IS NOT 操作符 (中风险)

**核心文件**: `tools/search/filter.go` (行 332-344)

```go
// 当前实现
equalOp := "="
nullEqualOp := "IS"
notEqualOp := "IS NOT"  // SQLite 特有
```

**问题**: SQLite 的 `IS NOT` 在 PostgreSQL 中行为不同

**迁移方案**:
```go
// PostgreSQL 需要使用 IS DISTINCT FROM
notEqualOp := "IS DISTINCT FROM"
```

### 2.4 SQLite 特有函数

| 函数 | 使用位置 | PostgreSQL 等效 |
|------|---------|----------------|
| `strftime('%Y-%m-%d %H:%M:%fZ')` | `migrations/1640988000_init.go` | `to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS.MSZ')` 或 `CURRENT_TIMESTAMP` |
| `randomblob(7)` | `migrations/1640988000_init.go` | `gen_random_bytes(7)` |
| `hex()` | `migrations/1640988000_init.go` | `encode(..., 'hex')` |
| `lower()` | 同上 | `lower()` (相同) |

**当前 ID 生成**:
```sql
-- SQLite
DEFAULT ('r'||lower(hex(randomblob(7))))
```

**PostgreSQL 迁移方案**:
```sql
-- 方案 1: 保持兼容格式
DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex')))

-- 方案 2: 使用 UUID v7 (推荐)
DEFAULT uuid_generate_v7()
```

### 2.5 布尔值处理 (中风险)

**核心文件**: `tools/search/filter.go` (行 252-258)

```go
var normalizedIdentifiers = map[string]string{
    "null": "NULL",
    "true": "1",    // SQLite 用 1 表示 true
    "false": "0",   // SQLite 用 0 表示 false
}
```

**迁移方案**:
```go
var normalizedIdentifiers = map[string]string{
    "null": "NULL",
    "true": "TRUE",   // PostgreSQL 原生布尔
    "false": "FALSE", // PostgreSQL 原生布尔
}
```

---

## 3. 系统表查询 (高风险)

### 3.1 sqlite_master / sqlite_schema 使用

| 文件路径 | 行号 | 用途 | PostgreSQL 等效 |
|---------|------|------|----------------|
| `core/db_table.go` | 62-69 | 获取表索引 | `pg_indexes` |
| `core/db_table.go` | 113-118 | 检查表是否存在 | `information_schema.tables` |
| `core/collection_record_table_sync.go` | 190-194 | 获取视图列表 | `information_schema.views` |
| `core/collection_validate.go` | 561-565 | 检查索引名称唯一性 | `pg_indexes` |

**当前实现** (`core/db_table.go`):
```go
// 获取索引
err := app.ConcurrentDB().Select("name", "sql").
    From("sqlite_master").
    AndWhere(dbx.NewExp("sql is not null")).
    AndWhere(dbx.HashExp{
        "type":     "index",
        "tbl_name": tableName,
    }).
    All(&indexes)

// 检查表是否存在
err := db.Select("(1)").
    From("sqlite_schema").
    AndWhere(dbx.HashExp{"type": []any{"table", "view"}}).
    AndWhere(dbx.NewExp("LOWER([[name]])=LOWER({:tableName})", dbx.Params{"tableName": tableName})).
    Limit(1).
    Row(&exists)
```

**PostgreSQL 迁移方案**:
```go
// 获取索引
err := app.ConcurrentDB().Select("indexname as name", "indexdef as sql").
    From("pg_indexes").
    AndWhere(dbx.HashExp{"tablename": tableName}).
    All(&indexes)

// 检查表是否存在
err := db.Select("(1)").
    From("information_schema.tables").
    AndWhere(dbx.HashExp{"table_type": []any{"BASE TABLE", "VIEW"}}).
    AndWhere(dbx.NewExp("LOWER(table_name)=LOWER({:tableName})", dbx.Params{"tableName": tableName})).
    Limit(1).
    Row(&exists)
```

### 3.2 PRAGMA 语句使用

| PRAGMA | 使用位置 | PostgreSQL 等效 |
|--------|---------|----------------|
| `PRAGMA_TABLE_INFO` | `core/db_table.go` | `information_schema.columns` |
| `PRAGMA optimize` | `core/collection_record_table_sync.go`, `core/base.go` | `ANALYZE` |
| `PRAGMA wal_checkpoint(TRUNCATE)` | `core/base_backup.go`, `core/base.go` | `CHECKPOINT` (或无需) |
| `PRAGMA journal_mode(WAL)` | `core/db_connect.go` | 默认启用 WAL |
| `PRAGMA busy_timeout` | `core/db_connect.go` | 连接池配置 |
| `PRAGMA synchronous(NORMAL)` | `core/db_connect.go` | `synchronous_commit` |
| `PRAGMA foreign_keys(ON)` | `core/db_connect.go` | 默认启用 |
| `PRAGMA temp_store(MEMORY)` | `core/db_connect.go` | `temp_tablespaces` |
| `PRAGMA cache_size(-32000)` | `core/db_connect.go` | `shared_buffers` |

**当前 `TableInfo` 实现**:
```go
func (app *BaseApp) TableInfo(tableName string) ([]*TableInfoRow, error) {
    info := []*TableInfoRow{}
    err := app.ConcurrentDB().NewQuery("SELECT * FROM PRAGMA_TABLE_INFO({:tableName})").
        Bind(dbx.Params{"tableName": tableName}).
        All(&info)
    return info, err
}
```

**PostgreSQL 迁移方案**:
```go
func (app *BaseApp) TableInfo(tableName string) ([]*TableInfoRow, error) {
    info := []*TableInfoRow{}
    err := app.ConcurrentDB().NewQuery(`
        SELECT 
            ordinal_position - 1 as cid,
            column_name as name,
            data_type as type,
            CASE WHEN is_nullable = 'NO' THEN true ELSE false END as notnull,
            column_default as dflt_value,
            CASE WHEN column_name IN (
                SELECT a.attname FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = {:tableName}::regclass AND i.indisprimary
            ) THEN 1 ELSE 0 END as pk
        FROM information_schema.columns
        WHERE table_name = {:tableName}
        ORDER BY ordinal_position
    `).Bind(dbx.Params{"tableName": tableName}).All(&info)
    return info, err
}
```

---

## 4. 备份恢复系统 (高风险)

### 4.1 当前 SQLite 备份机制

**核心文件**: `core/base_backup.go`

```go
// 行 77-86: 备份创建
createErr := e.App.RunInTransaction(func(txApp App) error {
    return txApp.AuxRunInTransaction(func(txApp App) error {
        // WAL 检查点 - SQLite 特有
        txApp.DB().NewQuery("PRAGMA wal_checkpoint(TRUNCATE)").Execute()
        txApp.AuxDB().NewQuery("PRAGMA wal_checkpoint(TRUNCATE)").Execute()
        return archive.Create(txApp.DataDir(), tempPath, e.Exclude...)
    })
})
```

**问题**:
1. SQLite 备份依赖文件系统直接复制
2. WAL 检查点是 SQLite 特有操作
3. 恢复依赖文件替换

**PostgreSQL 迁移方案**:
```go
// 使用 pg_dump 进行备份
func (app *BaseApp) CreateBackup(ctx context.Context, name string) error {
    // 调用 pg_dump
    cmd := exec.CommandContext(ctx, "pg_dump",
        "-Fc",  // 自定义格式，支持并行恢复
        "-f", tempPath,
        app.Settings().Database.URL,
    )
    return cmd.Run()
}

// 使用 pg_restore 进行恢复
func (app *BaseApp) RestoreBackup(ctx context.Context, name string) error {
    cmd := exec.CommandContext(ctx, "pg_restore",
        "-d", app.Settings().Database.URL,
        "-c",  // 先清理
        backupPath,
    )
    return cmd.Run()
}
```

---

## 5. 迁移相关

### 5.1 初始化迁移 Schema

**核心文件**: `migrations/1640988000_init.go`

**需要修改的 SQL**:

```sql
-- 当前 SQLite
CREATE TABLE {{_collections}} (
    [[id]]         TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
    [[system]]     BOOLEAN DEFAULT FALSE NOT NULL,
    [[type]]       TEXT DEFAULT "base" NOT NULL,
    [[name]]       TEXT UNIQUE NOT NULL,
    [[fields]]     JSON DEFAULT "[]" NOT NULL,
    [[indexes]]    JSON DEFAULT "[]" NOT NULL,
    [[created]]    TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
    [[updated]]    TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
);

-- PostgreSQL 迁移后
CREATE TABLE {{_collections}} (
    [[id]]         TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
    [[system]]     BOOLEAN DEFAULT FALSE NOT NULL,
    [[type]]       TEXT DEFAULT 'base' NOT NULL,
    [[name]]       TEXT UNIQUE NOT NULL,
    [[fields]]     JSONB DEFAULT '[]'::jsonb NOT NULL,
    [[indexes]]    JSONB DEFAULT '[]'::jsonb NOT NULL,
    [[created]]    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    [[updated]]    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### 5.2 字段类型映射

| SQLite 类型 | PostgreSQL 类型 | 说明 |
|------------|----------------|------|
| `TEXT` | `TEXT` | 相同 |
| `INTEGER` | `INTEGER` / `BIGINT` | 根据范围选择 |
| `REAL` | `DOUBLE PRECISION` | 浮点数 |
| `BOOLEAN` | `BOOLEAN` | PostgreSQL 原生支持 |
| `JSON` | `JSONB` | 使用二进制 JSON |
| `BLOB` | `BYTEA` | 二进制数据 |
| `TEXT` (日期) | `TIMESTAMPTZ` | 时间戳 |

---

## 6. 测试框架

### 6.1 测试数据文件

| 文件路径 | 说明 | 迁移方案 |
|---------|------|---------|
| `tests/data/data.db` | SQLite 测试数据库 | 转换为 PostgreSQL dump |
| `tests/data/auxiliary.db` | SQLite 辅助数据库 | 转换为 PostgreSQL dump |
| `tests/data/storage/` | 测试存储目录 | 保持不变 |

### 6.2 测试辅助函数

**核心文件**: `tests/app.go`

需要修改:
1. 测试数据库初始化逻辑
2. 添加 PostgreSQL 容器启动 (dockertest)
3. 测试数据导入方式

---

## 7. 关键风险点总结

### 7.1 高风险 (P0)

| 风险项 | 影响范围 | 工作量 | 测试复杂度 |
|-------|---------|-------|-----------|
| JSON 函数转换 | 全部查询 | 16h | 高 |
| 系统表查询替换 | 表管理、索引、视图 | 8h | 中 |
| PRAGMA 语句移除 | 连接、备份、优化 | 4h | 低 |
| ID 生成逻辑 | 所有表 | 4h | 低 |
| 时间函数转换 | 日期字段 | 4h | 低 |

### 7.2 中风险 (P1)

| 风险项 | 影响范围 | 工作量 | 测试复杂度 |
|-------|---------|-------|-----------|
| COLLATE NOCASE | 认证、搜索 | 4h | 中 |
| IS NOT 操作符 | 过滤查询 | 2h | 中 |
| 布尔值转换 | 过滤查询 | 2h | 低 |
| 备份恢复重写 | 运维功能 | 8h | 高 |

### 7.3 低风险 (P2)

| 风险项 | 影响范围 | 工作量 | 测试复杂度 |
|-------|---------|-------|-----------|
| 连接池配置 | 性能 | 2h | 低 |
| VACUUM 替换 | 维护 | 1h | 低 |
| 测试框架改造 | 开发流程 | 8h | 中 |

---

## 8. 文件修改清单

### 8.1 必须修改的文件 (P0)

```
core/
├── db_connect.go              # 驱动替换
├── db_connect_nodefaultdriver.go  # 驱动替换
├── db_table.go                # 系统表查询
├── base.go                    # 连接池、PRAGMA
├── base_backup.go             # 备份逻辑
├── record_field_resolver_runner.go  # JSON 函数
├── collection_record_table_sync.go  # JSON 函数、系统表
├── collection_validate.go     # 系统表查询
├── view.go                    # JSON 函数

tools/
├── dbutils/json.go            # JSON 辅助函数
├── search/filter.go           # 布尔值、操作符

migrations/
├── 1640988000_init.go         # 初始化 Schema
├── 1640988000_aux_init.go     # 辅助 Schema
└── *.go                       # 所有迁移文件
```

### 8.2 需要修改的文件 (P1)

```
apis/
├── record_auth_with_password.go  # COLLATE NOCASE
├── record_auth_with_oauth2.go    # COLLATE NOCASE

core/
├── record_query.go            # COLLATE NOCASE
├── field_text.go              # COLLATE NOCASE、类型

tools/
├── search/provider_test.go    # 测试驱动

tests/
├── app.go                     # 测试框架
└── data/                      # 测试数据
```

### 8.3 可能需要修改的文件 (P2)

```
go.mod                         # 依赖更新
modernc_versions_check.go      # 删除或重写
```

---

## 9. 迁移执行顺序建议

```
Phase 0: 基础设施 (1 周)
├── 1. 添加 PostgreSQL 驱动依赖
├── 2. 实现数据库适配器接口
├── 3. 创建 PostgreSQL 兼容函数
└── 4. 设置测试环境

Phase 1: 核心适配 (2 周)
├── 1. tools/dbutils/json.go 重写
├── 2. tools/search/filter.go 适配
├── 3. core/db_table.go 重写
├── 4. core/record_field_resolver_runner.go 适配
└── 5. 单元测试通过

Phase 2: 迁移脚本 (1 周)
├── 1. 重写所有 migrations/*.go
├── 2. 创建 PostgreSQL 初始化脚本
└── 3. 数据迁移工具

Phase 3: 功能完善 (1 周)
├── 1. 备份恢复重写
├── 2. COLLATE NOCASE 处理
├── 3. 集成测试
└── 4. 性能测试
```
