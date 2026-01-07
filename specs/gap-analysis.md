# PocketBase PostgreSQL 适配 - 差距分析报告

> **分析目的**: 对比计划任务 (`specs/003-postgresql-evolution/`) 与已实现代码 (`specs/postgresql-adaptation.md`) 之间的差距
> **分析日期**: 2026-01-06
> **兼容性要求**: PostgreSQL 15+

---

## ✅ 已解决: PostgreSQL 15 兼容性

### 问题描述 (已修复)

~~当前实现使用了 **`JSON_QUERY`** 函数，该函数是 **PostgreSQL 17** (2024年9月发布) 才引入的 SQL/JSON 标准函数。~~

**已修复**: 所有 `JSON_QUERY` 调用已替换为 `jsonb_path_query_first` (PostgreSQL 12+)

**修改的文件**:
- ✅ `migrations/postgres_functions.go` - `json_query_or_null` 函数定义
- ✅ `tools/dbutils/json.go` - `JSONExtract` 函数
- ✅ `tools/search/simple_field_resolver.go` - JSON 路径查询生成
- ✅ `tests/data/*.pg-dump.sql` - 测试数据

**当前实现**:
```sql
-- 兼容 PG15 的实现 (已应用)
CREATE OR REPLACE FUNCTION json_query_or_null(p_input anyelement, p_query text) 
RETURNS jsonb AS $$
BEGIN
    RETURN jsonb_path_query_first(p_input::text::jsonb, p_query::jsonpath);  -- ✅ PG12+
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
```

### 版本兼容性矩阵

| 函数 | PostgreSQL 版本 | 说明 |
|------|----------------|------|
| `JSON_QUERY` | 17+ | SQL/JSON 标准函数 (已移除) |
| `jsonb_path_query` | 12+ | JSONPath 查询，返回所有匹配 |
| `jsonb_path_query_first` | 12+ | JSONPath 查询，返回第一个匹配 (**当前使用**) |
| `->`, `->>`, `#>` | 9.4+ | 传统 JSONB 操作符 |

---

## 执行摘要

| 维度 | 计划 | 已实现 | 完成度 |
|------|------|--------|--------|
| **EPIC 数量** | 8 | 部分 | ~35% |
| **Story 数量** | 23 | 部分 | ~40% |
| **Task 数量** | 127 | 部分 | ~40% |
| **预估工时** | 341h | - | - |

**核心结论**: 
- 🚨 **紧急**: 需要修复 PostgreSQL 15 兼容性问题 (`JSON_QUERY` → `jsonb_path_query`)
- ✅ **EPIC-1 数据层解耦** 已基本完成 (~90%)，但 JSON 函数需要重做
- ✅ **EPIC-2 分布式事件网格** 已完成核心功能 (~70%)
- ⬜ **EPIC-3~8** 尚未开始或仅有基础设施

---

## 详细对比分析

### EPIC-1: 数据层解耦 ✅ 基本完成

| Story | 计划内容 | 实现状态 | 差距说明 |
|-------|---------|---------|---------|
| **STORY-1.1: 类型系统适配** | 布尔值、时间戳、UUID 转换 | ✅ 已实现 | 代码中已有 `TRUE/FALSE` 转换、`TIMESTAMPTZ` 支持、`uuid_generate_v7()` 函数 |
| **STORY-1.2: JSON 处理重写** | `json_extract` → JSONB | ✅ 已实现 | `tools/dbutils/json.go` 已实现 `jsonb_array_elements_text`、`JSON_QUERY_OR_NULL` 等 |
| **STORY-1.3: 并发模型验证** | 悲观锁、死锁检测 | ⚠️ 部分 | 未见 `SELECT FOR UPDATE` 和死锁重试机制的实现 |
| **STORY-1.4: 测试框架改造** | dockertest 集成 | ⚠️ 部分 | 有 `tests/data/*.pg-dump.sql` 测试数据，但未见 dockertest 集成 |
| **STORY-1.5: 连接池管理** | pgxpool 配置 | ✅ 已实现 | `DefaultDataMaxOpenConns=70`, `DefaultAuxMaxOpenConns=20` 已配置 |

**已实现的关键代码**:
```
core/db_connect.go       - PostgreSQL 连接函数
tools/dbutils/json.go    - JSON 操作适配
tools/search/filter.go   - 过滤器表达式生成
core/db_table.go         - 系统表查询适配
core/view.go             - 视图依赖处理
```

**差距详情**:

| Task ID | 描述 | 状态 |
|---------|------|------|
| T-1.1.1 | 布尔值转换器 | ✅ 已实现 (`TRUE/FALSE`) |
| T-1.1.2 | DateTime ↔ TIMESTAMPTZ | ✅ 已实现 |
| T-1.1.3 | UUID v7 生成函数 | ✅ 已实现 (`uuid_generate_v7`) |
| T-1.1.4 | 外键约束级联行为 | ✅ 已实现 (`CASCADE`) |
| T-1.1.5 | 类型转换单元测试 | ⚠️ 部分 |
| T-1.2.1 | 分析 `json_extract` 调用点 | ✅ 已完成 |
| T-1.2.2 | JSON 路径 AST 转换 | ✅ 已实现 (`JSON_QUERY_OR_NULL`) |
| T-1.2.3 | `JSON_QUERY_OR_NULL` 函数 | ✅ 已实现 |
| T-1.2.4 | `filter.go` 支持 JSONB | ✅ 已实现 (`to_jsonb`, 类型推断) |
| T-1.2.5 | GIN 索引自动创建 | ⬜ 未实现 |
| T-1.2.6 | JSON 查询转换测试 | ⚠️ 部分 |
| T-1.3.1~5 | 并发模型相关 | ⬜ 未实现 |
| T-1.4.1~5 | 测试框架相关 | ⚠️ 部分 (有测试数据，无 dockertest) |
| T-1.5.1 | pgxpool 替换 | ✅ 已实现 (`dbx.MustOpen("pgx", ...)`) |
| T-1.5.2 | 连接池配置项 | ✅ 已实现 |
| T-1.5.3 | 连接泄漏检测 | ⬜ 未实现 |
| T-1.5.4 | 连接池状态指标 | ⬜ 未实现 |

---

### EPIC-2: 分布式事件网格 ✅ 核心已完成

| Story | 计划内容 | 实现状态 | 差距说明 |
|-------|---------|---------|---------|
| **STORY-2.1: LISTEN/NOTIFY** | 事件监听基础设施 | ✅ 已实现 | `apis/realtime_bridge.go` 完整实现 |
| **STORY-2.2: 缓存失效** | 多实例缓存同步 | ✅ 已实现 | `collection_updated`, `settings_updated` 消息类型 |
| **STORY-2.3: 分布式 Hook** | 竞争消费/广播模式 | ⚠️ 部分 | 有订阅同步，但未见完整的 Hook 执行模式 |
| **STORY-2.4: 分布式 Cron** | Advisory Lock | ⬜ 未实现 | 未见 `pg_try_advisory_lock` 相关代码 |

**已实现的关键代码**:
```
apis/realtime_bridge.go        - 实时同步桥接主逻辑
apis/realtime_bridgedclient.go - 桥接客户端
```

**已实现的消息类型**:
- `subscription_upsert` - 订阅更新
- `subscription_delete` - 订阅删除
- `subscription_channel_offline` - 频道离线
- `collection_updated` - 集合定义更新
- `settings_updated` - 系统设置更新

**已实现的数据表**:
```sql
CREATE TABLE "_realtimeChannels" (
    "channelId" TEXT PRIMARY KEY,
    "validUntil" TIMESTAMP NOT NULL
);

CREATE TABLE "_realtimeClients" (
    "clientId" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "subscriptions" TEXT[] NOT NULL,
    ...
);
```

**差距详情**:

| Task ID | 描述 | 状态 |
|---------|------|------|
| T-2.1.1 | 事件监听 Goroutine | ✅ 已实现 (`listenSharedBridgeChannelLoop`) |
| T-2.1.2 | 事件 Payload 结构 | ✅ 已实现 |
| T-2.1.3 | node_id 生成比对 | ✅ 已实现 (`channelId`) |
| T-2.1.4 | 自动重连 | ✅ 已实现 (`loopOnNotification`) |
| T-2.1.5 | 单元测试 | ⬜ 未见 |
| T-2.2.1~5 | 缓存失效相关 | ✅ 已实现 |
| T-2.3.1~4 | 分布式 Hook | ⚠️ 部分 |
| T-2.4.1~4 | 分布式 Cron | ⬜ 未实现 |

---

### EPIC-3: 可观测性系统 ⬜ 未实现

| Story | 计划内容 | 实现状态 | 差距说明 |
|-------|---------|---------|---------|
| **STORY-3.1: 高性能日志** | UNLOGGED 分区表 | ⬜ 未实现 | 无相关代码 |
| **STORY-3.2: 监控数据采集** | metrics 表 | ⬜ 未实现 | 无相关代码 |
| **STORY-3.3: 监控专用连接** | 保留连接 | ⬜ 未实现 | 无相关代码 |
| **STORY-3.4: 数据老化** | 分区清理 | ⬜ 未实现 | 无相关代码 |

**预估工时**: 48h (全部待开发)

---

### EPIC-4: 行级安全性 ⬜ 未实现

| Story | 计划内容 | 实现状态 | 差距说明 |
|-------|---------|---------|---------|
| **STORY-4.1: 会话上下文注入** | `set_config` | ⬜ 未实现 | 无 `pb.auth.id` 注入代码 |
| **STORY-4.2: 规则编译器** | AST → RLS | ⬜ 未实现 | 无规则编译器 |
| **STORY-4.3: 跨集合规则** | EXISTS 子查询 | ⬜ 未实现 | 无相关代码 |

**预估工时**: 54h (全部待开发)

**注意**: 当前安全模型仍在应用层实现，未下沉到数据库 RLS。

---

### EPIC-5: 原生 Realtime 引擎 ⬜ 未实现

| Story | 计划内容 | 实现状态 | 差距说明 |
|-------|---------|---------|---------|
| **STORY-5.1: WAL 消费者** | pglogrepl | ⬜ 未实现 | 当前使用 LISTEN/NOTIFY，非 WAL 订阅 |
| **STORY-5.2: 事件权限过滤** | ViewRule 评估 | ⬜ 未实现 | 无相关代码 |

**预估工时**: 48h (全部待开发)

**当前实现**: 使用 `LISTEN/NOTIFY` 实现多实例同步，但不是真正的 WAL 订阅。

---

### EPIC-7: PostgreSQL 扩展生态 ⬜ 未实现

| Story | 计划内容 | 实现状态 | 差距说明 |
|-------|---------|---------|---------|
| **STORY-7.1: 向量字段** | pgvector | ⬜ 未实现 | 无 vector 字段类型 |
| **STORY-7.2: 全文搜索** | pg_trgm | ⬜ 未实现 | 无 GIN 索引优化 |

**预估工时**: 29h (全部待开发)

---

### EPIC-8: 运维与部署 ⚠️ 部分实现

| Story | 计划内容 | 实现状态 | 差距说明 |
|-------|---------|---------|---------|
| **STORY-8.1: 启动引导** | 自动初始化 | ✅ 已实现 | 自动创建数据库、兼容函数 |
| **STORY-8.2: 备份导出** | pg_dump 集成 | ⬜ 未实现 | 文档提到"需要额外配置" |
| **STORY-8.3: 容器化部署** | Docker Compose | ⬜ 未实现 | 无模板文件 |

**已实现的启动功能**:
- 自动创建不存在的数据库
- 执行兼容函数创建 (`migrations/postgres_functions.go`)
- 环境变量配置支持

---

## 完成度统计

### 按 EPIC 统计

| EPIC | 计划 Tasks | 已完成 | 部分完成 | 未开始 | 完成度 |
|------|-----------|--------|---------|--------|--------|
| EPIC-1: 数据层解耦 | 25 | 15 | 5 | 5 | **70%** |
| EPIC-2: 分布式事件网格 | 18 | 10 | 3 | 5 | **60%** |
| EPIC-3: 可观测性系统 | 24 | 0 | 0 | 24 | **0%** |
| EPIC-4: 行级安全性 | 15 | 0 | 0 | 15 | **0%** |
| EPIC-5: 原生 Realtime | 12 | 0 | 0 | 12 | **0%** |
| EPIC-7: 扩展生态 | 10 | 0 | 0 | 10 | **0%** |
| EPIC-8: 运维部署 | 15 | 5 | 2 | 8 | **40%** |
| **总计** | **119** | **30** | **10** | **79** | **~35%** |

### 按优先级统计

| 优先级 | EPIC | 状态 |
|--------|------|------|
| **P0 (MVP)** | EPIC-1 + EPIC-2 | ✅ 核心功能已完成 |
| **P1 (生产就绪)** | EPIC-3 + EPIC-4 + EPIC-8 | ⬜ 大部分未开始 |
| **P2 (增强)** | EPIC-5 + EPIC-7 | ⬜ 全部未开始 |
| **P3 (未来)** | EPIC-6 | ⬜ 未规划 |

---

## 已实现但未在计划中的功能

以下功能在 `postgresql-adaptation.md` 中有记录，但未在原计划中明确列出：

| 功能 | 说明 |
|------|------|
| **视图依赖处理** | `core/view.go` 实现了拓扑排序删除/重建依赖视图 |
| **系统表查询适配** | `information_schema` 替代 `sqlite_master` |
| **类型感知比较** | `filter.go` 中的 `inferDeterministicType` 跨类型比较 |
| **nocase 排序规则** | 创建 ICU collation 兼容 SQLite 大小写不敏感 |
| **心跳机制** | `_realtimeChannels` 表的 40 秒心跳检测 |

---

## 风险评估更新

### 已解决的高风险项 ✅

| 风险 | 解决方案 |
|------|---------|
| ~~JSON 查询转换~~ | ~~`JSON_QUERY_OR_NULL` + `to_jsonb` 类型转换~~ **需重做 (PG15)** |
| 布尔值/时间戳类型 | 自动转换已实现 |
| 多实例缓存一致性 | LISTEN/NOTIFY 桥接已实现 |

### 仍存在的风险项 ⚠️

| 风险 | 说明 | 建议 |
|------|------|------|
| ~~🚨 **PG15 兼容性**~~ | ~~`JSON_QUERY` 仅 PG17+ 支持~~ | ✅ **已修复**: 替换为 `jsonb_path_query_first` |
| **并发竞争** | 未见悲观锁和死锁重试 | 在关键写操作添加 `SELECT FOR UPDATE` |
| **连接泄漏** | 未实现检测机制 | 添加连接池监控 |
| **备份恢复** | pg_dump 未集成 | 优先实现 STORY-8.2 |
| **RLS 未实现** | 安全仍在应用层 | 评估是否需要 EPIC-4 |

---

## 下一步建议

### 短期 (1-2 周)

1. **完善 EPIC-1 剩余任务**
   - T-1.2.5: GIN 索引自动创建
   - T-1.3.x: 并发模型验证
   - T-1.5.3: 连接泄漏检测

2. **完善 EPIC-2 剩余任务**
   - T-2.4.x: 分布式 Cron 调度 (`pg_try_advisory_lock`)

3. **更新 Task 状态**
   - 将已完成的 Tasks 标记为 ✅

### 中期 (3-4 周)

4. **启动 EPIC-8 运维部署**
   - T-8.2.x: 备份导出集成
   - T-8.3.x: Docker Compose 模板

5. **评估 EPIC-3/4 优先级**
   - 可观测性系统是否必需？
   - RLS 是否必需？(当前应用层安全可能已足够)

### 长期 (2+ 月)

6. **按需启动 EPIC-5/7**
   - WAL 订阅 vs LISTEN/NOTIFY 权衡
   - pgvector 需求评估

---

## 附录: 文件对照表

| 计划中的模块 | 对应实现文件 | 状态 |
|-------------|-------------|------|
| 数据库连接 | `core/db_connect.go`, `core/base.go` | ✅ |
| JSON 操作 | `tools/dbutils/json.go` | ✅ |
| 过滤器表达式 | `tools/search/filter.go` | ✅ |
| 视图管理 | `core/view.go` | ✅ |
| 系统表查询 | `core/db_table.go` | ✅ |
| 兼容函数 | `migrations/postgres_functions.go` | ✅ |
| 实时桥接 | `apis/realtime_bridge.go` | ✅ |
| 字段解析器 | `core/record_field_resolver.go` | ✅ |
| 迁移脚本 | `migrations/1640988000_init.go` | ✅ |
| 测试数据 | `tests/data/*.pg-dump.sql` | ✅ |
| 日志系统 | - | ⬜ |
| 监控系统 | - | ⬜ |
| RLS 编译器 | - | ⬜ |
| WAL 消费者 | - | ⬜ |
| 向量字段 | - | ⬜ |
| 备份导出 | - | ⬜ |
