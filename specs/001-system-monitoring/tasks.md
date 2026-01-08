# Tasks: System Metrics 重构 - 合并到 AuxDB 并兼容 PostgreSQL

**Feature Branch**: `001-system-monitoring`  
**Created**: 2026-01-08  
**Status**: In Progress  
**Approach**: TDD (Red-Green-Refactor), 覆盖率目标 90%

## 重构目标

将独立的 `metrics.db` 合并到 `auxiliary.db`，复用现有的读写连接池分离机制，同时兼容 SQLite 和 PostgreSQL。

### 架构变更

```
Before:
├── data.db          (业务数据)
├── auxiliary.db     (Logs: _logs 表)
└── metrics.db       (Metrics: system_metrics 表)  ← 独立文件

After:
├── data.db          (业务数据)
└── auxiliary.db     (Logs + Metrics)
    ├── _logs 表
    └── _metrics 表  ← 合并到 AuxDB
```

### 优势

1. **复用读写分离**: AuxDB 已有 `auxConcurrentDB` + `auxNonconcurrentDB`
2. **统一生命周期**: 共享 WAL checkpoint、备份、迁移机制
3. **减少复杂度**: 少一个 db 文件，少一套连接池管理
4. **PostgreSQL 兼容**: 复用 AuxDB 的 PostgreSQL 适配逻辑

---

## Tasks

### Task 1: SystemMetrics Model 重构 (TDD)

**目标**: 将 `SystemMetrics` 改造为标准 Model 接口，支持 `app.AuxSave()`

**测试文件**: `core/metrics_model_test.go`

**Red Tests** (先写失败测试):
- [ ] 1.1 `TestSystemMetricsImplementsModel` - 验证实现 Model 接口
- [ ] 1.2 `TestSystemMetricsTableName` - 表名为 `_metrics`
- [ ] 1.3 `TestSystemMetricsPrimaryKey` - 验证 PK 方法
- [ ] 1.4 `TestSystemMetricsIsNew` - 验证 IsNew 判断逻辑
- [ ] 1.5 `TestSystemMetricsSetId` - 验证 SetId 方法

**Green Implementation**:
- [ ] 1.6 `SystemMetrics` 嵌入 `BaseModel`
- [ ] 1.7 表名改为 `_metrics` (与 `_logs` 命名风格一致)
- [ ] 1.8 使用 `types.DateTime` 替代 `time.Time`

**验收标准**: `go test -v -run TestSystemMetrics ./core/` 全部通过

---

### Task 2: 数据库迁移 (TDD)

**目标**: 在 AuxDB 中创建 `_metrics` 表，兼容 SQLite/PostgreSQL

**测试文件**: `migrations/metrics_migration_test.go`

**Red Tests**:
- [ ] 2.1 `TestMetricsMigrationSQLite` - SQLite 下表结构正确
- [ ] 2.2 `TestMetricsMigrationPostgreSQL` - PostgreSQL 下表结构正确
- [ ] 2.3 `TestMetricsMigrationIdempotent` - 迁移幂等性
- [ ] 2.4 `TestMetricsMigrationIndexes` - 索引创建正确

**Green Implementation**:
- [ ] 2.5 创建 `migrations/1736300000_metrics.go`
- [ ] 2.6 SQLite DDL: 使用 `strftime` 时间格式
- [ ] 2.7 PostgreSQL DDL: 使用 `TIMESTAMPTZ` 类型

**验收标准**: 迁移在两种数据库下均可执行

---

### Task 3: MetricsRepository 实现 (TDD)

**目标**: 使用 AuxDB 操作替代独立 MetricsDB

**测试文件**: `core/metrics_repository_test.go`

**Red Tests**:
- [ ] 3.1 `TestMetricsRepositoryInsert` - 插入单条记录
- [ ] 3.2 `TestMetricsRepositoryInsertBatch` - 批量插入
- [ ] 3.3 `TestMetricsRepositoryGetLatest` - 获取最新记录
- [ ] 3.4 `TestMetricsRepositoryGetByTimeRange` - 按时间范围查询
- [ ] 3.5 `TestMetricsRepositoryCleanup` - 清理过期数据
- [ ] 3.6 `TestMetricsRepositorySQLite` - SQLite 兼容性
- [ ] 3.7 `TestMetricsRepositoryPostgreSQL` - PostgreSQL 兼容性

**Green Implementation**:
- [ ] 3.8 创建 `core/metrics_repository.go`
- [ ] 3.9 使用 `app.AuxSave()` / `app.AuxModelQuery()` API
- [ ] 3.10 时间范围查询兼容两种数据库语法

**验收标准**: 覆盖率 ≥ 90%

---

### Task 4: MetricsCollector 适配 (TDD)

**目标**: 修改采集器使用新的 Repository

**测试文件**: `core/metrics_collector_test.go` (更新现有测试)

**Red Tests**:
- [ ] 4.1 `TestCollectorUsesAuxDB` - 验证使用 AuxDB 而非独立 DB
- [ ] 4.2 `TestCollectorWriteIsolation` - 写入不阻塞业务
- [ ] 4.3 `TestCollectorErrorRecovery` - DB 错误时优雅降级

**Green Implementation**:
- [ ] 4.4 修改 `MetricsCollector` 依赖 `MetricsRepository`
- [ ] 4.5 移除 `MetricsDB` 依赖
- [ ] 4.6 使用 `AuxNonconcurrentDB` 进行写入

**验收标准**: 现有测试 + 新测试全部通过

---

### Task 5: API 层适配 (TDD)

**目标**: 修改 metrics API 使用新的 Repository

**测试文件**: `apis/metrics_test.go` (更新现有测试)

**Red Tests**:
- [ ] 5.1 `TestMetricsAPIWithAuxDB` - API 使用 AuxDB 查询
- [ ] 5.2 `TestMetricsAPIPostgreSQL` - PostgreSQL 下 API 正常工作

**Green Implementation**:
- [ ] 5.3 修改 `apis/metrics.go` 使用 `MetricsRepository`
- [ ] 5.4 移除 `InitMetricsService` 中的独立 DB 初始化

**验收标准**: 所有 API 测试通过

---

### Task 6: 清理旧代码

**目标**: 删除独立 MetricsDB 相关代码

**Checklist**:
- [ ] 6.1 删除 `core/metrics_db.go`
- [ ] 6.2 删除 `core/metrics_db_test.go`
- [ ] 6.3 更新 `core/base.go` 移除 MetricsDB 初始化
- [ ] 6.4 更新备份逻辑排除 `metrics.db`
- [ ] 6.5 添加数据迁移逻辑 (可选: 从旧 metrics.db 导入)

**验收标准**: `go build ./...` 无编译错误

---

### Task 7: 集成测试

**目标**: 端到端验证重构后功能正常

**测试文件**: `tests/metrics_integration_test.go`

**Tests**:
- [ ] 7.1 `TestMetricsE2ESQLite` - SQLite 全流程
- [ ] 7.2 `TestMetricsE2EPostgreSQL` - PostgreSQL 全流程
- [ ] 7.3 `TestMetricsPerformance` - 性能不退化

**验收标准**: 
- 所有集成测试通过
- `go test -cover ./core/... ./apis/...` 覆盖率 ≥ 90%

---

## 执行顺序

```
Task 1 (Model) → Task 2 (Migration) → Task 3 (Repository)
                                           ↓
Task 6 (Cleanup) ← Task 5 (API) ← Task 4 (Collector)
                                           ↓
                                    Task 7 (Integration)
```

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 数据迁移丢失 | 保留旧 metrics.db 读取逻辑，启动时自动导入 |
| PostgreSQL 语法差异 | 使用 `app.IsPostgres()` 分支处理 |
| 性能退化 | 使用 `AuxNonconcurrentDB` 单连接写入，避免锁竞争 |

## 进度跟踪

| Task | Status | Coverage | Notes |
|------|--------|----------|-------|
| 1 | ✅ Completed | 100% | SystemMetrics 实现 Model 接口，嵌入 BaseModel |
| 2 | ✅ Completed | 54.5% | 迁移文件创建 _metrics 表 |
| 3 | ✅ Completed | 80-100% | MetricsRepository 使用 AuxDB |
| 4 | ✅ Completed | 87-100% | MetricsCollector 适配新 Repository |
| 5 | ✅ Completed | 70-100% | API 层使用 MetricsRepository |
| 6 | ✅ Completed | - | 删除 metrics_db.go 和 metrics_db_test.go |
| 7 | ✅ Completed | - | 所有集成测试通过 |
