# PocketBase 性能测试方案

> **目标**: 确保 PocketBase 在 SQLite 和 PostgreSQL 环境下保持卓越性能，验证多节点扩展能力

## 测试范围概览

### 数据库类型覆盖
- **SQLite**: 单文件数据库（PocketBase 经典模式）
- **PostgreSQL**: 单节点部署
- **PostgreSQL**: 多节点集群（主从复制 + 读写分离）

### 性能维度
- **吞吐量**: QPS/TPS 指标
- **延迟**: P50/P95/P99 响应时间
- **并发**: 高并发场景下的稳定性
- **资源消耗**: CPU/内存/磁盘/网络使用率
- **扩展性**: 水平扩展能力验证

## 文档结构

```
specs/004-performance-testing/
├── README.md                    # 本文档
├── test-scenarios.md           # 测试场景设计
├── benchmarks/                 # 基准测试定义
│   ├── sqlite-benchmarks.md
│   ├── postgresql-single.md
│   └── postgresql-cluster.md
├── tools/                      # 测试工具和脚本
│   ├── load-generators/
│   ├── monitoring/
│   └── analysis/
├── environments/               # 测试环境配置
│   ├── docker-compose/
│   ├── kubernetes/
│   └── bare-metal/
└── reports/                    # 测试报告模板
    ├── performance-baseline.md
    └── regression-analysis.md
```

## 核心测试原则

### 1. 真实场景驱动
- 基于实际业务场景设计测试用例
- 模拟真实的数据分布和访问模式
- 考虑不同规模的应用场景

### 2. 多维度评估
- **功能性能**: CRUD 操作、实时订阅、文件上传
- **系统性能**: 启动时间、内存占用、并发处理
- **网络性能**: API 响应、WebSocket 连接、文件传输

### 3. 渐进式压测
- 从轻负载到极限负载的渐进式测试
- 识别性能拐点和瓶颈
- 验证优雅降级机制

### 4. 对比基准
- SQLite vs PostgreSQL 性能对比
- 单节点 vs 多节点扩展效果
- 版本间性能回归检测

## 测试环境规格

### 硬件基准
```yaml
# 标准测试环境
CPU: 8 cores (Intel/AMD x86_64 或 ARM64)
Memory: 16GB RAM
Storage: NVMe SSD (1000+ IOPS)
Network: 1Gbps

# 高负载测试环境  
CPU: 16+ cores
Memory: 32GB+ RAM
Storage: 高性能 NVMe SSD (10000+ IOPS)
Network: 10Gbps
```

### 软件环境
```yaml
OS: Ubuntu 22.04 LTS / macOS / Windows
Go: 1.24+
Docker: 24.0+
PostgreSQL: 15, 16, 17, 18
SQLite: 3.45+
```

## 关键性能指标 (KPI)

### 响应时间目标
- **API 请求**: P95 < 100ms, P99 < 500ms
- **数据库查询**: P95 < 50ms, P99 < 200ms
- **文件上传**: 10MB 文件 < 5s
- **实时订阅**: 消息延迟 < 100ms

### 吞吐量目标
- **SQLite**: 1000+ QPS (读), 500+ QPS (写)
- **PostgreSQL 单节点**: 2000+ QPS (读), 1000+ QPS (写)  
- **PostgreSQL 集群**: 5000+ QPS (读), 1000+ QPS (写)

### 资源消耗目标
- **内存使用**: < 512MB (空载), < 2GB (高负载)
- **CPU 使用**: < 20% (正常负载), < 80% (高负载)
- **启动时间**: < 5s (SQLite), < 10s (PostgreSQL)

### 并发处理目标
- **同时连接**: 1000+ WebSocket 连接
- **并发用户**: 500+ 同时活跃用户
- **文件并发**: 100+ 并发文件上传

## 测试工具栈

### 负载生成
- **HTTP 压测**: wrk, hey, Apache Bench
- **WebSocket 压测**: 自定义 Go 工具
- **数据库压测**: pgbench, sysbench
- **综合压测**: K6, JMeter

### 监控采集
- **系统监控**: Prometheus + Grafana
- **应用监控**: PocketBase 内置指标
- **数据库监控**: pg_stat_statements, SQLite EXPLAIN
- **网络监控**: iftop, nethogs

### 分析工具
- **性能分析**: Go pprof, perf, flamegraph
- **数据分析**: Python pandas, R
- **报告生成**: 自动化 Markdown 报告

## 测试执行策略

### 阶段 1: 基准建立 (Baseline)
1. 单机 SQLite 性能基准
2. 单机 PostgreSQL 性能基准
3. 基础功能性能验证
4. 资源消耗基准测量

### 阶段 2: 压力测试 (Stress Testing)
1. 渐进式负载增加
2. 极限并发测试
3. 长时间稳定性测试
4. 内存泄漏检测

### 阶段 3: 扩展测试 (Scalability Testing)
1. PostgreSQL 主从复制性能
2. 读写分离效果验证
3. 多节点负载均衡
4. 水平扩展线性度

### 阶段 4: 回归测试 (Regression Testing)
1. 版本间性能对比
2. 功能更新影响评估
3. 配置优化效果验证
4. 持续集成性能门禁

## 风险控制

### 测试环境隔离
- 独立的测试环境，避免影响生产
- 容器化部署，确保环境一致性
- 自动化环境重置和清理

### 数据安全
- 使用模拟数据，不涉及真实业务数据
- 测试完成后自动清理测试数据
- 敏感信息脱敏处理

### 资源保护
- 设置资源使用上限，防止系统过载
- 实施熔断机制，避免级联故障
- 监控测试过程，及时干预异常

## 交付成果

### 测试报告
- **性能基准报告**: 各场景下的性能基准数据
- **对比分析报告**: SQLite vs PostgreSQL 详细对比
- **扩展性报告**: 多节点扩展效果分析
- **优化建议报告**: 性能调优和配置建议

### 工具和脚本
- **自动化测试套件**: 一键执行完整性能测试
- **监控仪表板**: 实时性能监控面板
- **分析工具**: 性能数据分析和可视化工具
- **部署模板**: 各种环境的部署配置

### 持续集成
- **性能门禁**: CI/CD 中的性能回归检测
- **基准更新**: 定期更新性能基准数据
- **告警机制**: 性能异常自动告警
- **趋势分析**: 长期性能趋势跟踪

---

**下一步**: 详细设计具体的测试场景和基准测试用例

> 📋 **相关文档**:
> - [测试场景设计](./test-scenarios.md)
> - [SQLite 基准测试](./benchmarks/sqlite-benchmarks.md)  
> - [PostgreSQL 基准测试](./benchmarks/postgresql-single.md)
> - [集群扩展测试](./benchmarks/postgresql-cluster.md)