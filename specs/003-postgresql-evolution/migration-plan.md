# PocketBase SQLite → PostgreSQL 迁移实施计划

> **版本**: v1.0
> **更新日期**: 2026-01-07
> **状态**: 规划中

---

## 1. 迁移概述

### 1.1 目标

将 PocketBase 的数据库后端从 SQLite 迁移到 PostgreSQL，同时：
- 保持 API 100% 兼容
- 保持 Hook 机制完全兼容
- 支持 PostgreSQL 15+

### 1.2 迁移范围

| 类别 | 文件数量 | 修改类型 |
|------|---------|---------|
| 核心数据库层 | 10+ | 重写 |
| 工具函数 | 5+ | 适配 |
| 迁移脚本 | 7 | 重写 |
| 测试框架 | 3+ | 改造 |
| API 层 | 4+ | 微调 |

### 1.3 不在范围内

- UI 修改 Schema 功能 (生产最佳实践)
- UI 恢复数据库功能 (安全考虑)
- 单文件部署 (改为 Docker Compose)

---

## 2. 技术架构

### 2.1 数据库适配器设计

```
┌─────────────────────────────────────────────────────────────┐
│                      PocketBase Core                        │
├─────────────────────────────────────────────────────────────┤
│                    Database Adapter Interface               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ JSONExtract │  │ TableInfo   │  │ SystemTableQueries  │ │
│  │ JSONEach    │  │ TableIndexes│  │ BackupRestore       │ │
│  │ JSONLength  │  │ HasTable    │  │ ConnectionPool      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   SQLite Adapter    │    │   PostgreSQL Adapter        │ │
│  │   (modernc/sqlite)  │    │   (jackc/pgx)               │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 新增文件结构

```
core/
├── db_adapter.go              # 数据库适配器接口
├── db_adapter_sqlite.go       # SQLite 实现
├── db_adapter_postgres.go     # PostgreSQL 实现
├── db_connect_postgres.go     # PostgreSQL 连接

tools/
├── dbutils/
│   ├── json.go               # 通用接口
│   ├── json_sqlite.go        # SQLite JSON 函数
│   └── json_postgres.go      # PostgreSQL JSON 函数

migrations/
├── postgres/                  # PostgreSQL 专用迁移
│   ├── 0001_init.go
│   ├── 0002_functions.go     # 兼容函数
│   └── ...
```

---

## 3. 分阶段实施计划

### Phase 0: 基础设施搭建 (预计 1 周)

#### 3.0.1 添加 PostgreSQL 驱动依赖

**任务**:
1. 在 `go.mod` 添加 `github.com/jackc/pgx/v5`
2. 添加 `github.com/jackc/pgxpool` 连接池
3. 更新依赖

**修改文件**:
- `go.mod`
- `go.sum`

#### 3.0.2 创建数据库适配器接口

**任务**:
1. 定义 `DBAdapter` 接口
2. 抽象数据库特定操作

**新增文件**: `core/db_adapter.go`

```go
package core

import "github.com/pocketbase/dbx"

// DBAdapter 定义数据库适配器接口
type DBAdapter interface {
    // 连接管理
    Connect(config DBConfig) (*dbx.DB, error)
    
    // JSON 操作
    JSONExtract(column, path string) string
    JSONEach(column string) string
    JSONArrayLength(column string) string
    
    // 系统表查询
    TableInfo(db dbx.Builder, tableName string) ([]*TableInfoRow, error)
    TableIndexes(db dbx.Builder, tableName string) (map[string]string, error)
    HasTable(db dbx.Builder, tableName string) bool
    
    // 备份恢复
    CreateBackup(ctx context.Context, path string) error
    RestoreBackup(ctx context.Context, path string) error
    
    // 数据库特定
    Vacuum(db dbx.Builder) error
    Optimize(db dbx.Builder) error
    
    // 类型转换
    BoolValue(v bool) string
    TimestampDefault() string
    IDDefault() string
}
```

#### 3.0.3 创建 PostgreSQL 兼容函数

**新增文件**: `migrations/postgres/0002_functions.go`

```sql
-- UUID v7 生成函数
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid AS $$
DECLARE
    unix_ts_ms bytea;
    uuid_bytes bytea;
BEGIN
    unix_ts_ms = substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
    uuid_bytes = unix_ts_ms || gen_random_bytes(10);
    uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
    uuid_bytes = set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
    RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

-- PocketBase ID 生成函数 (兼容格式)
CREATE OR REPLACE FUNCTION pb_generate_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'r' || lower(encode(gen_random_bytes(7), 'hex'));
END
$$ LANGUAGE plpgsql VOLATILE;

-- nocase 排序规则
CREATE COLLATION IF NOT EXISTS nocase (
    provider = icu,
    locale = 'und-u-ks-level2',
    deterministic = false
);

-- json_valid 兼容函数
CREATE OR REPLACE FUNCTION json_valid(text) RETURNS boolean AS $$
BEGIN
    PERFORM $1::jsonb;
    RETURN TRUE;
EXCEPTION WHEN others THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- json_query_or_null 兼容函数 (PG15 兼容)
CREATE OR REPLACE FUNCTION json_query_or_null(data jsonb, path text)
RETURNS jsonb AS $$
BEGIN
    RETURN jsonb_path_query_first(data, path::jsonpath);
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### 3.0.4 设置测试环境

**任务**:
1. 添加 `dockertest` 依赖
2. 创建 PostgreSQL 容器启动逻辑
3. 配置 CI/CD 双数据库测试

**新增文件**: `tests/postgres_helper.go`

```go
package tests

import (
    "github.com/ory/dockertest/v3"
)

func SetupPostgresContainer() (*dockertest.Pool, *dockertest.Resource, string, error) {
    pool, err := dockertest.NewPool("")
    if err != nil {
        return nil, nil, "", err
    }
    
    resource, err := pool.Run("postgres", "15", []string{
        "POSTGRES_PASSWORD=test",
        "POSTGRES_USER=test",
        "POSTGRES_DB=pocketbase_test",
    })
    if err != nil {
        return nil, nil, "", err
    }
    
    connStr := fmt.Sprintf("postgres://test:test@localhost:%s/pocketbase_test?sslmode=disable",
        resource.GetPort("5432/tcp"))
    
    // 等待数据库就绪
    pool.Retry(func() error {
        db, err := sql.Open("pgx", connStr)
        if err != nil {
            return err
        }
        return db.Ping()
    })
    
    return pool, resource, connStr, nil
}
```

---

### Phase 1: 核心数据库层适配 (预计 2 周)

#### 3.1.1 JSON 函数重写

**修改文件**: `tools/dbutils/json.go`

**当前实现**:
```go
func JSONEach(column string) string {
    return fmt.Sprintf(
        `json_each(CASE WHEN iif(json_valid([[%s]]), json_type([[%s]])='array', FALSE) THEN [[%s]] ELSE json_array([[%s]]) END)`,
        column, column, column, column,
    )
}
```

**PostgreSQL 实现**:
```go
func JSONEachPostgres(column string) string {
    return fmt.Sprintf(
        `jsonb_array_elements(
            CASE 
                WHEN [[%s]] IS NOT NULL AND jsonb_typeof([[%s]]::jsonb) = 'array' 
                THEN [[%s]]::jsonb 
                ELSE jsonb_build_array([[%s]]) 
            END
        )`,
        column, column, column, column,
    )
}

func JSONExtractPostgres(column string, path string) string {
    if path == "" {
        return fmt.Sprintf("[[%s]]::jsonb", column)
    }
    
    // 转换 JSONPath: $.a.b -> {a,b}
    pgPath := convertJSONPathToPostgres(path)
    
    return fmt.Sprintf(
        `COALESCE([[%s]]::jsonb #> '%s', NULL)`,
        column, pgPath,
    )
}

func JSONArrayLengthPostgres(column string) string {
    return fmt.Sprintf(
        `COALESCE(
            jsonb_array_length(
                CASE 
                    WHEN [[%s]] IS NOT NULL AND jsonb_typeof([[%s]]::jsonb) = 'array' 
                    THEN [[%s]]::jsonb 
                    ELSE '[]'::jsonb 
                END
            ), 
            0
        )`,
        column, column, column,
    )
}
```

#### 3.1.2 过滤器适配

**修改文件**: `tools/search/filter.go`

**修改点**:

1. 布尔值标识符:
```go
// 添加数据库类型检测
var normalizedIdentifiers = map[string]string{
    "null": "NULL",
    "true": "TRUE",   // PostgreSQL
    "false": "FALSE", // PostgreSQL
}
```

2. 不等于操作符:
```go
// 行 337-340
if !equal {
    equalOp = "IS DISTINCT FROM"  // PostgreSQL 兼容
    nullEqualOp = "IS DISTINCT FROM"
    concatOp = "AND"
    nullExpr = "IS NOT NULL"
}
```

#### 3.1.3 系统表查询重写

**修改文件**: `core/db_table.go`

**PostgreSQL 实现**:

```go
// TableColumns - PostgreSQL 版本
func (app *BaseApp) TableColumnsPostgres(tableName string) ([]string, error) {
    columns := []string{}
    err := app.ConcurrentDB().NewQuery(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = {:tableName}
        ORDER BY ordinal_position
    `).Bind(dbx.Params{"tableName": tableName}).Column(&columns)
    return columns, err
}

// TableInfo - PostgreSQL 版本
func (app *BaseApp) TableInfoPostgres(tableName string) ([]*TableInfoRow, error) {
    info := []*TableInfoRow{}
    err := app.ConcurrentDB().NewQuery(`
        SELECT 
            ordinal_position - 1 as cid,
            column_name as name,
            data_type as type,
            CASE WHEN is_nullable = 'NO' THEN true ELSE false END as notnull,
            column_default as dflt_value,
            CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END as pk
        FROM information_schema.columns c
        LEFT JOIN (
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = {:tableName} AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_name = {:tableName}
        ORDER BY ordinal_position
    `).Bind(dbx.Params{"tableName": tableName}).All(&info)
    return info, err
}

// TableIndexes - PostgreSQL 版本
func (app *BaseApp) TableIndexesPostgres(tableName string) (map[string]string, error) {
    indexes := []struct {
        Name string `db:"indexname"`
        Sql  string `db:"indexdef"`
    }{}
    
    err := app.ConcurrentDB().NewQuery(`
        SELECT indexname, indexdef as sql
        FROM pg_indexes
        WHERE tablename = {:tableName}
    `).Bind(dbx.Params{"tableName": tableName}).All(&indexes)
    
    if err != nil {
        return nil, err
    }
    
    result := make(map[string]string, len(indexes))
    for _, idx := range indexes {
        result[idx.Name] = idx.Sql
    }
    return result, nil
}

// HasTable - PostgreSQL 版本
func (app *BaseApp) hasTablePostgres(db dbx.Builder, tableName string) bool {
    var exists int
    err := db.NewQuery(`
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = {:tableName}
        LIMIT 1
    `).Bind(dbx.Params{"tableName": tableName}).Row(&exists)
    return err == nil && exists > 0
}
```

#### 3.1.4 记录字段解析器适配

**修改文件**: `core/record_field_resolver_runner.go`

**主要修改点**:
- 行 343: `json_each` → `jsonb_array_elements`
- 行 362: `json_each` → `jsonb_array_elements`
- 行 832: `json_extract` → JSONB 操作符

---

### Phase 2: 迁移脚本重写 (预计 1 周)

#### 3.2.1 初始化迁移

**修改文件**: `migrations/1640988000_init.go`

**PostgreSQL 版本**:

```go
func init() {
    core.SystemMigrations.Register(func(txApp core.App) error {
        if txApp.DBType() != "postgres" {
            return nil // 跳过非 PostgreSQL
        }
        
        // 创建扩展
        txApp.DB().NewQuery(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            CREATE EXTENSION IF NOT EXISTS "pg_trgm";
        `).Execute()
        
        // 创建兼容函数
        txApp.DB().NewQuery(`
            CREATE OR REPLACE FUNCTION pb_generate_id()
            RETURNS TEXT AS $$
            BEGIN
                RETURN 'r' || lower(encode(gen_random_bytes(7), 'hex'));
            END
            $$ LANGUAGE plpgsql VOLATILE;
        `).Execute()
        
        // 创建 _collections 表
        _, execerr := txApp.DB().NewQuery(`
            CREATE TABLE {{_collections}} (
                [[id]]         TEXT PRIMARY KEY DEFAULT pb_generate_id() NOT NULL,
                [[system]]     BOOLEAN DEFAULT FALSE NOT NULL,
                [[type]]       TEXT DEFAULT 'base' NOT NULL,
                [[name]]       TEXT UNIQUE NOT NULL,
                [[fields]]     JSONB DEFAULT '[]'::jsonb NOT NULL,
                [[indexes]]    JSONB DEFAULT '[]'::jsonb NOT NULL,
                [[listRule]]   TEXT DEFAULT NULL,
                [[viewRule]]   TEXT DEFAULT NULL,
                [[createRule]] TEXT DEFAULT NULL,
                [[updateRule]] TEXT DEFAULT NULL,
                [[deleteRule]] TEXT DEFAULT NULL,
                [[options]]    JSONB DEFAULT '{}'::jsonb NOT NULL,
                [[created]]    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
                [[updated]]    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx__collections_type ON {{_collections}} ([[type]]);
        `).Execute()
        
        if execerr != nil {
            return fmt.Errorf("_collections exec error: %w", execerr)
        }
        
        // ... 其他表创建
        return nil
    }, nil)
}
```

#### 3.2.2 辅助数据库迁移

**修改文件**: `migrations/1640988000_aux_init.go`

**PostgreSQL 版本** (日志表使用 UNLOGGED + 分区):

```go
func init() {
    core.AuxSystemMigrations.Register(func(txApp core.App) error {
        if txApp.DBType() != "postgres" {
            return nil
        }
        
        _, execErr := txApp.AuxDB().NewQuery(`
            -- 创建日志主表 (UNLOGGED + 分区)
            CREATE UNLOGGED TABLE IF NOT EXISTS {{_logs}} (
                [[id]]        TEXT NOT NULL,
                [[level]]     INTEGER DEFAULT 0 NOT NULL,
                [[message]]   TEXT DEFAULT '' NOT NULL,
                [[data]]      JSONB DEFAULT '{}'::jsonb NOT NULL,
                [[created]]   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
                PRIMARY KEY ([[id]], [[created]])
            ) PARTITION BY RANGE ([[created]]);
            
            -- 创建默认分区
            CREATE UNLOGGED TABLE IF NOT EXISTS {{_logs_default}} 
            PARTITION OF {{_logs}} DEFAULT;
            
            -- 创建索引
            CREATE INDEX IF NOT EXISTS idx__logs_created ON {{_logs}} ([[created]]);
            CREATE INDEX IF NOT EXISTS idx__logs_level ON {{_logs}} ([[level]]) WHERE [[level]] > 0;
        `).Execute()
        
        return execErr
    }, nil)
}
```

---

### Phase 3: 功能完善 (预计 1 周)

#### 3.3.1 备份恢复重写

**修改文件**: `core/base_backup.go`

**PostgreSQL 实现**:

```go
func (app *BaseApp) CreateBackupPostgres(ctx context.Context, name string) error {
    // 检查 pg_dump 是否可用
    if _, err := exec.LookPath("pg_dump"); err != nil {
        return fmt.Errorf("pg_dump not found: %w", err)
    }
    
    tempPath := filepath.Join(app.DataDir(), LocalTempDirName, name+".dump")
    
    // 执行 pg_dump
    cmd := exec.CommandContext(ctx, "pg_dump",
        "-Fc",                          // 自定义格式
        "-f", tempPath,                 // 输出文件
        "-d", app.Settings().Database.URL,
    )
    
    if err := cmd.Run(); err != nil {
        return fmt.Errorf("pg_dump failed: %w", err)
    }
    
    // 打包上传文件
    // ...
    
    return nil
}

func (app *BaseApp) RestoreBackupPostgres(ctx context.Context, name string) error {
    // 检查 pg_restore 是否可用
    if _, err := exec.LookPath("pg_restore"); err != nil {
        return fmt.Errorf("pg_restore not found: %w", err)
    }
    
    // 下载备份文件
    // ...
    
    // 执行 pg_restore
    cmd := exec.CommandContext(ctx, "pg_restore",
        "-d", app.Settings().Database.URL,
        "-c",                           // 先清理
        "--if-exists",                  // 忽略不存在的对象
        backupPath,
    )
    
    if err := cmd.Run(); err != nil {
        return fmt.Errorf("pg_restore failed: %w", err)
    }
    
    return nil
}
```

#### 3.3.2 COLLATE NOCASE 处理

**修改文件**: `core/record_query.go`, `apis/record_auth_*.go`

**方案**: 使用 `LOWER()` 函数替代

```go
// 当前
expr = dbx.NewExp("[[email]] = {:email} COLLATE NOCASE", dbx.Params{"email": email})

// PostgreSQL
expr = dbx.NewExp("LOWER([[email]]) = LOWER({:email})", dbx.Params{"email": email})
```

#### 3.3.3 连接池配置

**修改文件**: `core/base.go`

```go
func (app *BaseApp) initPostgresDB() error {
    config, err := pgxpool.ParseConfig(app.Settings().Database.URL)
    if err != nil {
        return err
    }
    
    // 连接池配置
    config.MaxConns = int32(app.Settings().Database.MaxOpenConns)
    config.MinConns = int32(app.Settings().Database.MaxIdleConns)
    config.MaxConnLifetime = time.Hour
    config.MaxConnIdleTime = 10 * time.Minute
    config.HealthCheckPeriod = time.Minute
    
    pool, err := pgxpool.NewWithConfig(context.Background(), config)
    if err != nil {
        return err
    }
    
    // 包装为 dbx.DB
    db := dbx.NewFromDB(stdlib.OpenDBFromPool(pool), "pgx")
    
    app.concurrentDB = db
    app.nonconcurrentDB = db // PostgreSQL 不需要区分
    
    return nil
}
```

---

## 4. 测试策略

### 4.1 单元测试

| 测试类别 | 数量 | 覆盖范围 |
|---------|------|---------|
| JSON 函数测试 | 50+ | `tools/dbutils/json_test.go` |
| 过滤器测试 | 100+ | `tools/search/filter_test.go` |
| 系统表测试 | 20+ | `core/db_table_test.go` |
| 迁移测试 | 10+ | `migrations/*_test.go` |

### 4.2 集成测试

```bash
# 运行 PostgreSQL 测试
DB_TYPE=postgres go test ./...

# 运行 SQLite 测试 (回归)
DB_TYPE=sqlite go test ./...

# 运行双数据库测试
make test-all-db
```

### 4.3 性能测试

| 测试场景 | 指标 | 目标 |
|---------|------|------|
| 简单查询 | 响应时间 | < 10ms |
| JSON 查询 | 响应时间 | < 50ms |
| 并发写入 | QPS | > 1000 |
| 日志写入 | QPS | > 5000 |

---

## 5. 风险缓解

### 5.1 回滚计划

1. **代码回滚**: 使用 Git 分支管理，随时可回滚
2. **数据回滚**: 保留 SQLite 数据库文件作为备份
3. **功能开关**: 通过环境变量控制数据库类型

### 5.2 兼容性保证

1. **API 兼容**: 所有 REST API 接口保持不变
2. **数据兼容**: 提供数据迁移工具
3. **配置兼容**: 支持通过环境变量或配置文件指定数据库类型

---

## 6. 里程碑

| 里程碑 | 目标日期 | 交付物 |
|-------|---------|--------|
| M0: 基础设施 | Week 1 | 适配器接口、测试环境 |
| M1: 核心适配 | Week 3 | JSON 函数、系统表查询 |
| M2: 迁移脚本 | Week 4 | PostgreSQL 初始化脚本 |
| M3: 功能完善 | Week 5 | 备份恢复、集成测试 |
| M4: 发布准备 | Week 6 | 文档、性能测试、发布 |

---

## 7. 附录

### 7.1 环境变量配置

```bash
# 数据库类型
PB_DB_TYPE=postgres

# PostgreSQL 连接串
PB_DATABASE_URL=postgres://user:pass@localhost:5432/pocketbase?sslmode=disable

# 连接池配置
PB_DB_MAX_OPEN_CONNS=25
PB_DB_MAX_IDLE_CONNS=10
PB_DB_CONN_MAX_LIFETIME=3600
```

### 7.2 Docker Compose 模板

```yaml
version: '3.8'

services:
  pocketbase:
    build: .
    ports:
      - "8090:8090"
    environment:
      - PB_DB_TYPE=postgres
      - PB_DATABASE_URL=postgres://pocketbase:pocketbase@postgres:5432/pocketbase?sslmode=disable
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - pb_data:/pb_data

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=pocketbase
      - POSTGRES_PASSWORD=pocketbase
      - POSTGRES_DB=pocketbase
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pocketbase"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pb_data:
  pg_data:
```

### 7.3 数据迁移工具

```bash
# 从 SQLite 导出
pocketbase export --format=json --output=data.json

# 导入到 PostgreSQL
pocketbase import --format=json --input=data.json --db-type=postgres
```
