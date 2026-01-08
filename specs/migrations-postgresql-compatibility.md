# Migrations PostgreSQL 兼容性分析报告

> 最后更新: 2026-01-08
> 状态: ✅ 所有问题已修复，PostgreSQL 启动测试通过

## 概述

本文档记录了 PocketBase 迁移系统在 PostgreSQL 兼容性方面的分析结果，包括发现的问题和修复方案。

## 迁移执行机制

### 防止重复执行机制

迁移运行器通过以下机制防止重复执行：

1. **`_migrations` 表记录** - 每个已执行的迁移文件名作为主键存储
2. **`isMigrationApplied()` 检查** - 执行前检查迁移是否已应用
3. **`ReapplyCondition` 条件** - 只有返回 `true` 时才会重新执行已应用的迁移

```go
// core/migrations_runner.go
func (r *MigrationsRunner) isMigrationApplied(tx dbx.Builder, file string) bool {
    var exists bool
    err := tx.Select("count(*)").
        From(r.tableName).
        Where(dbx.HashExp{"file": file}).
        Row(&exists)
    return err == nil && exists
}
```

## 各迁移文件兼容性分析

| 文件 | SQLite | PostgreSQL | 状态 | 问题描述 |
|------|--------|------------|------|----------|
| `1640988000_init.go` | ✅ | ✅ | 已修复 | 依赖 `ColumnType()` 和索引构建 |
| `1640988000_aux_init.go` | ✅ | ✅ | 已修复 | 已正确区分 SQLite/PostgreSQL |
| `1717233556_v0.23_migrate.go` | ✅ | ⚠️ | 无需修复 | 使用反引号，但只在旧版升级时执行 |
| `1717233557_v0.23_migrate2.go` | ✅ | ✅ | 兼容 | 使用 `[[]]` 占位符 |
| `1717233558_v0.23_migrate3.go` | ✅ | ✅ | 兼容 | 使用高层 API |
| `1717233559_v0.23_migrate4.go` | ✅ | ✅ | 兼容 | 使用高层 API |
| `1736300000_create_proxies.go` | ✅ | ✅ | 已修复 | 依赖索引构建 |
| `1736400000_create_kv.go` | ✅ | ✅ | 已修复 | 已正确区分 |
| `1736500000_create_jobs.go` | ✅ | ✅ | 已修复 | 已正确区分 |
| `1736500000_create_secrets.go` | ✅ | ✅ | 已修复 | 已正确区分 |
| `1763020353_update_default_auth_alert_templates.go` | ✅ | ✅ | 兼容 | 使用高层 API |
| `postgres_init.go` | N/A | ✅ | PostgreSQL 专用 | 辅助函数 |

## 发现的关键问题及修复

### 问题 1: PRAGMA 命令不兼容

**问题描述：**

SQLite 特有的 `PRAGMA` 命令在 PostgreSQL 中会导致语法错误：

```
ERROR:  syntax error at or near "PRAGMA" at character 1
STATEMENT:  PRAGMA optimize
```

这会导致事务被中止，后续所有操作都失败。

**涉及位置：**

1. `core/collection_record_table_sync.go:147` - `PRAGMA optimize`
2. `core/base.go:1472, 1477` - `PRAGMA wal_checkpoint`
3. `core/base.go:1482` - `PRAGMA optimize`

**修复方案：**

在执行 PRAGMA 命令前检查数据库类型：

```go
// core/collection_record_table_sync.go
// 修复前
_, optimizeErr := app.NonconcurrentDB().NewQuery("PRAGMA optimize").Execute()

// 修复后
if !app.IsPostgres() {
    _, optimizeErr := app.NonconcurrentDB().NewQuery("PRAGMA optimize").Execute()
    if optimizeErr != nil {
        app.Logger().Warn("Failed to run PRAGMA optimize after record table sync", slog.String("error", optimizeErr.Error()))
    }
}
```

`core/base.go` 中的定时任务已经有 PostgreSQL 检查，无需修改。

### 问题 2: 索引创建语法不兼容

**问题描述：**

`Index.Build()` 方法使用反引号 (`) 作为标识符引用，这是 SQLite/MySQL 语法。PostgreSQL 需要使用双引号 (")。

**涉及位置：**

- `tools/dbutils/index.go` - `Build()` 方法

**修复方案：**

添加 `BuildForPostgres()` 方法，使用双引号：

```go
// tools/dbutils/index.go

// Build 使用反引号（SQLite/MySQL 风格）
func (idx Index) Build() string {
    return idx.build("`")
}

// BuildForPostgres 使用双引号（PostgreSQL 风格）
func (idx Index) BuildForPostgres() string {
    return idx.build(`"`)
}

// build 是内部实现，接受引号字符参数
func (idx Index) build(quote string) string {
    // ... 实现逻辑
}
```

在 `createCollectionIndexes` 中根据数据库类型选择方法：

```go
// core/collection_record_table_sync.go
var indexSQL string
if txApp.IsPostgres() {
    indexSQL = parsed.BuildForPostgres()
} else {
    indexSQL = parsed.Build()
}
```

### 问题 3: 字段类型映射

**问题描述：**

不同数据库需要不同的列类型定义。

**修复方案：**

在各字段类型的 `ColumnType()` 方法中根据 `app.IsPostgres()` 返回正确的类型：

```go
// core/field_text.go
func (f *TextField) ColumnType(app App) string {
    if app.IsPostgres() {
        return "TEXT DEFAULT ''"
    }
    return "TEXT DEFAULT '' NOT NULL"
}
```

### 问题 4: 辅助表创建语法

**问题描述：**

`1640988000_aux_init.go` 中的辅助表（`_externalAuths`, `_authOrigins`, `_superusers`）使用了 SQLite 特有语法。

**修复方案：**

根据数据库类型使用不同的 SQL：

```go
// migrations/1640988000_aux_init.go
if app.IsPostgres() {
    // PostgreSQL 语法
    _, tablesErr = txApp.DB().NewQuery(`
        CREATE TABLE IF NOT EXISTS "_externalAuths" (
            "id"           TEXT PRIMARY KEY NOT NULL,
            "collectionRef" TEXT DEFAULT '' NOT NULL,
            "recordRef"    TEXT DEFAULT '' NOT NULL,
            "provider"     TEXT DEFAULT '' NOT NULL,
            "providerId"   TEXT DEFAULT '' NOT NULL,
            "created"      TEXT DEFAULT '' NOT NULL,
            "updated"      TEXT DEFAULT '' NOT NULL
        )
    `).Execute()
} else {
    // SQLite 语法
    _, tablesErr = txApp.DB().NewQuery(`
        CREATE TABLE IF NOT EXISTS ` + "`_externalAuths`" + ` (
            ` + "`id`" + `           TEXT PRIMARY KEY NOT NULL,
            ...
        )
    `).Execute()
}
```

### 问题 5: v0.23 迁移中的硬编码 SQLite 语法

**问题描述：**

`1717233556_v0.23_migrate.go` 中有硬编码的 SQLite 语法：

```go
// 使用反引号和 sqlite_master 查询
fmt.Sprintf("CREATE UNIQUE INDEX `_%s_username_idx` ON `%s` (username COLLATE NOCASE)", c.Id, c.Name)
```

**分析：**

这个迁移只在从旧版本（v0.22 或更早）升级时执行。由于 PostgreSQL 支持是新功能，不会存在从旧版本 PostgreSQL 数据库升级的场景，因此**无需修复**。

## 测试验证

### 测试步骤

1. 清理 PostgreSQL 数据库：
```bash
docker exec pocketbase_pg_test psql -U pocketbase -d pocketbase_test -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO pocketbase; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

2. 启动服务并验证：
```bash
./pocketbase serve --pg="postgres://pocketbase:pocketbase@127.0.0.1:15432/pocketbase_test?sslmode=disable"
```

3. 检查 health 端点：
```bash
curl http://127.0.0.1:8090/api/health
```

### 预期结果

- 服务正常启动
- 所有系统 collection 创建成功
- 索引正确创建
- Health 检查返回 `{"code":200,"message":"API is healthy."}`

## 总结

PostgreSQL 兼容性的主要挑战：

1. **SQL 语法差异** - PRAGMA 命令、标识符引用方式
2. **数据类型差异** - 需要映射到对应的 PostgreSQL 类型
3. **函数差异** - 如随机函数 `RANDOM()` vs `random()`
4. **隐式列差异** - SQLite 的 `rowid` 在 PostgreSQL 中不存在
5. **迁移脚本兼容性** - 旧版本迁移脚本需要正确识别新安装

通过在关键位置添加 `app.IsPostgres()` 检查并提供对应的 PostgreSQL 实现，可以实现双数据库兼容。

## 新增发现的问题

### 问题 6: SQLite 隐式 rowid 列

**问题描述：**

`core/collection_query.go` 中使用了 SQLite 特有的隐式 `rowid` 列进行排序：

```go
err := q.OrderBy("rowid ASC").All(&collections)
```

PostgreSQL 没有隐式 `rowid` 列，会导致错误：
```
ERROR:  column "rowid" does not exist
```

**修复方案：**

改用 `id` 列排序：

```go
// 注意: SQLite 有隐式 rowid 列，但 PostgreSQL 没有
// 使用 id 列排序以保持跨数据库兼容性
err := q.OrderBy("id ASC").All(&collections)
```

### 问题 7: 索引 WHERE 子句中的引号转换

**问题描述：**

`Index.BuildForPostgres()` 方法正确地将索引名和列名转换为双引号，但 WHERE 子句中的反引号没有被转换：

```sql
-- 错误的输出
CREATE UNIQUE INDEX "idx_email" ON "users" ("email") WHERE `email` != ''
```

**修复方案：**

在 `build()` 方法中添加 WHERE 子句的引号转换：

```go
if idx.Where != "" {
    str.WriteString(" WHERE ")
    whereClause := idx.Where
    if quote == `"` {
        // PostgreSQL: 将反引号转换为双引号
        whereClause = strings.ReplaceAll(whereClause, "`", `"`)
    }
    str.WriteString(whereClause)
}
```

### 问题 8: v0.23 迁移脚本在新安装时执行

**问题描述：**

`1717233556_v0.23_migrate.go` 迁移脚本设计用于从 v0.22 升级到 v0.23。但在新安装时，它的 `hasUpgraded` 检查不够完善，会尝试读取旧的 `_params` 表结构（带 `key` 列），导致错误：

```
ERROR: column "key" does not exist
```

**修复方案：**

添加新安装检查，如果 `_admins` 表不存在则跳过迁移：

```go
// 检查是否是新安装（没有 _admins 表表示是新安装，不需要迁移）
if !txApp.HasTable("_admins") {
    return nil
}
```

### 问题 9: SimpleFieldResolver JSON 路径语法

**问题描述：**

`tools/search/simple_field_resolver.go` 中的 `Resolve()` 方法使用 SQLite 的 `JSON_EXTRACT()` 函数处理 JSON 路径：

```go
// SQLite 语法
JSON_EXTRACT([[data]], '$.auth')
```

PostgreSQL 使用不同的 JSON 操作符（`->` 和 `->>`）。

**修复方案：**

根据数据库类型生成不同的 JSON 路径表达式：

```go
if r.dbType.IsPostgres() {
    // PostgreSQL: data->>'auth'
    expr.WriteString("[[data]]->>'auth'")
} else {
    // SQLite: JSON_EXTRACT([[data]], '$.auth')
}
```

### 问题 10: strftime 函数不兼容

**问题描述：**

`core/log_query.go` 中的 `LogsStats()` 方法使用 SQLite 的 `strftime()` 函数：

```go
strftime('%Y-%m-%d %H:00:00', created)
```

PostgreSQL 没有 `strftime()` 函数，使用 `to_char()` 代替。

**修复方案：**

```go
if app.IsPostgres() {
    dateExpr = "to_char(created, 'YYYY-MM-DD HH24:00:00') as date"
} else {
    dateExpr = "strftime('%Y-%m-%d %H:00:00', created) as date"
}
```

## 测试验证结果

### 测试环境
- PostgreSQL 15 (Docker 容器)
- PocketBase 最新开发版本

### 测试结果
- ✅ 服务正常启动
- ✅ 所有系统 collection 创建成功
- ✅ 所有系统表创建成功（15 个表）
- ✅ Health 检查返回 `{"code":200,"message":"API is healthy."}`

### 创建的系统表
```
_authOrigins
_collections
_externalAuths
_jobs
_kv
_logs
_mfas
_migrations
_otps
_params
_proxies
_secrets
_superusers
posts
users
```
