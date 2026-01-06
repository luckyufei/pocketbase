# PocketBase PostgreSQL 适配技术文档

> 本文档详细记录了 PocketBase 从 SQLite 切换到 PostgreSQL 的所有技术变更点。

## 目录

1. [概述](#概述)
2. [数据库连接层](#数据库连接层)
3. [SQL 语法差异处理](#sql-语法差异处理)
4. [JSON 操作适配](#json-操作适配)
5. [过滤器表达式生成](#过滤器表达式生成)
6. [视图管理](#视图管理)
7. [系统表查询](#系统表查询)
8. [PostgreSQL 兼容函数](#postgresql-兼容函数)
9. [实时同步桥接](#实时同步桥接)
10. [字段解析器适配](#字段解析器适配)
11. [迁移脚本](#迁移脚本)
12. [测试数据](#测试数据)

---

## 概述

### 主要变更对比

| 类别 | SQLite | PostgreSQL |
|------|--------|------------|
| **驱动** | `modernc.org/sqlite` | `github.com/jackc/pgx/v5` |
| **JSON 函数** | `json_each`, `json_extract` | `jsonb_array_elements_text`, `JSON_QUERY` |
| **布尔值** | `1`, `0` | `TRUE`, `FALSE` |
| **比较操作符** | `IS`, `IS NOT` | `IS NOT DISTINCT FROM`, `IS DISTINCT FROM` |
| **类型转换** | `CAST(...AS...)` | `CAST` 或 `::type` |
| **JOIN 语法** | 可省略 ON | 必须有 ON 子句 |
| **视图更新** | 直接替换 | 需要删除依赖后重建 |
| **系统表** | `sqlite_master`, `PRAGMA` | `information_schema` |
| **实时同步** | 不支持多实例 | `LISTEN/NOTIFY` |
| **连接池** | 120 (data) | 70 (data), 20 (aux) |

### 新增功能

1. **水平扩展支持**：通过 PostgreSQL 的 `LISTEN/NOTIFY` 实现多实例实时同步
2. **自动数据库创建**：连接时自动创建不存在的数据库
3. **兼容函数**：创建 SQLite 兼容的 PostgreSQL 函数

---

## 数据库连接层

### 文件位置
- `core/db_connect.go`
- `core/base.go`

### 连接函数

```go
// PostgreSQL 连接函数
// 连接字符串格式: "postgres://user:pass@127.0.0.1:5432?sslmode=disable"
func PostgresDBConnectFunc(connectionString string) DBConnectFunc {
    return func(dbName string) (*dbx.DB, error) {
        // 解析连接字符串并替换数据库名
        urlClone.Path = dbName
        db, err := dbx.MustOpen("pgx", urlClone.String())
        
        // 自动创建不存在的数据库
        if err != nil && regexp.MustCompile(`database ".+" does not exist`).MatchString(err.Error()) {
            createDatabase(connectionString, dbName)
            db, err = dbx.MustOpen("pgx", urlClone.String())
        }
        return db, nil
    }
}
```

### 连接池配置

```go
// PostgreSQL 默认连接数（比 SQLite 少，因为 PostgreSQL 默认最大连接数是 100）
DefaultDataMaxOpenConns int = 70   // SQLite: 120
DefaultAuxMaxOpenConns  int = 20   // SQLite: 无单独配置
```

### 配置结构

```go
type BaseAppConfig struct {
    PostgresURL      string // eg: "postgres://user:pass@localhost:5432?sslmode=disable"
    PostgresDataDB   string // eg: "pb-data"
    PostgresAuxDB    string // eg: "pb-auxiliary"
    IsRealtimeBridge bool   // 启用实时同步桥接
}
```

### 关键差异

```go
// PostgreSQL 不需要分离并发和非并发连接（SQLite 需要是因为写锁）
nonconcurrentDB := concurrentDB  // 共享同一连接池
```

---

## SQL 语法差异处理

### 布尔值表示

```go
// SQLite
"true": "1"
"false": "0"

// PostgreSQL
"true":  "TRUE"
"false": "FALSE"
```

### 相等比较操作符

```go
// SQLite
equalOp := "="
nullEqualOp := "IS"
notEqualOp := "IS NOT"

// PostgreSQL
equalOp := "="
nullEqualOp := "IS NOT DISTINCT FROM"  // 处理 NULL 值比较
notEqualOp := "IS DISTINCT FROM"       // 处理 NULL 值不等比较
```

**原因**：
- SQLite 的 `IS` 和 `IS NOT` 可以正确处理 NULL 值比较
- PostgreSQL 的 `IS` 只能用于 `IS NULL` / `IS NOT NULL`
- PostgreSQL 需要使用 `IS NOT DISTINCT FROM` 来实现类似 SQLite `IS` 的语义

### JOIN 语法

```go
// SQLite - 可以省略 ON 子句
"LEFT JOIN (%s) {{%s}}"

// PostgreSQL - 必须有 ON 子句
"LEFT JOIN (%s) {{%s}} ON 1 = 1"
```

### 类型转换语法

```go
// SQLite - 只支持标准 CAST
var castRegex = regexp.MustCompile(`(?is)^cast\s*\(.*\s+as\s+(\w+)\s*\)$`)

// PostgreSQL - 支持标准 CAST 和 :: 语法
var castRegex = regexp.MustCompile(`(?is)^cast\s*\([\s\S]*\s+as\s+(\w+)\s*\)$`)
var castRegex2 = regexp.MustCompile(`(?is)^[\s\S]*::(\w+)\s*$`)
```

---

## JSON 操作适配

### 文件位置
- `tools/dbutils/json.go`

### JSON 数组展开

```go
// SQLite
func JSONEach(column string) string {
    return fmt.Sprintf(
        `json_each(CASE WHEN iif(json_valid([[%s]]), json_type([[%s]])='array', FALSE) 
         THEN [[%s]] ELSE json_array([[%s]]) END)`,
        column, column, column, column,
    )
}

// PostgreSQL
func JSONEach(column string) string {
    return fmt.Sprintf(
        `jsonb_array_elements_text(CASE WHEN ([[%s]] IS JSON OR json_valid([[%s]]::text)) 
         AND jsonb_typeof([[%s]]::jsonb) = 'array' 
         THEN [[%s]]::jsonb 
         ELSE jsonb_build_array([[%s]]) END)`,
        column, column, column, column, column,
    )
}
```

### JSON 数组包含检查

```go
// PostgreSQL 使用 `?` 操作符检查 JSON 数组是否包含某个字符串
func JsonArrayExistsStr(column string, strValue string) dbx.Expression {
    return dbx.NewExp(fmt.Sprintf("[[%s]] ? {:value}::text", column), dbx.Params{
        "value": strValue,
    })
}
```

### JSON 数组长度

```go
// SQLite
func JSONArrayLength(column string) string {
    return fmt.Sprintf(
        `json_array_length(CASE WHEN iif(json_valid([[%s]]), json_type([[%s]])='array', FALSE) 
         THEN [[%s]] ELSE ... END)`,
        column, column, column,
    )
}

// PostgreSQL
func JSONArrayLength(column string) string {
    return fmt.Sprintf(
        `(CASE WHEN ([[%s]] IS JSON OR JSON_VALID([[%s]]::text)) 
         AND jsonb_typeof([[%s]]::jsonb) = 'array' 
         THEN jsonb_array_length([[%s]]::jsonb) ELSE 0 END)`,
        column, column, column, column,
    )
}
```

### JSON 路径提取

```go
// SQLite
func JSONExtract(column string, path string) string {
    return fmt.Sprintf(
        "(CASE WHEN json_valid([[%s]]) THEN JSON_EXTRACT([[%s]], '$%s') 
         ELSE JSON_EXTRACT(json_object('pb', [[%s]]), '$.pb%s') END)",
        column, column, path, column, path,
    )
}

// PostgreSQL - 使用自定义函数
func JSONExtract(column string, path string) string {
    return fmt.Sprintf(
        `JSON_QUERY_OR_NULL([[%s]], '$%s')::jsonb`,
        column, path,
    )
}
```

---

## 过滤器表达式生成

### 文件位置
- `tools/search/filter.go`

### 数值参数处理

PostgreSQL 的强类型验证会导致问题：

```go
// 问题场景：查询 "1=1"
// SQLite: 正常工作
// PostgreSQL: 生成 "SELECT xxx WHERE $1 = $2" 并传入 [1, 1]
// 由于未指定类型，PostgreSQL 将 $1 和 $2 视为 text，导致类型转换错误

// 解决方案：直接使用数字字面量而非占位符
case fexpr.TokenNumber:
    safeNumberStr := strconv.FormatFloat(cast.ToFloat64(token.Literal), 'f', -1, 64)
    return &ResolverResult{
        Identifier: safeNumberStr,  // 直接使用数字，避免类型推断问题
        Params:     dbx.Params{},
    }, nil
```

### 空字符串特殊处理

```go
// PostgreSQL: 提前展开空字符串
if token.Literal == "" {
    return &ResolverResult{Identifier: `''`}, nil
}
```

### 类型感知的比较

```go
// PostgreSQL 需要处理跨类型比较
func resolveOrderingExpr(op string, l, r *ResolverResult) dbx.Expression {
    lType := inferDeterministicType(l)
    rType := inferDeterministicType(r)

    // 如果两边类型不同，需要进行类型转换
    if lType != "" && rType != "" && lType != rType {
        if lType == "numeric" {
            right = withNonJsonbType(right, "numeric")
        } else if rType == "numeric" {
            left = withNonJsonbType(left, "numeric")
        } else {
            // 都转为 text 进行比较
            left = withNonJsonbType(left, "text")
            right = withNonJsonbType(right, "text")
        }
    }
    
    return dbx.NewExp(fmt.Sprintf("%s %s %s", left, op, right), ...)
}
```

### JSONB 类型转换

```go
// 使用 to_jsonb() 消除类型差异，实现跨类型比较
func castToJsonb(identifier *ResolverResult) string {
    if strings.ToLower(identifier.Identifier) == "null" {
        return "to_jsonb(NULL::text)"
    }
    if tp := inferPolymorphicLiteral(identifier); tp != "" {
        return fmt.Sprintf("to_jsonb(%s::%s)", identifier.Identifier, tp)
    }
    return fmt.Sprintf("to_jsonb(%s)", identifier.Identifier)
}
```

---

## 视图管理

### 文件位置
- `core/view.go`

### 视图依赖处理

PostgreSQL 不支持直接修改被依赖的视图，需要：
1. 获取所有依赖当前视图的其他视图
2. 按拓扑排序逆序删除依赖视图
3. 删除并重建当前视图
4. 按拓扑排序顺序重建依赖视图

```go
func (app *BaseApp) SaveView(name string, selectQuery string) error {
    return app.RunInTransaction(func(txApp App) error {
        // 获取依赖视图
        dependentViews, err := findDependentViews(txApp, name)
        
        // 逆序删除依赖视图
        for i := len(dependentViews) - 1; i >= 0; i-- {
            txApp.DeleteView(dependentViews[i].Name)
        }
        
        // 删除并重建当前视图
        txApp.DeleteView(name)
        viewQuery := fmt.Sprintf("CREATE VIEW {{%s}} AS SELECT * FROM (%s)", name, selectQuery)
        txApp.DB().NewQuery(viewQuery).Execute()
        
        // 重建依赖视图
        for _, dependentView := range dependentViews {
            txApp.DB().NewQuery(dependentView.SQL).Execute()
        }
        
        return nil
    })
}
```

### 视图依赖查询

```go
// 使用 PostgreSQL 系统表查询视图依赖关系
func findDependentViews(app App, tableOrViewName string) ([]viewDef, error) {
    query := `
        SELECT u.view_name, u.table_name referenced_table_name, v.view_definition
        FROM information_schema.view_table_usage u
        JOIN information_schema.views v ON u.view_schema = v.table_schema
            AND u.view_name = v.table_name
        WHERE u.table_schema = current_schema()
        ORDER BY u.view_name;
    `
    // 使用拓扑排序确定正确的删除/重建顺序
}
```

---

## 系统表查询

### 文件位置
- `core/db_table.go`

### 表列名查询

```go
// SQLite
"SELECT name FROM PRAGMA_TABLE_INFO({:tableName})"

// PostgreSQL
`SELECT column_name
 FROM information_schema.columns
 WHERE table_name = {:tableName}
   AND table_schema = current_schema()`
```

### 表信息查询

```go
// SQLite
"SELECT * FROM PRAGMA_TABLE_INFO({:tableName})"

// PostgreSQL
`SELECT 
    ordinal_position - 1 AS cid,
    c.column_name AS name,
    data_type AS type,
    CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END AS notnull,
    column_default AS dflt_value,
    CASE WHEN pk.constraint_type = 'PRIMARY KEY' THEN 1 ELSE 0 END AS pk
FROM information_schema.columns c
LEFT JOIN (...) pk ON c.column_name = pk.column_name
WHERE c.table_name = {:table_name} AND c.table_schema = current_schema()`
```

### 表索引查询

```go
// SQLite
`SELECT name, sql FROM sqlite_master 
 WHERE type = 'index' AND tbl_name = {:tableName} AND sql IS NOT NULL`

// PostgreSQL
`SELECT indexname, indexdef
 FROM pg_indexes
 WHERE tablename = {:tableName}
 AND indexname NOT IN (
     SELECT conname FROM pg_constraint
     WHERE contype = 'p' AND conrelid = {:tableName}::regclass
 )`
```

### 删除表

```go
// SQLite
"DROP TABLE IF EXISTS {{%s}}"

// PostgreSQL - 使用 CASCADE 删除依赖对象
"DROP TABLE IF EXISTS {{%s}} CASCADE"
```

### 检查表是否存在

```go
// SQLite
`SELECT (1) FROM sqlite_schema 
 WHERE type IN ('table', 'view') AND LOWER(name) = LOWER({:tableName})`

// PostgreSQL
`SELECT 1 FROM information_schema.tables
 WHERE table_schema = current_schema()
   AND lower(table_name) = lower({:tableName})`
```

---

## PostgreSQL 兼容函数

### 文件位置
- `migrations/postgres_functions.go`

### UUID v7 生成函数

```sql
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid AS $$
BEGIN
    -- 使用随机 v4 uuid 作为起点
    -- 然后覆盖时间戳
    -- 设置版本 7 标志位
    RETURN encode(
        set_bit(set_bit(
            overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
                from 1 for 6
            ), 52, 1
        ), 53, 1),
        'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;
```

### 大小写不敏感排序规则

```sql
-- 添加 "nocase" 排序规则以兼容 SQLite 的内置 "nocase" 排序规则
CREATE COLLATION IF NOT EXISTS "nocase" (
    provider = icu,
    locale = 'und-u-ks-level2',
    deterministic = false
);
```

### JSON 验证函数

```sql
CREATE OR REPLACE FUNCTION json_valid(text) RETURNS boolean AS $$
BEGIN
    PERFORM $1::jsonb;
    RETURN TRUE;
EXCEPTION WHEN others THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### JSON 查询函数（容错版本）

```sql
-- 处理任意类型的 JSON 查询，出错时返回 NULL
CREATE OR REPLACE FUNCTION json_query_or_null(p_input anyelement, p_query text) 
RETURNS jsonb AS $$
BEGIN
    RETURN JSON_QUERY(p_input::text::jsonb, p_query);
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
```

### SQLite 兼容函数

```sql
-- hex() 函数
CREATE OR REPLACE FUNCTION hex(data bytea) RETURNS text AS $$
    SELECT encode(data, 'hex')
$$ LANGUAGE SQL IMMUTABLE;

-- randomblob() 函数
CREATE OR REPLACE FUNCTION randomblob(length integer) RETURNS bytea AS $$
    SELECT gen_random_bytes(length)
$$ LANGUAGE SQL IMMUTABLE;
```

---

## 实时同步桥接

### 文件位置
- `apis/realtime_bridge.go`
- `apis/realtime_bridgedclient.go`

### 架构图

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  PocketBase #1  │     │  PocketBase #2  │     │  PocketBase #3  │
│  (Channel: c_1) │     │  (Channel: c_2) │     │  (Channel: c_3) │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   PostgreSQL Database   │
                    │   LISTEN/NOTIFY         │
                    │   shared_bridge_channel │
                    └─────────────────────────┘
```

### 数据表结构

```sql
-- 频道注册表（心跳检测）
CREATE TABLE "_realtimeChannels" (
    "channelId" TEXT PRIMARY KEY,
    "validUntil" TIMESTAMP NOT NULL
);

-- 客户端订阅表
CREATE TABLE "_realtimeClients" (
    "clientId" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "subscriptions" TEXT[] NOT NULL,
    "authCollectionRef" TEXT NOT NULL DEFAULT '',
    "authRecordRef" TEXT NOT NULL DEFAULT '',
    "updatedByChannelId" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX "_realtimeClients_channelId_idx" ON "_realtimeClients" ("channelId");
```

### 消息类型

| 消息类型 | 说明 |
|---------|------|
| `subscription_upsert` | 订阅更新 |
| `subscription_delete` | 订阅删除 |
| `subscription_channel_offline` | 频道离线 |
| `collection_updated` | 集合定义更新 |
| `settings_updated` | 系统设置更新 |

### 监听共享频道

```go
func (t *RealtimeBridge) listenSharedBridgeChannelLoop(ctx context.Context) {
    loopOnNotification(ctx, t.app, "shared_bridge_channel", func() {
        // 连接后刷新订阅
        t.fullRefreshSubscriptions()
        t.app.ReloadCachedCollections()
        t.app.ReloadSettings()
    }, func(notification *pgconn.Notification) {
        switch messageType {
        case "subscription_upsert":
            // 处理订阅更新
        case "subscription_delete":
            // 处理订阅删除
        case "subscription_channel_offline":
            // 处理频道离线，清理该频道的所有客户端
        case "collection_updated":
            t.app.ReloadCachedCollections()
        case "settings_updated":
            t.app.ReloadSettings()
        }
    })
}
```

### 跨实例消息发送

```go
func (t *RealtimeBridge) SendViaBridge(channelId string, clientId string, message subscriptions.Message) {
    t.app.DB().NewQuery(`
        SELECT pg_notify({:channelId}, {:payload})
    `).Bind(dbx.Params{
        "channelId": channelId,
        "payload":   clientId + "|" + message.Name + "|" + string(message.Data),
    }).Execute()
}
```

### 心跳机制

```go
func (t *RealtimeBridge) heartbeatLoop(ctx context.Context) {
    // 每 30 秒更新心跳，清理超时的频道
    t.app.DB().NewQuery(`
        WITH 
            insert_operation AS (
                INSERT INTO "_realtimeChannels" ("channelId", "validUntil")
                VALUES ({:channelId}, now() + interval '40 seconds')
                ON CONFLICT ("channelId") DO UPDATE SET "validUntil" = EXCLUDED."validUntil"
            ),
            deleted_channels AS (
                DELETE FROM "_realtimeChannels" WHERE "validUntil" < now()
                RETURNING "channelId"
            ),
            _ AS (
                DELETE FROM "_realtimeClients"
                WHERE "channelId" IN (SELECT "channelId" FROM deleted_channels)
            )
        SELECT pg_notify('shared_bridge_channel', 'subscription_channel_offline|' || "channelId") 
        FROM deleted_channels;
    `)
}
```

---

## 字段解析器适配

### 文件位置
- `core/record_field_resolver.go`
- `core/record_field_resolver_runner.go`

### JOIN 子句必须有 ON 条件

```go
func (r *RecordFieldResolver) registerJoin(tableName string, tableAlias string, on dbx.Expression) error {
    // PostgreSQL 不允许没有 ON 子句的 JOIN
    if on == nil {
        on = dbx.NewExp("1=1")
    }
    // ...
}
```

### 空字符串特殊处理

```go
// PostgreSQL 特有：提前展开空字符串
if resultVal == "" && (modifier == "" || modifier == lowerModifier) {
    return &search.ResolverResult{Identifier: `''`}, nil
}
```

### JSON 数组展开（`:each` 修饰符）

```go
func (r *runner) processRequestBodyEachModifier(bodyField Field) (*search.ResolverResult, error) {
    // SQLite:
    // jeTable := fmt.Sprintf("json_each({:%s})", placeholder)
    
    // PostgreSQL:
    jeTable := dbutils.JSONEachByPlaceholder(placeholder)
}
```

---

## 迁移脚本

### 文件位置
- `migrations/1640988000_init.go`
- `migrations/1640988000_aux_init.go`

### 主要变更

1. **主键生成**：使用 `uuid_generate_v7()` 替代 SQLite 的自增 ID
2. **JSON 类型**：使用 `JSONB` 替代 `TEXT`
3. **时间戳类型**：使用 `TIMESTAMP` 替代 `TEXT`
4. **索引语法**：适配 PostgreSQL 索引语法

---

## 测试数据

### 文件位置
- `tests/data/data.pg-dump.sql` - PostgreSQL 测试数据
- `tests/data/auxiliary.pg-dump.sql` - 辅助数据库测试数据
- `tests/data/Makefile` - 数据导出脚本

### 测试问题修复

- `tests/issues/issue_35_test.go` - DateTime 字段空值插入问题
- `tests/issues/issue_49_test.go` - DateTime 过滤查询问题

---

## 启动命令

```bash
# 使用 PostgreSQL 启动
go run main.go serve \
    --postgresUrl="postgres://user:pass@localhost:5432/postgres?sslmode=disable" \
    --postgresDataDB="pb-data" \
    --postgresAuxDB="pb-auxiliary"
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `POSTGRES_URL` | PostgreSQL 连接字符串 | `postgres://user:pass@127.0.0.1:5432/postgres?sslmode=disable` |
| `POSTGRES_DATA_DB` | 数据数据库名 | `pb-data` |
| `POSTGRES_AUX_DB` | 辅助数据库名 | `pb-auxiliary` |

---

## 已知限制

1. **备份功能**：PostgreSQL 版本的备份功能需要额外配置
2. **日志排序**：使用 `ctid` 替代 SQLite 的 `rowid` 进行日志排序
3. **类型强制**：PostgreSQL 的强类型系统需要更多的显式类型转换

---

## 参考资料

- [pgx 驱动文档](https://github.com/jackc/pgx)
- [PostgreSQL LISTEN/NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL JSON 函数](https://www.postgresql.org/docs/current/functions-json.html)
