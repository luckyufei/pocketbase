# 双数据库测试覆盖改进计划（完整版）

> **版本**: 2.0  
> **日期**: 2026-01-30  
> **状态**: 待执行  
> **目标**: 将 PostgreSQL 测试覆盖率提升到与 SQLite 相同的水平

## 目标

| 指标 | 当前值 | 目标值 |
|------|-------|-------|
| SQLite 测试函数 | 1,549 | 1,549 |
| PostgreSQL 测试函数 | 82 | **1,549** |
| 覆盖率 | 5.3% | **100%** |
| 测试缺口 | 1,467 | **0** |

---

## 总体策略

### 方案选择

| 方案 | 描述 | 工作量 | 推荐 |
|------|------|-------|------|
| A. 复制所有测试 | 为每个 SQLite 测试创建 PostgreSQL 副本 | 极高 | ❌ |
| B. **双数据库方法** | 使用 `TestBothDBs()` 让现有测试同时运行在两种数据库上 | 低 | ✅ |
| C. 参数化测试 | 通过参数控制数据库类型 | 中 | ⚪ |

**采用方案 B**：通过将 `scenario.Test(t)` 改为 `scenario.TestBothDBs(t)`，或使用 `DualDBTest()` 包装现有测试，最小化代码改动。

---

## 阶段划分

| 阶段 | 模块 | 缺口 | 预计工作量 | 时间 |
|------|------|------|-----------|------|
| 阶段一 | core | 788 | 3-4 周 | Week 1-4 |
| 阶段二 | apis | 170 | 1-2 周 | Week 5-6 |
| 阶段三 | tools | 343 | 2-3 周 | Week 7-9 |
| 阶段四 | plugins | 148 | 1-2 周 | Week 10-11 |
| 阶段五 | forms + mails | 17 | 2-3 天 | Week 12 |
| 收尾 | CI + 文档 | - | 1 周 | Week 13 |

---

## 阶段一：Core 模块 (788 个测试函数)

### 1.1 数据库相关测试 (高优先级)

需要迁移到双数据库的测试文件：

| 文件 | 测试函数数 | 优先级 | 迁移方式 |
|------|-----------|-------|---------|
| `record_model_test.go` | ~50 | 🔴 P0 | DualDBTest |
| `collection_model_test.go` | ~40 | 🔴 P0 | DualDBTest |
| `record_query_test.go` | ~30 | 🔴 P0 | DualDBTest |
| `db_test.go` | ~20 | 🔴 P0 | DualDBTest |
| `db_cron_test.go` | ~15 | 🟡 P1 | DualDBTest |
| `db_settings_test.go` | ~10 | 🟡 P1 | DualDBTest |

### 1.2 字段类型测试 (中优先级)

| 文件 | 测试函数数 | 优先级 |
|------|-----------|-------|
| `field_text_test.go` | ~20 | 🟡 P1 |
| `field_number_test.go` | ~15 | 🟡 P1 |
| `field_bool_test.go` | ~10 | 🟡 P1 |
| `field_date_test.go` | ~15 | 🟡 P1 |
| `field_file_test.go` | ~20 | 🟡 P1 |
| `field_relation_test.go` | ~25 | 🔴 P0 |
| `field_select_test.go` | ~15 | 🟡 P1 |
| `field_json_test.go` | ~15 | 🔴 P0 |
| `field_email_test.go` | ~10 | 🟢 P2 |
| `field_url_test.go` | ~10 | 🟢 P2 |
| `field_editor_test.go` | ~10 | 🟢 P2 |
| `field_autodate_test.go` | ~10 | 🟡 P1 |
| `field_geo_point_test.go` | ~10 | 🟢 P2 |
| `field_password_test.go` | ~15 | 🟡 P1 |

### 1.3 认证相关测试

| 文件 | 测试函数数 | 优先级 |
|------|-----------|-------|
| `auth_origin_query_test.go` | ~15 | 🔴 P0 |
| `external_auth_query_test.go` | ~20 | 🔴 P0 |
| `mfa_query_test.go` | ~15 | 🔴 P0 |
| `otp_query_test.go` | ~15 | 🔴 P0 |

### 1.4 迁移方式示例

```go
// 原来的测试
func TestRecordModel(t *testing.T) {
    app, _ := tests.NewTestApp()
    defer app.Cleanup()
    // ... 测试代码
}

// 迁移后
func TestRecordModel(t *testing.T) {
    tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
        // ... 相同的测试代码，但会在 SQLite 和 PostgreSQL 上都运行
    })
}
```

---

## 阶段二：APIs 模块 (170 个测试函数)

### 2.1 CRUD 测试 (高优先级)

| 文件 | 测试函数数 | 迁移方式 |
|------|-----------|---------|
| `record_crud_test.go` | ~50 | `TestBothDBs()` |
| `collection_test.go` | ~30 | `TestBothDBs()` |
| `collection_import_test.go` | ~10 | `TestBothDBs()` |

### 2.2 认证测试

| 文件 | 测试函数数 | 迁移方式 |
|------|-----------|---------|
| `record_auth_password_test.go` | ~15 | `TestBothDBs()` |
| `record_auth_with_oauth2_test.go` | ~20 | `TestBothDBs()` |
| `record_auth_otp_test.go` | ~10 | `TestBothDBs()` |
| `record_auth_refresh_test.go` | ~5 | `TestBothDBs()` |
| `record_auth_methods_test.go` | ~5 | `TestBothDBs()` |

### 2.3 其他 API 测试

| 文件 | 测试函数数 | 迁移方式 |
|------|-----------|---------|
| `batch_test.go` | ~10 | `TestBothDBs()` |
| `realtime_test.go` | ~8 | `TestBothDBs()` |
| `file_test.go` | ~10 | `TestBothDBs()` |
| `backup_test.go` | ~8 | `TestBothDBs()` |
| `settings_test.go` | ~5 | `TestBothDBs()` |
| `logs_test.go` | ~5 | `TestBothDBs()` |

### 2.4 迁移方式示例

```go
// 原来的测试
func TestRecordCrudList(t *testing.T) {
    scenarios := []tests.ApiScenario{...}
    for _, scenario := range scenarios {
        scenario.Test(t)  // 只在 SQLite 上运行
    }
}

// 迁移后 - 方式1：逐个迁移
func TestRecordCrudList(t *testing.T) {
    scenarios := []tests.ApiScenario{...}
    for _, scenario := range scenarios {
        scenario.TestBothDBs(t)  // 在 SQLite 和 PostgreSQL 上都运行
    }
}

// 迁移后 - 方式2：批量迁移
func TestRecordCrudList(t *testing.T) {
    scenarios := []tests.ApiScenario{...}
    tests.ApiScenariosTestBothDBs(t, scenarios)
}
```

---

## 阶段三：Tools 模块 (343 个测试函数)

### 3.1 数据库相关工具 (高优先级)

| 目录/文件 | 测试函数数 | 优先级 |
|----------|-----------|-------|
| `tools/dbutils/` | ~30 | 🔴 P0 |
| `tools/search/` | ~40 | 🔴 P0 |

### 3.2 认证提供商 (中优先级)

| 目录 | 测试函数数 | 说明 |
|------|-----------|------|
| `tools/auth/` | ~80 | 35+ OAuth 提供商，大部分与数据库无关 |

**注意**: 大部分 OAuth 提供商测试不涉及数据库操作，可能不需要双数据库测试。

### 3.3 其他工具

| 目录 | 测试函数数 | 需要双数据库 |
|------|-----------|-------------|
| `tools/filesystem/` | ~30 | ⚪ 可能不需要 |
| `tools/subscriptions/` | ~20 | ✅ 需要 |
| `tools/cron/` | ~15 | ⚪ 可能不需要 |
| `tools/security/` | ~20 | ⚪ 可能不需要 |
| `tools/types/` | ~30 | ⚪ 可能不需要 |
| `tools/hook/` | ~15 | ⚪ 可能不需要 |
| `tools/router/` | ~20 | ⚪ 可能不需要 |
| 其他 | ~60 | ⚪ 可能不需要 |

**筛选原则**: 只对涉及数据库操作的测试进行双数据库迁移。

---

## 阶段四：Plugins 模块 (148 个测试函数)

### 4.1 需要双数据库的插件

| 插件 | 测试函数数 | 优先级 | 原因 |
|------|-----------|-------|------|
| `jsvm/` | ~63 | 🔴 P0 | 涉及 hooks 和 migrations |
| `migratecmd/` | ~20 | 🔴 P0 | 直接操作数据库 |
| `gateway/` | ~15 | 🟡 P1 | 代理配置存储 |

### 4.2 可能不需要双数据库的插件

| 插件 | 测试函数数 | 原因 |
|------|-----------|------|
| `ghupdate/` | ~20 | 与数据库无关 |
| `tofauth/` | ~30 | 主要是 HTTP 测试 |

---

## 阶段五：Forms + Mails 模块 (17 个测试函数)

### 5.1 Forms 模块

| 文件 | 测试函数数 | 迁移方式 |
|------|-----------|---------|
| `record_upsert_test.go` | ~8 | DualDBTest |
| 其他 | ~4 | DualDBTest |

### 5.2 Mails 模块

| 文件 | 测试函数数 | 需要双数据库 |
|------|-----------|-------------|
| `mails_test.go` | ~5 | ⚪ 可能不需要 |

---

## 收尾阶段：CI + 文档

### CI 配置

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
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: pocketbase_test
        ports:
          - 5432:5432
    env:
      TEST_POSTGRES: 1
      POSTGRES_DSN: postgres://postgres:postgres@localhost:5432/pocketbase_test?sslmode=disable
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
      - run: go test ./... -count 1 -timeout 30m
```

### 文档更新

| 文档 | 内容 |
|------|------|
| `docs/TESTING.md` | 双数据库测试指南 |
| `docs/POSTGRESQL.md` | PostgreSQL 测试章节 |
| `CONTRIBUTING.md` | 贡献者测试要求 |

---

## 进度跟踪

### 里程碑

| 里程碑 | 目标覆盖率 | 预计日期 |
|--------|-----------|---------|
| M1: Core 完成 | 55% | Week 4 |
| M2: APIs 完成 | 66% | Week 6 |
| M3: Tools 完成 | 88% | Week 9 |
| M4: Plugins 完成 | 98% | Week 11 |
| M5: 全部完成 | 100% | Week 13 |

### 覆盖率计算

| 阶段完成后 | 新增 PostgreSQL 测试 | 累计 PostgreSQL 测试 | 覆盖率 |
|-----------|---------------------|---------------------|-------|
| 当前 | 0 | 82 | 5.3% |
| 阶段一完成 | +788 | 870 | 56.2% |
| 阶段二完成 | +170 | 1,040 | 67.1% |
| 阶段三完成 | +343 | 1,383 | 89.3% |
| 阶段四完成 | +148 | 1,531 | 98.8% |
| 阶段五完成 | +17 | 1,548 | 99.9% |
| 收尾 | +1 | 1,549 | 100% |

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| PostgreSQL 语法不兼容 | 中 | 高 | 使用 `dbutils` 兼容函数 |
| 测试数据不一致 | 中 | 中 | 每次测试前重置数据 |
| CI 超时 | 低 | 中 | 并行化测试运行 |
| 工作量超出预期 | 中 | 中 | 优先处理高优先级测试 |

---

## 资源需求

| 资源 | 数量 | 用途 |
|------|------|------|
| 开发人员 | 1-2 | 测试迁移 |
| CI 分钟数 | ~1000/周 | 双数据库测试运行 |
| 时间 | 13 周 | 完成全部迁移 |

---

## 附录：不需要双数据库测试的模块

以下模块/测试与数据库操作无关，可以跳过：

| 模块 | 原因 |
|------|------|
| `tools/archive/` | 纯文件操作 |
| `tools/inflector/` | 字符串处理 |
| `tools/list/` | 通用列表操作 |
| `tools/logger/` | 日志输出 |
| `tools/mailer/` | SMTP 操作 |
| `tools/osutils/` | OS 操作 |
| `tools/picker/` | 数据选择 |
| `tools/routine/` | 协程管理 |
| `tools/template/` | 模板渲染 |
| `tools/tokenizer/` | 分词 |
| `tools/types/` | 类型定义 |
| `plugins/ghupdate/` | GitHub API |
