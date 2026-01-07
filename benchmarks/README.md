# PocketBase 性能基准测试

> 验证 PocketBase 在 SQLite 和 PostgreSQL 环境下的性能表现，包括单节点和集群扩展能力。

## 快速开始

```bash
cd benchmarks

# 构建测试工具
make build

# 查看所有可用命令
make help
```

## 测试类型

### 1. SQLite 基准测试

```bash
# 小规模测试 (1000 用户)
make run-sqlite-small

# 中规模测试 (10000 用户)
make run-sqlite-medium

# 大规模测试 (100000 用户)
make run-sqlite-large
```

### 2. PostgreSQL vs SQLite 对比测试

```bash
# 启动 PostgreSQL 环境
cd docker && docker-compose up -d && cd ..

# 运行对比测试 (所有版本)
make run-pg-compare-all

# 测试单个版本
make run-pg15
make run-pg16
make run-pg17
make run-pg18
```

### 3. PostgreSQL 集群测试

```bash
# 启动集群环境 (1主2从 + HAProxy)
cd docker && docker-compose -f docker-compose-cluster.yml up -d && cd ..

# 等待集群初始化
sleep 30

# 2 节点集群测试
make run-cluster-2node

# 3 节点集群测试
make run-cluster-3node

# HAProxy 负载均衡测试
make run-cluster-haproxy

# 集群扩展性对比测试
make run-cluster-scalability
```

## 测试报告

所有测试报告保存在 `reports/` 目录，按类型分类：

```
reports/
├── REPORTS.md          # 报告汇总和最新结果
├── comparison/         # PostgreSQL vs SQLite 对比报告
├── cluster/            # 集群测试报告
├── postgresql/         # PostgreSQL 单节点报告
└── sqlite/             # SQLite 基准报告
```

**查看最新测试结果**: [reports/REPORTS.md](reports/REPORTS.md)

## 目录结构

```
benchmarks/
├── cmd/                    # 命令行工具
│   ├── benchmark/          # 统一入口
│   ├── pg-compare/         # PostgreSQL vs SQLite 对比
│   └── cluster-benchmark/  # 集群性能测试
├── configs/                # 环境配置文件
├── docker/                 # Docker Compose 配置
│   ├── docker-compose.yml  # 单节点环境
│   └── docker-compose-cluster.yml # 集群环境
├── scripts/                # 初始化脚本
├── monitoring/             # Prometheus/Grafana 配置
├── reports/                # 测试报告 (git 管理)
├── http/                   # HTTP API 负载测试
├── websocket/              # WebSocket 测试
├── database/               # 数据库直连测试
├── Makefile                # 构建和运行脚本
└── *.go                    # 测试核心代码
```

## 环境要求

- Go 1.24+
- Docker 24.0+ (用于 PostgreSQL 测试)
- 推荐: 8+ CPU, 16GB+ RAM

## 配置文件

| 配置文件 | 用途 |
|----------|------|
| `configs/local-sqlite.json` | 本地 SQLite 测试 |
| `configs/local-postgres.json` | 本地 PostgreSQL 测试 |
| `configs/docker-postgres.json` | Docker 环境测试 |
| `configs/production.json` | 生产服务器测试 |

使用配置文件运行:
```bash
./bin/benchmark -config configs/docker-postgres.json
```

## 命令行参数

```bash
./bin/pg-compare -help

# 常用参数
-duration 30s      # 测试持续时间
-concurrency 20    # 并发数
-pg-versions 17    # PostgreSQL 版本 (15,16,17,18)
-skip-sqlite       # 跳过 SQLite 测试
-verbose           # 详细输出
```

## 最新测试结果摘要

### PostgreSQL vs SQLite (并发=20, 持续=30s)

| 指标 | SQLite | PostgreSQL 17 |
|------|--------|---------------|
| 总 OPS | 81,537 | 7,020 |
| P95 延迟 | 0.8 ms | 4.9 ms |
| 成功率 | 72.72% | 99.97% |

### 集群扩展性

| 配置 | 读 QPS | 相对单节点 |
|------|--------|------------|
| 单节点 | 5,349 | 基准 |
| 2 节点 (1主1从) | 10,101 | +89% |
| 3 节点 (1主2从) | 11,668 | +118% |

详细结果见 [reports/REPORTS.md](reports/REPORTS.md)
