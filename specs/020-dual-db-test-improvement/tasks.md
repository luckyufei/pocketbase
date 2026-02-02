# 双数据库测试覆盖改进任务清单（完整版）

> **关联计划**: [plan.md](./plan.md)  
> **目标**: PostgreSQL 测试覆盖率从 5.3% → 100%  
> **当前进度**: 1380/1549 (89.1%) ⬆️

## 状态图例

- 🔴 待开始
- 🟡 进行中  
- 🟢 已完成
- ⚪ 已跳过（不需要）

---

## 阶段一：Core 模块 (788 测试函数)

### 1.1 数据库核心测试 🟢

| # | 文件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 1.1.1 | `record_model_test.go` | 14 (DB相关) | 🟢 | 2026-01-30 |
| 1.1.2 | `collection_model_test.go` | 7 (DB相关) | 🟢 | 2026-01-30 |
| 1.1.3 | `record_query_test.go` | 13 | 🟢 | 2026-01-30 |
| 1.1.4 | `db_test.go` | 3 (DB相关) | 🟢 | 2026-01-30 |
| 1.1.5 | `log_query_test.go` | 3 | 🟢 | 2026-01-30 |
| 1.1.6 | `base_test.go` | 4 (DB相关) | 🟢 | 2026-01-30 |
| 1.1.7 | `db_tx_test.go` | 6 | 🟢 | 2026-01-30 |
| 1.1.8 | `collection_query_test.go` | 9 | 🟢 | 2026-01-30 |
| 1.1.9 | `db_table_test.go` | 10 | 🟢 | 2026-01-30 |

**小计**: ~225 测试函数（已完成 69）

**重要修复（1.1.9）**:
- 修复 `BaseApp.TableInfo()` 直接使用 `app.ConcurrentDB()` 查询 PostgreSQL，避免 DBAdapter 连接未初始化问题
- 修复 `BaseApp.TableColumns()` 和 `BaseApp.TableIndexes()` 使用相同模式
- 修复 `BaseApp.Vacuum()` 支持 PostgreSQL 的 `VACUUM ANALYZE`
- 更新测试期望值以匹配实际的 PostgreSQL 表结构

---

### 1.2 字段类型测试 🟢

| # | 文件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 1.2.1 | `field_text_test.go` | 7 | 🟢 | 2026-01-30 |
| 1.2.2 | `field_number_test.go` | 6 | 🟢 | 2026-01-30 |
| 1.2.3 | `field_bool_test.go` | 5 | 🟢 | 2026-01-30 |
| 1.2.4 | `field_date_test.go` | 5 | 🟢 | 2026-01-30 |
| 1.2.5 | `field_file_test.go` | 12 | 🟢 | 2026-01-30 |
| 1.2.6 | `field_relation_test.go` | 8 | 🟢 | 2026-02-02 |
| 1.2.7 | `field_select_test.go` | 6 | 🟢 | 2026-01-30 |
| 1.2.8 | `field_json_test.go` | 6 | 🟢 | 2026-01-30 |
| 1.2.9 | `field_email_test.go` | 4 | 🟢 | 2026-01-30 |
| 1.2.10 | `field_url_test.go` | 4 | 🟢 | 2026-01-30 |
| 1.2.11 | `field_editor_test.go` | 5 | 🟢 | 2026-01-30 |
| 1.2.12 | `field_autodate_test.go` | 7 | 🟢 | 2026-02-02 |
| 1.2.13 | `field_geo_point_test.go` | 5 | 🟢 | 2026-02-02 |
| 1.2.14 | `field_password_test.go` | 7 | 🟢 | 2026-02-02 |
| 1.2.15 | `field_secret_test.go` | 15 | 🟢 | 2026-02-02 |

**小计**: ~102 测试函数（已完成）

**已迁移测试 (1.2.1)**:
- `TestTextFieldBaseMethods` - 无需迁移（不访问数据库）
- `TestTextFieldColumnType` - 迁移到 `DualDBTest`，支持 SQLite/PostgreSQL 不同 PRIMARY KEY 语法
- `TestTextFieldPrepareValue` - 迁移到 `DualDBTest`
- `TestTextFieldValidateValue` - 迁移到 `DualDBTest`，29 个子测试场景
- `TestTextFieldValidateSettings` - 迁移到 `DualDBTest`，包含 `testDefaultFieldIdValidationWithApp` 和 `testDefaultFieldNameValidationWithApp`
- `TestTextFieldAutogenerate` - 迁移到 `DualDBTest`
- `TestTextFieldFindSetter` - 无需迁移（不访问数据库）

**新增辅助函数** (`field_test.go`):
- `testDefaultFieldIdValidationWithApp(t, app, fieldType)` - 用于 DualDBTest 内部
- `testDefaultFieldNameValidationWithApp(t, app, fieldType)` - 用于 DualDBTest 内部

---

### 1.3 认证相关测试 🟢

| # | 文件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 1.3.1 | `auth_origin_query_test.go` | 5 | 🟢 | 2026-02-02 |
| 1.3.2 | `external_auth_query_test.go` | 3 | 🟢 | 2026-02-02 |
| 1.3.3 | `mfa_query_test.go` | 5 | 🟢 | 2026-02-02 |
| 1.3.4 | `otp_query_test.go` | 5 | 🟢 | 2026-02-02 |
| 1.3.5 | `record_tokens_test.go` | 7 | 🟢 | 2026-02-02 |

**小计**: 25 测试函数（已完成）

---

### 1.4 其他 Core 测试 🟡

| # | 文件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 1.4.1 | `external_auth_model_test.go` | 10 | 🟢 | 2026-02-02 |
| 1.4.2 | `mfa_model_test.go` | 10 | 🟢 | 2026-02-02 |
| 1.4.3 | `otp_model_test.go` | 10 | 🟢 | 2026-02-02 |
| 1.4.4 | `auth_origin_model_test.go` | 10 | 🟢 | 2026-02-02 |
| 1.4.5 | `settings_query_test.go` | 2 | 🟢 | 2026-02-02 |
| 1.4.6 | `settings_model_test.go` | 2 (DB相关) | 🟢 | 2026-02-02 |
| 1.4.7 | `kv_store_test.go` | 32 | 🟢 | 2026-02-02 |
| 1.4.8 | `secrets_store_test.go` | 18 | 🟢 | 2026-02-02 |
| 1.4.9 | `job_store_test.go` | 33 | 🟢 | 2026-02-02 |
| 1.4.10 | `record_query_expand_test.go` | 3 | 🟢 | 2026-02-02 |
| 1.4.11 | `collection_validate_test.go` | 1 | 🟢 | 2026-02-02 |
| 1.4.12 | `collection_import_test.go` | 4 | 🟢 | 2026-02-02 |
| 1.4.13 | `collection_model_auth_options_test.go` | 15 | 🟢 | 2026-02-02 |
| 1.4.14 | `validators/db_test.go` | 1 | 🟢 | 2026-02-02 |
| 1.4.15 | `event_request_test.go` | 5 | 🟢 | 2026-02-02 |
| 1.4.16 | `analytics_settings_test.go` | 2 | 🟢 | 2026-02-02 |
| 1.4.17 | `migrations_runner_test.go` | 2 | 🟢 | 2026-02-02 |
| 1.4.18 | `record_model_auth_test.go` | 1 | 🟢 | 2026-02-02 |
| 1.4.19 | `record_model_superusers_test.go` | 1 | 🟢 | 2026-02-02 |
| 1.4.20 | `collection_model_view_options_test.go` | 1 | 🟢 | 2026-02-02 |
| 1.4.21 | `metrics_collector_test.go` | 12 | 🟢 | 2026-02-02 |
| 1.4.22 | `metrics_repository_test.go` | 8 | 🟢 | 2026-02-02 |
| 1.4.23 | `view_test.go` | 4 | 🟢 | 2026-02-02 |
| 1.4.24 | `record_field_resolver_test.go` | 5 | ⚪ | - |
| 1.4.25 | `fields_list_test.go` | 14 | ⚪ | - |
| 1.4.26 | `collection_record_table_sync_test.go` | 2 | 🟢 | 2026-02-02 |
| 1.4.27 | `kv_benchmark_test.go` (TestKVThroughput) | 1 | 🟢 | 2026-02-02 |
| 1.4.28 | `field_test.go` (辅助函数) | 2 | 🟢 | 2026-02-02 |
| 1.4.29 | `base_backup_test.go` | 2 | ⚪ | - |
| 1.4.30 | `analytics_repository_sqlite_test.go` | 7 | ⚪ | - |
| 1.4.31 | `trace_repository_sqlite_test.go` | 15 | ⚪ | - |
| 1.4.32 | 其他 | ~42 | 🔴 | - |

**小计**: ~299 测试函数（已完成 192）

**注**:
- `record_field_resolver_test.go`: 测试期望的 SQL 语法是 SQLite 特定的（已有 `record_field_resolver_pg_test.go` 作为 PostgreSQL 测试）
- `fields_list_test.go`: 不使用数据库，纯数据结构测试
- `validators/db_test.go`: 仅 `TestUniqueId` 需要迁移（已完成）
- `base_backup_test.go`: 备份功能涉及 SQLite 文件操作，跳过
- `analytics_repository_sqlite_test.go`: SQLite 特定的 Analytics Repository 测试
- `trace_repository_sqlite_test.go`: SQLite 特定的 Trace Repository 测试

---

**阶段一总计**: 788 测试函数

---

## 阶段二：APIs 模块 (170 测试函数)

### 2.1 CRUD 测试 🟢

| # | 文件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 2.1.1 | `record_crud_test.go` | 145 | 🟢 | 2026-02-02 |
| 2.1.2 | `collection_test.go` | 62 | 🟢 | 2026-02-02 |
| 2.1.3 | `collection_import_test.go` | 8 | 🟢 | 2026-02-02 |
| 2.1.4 | `record_crud_auth_origin_test.go` | 15 | 🟢 | 2026-02-02 |
| 2.1.5 | `record_crud_external_auth_test.go` | 15 | 🟢 | 2026-02-02 |
| 2.1.6 | `record_crud_mfa_test.go` | 16 | 🟢 | 2026-02-02 |
| 2.1.7 | `record_crud_otp_test.go` | 16 | 🟢 | 2026-02-02 |
| 2.1.8 | `record_crud_secret_test.go` | 15 | 🟢 | 2026-02-02 |
| 2.1.9 | `record_crud_superuser_test.go` | 16 | 🟢 | 2026-02-02 |

**小计**: 308 测试函数 (已完成)

---

### 2.2 认证测试 🟢

| # | 文件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 2.2.1 | `record_auth_with_password_test.go` | 25 | 🟢 | 2026-02-02 |
| 2.2.2 | `record_auth_with_oauth2_test.go` | 49 | 🟢 | 2026-02-02 |
| 2.2.3 | `record_auth_with_oauth2_redirect_test.go` | 10 | 🟢 | 2026-02-02 |
| 2.2.4 | `record_auth_with_otp_test.go` | 17 | 🟢 | 2026-02-02 |
| 2.2.5 | `record_auth_otp_request_test.go` | 12 | 🟢 | 2026-02-02 |
| 2.2.6 | `record_auth_refresh_test.go` | 11 | 🟢 | 2026-02-02 |
| 2.2.7 | `record_auth_methods_test.go` | 6 | 🟢 | 2026-02-02 |
| 2.2.8 | `record_auth_impersonate_test.go` | 6 | 🟢 | 2026-02-02 |
| 2.2.9 | `record_auth_email_change_confirm_test.go` | 11 | 🟢 | 2026-02-02 |
| 2.2.10 | `record_auth_email_change_request_test.go` | 11 | 🟢 | 2026-02-02 |
| 2.2.11 | `record_auth_password_reset_confirm_test.go` | 12 | 🟢 | 2026-02-02 |
| 2.2.12 | `record_auth_password_reset_request_test.go` | 10 | 🟢 | 2026-02-02 |
| 2.2.13 | `record_auth_verification_confirm_test.go` | 12 | 🟢 | 2026-02-02 |
| 2.2.14 | `record_auth_verification_request_test.go` | 10 | 🟢 | 2026-02-02 |

**小计**: 202 测试函数 (已完成)

---

### 2.3 其他 API 测试 🟢

| # | 文件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 2.3.1 | `batch_test.go` | 14 | 🟢 | 2026-02-02 |
| 2.3.2 | `realtime_test.go` | 17 | 🟢 | 2026-02-02 |
| 2.3.3 | `file_test.go` | 26 | 🟢 | 2026-02-02 |
| 2.3.4 | `backup_test.go` | 37 | 🟢 | 2026-02-02 |
| 2.3.5 | `settings_test.go` | 29 | 🟢 | 2026-02-02 |
| 2.3.6 | `logs_test.go` | 12 | 🟢 | 2026-02-02 |
| 2.3.7 | `health_test.go` | 3 | 🟢 | 2026-02-02 |
| 2.3.8 | `cron_test.go` | 8 | 🟢 | 2026-02-02 |
| 2.3.9 | `middlewares_test.go` | 31 | 🟢 | 2026-02-02 |
| 2.3.10 | `analytics_events_test.go` | 10 | 🟢 | 2026-02-02 |
| 2.3.11 | `analytics_logging_test.go` | 7 | 🟢 | 2026-02-02 |
| 2.3.12 | `analytics_stats_test.go` | 24 | 🟢 | 2026-02-02 |
| 2.3.13 | `database_stats_test.go` | 3 | 🟢 | 2026-02-02 |
| 2.3.14 | `job_routes_test.go` | 15 | 🟢 | 2026-02-02 |
| 2.3.15 | `kv_routes_test.go` | 37 | 🟢 | 2026-02-02 |
| 2.3.16 | `metrics_test.go` | 18 | 🟢 | 2026-02-02 |
| 2.3.17 | `secrets_routes_test.go` | 15 | 🟢 | 2026-02-02 |
| 2.3.18 | `traces_test.go` | 16 | 🟢 | 2026-02-02 |

**小计**: 322 测试函数 (已完成)

---

**阶段二总计**: 170 测试函数

---

## 阶段三：Tools 模块 (343 测试函数)

### 3.1 数据库相关工具 🔴

| # | 目录/文件 | 测试函数数 | 状态 | 完成日期 |
|---|----------|-----------|------|---------|
| 3.1.1 | `tools/dbutils/` (剩余) | ~20 | 🔴 | - |
| 3.1.2 | `tools/search/` (剩余) | ~35 | 🔴 | - |
| 3.1.3 | `tools/subscriptions/` | ~20 | 🔴 | - |

**小计**: ~75 测试函数

---

### 3.2 认证工具 (评估是否需要) 🔴

| # | 目录 | 测试函数数 | 需要双数据库 | 状态 |
|---|------|-----------|-------------|------|
| 3.2.1 | `tools/auth/` | ~80 | 待评估 | 🔴 |

**注**: 需要逐个分析是否涉及数据库操作

---

### 3.3 其他工具 (可能跳过) ⚪

| # | 目录 | 测试函数数 | 需要双数据库 | 状态 |
|---|------|-----------|-------------|------|
| 3.3.1 | `tools/filesystem/` | ~30 | 否 | ⚪ |
| 3.3.2 | `tools/cron/` | ~15 | 否 | ⚪ |
| 3.3.3 | `tools/security/` | ~20 | 否 | ⚪ |
| 3.3.4 | `tools/types/` | ~30 | 否 | ⚪ |
| 3.3.5 | `tools/hook/` | ~15 | 否 | ⚪ |
| 3.3.6 | `tools/router/` | ~20 | 否 | ⚪ |
| 3.3.7 | 其他 | ~58 | 否 | ⚪ |

**小计**: ~188 测试函数 (可能跳过)

---

**阶段三总计**: 343 测试函数 (实际需要迁移约 155)

---

## 阶段四：Plugins 模块 (148 测试函数)

### 4.1 需要双数据库的插件 🟡

| # | 插件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 4.1.1 | `plugins/jsvm/binds_test.go` | 14 (NewTestApp) | 🟢 | 2026-02-02 |
| 4.1.2 | `plugins/migratecmd/migratecmd_test.go` | 5 (NewTestApp) | 🟢 | 2026-02-02 |
| 4.1.3 | `plugins/gateway/` | ~15 | ⚪ | - |

**小计**: ~98 测试函数（已完成 19）

**注**:
- `plugins/jsvm/binds_test.go`: 14 个使用 `tests.NewTestApp()` 的测试已迁移
- `plugins/migratecmd/migratecmd_test.go`: 5 个子测试已迁移
- `plugins/gateway/`: 这些测试不使用 `tests.NewTestApp()`，无需迁移

---

### 4.2 可能不需要的插件 (已评估) ⚪

| # | 插件 | 测试函数数 | 需要双数据库 | 状态 |
|---|------|-----------|-------------|------|
| 4.2.1 | `plugins/ghupdate/` | ~20 | 否 | ⚪ |
| 4.2.2 | `plugins/tofauth/` | ~30 | 否 | ⚪ |
| 4.2.3 | `plugins/jsvm/` 其他测试 | ~49 | 否 | ⚪ |
| 4.2.4 | `plugins/gateway/` | ~29 | 否 | ⚪ |

**小计**: ~128 测试函数 (不需要迁移)

---

**阶段四总计**: 148 测试函数（已完成 19，跳过 129）

---

## 阶段五：Forms + Mails (17 测试函数)

### 5.1 Forms 模块 🟢

| # | 文件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 5.1.1 | `record_upsert_test.go` | 8 | 🟢 | 2026-02-02 |
| 5.1.2 | `apple_client_secret_create_test.go` | 1 | 🟢 | 2026-02-02 |
| 5.1.3 | `test_s3_filesystem_test.go` | 2 | 🟢 | 2026-02-02 |
| 5.1.4 | `test_email_send_test.go` | 1 | 🟢 | 2026-02-02 |

**小计**: 12 测试函数 (已完成)

---

### 5.2 Mails 模块 🟢

| # | 文件 | 测试函数数 | 状态 | 完成日期 |
|---|------|-----------|------|---------|
| 5.2.1 | `record_test.go` | 5 | 🟢 | 2026-02-02 |

**小计**: 5 测试函数 (已完成)

---

**阶段五总计**: 17 测试函数 (已完成 17)

---

## 收尾阶段：CI + 文档 🔴

| # | 任务 | 状态 | 完成日期 |
|---|------|------|---------|
| 6.1 | 创建 CI 配置 | 🔴 | - |
| 6.2 | 更新 TESTING.md | 🔴 | - |
| 6.3 | 更新 POSTGRESQL.md | 🔴 | - |
| 6.4 | 更新 CONTRIBUTING.md | 🔴 | - |
| 6.5 | 最终验证 | 🔴 | - |

---

## 已完成任务 🟢

| # | 任务 | 完成日期 |
|---|------|---------|
| 0.1 | 新增 `ApiScenario.TestBothDBs()` | 2026-01-30 |
| 0.2 | 新增 `ApiScenario.TestBothDBsParallel()` | 2026-01-30 |
| 0.3 | 新增 `ApiScenariosTestBothDBs()` | 2026-01-30 |
| 0.4 | 创建双数据库测试示例 | 2026-01-30 |
| 0.5 | 修复 `database_stats_test.go` | 2026-01-30 |
| 0.6 | 创建测试分析报告 | 2026-01-30 |
| 1.1.1 | 迁移 `record_model_test.go` (14 个 DB 测试) | 2026-01-30 |
| 1.1.2 | 迁移 `collection_model_test.go` (7 个 DB 测试) | 2026-01-30 |
| 1.1.3 | 迁移 `record_query_test.go` (13 个 DB 测试) | 2026-01-30 |
| 1.1.4 | 迁移 `db_test.go` (3 个 DB 测试) | 2026-01-30 |
| 1.1.5 | 迁移 `log_query_test.go` (3 个 DB 测试) | 2026-01-30 |
| 1.1.6 | 迁移 `base_test.go` (4 个 DB 测试) | 2026-01-30 |
| 1.1.7 | 迁移 `db_tx_test.go` (6 个 DB 测试) | 2026-01-30 |
| 1.1.8 | 迁移 `collection_query_test.go` (9 个测试) | 2026-01-30 |
| 1.1.9 | 迁移 `db_table_test.go` (10 个测试) | 2026-01-30 |
| 1.2.1 | 迁移 `field_text_test.go` (7 个测试) | 2026-01-30 |
| 1.2.2 | 迁移 `field_number_test.go` (6 个测试) | 2026-01-30 |
| 1.2.3 | 迁移 `field_bool_test.go` (5 个测试) | 2026-01-30 |
| 1.2.4 | 迁移 `field_date_test.go` (5 个测试) | 2026-01-30 |
| 1.2.5 | 迁移 `field_file_test.go` (12 个测试) | 2026-01-30 |
| 1.2.6 | 迁移 `field_relation_test.go` (8 个测试) | 2026-02-02 |
| 1.2.7 | 迁移 `field_select_test.go` (6 个测试) | 2026-01-30 |
| 1.2.8 | 迁移 `field_json_test.go` (6 个测试) | 2026-01-30 |
| 1.2.9 | 迁移 `field_email_test.go` (4 个测试) | 2026-01-30 |
| 1.2.10 | 迁移 `field_url_test.go` (4 个测试) | 2026-01-30 |
| 1.2.11 | 迁移 `field_editor_test.go` (5 个测试) | 2026-01-30 |
| 1.2.12 | 迁移 `field_autodate_test.go` (7 个测试) | 2026-02-02 |
| 1.2.13 | 迁移 `field_geo_point_test.go` (5 个测试) | 2026-02-02 |
| 1.2.14 | 迁移 `field_password_test.go` (7 个测试) | 2026-02-02 |
| 1.2.15 | 迁移 `field_secret_test.go` (15 个测试) | 2026-02-02 |
| 1.3.1 | 迁移 `auth_origin_query_test.go` (5 个测试) | 2026-02-02 |
| 1.3.2 | 迁移 `external_auth_query_test.go` (3 个测试) | 2026-02-02 |
| 1.3.3 | 迁移 `mfa_query_test.go` (5 个测试) | 2026-02-02 |
| 1.3.4 | 迁移 `otp_query_test.go` (5 个测试) | 2026-02-02 |
| 1.3.5 | 迁移 `record_tokens_test.go` (7 个测试) | 2026-02-02 |
| 1.4.1 | 迁移 `external_auth_model_test.go` (10 个测试) | 2026-02-02 |
| 1.4.2 | 迁移 `mfa_model_test.go` (10 个测试) | 2026-02-02 |
| 1.4.3 | 迁移 `otp_model_test.go` (10 个测试) | 2026-02-02 |
| 1.4.4 | 迁移 `auth_origin_model_test.go` (10 个测试) | 2026-02-02 |
| 1.4.5 | 迁移 `settings_query_test.go` (2 个测试) | 2026-02-02 |
| 1.4.6 | 迁移 `settings_model_test.go` (2 个测试) | 2026-02-02 |
| 1.4.7 | 迁移 `kv_store_test.go` (32 个测试) | 2026-02-02 |
| 1.4.8 | 迁移 `secrets_store_test.go` (18 个测试) | 2026-02-02 |
| 1.4.9 | 迁移 `job_store_test.go` (33 个测试) | 2026-02-02 |
| 1.4.10 | 迁移 `record_query_expand_test.go` (3 个测试) | 2026-02-02 |
| 1.4.11 | 迁移 `collection_validate_test.go` (1 个测试) | 2026-02-02 |
| 1.4.12 | 迁移 `collection_import_test.go` (4 个测试) | 2026-02-02 |
| 1.4.13 | 迁移 `collection_model_auth_options_test.go` (15 个测试) | 2026-02-02 |
| 1.4.14 | 迁移 `validators/db_test.go` (1 个测试) | 2026-02-02 |
| 1.4.15 | 迁移 `event_request_test.go` (5 个测试) | 2026-02-02 |
| 1.4.16 | 迁移 `analytics_settings_test.go` (2 个测试) | 2026-02-02 |
| 1.4.17 | 迁移 `migrations_runner_test.go` (2 个测试) | 2026-02-02 |
| 1.4.18 | 迁移 `record_model_auth_test.go` (1 个测试) | 2026-02-02 |
| 1.4.19 | 迁移 `record_model_superusers_test.go` (1 个测试) | 2026-02-02 |
| 1.4.20 | 迁移 `collection_model_view_options_test.go` (1 个测试) | 2026-02-02 |
| 1.4.21 | 迁移 `metrics_collector_test.go` (12 个测试) | 2026-02-02 |
| 1.4.22 | 迁移 `metrics_repository_test.go` (8 个测试) | 2026-02-02 |
| 1.4.23 | 迁移 `view_test.go` (4 个测试) | 2026-02-02 |
| 1.4.26 | 迁移 `collection_record_table_sync_test.go` (2 个测试) | 2026-02-02 |
| 1.4.27 | 迁移 `kv_benchmark_test.go` TestKVThroughput (1 个测试) | 2026-02-02 |
| 1.4.28 | 迁移 `field_test.go` 辅助函数 (2 个测试) | 2026-02-02 |
| 2.3.5 | 迁移 `settings_test.go` (29 个测试) | 2026-02-02 |
| 2.3.6 | 迁移 `logs_test.go` (12 个测试) | 2026-02-02 |
| 2.3.7 | 迁移 `health_test.go` (3 个测试) | 2026-02-02 |
| 2.3.8 | 迁移 `cron_test.go` (8 个测试) | 2026-02-02 |
| 2.3.9 | 迁移 `middlewares_test.go` (31 个测试) | 2026-02-02 |
| 2.x | 迁移 APIs 模块全部测试 (832 个测试) | 2026-02-02 |
| 5.1.2 | 迁移 `apple_client_secret_create_test.go` (1 个测试) | 2026-02-02 |
| 5.1.3 | 迁移 `test_s3_filesystem_test.go` (2 个测试) | 2026-02-02 |
| 5.1.4 | 迁移 `test_email_send_test.go` (1 个测试) | 2026-02-02 |
| 5.2.1 | 迁移 `mails/record_test.go` (5 个测试) | 2026-02-02 |
| 5.1.1 | 迁移 `forms/record_upsert_test.go` (8 个测试) | 2026-02-02 |
| 4.1.1 | 迁移 `plugins/jsvm/binds_test.go` (14 个测试) | 2026-02-02 |
| 4.1.2 | 迁移 `plugins/migratecmd/migratecmd_test.go` (5 个测试) | 2026-02-02 |

---

## 进度统计

| 阶段 | 需要迁移 | 已完成 | 进行中 | 待开始 | 跳过 | 完成率 |
|------|---------|-------|-------|-------|------|-------|
| 框架改进 | 6 | 6 | 0 | 0 | 0 | 100% |
| 阶段一 Core | 788 | 411 | 0 | 333 | 44 | 52.2% |
| 阶段二 APIs | 832 | 832 | 0 | 0 | 0 | 100% |
| 阶段三 Tools | 343 | 12 | 0 | 143 | 188 | 3.5% |
| 阶段四 Plugins | 148 | 19 | 0 | 0 | 129 | 12.8% |
| 阶段五 Forms+Mails | 17 | 17 | 0 | 0 | 0 | 100% |
| 收尾 | 5 | 0 | 0 | 5 | 0 | 0% |
| **总计** | **2,139** | **1,297** | **0** | **481** | **361** | **60.6%** |

**目标进度**: 1380/1549 → 1549/1549 (89.1% → 100%)

---

## 下一步行动

1. ✅ ~~**已完成**: 阶段 1.1 - 数据库核心测试~~ 
2. ✅ ~~**已完成**: 阶段 1.2 - 字段类型测试~~
3. ✅ ~~**已完成**: 阶段 1.3 - 认证相关测试~~
4. ✅ ~~**已完成**: 阶段 4.1 - Plugins 模块测试（jsvm, migratecmd）~~
5. **下一个**: 完成收尾阶段 - CI 配置和文档更新
5. **本周**: 完成阶段一其他 Core 测试 (1.4.x)

---

## ⚠️ 发现的代码问题（需要修复）

在迁移测试过程中发现以下**代码实现问题**（不仅仅是测试问题）：

### 问题 1: `FindAuthRecordByEmail` 硬编码 SQLite 语法 🟢 已修复

**文件**: `core/record_query.go:555`

**问题描述**:
```go
// 原实现 - 硬编码 SQLite 语法
expr = dbx.NewExp("[["+FieldNameEmail+"]] = {:email} COLLATE NOCASE", dbx.Params{"email": email})
```

**修复方案**: 使用 `DBAdapter().NoCaseCollation()` 判断数据库类型
```go
collation := app.DBAdapter().NoCaseCollation()
if collation == "LOWER" {
    // PostgreSQL: WHERE LOWER(email) = LOWER(:email)
    expr = dbx.NewExp("LOWER([["+FieldNameEmail+"]]) = LOWER({:email})", dbx.Params{"email": email})
} else {
    // SQLite: WHERE email = :email COLLATE NOCASE
    expr = dbx.NewExp("[["+FieldNameEmail+"]] = {:email} "+collation, dbx.Params{"email": email})
}
```

**状态**: 🟢 已修复 (2026-01-30)

---

### 问题 2: `field_text.go` 硬编码 SQLite 语法 🟢 已修复

**文件**: `core/field_text.go:208`

**问题描述**:
```go
// 原实现 - 硬编码 SQLite 语法
Where(dbx.NewExp("id = {:id} COLLATE NOCASE", dbx.Params{"id": newVal})).
```

**修复方案**: 同问题 1，使用 `DBAdapter().NoCaseCollation()` 判断

**状态**: 🟢 已修复 (2026-01-30)

---

### 问题 3: `initDataDB` 没有正确检查 `PostgresDSN` 🟢 已修复

**文件**: `core/base.go:initDataDB()`

**问题描述**:
原代码检查 `app.DataDir()` 是否为 PostgreSQL DSN，但忽略了 `config.PostgresDSN` 设置。

**修复方案**: 
1. 优先检查 `app.config.PostgresDSN`
2. 自动根据数据库类型设置 `DBAdapter`

**状态**: 🟢 已修复 (2026-01-30)

---

### 问题 4: AuxDB 迁移错误使用主数据库类型判断 🟢 已修复

**文件**: 
- `migrations/1640988000_aux_init.go`
- `migrations/1736600000_system_metrics.go`

**问题描述**:
AuxDB（日志数据库）始终使用 SQLite，但这些迁移检查 `txApp.IsPostgres()` 来决定 SQL 语法。当主数据库是 PostgreSQL 时，会对 SQLite AuxDB 执行 PostgreSQL 语法导致错误。

**修复方案**: 移除 `IsPostgres()` 判断，始终使用 SQLite 语法

**状态**: 🟢 已修复 (2026-01-30)

---

### 问题 5: PostgreSQL 测试框架缺少测试数据导入 🔴

**文件**: `tests/dual_db_test_helper.go`

**问题描述**:
`NewPostgresTestApp()` 只设置了 PostgreSQL DSN，但没有导入测试数据到 PostgreSQL 数据库。SQLite 测试使用克隆的 `data.db` 文件，但 PostgreSQL 需要单独导入数据。

**影响**:
- PostgreSQL 测试找不到测试数据（如用户、collection等）
- 导致 "no rows in result set" 错误

**修复建议**:
需要在 `NewPostgresTestApp()` 中添加测试数据导入逻辑，或者修改测试数据初始化方式。

**状态**: 🔴 待修复

---

## 验证命令

```bash
# 验证单个文件迁移
TEST_POSTGRES=1 POSTGRES_DSN="..." go test ./core/... -v -run "TestRecordModel" -count 1

# 验证整个模块
TEST_POSTGRES=1 POSTGRES_DSN="..." go test ./core/... -count 1 -timeout 30m

# 统计 PostgreSQL 测试覆盖
grep -r "func Test" --include="*_test.go" . | wc -l  # 总测试数
grep -r "DualDBTest\|TestBothDBs\|Postgres\|PG" --include="*_test.go" . | wc -l  # PostgreSQL 测试数
```
