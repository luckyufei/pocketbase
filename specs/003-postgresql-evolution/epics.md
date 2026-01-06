# PocketBase PostgreSQL 演进 - EPIC 列表

> 按照敏捷开发 EPIC-STORY-TASK 规范组织

---

## EPIC-1: 数据层解耦 (The Great Decoupling)

**目标**: 完成 `dbx` 的 PostgreSQL 适配，通过 100% 单元测试

**业务价值**: 验证 PocketBase 在 PostgreSQL 上的核心能力完整性

**验收标准**:
- [ ] 4701 个单元测试在 PostgreSQL 下全部通过
- [ ] 布尔值、时间戳、JSON 类型自动转换正常
- [ ] 并发压力测试无数据不一致

**优先级**: P0 (必须)

**预估周期**: 4 周

---

## EPIC-2: 分布式事件网格 (The Event Grid)

**目标**: 基于 `LISTEN/NOTIFY` 构建分布式 Hooks 和缓存失效机制

**业务价值**: 支持多实例水平扩展，解决 Hook 触发不确定性

**验收标准**:
- [ ] 多实例部署时缓存自动失效
- [ ] 事务后 Hooks 支持竞争消费和广播两种模式
- [ ] 分布式 Cron 通过 Advisory Lock 实现排他执行

**优先级**: P0 (必须)

**预估周期**: 2 周

---

## EPIC-3: 可观测性系统 (Observability)

**目标**: 实现高性能日志和监控系统，对核心业务影响 < 3%

**业务价值**: 生产环境可观测性，问题快速定位

**验收标准**:
- [ ] 日志系统支持 5000+ QPS 写入
- [ ] 监控系统支持内存、连接池、Goroutine 等指标
- [ ] 熔断机制：系统压力大时自动丢弃日志

**优先级**: P1 (重要)

**预估周期**: 2 周

---

## EPIC-4: 行级安全性 (RLS Integration)

**目标**: 将 PocketBase API Rules 编译为 PostgreSQL RLS Policies

**业务价值**: 安全下沉到数据库内核，性能提升 + 无死角保护

**验收标准**:
- [ ] `set_config` 会话变量注入用户上下文
- [ ] 规则编译器支持基础语法转换
- [ ] 跨集合连接规则转换为 EXISTS 子查询

**优先级**: P1 (重要)

**预估周期**: 3 周

---

## EPIC-5: 原生 Realtime 引擎 (WAL Subscription)

**目标**: 通过 WAL 订阅实现真正的 Realtime 推送

**业务价值**: 捕获所有数据库变更，包括直接 SQL 修改

**验收标准**:
- [ ] 使用 `pglogrepl` 实现 WAL 消费
- [ ] 事件解析并注入 PocketBase Realtime 管理器
- [ ] 权限过滤：按 ViewRule 过滤推送内容

**优先级**: P2 (增强)

**预估周期**: 4 周

---

## EPIC-6: WASM 计算运行时 (The WASM Leap)

**目标**: 用 `wazero` + QuickJS 替代 Goja，支持现代 JS 生态

**业务价值**: 支持 ES2023、async/await、NPM 包

**验收标准**:
- [ ] WASM 沙箱环境运行 QuickJS
- [ ] Host Functions 暴露 DB 查询和 HTTP Fetch
- [ ] 性能对比 Goja 提升 2x+

**优先级**: P3 (未来)

**预估周期**: 6 周

---

## EPIC-7: PostgreSQL 扩展生态 (Extensions)

**目标**: 集成 pgvector、pg_trgm 等扩展

**业务价值**: AI 向量搜索、全文检索性能优化

**验收标准**:
- [ ] 新增 `vector` 字段类型
- [ ] API 支持向量距离查询
- [ ] 全文搜索使用 pg_trgm 加速

**优先级**: P2 (增强)

**预估周期**: 3 周

---

## EPIC-8: 运维与部署 (DevOps)

**目标**: 完善备份、启动引导、容器化部署

**业务价值**: 生产可用的完整交付物

**验收标准**:
- [ ] pg_dump 集成备份导出
- [ ] 空库自动 Bootstrap
- [ ] Docker Compose 编排模板

**优先级**: P1 (重要)

**预估周期**: 2 周

---

## 优先级总览

```
P0 (必须 - MVP):
├── EPIC-1: 数据层解耦
└── EPIC-2: 分布式事件网格

P1 (重要 - v2.1):
├── EPIC-3: 可观测性系统
├── EPIC-4: 行级安全性
└── EPIC-8: 运维与部署

P2 (增强 - v2.2):
├── EPIC-5: 原生 Realtime 引擎
└── EPIC-7: PostgreSQL 扩展生态

P3 (未来 - v3.0):
└── EPIC-6: WASM 计算运行时
```

---

## 依赖关系

```
EPIC-1 ──┬──> EPIC-2 ──> EPIC-5
         │
         ├──> EPIC-3
         │
         ├──> EPIC-4
         │
         ├──> EPIC-7
         │
         └──> EPIC-8

EPIC-6 (独立，可并行)
```
