# Serverless vs Hooks 性能与稳定性对比测试方案

**Feature Branch**: `011-serverless-benchmark`
**Created**: 2026-01-09
**Status**: Planning

## 1. 核心问题 (Problem Essence)

PocketBase 现有两种 JavaScript 扩展机制：
- **jsvm (Goja)**: 原有的 hooks 系统，基于 Goja 引擎（Go 原生 ES5+ 实现）
- **serverless (QuickJS WASM)**: 新的 serverless 系统，基于 QuickJS 编译为 WASM

需要通过系统性的性能和稳定性测试，量化两者的差异，为用户选择提供数据支撑。

## 2. 测试目标

### 2.1 性能指标
| 指标 | 描述 | 目标 |
|------|------|------|
| **冷启动延迟** | 首次执行 JS 代码的时间 | serverless < 50ms |
| **热执行延迟** | 预热后单次执行时间 | serverless ≤ 2x jsvm |
| **吞吐量 (QPS)** | 每秒处理请求数 | serverless ≥ 50% jsvm |
| **P99 延迟** | 99% 请求的最大延迟 | serverless < 100ms |
| **内存占用** | 运行时内存消耗 | serverless 可控（配置化） |

### 2.2 稳定性指标
| 指标 | 描述 | 目标 |
|------|------|------|
| **长时间运行** | 24h 持续运行无内存泄漏 | 内存增长 < 10% |
| **高并发** | 1000 并发连接 | 成功率 > 99.9% |
| **错误恢复** | JS 异常不影响主进程 | 100% 隔离 |
| **超时控制** | 死循环/长任务可中断 | 100% 可中断 |
| **资源限制** | 内存超限自动终止 | 100% 生效 |

## 3. 测试场景设计

### 3.1 场景分类

```
┌─────────────────────────────────────────────────────────────────┐
│                        测试场景矩阵                              │
├─────────────────┬───────────────────┬───────────────────────────┤
│     维度        │      jsvm         │       serverless          │
├─────────────────┼───────────────────┼───────────────────────────┤
│ HTTP Handler    │ routerAdd()       │ routes/*.ts               │
│ DB Hook         │ onRecordCreate()  │ pb.onRecordBeforeCreate() │
│ Cron Job        │ cronAdd()         │ workers/*.ts              │
│ 计算密集型      │ 斐波那契/JSON解析  │ 斐波那契/JSON解析          │
│ I/O 密集型      │ DB 查询/HTTP 请求  │ DB 查询/HTTP 请求          │
│ 异步操作        │ 不支持 async       │ 完整 async/await          │
└─────────────────┴───────────────────┴───────────────────────────┘
```

### 3.2 具体测试用例

#### S1: HTTP Handler 性能测试
```
场景: 简单 JSON 响应
请求: GET /api/benchmark/hello
响应: { "message": "Hello", "timestamp": 1234567890 }

测试参数:
- 并发数: 10, 50, 100, 200, 500
- 持续时间: 30s
- 预热: 100 请求
```

#### S2: DB Hook 性能测试
```
场景: 记录创建前校验
触发: POST /api/collections/benchmark_items/records
逻辑: 读取关联记录，设置计算字段

测试参数:
- 并发数: 10, 50, 100
- 持续时间: 60s
- 数据量: 1000 条预置记录
```

#### S3: 计算密集型测试
```
场景: 斐波那契数列计算
请求: GET /api/benchmark/fib?n=30
逻辑: 递归计算 fib(n)

测试参数:
- n 值: 20, 25, 30, 35
- 并发数: 10
- 重复次数: 100
```

#### S4: I/O 密集型测试
```
场景: 数据库批量查询
请求: GET /api/benchmark/query?count=10
逻辑: 执行 count 次 DB 查询

测试参数:
- count: 1, 5, 10, 20
- 并发数: 50
- 持续时间: 30s
```

#### S5: 内存压力测试
```
场景: 大对象分配
请求: GET /api/benchmark/memory?size=10
逻辑: 分配 size MB 的数组

测试参数:
- size: 1, 5, 10, 50, 100 MB
- 并发数: 10
- 验证: serverless 应在超限时终止
```

#### S6: 长时间稳定性测试
```
场景: 混合负载持续运行
请求: 随机混合 S1-S4 场景
持续时间: 1h / 4h / 24h

监控指标:
- 内存使用趋势
- 错误率趋势
- 延迟分布变化
```

#### S7: 错误恢复测试
```
场景: JS 异常处理
测试用例:
- 语法错误
- 运行时异常 (undefined.property)
- 死循环 (while(true))
- 栈溢出 (无限递归)
- 内存溢出 (分配超大数组)

验证:
- 主进程不受影响
- 错误正确返回客户端
- 资源正确释放
```

## 4. 测试环境

### 4.1 硬件配置
```yaml
测试机器:
  CPU: 8 核
  内存: 16 GB
  存储: SSD
  网络: 本地回环

容器限制 (可选):
  CPU: 2 核
  内存: 2 GB
```

### 4.2 软件配置
```yaml
PocketBase:
  版本: 当前开发版
  数据库: SQLite (默认)
  
jsvm 配置:
  HooksPoolSize: 4
  
serverless 配置:
  PoolSize: 4
  MaxMemoryMB: 128
  TimeoutSeconds: 30
```

## 5. 测试代码结构

```
benchmarks/
├── serverless-vs-hooks/
│   ├── README.md                 # 使用说明
│   ├── config.go                 # 配置定义
│   ├── runner.go                 # 测试运行器
│   ├── reporter.go               # 结果报告生成
│   │
│   ├── scenarios/                # 测试场景
│   │   ├── http_handler.go       # S1: HTTP Handler
│   │   ├── db_hook.go            # S2: DB Hook
│   │   ├── compute.go            # S3: 计算密集型
│   │   ├── io_intensive.go       # S4: I/O 密集型
│   │   ├── memory_pressure.go    # S5: 内存压力
│   │   ├── stability.go          # S6: 稳定性
│   │   └── error_recovery.go     # S7: 错误恢复
│   │
│   ├── fixtures/                 # 测试数据
│   │   ├── jsvm/                 # jsvm hooks 代码
│   │   │   └── benchmark.pb.js
│   │   └── serverless/           # serverless 代码
│   │       ├── routes/
│   │       │   └── benchmark.ts
│   │       └── hooks/
│   │           └── benchmark.ts
│   │
│   ├── cmd/                      # 命令行入口
│   │   └── benchmark/
│   │       └── main.go
│   │
│   └── Makefile                  # 构建和运行
│
└── reports/                      # 测试报告
    └── serverless-vs-hooks/
        ├── 2026-01-09-full.json
        └── 2026-01-09-summary.md
```

## 6. 测试执行流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        测试执行流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 环境准备                                                     │
│     ├── 启动 PocketBase (jsvm 模式)                              │
│     ├── 加载 jsvm hooks                                          │
│     └── 预热运行时                                               │
│                                                                 │
│  2. jsvm 测试                                                    │
│     ├── 执行 S1-S7 场景                                          │
│     └── 记录结果                                                 │
│                                                                 │
│  3. 重启 PocketBase (serverless 模式)                            │
│     ├── 加载 serverless functions                                │
│     └── 预热运行时                                               │
│                                                                 │
│  4. serverless 测试                                              │
│     ├── 执行 S1-S7 场景                                          │
│     └── 记录结果                                                 │
│                                                                 │
│  5. 生成对比报告                                                  │
│     ├── JSON 原始数据                                            │
│     ├── Markdown 汇总                                            │
│     └── 可视化图表 (可选)                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 7. 结果报告格式

### 7.1 JSON 格式
```json
{
  "meta": {
    "timestamp": "2026-01-09T12:00:00Z",
    "duration": "2h30m",
    "environment": {
      "cpu": "Apple M2 8-core",
      "memory": "16GB",
      "os": "macOS 14.0"
    }
  },
  "scenarios": {
    "S1_http_handler": {
      "jsvm": {
        "qps": 5000,
        "p50_ms": 2.1,
        "p95_ms": 5.3,
        "p99_ms": 12.5,
        "error_rate": 0.0
      },
      "serverless": {
        "qps": 3200,
        "p50_ms": 3.5,
        "p95_ms": 8.2,
        "p99_ms": 18.7,
        "error_rate": 0.0
      },
      "comparison": {
        "qps_ratio": 0.64,
        "p99_ratio": 1.50
      }
    }
  },
  "summary": {
    "winner_performance": "jsvm",
    "winner_stability": "serverless",
    "recommendation": "..."
  }
}
```

### 7.2 Markdown 汇总
```markdown
# Serverless vs Hooks 性能对比报告

## 执行环境
- CPU: Apple M2 8-core
- 内存: 16GB
- 测试时间: 2026-01-09

## 性能对比

| 场景 | jsvm QPS | serverless QPS | 比率 | 胜出 |
|------|----------|----------------|------|------|
| HTTP Handler | 5000 | 3200 | 64% | jsvm |
| DB Hook | 2000 | 1800 | 90% | jsvm |
| 计算密集 | 100 | 120 | 120% | serverless |
| I/O 密集 | 1500 | 1400 | 93% | jsvm |

## 稳定性对比

| 指标 | jsvm | serverless | 胜出 |
|------|------|------------|------|
| 24h 内存增长 | 15% | 3% | serverless |
| 错误隔离 | 部分 | 完全 | serverless |
| 超时控制 | 无 | 有 | serverless |

## 结论

...
```

## 8. 成功标准

### 8.1 测试完成标准
- [ ] 所有 7 个场景测试通过
- [ ] 生成完整的 JSON 报告
- [ ] 生成可读的 Markdown 汇总
- [ ] 测试可重复执行

### 8.2 性能验收标准
- [ ] serverless QPS ≥ jsvm 的 50%
- [ ] serverless P99 延迟 ≤ jsvm 的 3x
- [ ] serverless 冷启动 < 100ms

### 8.3 稳定性验收标准
- [ ] serverless 24h 运行内存增长 < 10%
- [ ] serverless 错误 100% 隔离
- [ ] serverless 超时 100% 可控

## 9. 依赖模块

| 模块 | 用途 | 状态 |
|------|------|------|
| `plugins/jsvm` | jsvm hooks 实现 | 已有 |
| `plugins/serverless` | serverless 实现 | 已有 |
| `benchmarks/` | 性能测试框架 | 已有 |
| `vegeta` (可选) | HTTP 负载测试工具 | 外部依赖 |

## 10. 时间估算

| 阶段 | 工作内容 | 预估时间 |
|------|---------|---------|
| Phase 1 | 测试框架搭建 | 2h |
| Phase 2 | S1-S4 性能场景 | 4h |
| Phase 3 | S5-S7 稳定性场景 | 4h |
| Phase 4 | 报告生成器 | 2h |
| Phase 5 | 文档和优化 | 2h |
| **总计** | | **14h** |
