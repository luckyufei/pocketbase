# PostgreSQL 迁移兼容性修复 - Tasks

> 基于 `specs/migrations-postgresql-compatibility.md` 分析报告
> 最后更新: 2026-01-08

---

## STORY-M.1: PRAGMA 命令兼容性修复

### 问题描述
SQLite 特有的 `PRAGMA` 命令在 PostgreSQL 中会导致语法错误，事务被中止。

### Tasks

| Task ID | 描述 | 文件 | TDD | 状态 |
|---------|------|------|-----|------|
| T-M.1.1 | 修复 `collection_record_table_sync.go` 中的 PRAGMA optimize | `core/collection_record_table_sync.go` | ❌ (迁移代码) | ✅ 已完成 |
| T-M.1.2 | 验证 `base.go` 中的 PRAGMA 已有 PostgreSQL 检查 | `core/base.go` | ❌ | ✅ 已验证 |

---

## STORY-M.2: 索引创建语法兼容性

### 问题描述
`Index.Build()` 使用反引号作为标识符引用，PostgreSQL 需要双引号。

### Tasks

| Task ID | 描述 | 文件 | TDD | 状态 |
|---------|------|------|-----|------|
| T-M.2.1 | 添加 `BuildForPostgres()` 方法 | `tools/dbutils/index.go` | ✅ | ✅ 已完成 |
| T-M.2.2 | 编写 `BuildForPostgres()` 单元测试 | `tools/dbutils/index_test.go` | ✅ | ✅ 已完成 |
| T-M.2.3 | 修改 `createCollectionIndexes` 使用正确方法 | `core/collection_record_table_sync.go` | ❌ (迁移代码) | ✅ 已完成 |
| T-M.2.4 | 修复 WHERE 子句中的引号转换 | `tools/dbutils/index.go` | ✅ | ✅ 已完成 |

---

## STORY-M.3: 辅助表创建语法兼容性

### 问题描述
`1640988000_aux_init.go` 中的辅助表使用了 SQLite 特有语法。

### Tasks

| Task ID | 描述 | 文件 | TDD | 状态 |
|---------|------|------|-----|------|
| T-M.3.1 | 验证 `aux_init.go` 已正确区分数据库类型 | `migrations/1640988000_aux_init.go` | ❌ | ✅ 已验证 |

---

## STORY-M.4: 字段类型映射验证

### 问题描述
各字段类型的 `ColumnType()` 方法需要根据数据库类型返回正确的类型。

### Tasks

| Task ID | 描述 | 文件 | TDD | 状态 |
|---------|------|------|-----|------|
| T-M.4.1 | 验证 `TextField.ColumnType()` PostgreSQL 兼容性 | `core/field_text.go` | ✅ | ✅ 已验证 |
| T-M.4.2 | 验证 `NumberField.ColumnType()` PostgreSQL 兼容性 | `core/field_number.go` | ✅ | ✅ 已验证 |
| T-M.4.3 | 验证 `BoolField.ColumnType()` PostgreSQL 兼容性 | `core/field_bool.go` | ✅ | ✅ 已验证 |
| T-M.4.4 | 验证 `DateField.ColumnType()` PostgreSQL 兼容性 | `core/field_date.go` | ✅ | ✅ 已验证 |
| T-M.4.5 | 验证 `JSONField.ColumnType()` PostgreSQL 兼容性 | `core/field_json.go` | ✅ | ✅ 已验证 |
| T-M.4.6 | 编写字段类型映射集成测试 | `core/field_column_type_test.go` | ✅ | ✅ 已完成 |

---

## STORY-M.5: SQLite 特有语法修复

### 问题描述
代码中使用了 SQLite 特有的 `rowid` 隐式列，PostgreSQL 没有这个列。

### Tasks

| Task ID | 描述 | 文件 | TDD | 状态 |
|---------|------|------|-----|------|
| T-M.5.1 | 修复 `FindAllCollections` 中的 `rowid` 排序 | `core/collection_query.go` | ❌ | ✅ 已完成 |

---

## STORY-M.6: 迁移脚本兼容性

### 问题描述
v0.23 迁移脚本在新安装时不应执行。

### Tasks

| Task ID | 描述 | 文件 | TDD | 状态 |
|---------|------|------|-----|------|
| T-M.6.1 | 添加新安装检查，跳过 v0.23 迁移 | `migrations/1717233556_v0.23_migrate.go` | ❌ | ✅ 已完成 |

---

## STORY-M.7: 端到端启动测试

### 问题描述
验证 PostgreSQL 模式下服务能正常启动，所有系统 collection 创建成功。

### Tasks

| Task ID | 描述 | 文件 | TDD | 状态 |
|---------|------|------|-----|------|
| T-M.7.1 | 清理 PostgreSQL 数据库并启动服务 | - | ❌ | ✅ 已完成 |
| T-M.7.2 | 验证 health 端点返回正常 | - | ❌ | ✅ 已完成 |
| T-M.7.3 | 验证所有系统表创建成功 | - | ❌ | ✅ 已完成 |

---

## 工作量汇总

| Story | Tasks 数量 | 预估工时 | 实际状态 |
|-------|-----------|---------|---------|
| STORY-M.1 | 2 | 1h | ✅ 完成 |
| STORY-M.2 | 4 | 3h | ✅ 完成 |
| STORY-M.3 | 1 | 0.5h | ✅ 完成 |
| STORY-M.4 | 6 | 3h | ✅ 完成 |
| STORY-M.5 | 1 | 0.5h | ✅ 完成 |
| STORY-M.6 | 1 | 0.5h | ✅ 完成 |
| STORY-M.7 | 3 | 1h | ✅ 完成 |
| **总计** | **18** | **9.5h** | ✅ 全部完成 |

---

## 修复的文件列表

```
core/collection_query.go           # 修复 rowid 排序
core/collection_record_table_sync.go  # 修复 PRAGMA optimize
core/field_column_type_test.go     # 新增字段类型测试
migrations/1717233556_v0.23_migrate.go  # 添加新安装检查
tools/dbutils/index.go             # 修复 WHERE 子句引号转换
tools/dbutils/index_test.go        # 新增 BuildForPostgres 测试
```
