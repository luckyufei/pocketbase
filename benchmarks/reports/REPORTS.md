# 性能测试报告

本目录包含 PocketBase 性能基准测试的所有测试报告。

## 目录结构

```
reports/
├── comparison/     # PostgreSQL vs SQLite 对比测试报告
├── cluster/        # PostgreSQL 集群测试报告 (主从复制、读写分离)
├── postgresql/     # PostgreSQL 单节点测试报告
├── sqlite/         # SQLite 单独测试报告
└── REPORTS.md      # 本说明文件
```

## 报告命名规范

- `pg-sqlite-comparison-YYYYMMDD-HHMMSS.json` - PostgreSQL vs SQLite 对比测试
- `sqlite-benchmark-YYYYMMDD-HHMMSS.json` - SQLite 基准测试
- `postgresql-benchmark-YYYYMMDD-HHMMSS.json` - PostgreSQL 单节点测试
- `cluster-benchmark-Nnode-YYYYMMDD-HHMMSS.json` - PostgreSQL 集群测试 (N节点)

## 最新测试结果摘要 (2026-01-08)

### 测试环境

| 项目 | 配置 |
|------|------|
| 硬件 | MacBook Pro M1 Pro (32GB RAM) |
| 容器 | Docker/Colima (8 CPU, 24GB RAM) |
| PostgreSQL | 15.15 / 16.11 / 17.7 / 18.1 (Alpine) |
| SQLite | modernc.org/sqlite (纯 Go) |

### PostgreSQL vs SQLite 对比 (并发=20, 持续时间=30s)

| 指标 | SQLite | PostgreSQL 17 | 比值 |
|------|--------|---------------|------|
| 读 QPS | 57,046 | 4,910 | 8.6% |
| 写 TPS | 24,492 | 2,110 | 8.6% |
| 平均延迟 | 0.24 ms | 2.85 ms | 11.7x |
| P95 延迟 | 0.81 ms | 4.89 ms | 6.0x |
| 成功率 | 72.72% | 99.97% | +27% |

### PostgreSQL 版本对比

| 版本 | 总 OPS | P95 延迟 | 相对 PG15 |
|------|--------|----------|-----------|
| PostgreSQL 15.15 | 6,848 | 4.96 ms | 基准 |
| PostgreSQL 16.11 | 6,930 | 5.01 ms | +1.2% |
| PostgreSQL 17.7 | 7,020 | 4.89 ms | +2.5% |
| PostgreSQL 18.1 | 7,031 | 4.52 ms | +2.7% |

### 高并发测试 (PostgreSQL 17)

| 并发 | 总 OPS | P95 延迟 | 成功率 |
|------|--------|----------|--------|
| 20 | 7,020 | 4.89 ms | 99.97% |
| 50 | 7,236 | 11.77 ms | 99.96% |
| 100 | 8,491 | 32.35 ms | 99.94% |
| 200 | 9,105 | 63.43 ms | 99.94% |
| 500 | 3,618 | 148.77 ms | 94.75% |

### PostgreSQL 集群测试 (主从复制 + 读写分离)

#### 集群扩展性对比

| 测试类型 | 节点数 | 总 OPS | 读 QPS | 写 TPS | P95 延迟 | 扩展比 |
|----------|--------|--------|--------|--------|----------|--------|
| 单节点 PG17 | 1 | 7,643 | 5,349 | 2,294 | 4.0 ms | 基准 |
| 2 节点集群 | 2 | 12,631 | 10,101 | 2,529 | 3.5 ms | 1.65x |
| 3 节点集群 | 3 | 14,598 | 11,668 | 2,930 | 4.7 ms | 1.91x |
| HAProxy 负载均衡 | 2 | 2,601 | 2,080 | 521 | 44.6 ms | 0.34x |

#### 读扩展性分析

| 节点数 | 读 QPS | 相对单节点提升 | 理论线性扩展 | 扩展效率 |
|--------|--------|----------------|--------------|----------|
| 1 (单节点) | 5,349 | 基准 | 5,349 | 100% |
| 2 (1主1从) | 10,101 | +89% | 10,698 | 94% |
| 3 (1主2从) | 11,668 | +118% | 16,047 | 73% |

#### 集群测试结论

1. **读扩展性良好**: 2 节点集群读 QPS 提升 89%，接近线性扩展
2. **3 节点效率下降**: 扩展效率从 94% 降至 73%，存在协调开销
3. **HAProxy 开销大**: 代理层引入显著延迟 (P95: 44.6ms vs 直连 3.5ms)
4. **写性能稳定**: 写 TPS 随节点数略有提升 (2,294 → 2,930)
5. **推荐配置**: 生产环境建议 1主2从，读写分离可提升 2 倍读吞吐

### 关键发现

#### 单节点测试

1. **SQLite 本地性能优势**: 在本地单机场景，SQLite 吞吐量约为 PostgreSQL 的 12 倍
2. **PostgreSQL 可靠性更高**: 成功率 99.97% vs SQLite 的 72.72%
3. **版本差异较小**: PostgreSQL 15→18 性能提升约 2.7%
4. **最佳并发数**: 100-200 并发时吞吐量最高，超过 200 后急剧下降
5. **推荐配置**: 生产环境连接池大小建议 100-150

#### 集群测试

6. **读扩展性验证**: 2 节点集群读 QPS 提升 89%，验证了多节点扩展能力
7. **3 节点扩展效率**: 73% 扩展效率，存在协调开销但仍有显著收益
8. **HAProxy 适用场景**: 适合生产环境读写分离，但需接受代理层延迟开销
9. **集群推荐**: 1主2从配置可将读吞吐提升约 2 倍，满足大多数扩展需求

## 运行测试

```bash
cd benchmarks

# 构建测试工具
make build

# ========== 单节点测试 ==========

# PostgreSQL vs SQLite 对比测试
./bin/pg-compare -duration 30s -concurrency 20 -pg-versions 15,16,17,18 \
    -pg-password pocketbase_test_password -verbose

# 单独测试某个 PostgreSQL 版本
make run-pg17

# 完整对比测试
make run-pg-compare-all

# ========== 集群测试 ==========

# 启动集群环境 (需要先启动)
cd docker
docker-compose -f docker-compose-cluster.yml up -d
cd ..

# 2 节点集群测试 (1主1从)
make run-cluster-2node

# 3 节点集群测试 (1主2从)
make run-cluster-3node

# HAProxy 负载均衡测试
make run-cluster-haproxy

# 集群扩展性对比测试
make run-cluster-scalability
```

## 报告格式说明

### JSON 报告字段

```json
{
  "test_time": "测试时间",
  "test_duration": "测试持续时间",
  "concurrency": "并发数",
  "data_scale": "数据规模 (small/medium/large)",
  "sqlite_results": {
    "read_qps": "读操作 QPS",
    "write_tps": "写操作 TPS",
    "total_ops": "总 OPS",
    "avg_latency_ms": "平均延迟 (ms)",
    "p95_latency_ms": "P95 延迟 (ms)",
    "success_rate": "成功率 (%)"
  },
  "postgres_results": {
    "15": { /* PostgreSQL 15 结果 */ },
    "16": { /* PostgreSQL 16 结果 */ },
    "17": { /* PostgreSQL 17 结果 */ },
    "18": { /* PostgreSQL 18 结果 */ }
  },
  "comparison": {
    "15": {
      "read_qps_ratio": "相对 SQLite 的读 QPS 比值",
      "write_tps_ratio": "相对 SQLite 的写 TPS 比值",
      "avg_latency_ratio": "相对 SQLite 的延迟倍数"
    }
  }
}
```
