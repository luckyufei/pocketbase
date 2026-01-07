# PocketBase PostgreSQL 演进 - 详细任务清单

> **兼容性要求**: PostgreSQL 15+
> **基于代码分析**: 2026-01-07

---

## 任务状态说明

| 状态 | 说明 |
|------|------|
| ⬜ | 待开始 |
| 🔄 | 进行中 |
| ⚠️ | 需要验证 |
| ✅ | 已完成 |
| ❌ | 已取消 |

---

## EPIC-0: 基础设施搭建

### STORY-0.1: 依赖管理

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-0.1.1 | 添加 `github.com/jackc/pgx/v5` 依赖 | `go.mod` | 0.5h | ✅ |
| T-0.1.2 | 添加 `github.com/jackc/pgxpool` 连接池 | `go.mod` | 0.5h | ✅ |
| T-0.1.3 | 添加 `github.com/ory/dockertest/v3` 测试依赖 | `go.mod` | 0.5h | ✅ |
| T-0.1.4 | 运行 `go mod tidy` 更新依赖 | `go.sum` | 0.5h | ✅ |

### STORY-0.2: 数据库适配器接口

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-0.2.1 | 定义 `DBAdapter` 接口 | `core/db_adapter.go` | 2h | ✅ |
| T-0.2.2 | 定义 `DBConfig` 配置结构 | `core/db_adapter.go` | 1h | ✅ |
| T-0.2.3 | 实现 SQLite 适配器 (保持现有行为) | `core/db_adapter_sqlite.go` | 4h | ✅ |
| T-0.2.4 | 实现 PostgreSQL 适配器骨架 | `core/db_adapter_postgres.go` | 2h | ✅ |
| T-0.2.5 | 在 `BaseApp` 中集成适配器 | `core/base.go` | 2h | ✅ |

### STORY-0.3: PostgreSQL 兼容函数

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-0.3.1 | 实现 `pb_generate_id()` 函数 | `migrations/postgres/0002_functions.sql` | 1h | ⬜ |
| T-0.3.2 | 实现 `uuid_generate_v7()` 函数 | `migrations/postgres/0002_functions.sql` | 1h | ⬜ |
| T-0.3.3 | 创建 `nocase` collation | `migrations/postgres/0002_functions.sql` | 0.5h | ⬜ |
| T-0.3.4 | 实现 `json_valid()` 兼容函数 | `migrations/postgres/0002_functions.sql` | 0.5h | ⬜ |
| T-0.3.5 | 实现 `json_query_or_null()` 函数 (PG15 兼容) | `migrations/postgres/0002_functions.sql` | 1h | ⬜ |
| T-0.3.6 | 编写函数单元测试 | `migrations/postgres/functions_test.go` | 2h | ⬜ |

### STORY-0.4: 测试环境搭建

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-0.4.1 | 创建 PostgreSQL Docker 容器辅助函数 | `tests/postgres_helper.go` | 2h | ⬜ |
| T-0.4.2 | 创建测试数据库初始化逻辑 | `tests/postgres_helper.go` | 2h | ⬜ |
| T-0.4.3 | 创建测试数据导入逻辑 | `tests/postgres_helper.go` | 2h | ⬜ |
| T-0.4.4 | 配置 CI/CD 双数据库测试 | `.github/workflows/test.yml` | 2h | ⬜ |
| T-0.4.5 | 创建 `make test-postgres` 命令 | `Makefile` | 0.5h | ⬜ |

---

## EPIC-1: 数据层解耦

### STORY-1.1: JSON 函数重写

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-1.1.1 | 分析现有 `JSONEach` 调用点 | - | 1h | ✅ |
| T-1.1.2 | 实现 PostgreSQL `JSONEach` | `tools/dbutils/json_postgres.go` | 2h | ⬜ |
| T-1.1.3 | 分析现有 `JSONExtract` 调用点 | - | 1h | ✅ |
| T-1.1.4 | 实现 PostgreSQL `JSONExtract` | `tools/dbutils/json_postgres.go` | 4h | ⬜ |
| T-1.1.5 | 实现 JSONPath → PostgreSQL 路径转换 | `tools/dbutils/json_postgres.go` | 2h | ⬜ |
| T-1.1.6 | 分析现有 `JSONArrayLength` 调用点 | - | 0.5h | ✅ |
| T-1.1.7 | 实现 PostgreSQL `JSONArrayLength` | `tools/dbutils/json_postgres.go` | 1h | ⬜ |
| T-1.1.8 | 重构 `tools/dbutils/json.go` 为接口 | `tools/dbutils/json.go` | 2h | ⬜ |
| T-1.1.9 | 编写 JSON 函数单元测试 | `tools/dbutils/json_test.go` | 4h | ⬜ |
| T-1.1.10 | 编写 JSON 函数集成测试 | `tools/dbutils/json_integration_test.go` | 2h | ⬜ |

**调用点清单** (已分析):
- `core/record_field_resolver_runner.go`: 行 343, 362, 481, 578, 619, 675, 717, 763, 781, 837
- `core/collection_record_table_sync.go`: 行 231, 258
- `core/view.go`: 行 182

### STORY-1.2: 过滤器适配

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-1.2.1 | 修改布尔值标识符映射 | `tools/search/filter.go:252-258` | 1h | ⬜ |
| T-1.2.2 | 修改 `IS NOT` → `IS DISTINCT FROM` | `tools/search/filter.go:337-344` | 1h | ⬜ |
| T-1.2.3 | 添加数据库类型检测逻辑 | `tools/search/filter.go` | 2h | ⬜ |
| T-1.2.4 | 更新 `resolveEqualExpr` 函数 | `tools/search/filter.go:328-406` | 2h | ⬜ |
| T-1.2.5 | 编写过滤器单元测试 | `tools/search/filter_test.go` | 4h | ⬜ |

### STORY-1.3: 系统表查询重写

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-1.3.1 | 重写 `TableColumns` 函数 | `core/db_table.go:11-18` | 1h | ⬜ |
| T-1.3.2 | 重写 `TableInfo` 函数 | `core/db_table.go:33-51` | 2h | ⬜ |
| T-1.3.3 | 重写 `TableIndexes` 函数 | `core/db_table.go:56-81` | 2h | ⬜ |
| T-1.3.4 | 重写 `hasTable` 函数 | `core/db_table.go:110-121` | 1h | ⬜ |
| T-1.3.5 | 重写 `Vacuum` 函数 | `core/db_table.go:123-137` | 0.5h | ⬜ |
| T-1.3.6 | 编写系统表查询测试 | `core/db_table_test.go` | 2h | ⬜ |

### STORY-1.4: 记录字段解析器适配

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-1.4.1 | 适配 `json_each` 调用 (行 343) | `core/record_field_resolver_runner.go` | 1h | ⬜ |
| T-1.4.2 | 适配 `json_each` 调用 (行 362) | `core/record_field_resolver_runner.go` | 1h | ⬜ |
| T-1.4.3 | 适配关系字段 JSON 处理 | `core/record_field_resolver_runner.go:481-837` | 4h | ⬜ |
| T-1.4.4 | 编写字段解析器测试 | `core/record_field_resolver_runner_test.go` | 4h | ⬜ |

### STORY-1.5: 集合表同步适配

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-1.5.1 | 适配 `json_extract` 调用 (行 231) | `core/collection_record_table_sync.go` | 1h | ⬜ |
| T-1.5.2 | 适配 `json_extract` 调用 (行 258) | `core/collection_record_table_sync.go` | 1h | ⬜ |
| T-1.5.3 | 适配视图列表查询 (行 190-194) | `core/collection_record_table_sync.go` | 1h | ⬜ |
| T-1.5.4 | 适配 `PRAGMA optimize` 调用 (行 147) | `core/collection_record_table_sync.go` | 0.5h | ⬜ |
| T-1.5.5 | 编写集合同步测试 | `core/collection_record_table_sync_test.go` | 2h | ⬜ |

### STORY-1.6: 视图处理适配

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-1.6.1 | 适配 `json_extract` 调用 (行 182) | `core/view.go` | 1h | ⬜ |
| T-1.6.2 | 编写视图处理测试 | `core/view_test.go` | 1h | ⬜ |

### STORY-1.7: 连接池管理

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-1.7.1 | 实现 PostgreSQL 连接池初始化 | `core/base.go` | 2h | ⬜ |
| T-1.7.2 | 添加连接池配置项 | `core/settings_model.go` | 1h | ⬜ |
| T-1.7.3 | 移除 SQLite 特有的单连接限制 | `core/base.go:1174-1260` | 1h | ⬜ |
| T-1.7.4 | 添加 `ConnMaxLifetime` 配置 | `core/base.go` | 0.5h | ⬜ |
| T-1.7.5 | 编写连接池测试 | `core/base_test.go` | 2h | ⬜ |

---

## EPIC-2: 迁移脚本重写

### STORY-2.1: 初始化迁移

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-2.1.1 | 创建 PostgreSQL 扩展初始化 | `migrations/postgres/0001_extensions.go` | 1h | ⬜ |
| T-2.1.2 | 重写 `_collections` 表创建 | `migrations/postgres/0003_init.go` | 2h | ⬜ |
| T-2.1.3 | 重写 `_params` 表创建 | `migrations/postgres/0003_init.go` | 1h | ⬜ |
| T-2.1.4 | 重写 MFA 集合创建 | `migrations/postgres/0003_init.go` | 1h | ⬜ |
| T-2.1.5 | 重写 OTP 集合创建 | `migrations/postgres/0003_init.go` | 1h | ⬜ |
| T-2.1.6 | 重写 ExternalAuths 集合创建 | `migrations/postgres/0003_init.go` | 1h | ⬜ |
| T-2.1.7 | 重写 AuthOrigins 集合创建 | `migrations/postgres/0003_init.go` | 1h | ⬜ |
| T-2.1.8 | 重写 Superusers 集合创建 | `migrations/postgres/0003_init.go` | 1h | ⬜ |
| T-2.1.9 | 重写 Users 集合创建 | `migrations/postgres/0003_init.go` | 1h | ⬜ |
| T-2.1.10 | 编写初始化迁移测试 | `migrations/postgres/0003_init_test.go` | 2h | ⬜ |

### STORY-2.2: 辅助数据库迁移

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-2.2.1 | 创建 UNLOGGED 日志表 | `migrations/postgres/0004_aux_init.go` | 2h | ⬜ |
| T-2.2.2 | 创建日志表分区 | `migrations/postgres/0004_aux_init.go` | 1h | ⬜ |
| T-2.2.3 | 创建日志表索引 | `migrations/postgres/0004_aux_init.go` | 1h | ⬜ |
| T-2.2.4 | 编写辅助迁移测试 | `migrations/postgres/0004_aux_init_test.go` | 1h | ⬜ |

### STORY-2.3: 字段类型映射

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-2.3.1 | 实现 `TextField.ColumnType` PostgreSQL 版本 | `core/field_text.go:158-163` | 1h | ⬜ |
| T-2.3.2 | 实现 `BoolField.ColumnType` PostgreSQL 版本 | `core/field_bool.go` | 0.5h | ⬜ |
| T-2.3.3 | 实现 `DateField.ColumnType` PostgreSQL 版本 | `core/field_date.go` | 1h | ⬜ |
| T-2.3.4 | 实现 `JSONField.ColumnType` PostgreSQL 版本 | `core/field_json.go` | 1h | ⬜ |
| T-2.3.5 | 实现 `NumberField.ColumnType` PostgreSQL 版本 | `core/field_number.go` | 0.5h | ⬜ |
| T-2.3.6 | 编写字段类型测试 | `core/field_*_test.go` | 4h | ⬜ |

---

## EPIC-3: API 层适配

### STORY-3.1: 认证 API 适配

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-3.1.1 | 适配密码认证 COLLATE NOCASE | `apis/record_auth_with_password.go:129-131` | 1h | ⬜ |
| T-3.1.2 | 适配 OAuth2 认证 COLLATE NOCASE | `apis/record_auth_with_oauth2.go:221-223` | 1h | ⬜ |
| T-3.1.3 | 编写认证 API 测试 | `apis/record_auth_*_test.go` | 2h | ⬜ |

### STORY-3.2: 记录查询适配

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-3.2.1 | 适配邮箱查询 COLLATE NOCASE | `core/record_query.go:553-556` | 1h | ⬜ |
| T-3.2.2 | 编写记录查询测试 | `core/record_query_test.go` | 2h | ⬜ |

---

## EPIC-4: 备份恢复重写

### STORY-4.1: 备份功能

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-4.1.1 | 检测 `pg_dump` 可用性 | `core/base_backup.go` | 1h | ⬜ |
| T-4.1.2 | 实现 `pg_dump` 调用逻辑 | `core/base_backup.go` | 2h | ⬜ |
| T-4.1.3 | 移除 WAL 检查点代码 | `core/base_backup.go:81-82` | 0.5h | ⬜ |
| T-4.1.4 | 实现备份文件打包 | `core/base_backup.go` | 2h | ⬜ |
| T-4.1.5 | 编写备份功能测试 | `core/base_backup_test.go` | 2h | ⬜ |

### STORY-4.2: 恢复功能

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-4.2.1 | 检测 `pg_restore` 可用性 | `core/base_backup.go` | 1h | ⬜ |
| T-4.2.2 | 实现 `pg_restore` 调用逻辑 | `core/base_backup.go` | 2h | ⬜ |
| T-4.2.3 | 实现恢复前数据库清理 | `core/base_backup.go` | 1h | ⬜ |
| T-4.2.4 | 编写恢复功能测试 | `core/base_backup_test.go` | 2h | ⬜ |

---

## EPIC-5: 清理和优化

### STORY-5.1: 移除 SQLite 特有代码

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-5.1.1 | 移除/重写 `modernc_versions_check.go` | `modernc_versions_check.go` | 1h | ⬜ |
| T-5.1.2 | 移除 PRAGMA 相关代码 | `core/base.go:1360-1370` | 1h | ⬜ |
| T-5.1.3 | 更新驱动导入 | `core/db_connect.go` | 0.5h | ⬜ |

### STORY-5.2: 文档更新

| Task ID | 描述 | 文件 | 预估 | 状态 |
|---------|------|------|------|------|
| T-5.2.1 | 更新 README 数据库配置说明 | `README.md` | 1h | ⬜ |
| T-5.2.2 | 创建 PostgreSQL 部署指南 | `docs/postgresql-deployment.md` | 2h | ⬜ |
| T-5.2.3 | 创建数据迁移指南 | `docs/migration-guide.md` | 2h | ⬜ |

---

## 工作量汇总

| EPIC | Tasks 数量 | 预估工时 |
|------|-----------|---------|
| EPIC-0: 基础设施搭建 | 19 | 24h |
| EPIC-1: 数据层解耦 | 35 | 56h |
| EPIC-2: 迁移脚本重写 | 16 | 22h |
| EPIC-3: API 层适配 | 5 | 7h |
| EPIC-4: 备份恢复重写 | 9 | 13h |
| EPIC-5: 清理和优化 | 5 | 7h |
| **总计** | **89** | **129h** |

---

## 执行顺序建议

```
Week 1: EPIC-0 (基础设施)
├── STORY-0.1: 依赖管理
├── STORY-0.2: 数据库适配器接口
├── STORY-0.3: PostgreSQL 兼容函数
└── STORY-0.4: 测试环境搭建

Week 2-3: EPIC-1 (数据层解耦)
├── STORY-1.1: JSON 函数重写
├── STORY-1.2: 过滤器适配
├── STORY-1.3: 系统表查询重写
├── STORY-1.4: 记录字段解析器适配
├── STORY-1.5: 集合表同步适配
├── STORY-1.6: 视图处理适配
└── STORY-1.7: 连接池管理

Week 4: EPIC-2 (迁移脚本)
├── STORY-2.1: 初始化迁移
├── STORY-2.2: 辅助数据库迁移
└── STORY-2.3: 字段类型映射

Week 5: EPIC-3 + EPIC-4 (API + 备份)
├── STORY-3.1: 认证 API 适配
├── STORY-3.2: 记录查询适配
├── STORY-4.1: 备份功能
└── STORY-4.2: 恢复功能

Week 6: EPIC-5 (清理) + 集成测试
├── STORY-5.1: 移除 SQLite 特有代码
├── STORY-5.2: 文档更新
└── 全量集成测试
```

---

## 依赖关系图

```
EPIC-0 (基础设施)
    │
    ├──> STORY-0.2 (适配器接口)
    │        │
    │        ├──> EPIC-1 全部 STORY
    │        │
    │        └──> EPIC-2 全部 STORY
    │
    └──> STORY-0.4 (测试环境)
             │
             └──> 所有测试任务

EPIC-1 (数据层)
    │
    ├──> STORY-1.1 (JSON) ──> STORY-1.4, 1.5, 1.6
    │
    ├──> STORY-1.2 (过滤器) ──> EPIC-3
    │
    └──> STORY-1.3 (系统表) ──> STORY-1.5

EPIC-2 (迁移)
    │
    └──> 依赖 EPIC-1 完成

EPIC-4 (备份)
    │
    └──> 独立，可并行
```
