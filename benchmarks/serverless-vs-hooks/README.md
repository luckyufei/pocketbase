# Serverless vs Hooks 性能对比测试

对比 PocketBase 两种 JavaScript 扩展机制的性能和稳定性：
- **jsvm (Goja)**: 原有的 hooks 系统
- **serverless (QuickJS WASM)**: 新的 serverless 系统

## 快速开始

```bash
# 1. 设置测试环境
make setup

# 2. 启动 PocketBase
cd ../../examples/base && ./pocketbase serve

# 3. 在 Admin UI 创建测试 collections

# 4. 运行测试
make run
```

## 测试场景

| 场景 | 描述 | 目的 |
|------|------|------|
| S1: HTTP Handler | 简单 JSON 响应 | 测试基础性能 |
| S2: DB Hook | 记录创建前校验 | 测试 Hook 性能 |
| S3: 计算密集型 | 斐波那契计算 | 测试 CPU 密集场景 |
| S4: I/O 密集型 | 数据库批量查询 | 测试 I/O 场景 |
| S5: 内存压力 | 大对象分配 | 测试内存限制 |
| S6: 稳定性 | 长时间运行 | 测试内存泄漏 |
| S7: 错误恢复 | 各类 JS 错误 | 测试错误隔离 |

## 目录结构

```
serverless-vs-hooks/
├── cmd/benchmark/main.go    # 命令行入口
├── config.go                # 配置定义
├── runner.go                # 测试运行器
├── result.go                # 结果数据结构
├── reporter.go              # 报告生成器
├── fixtures/                # 测试代码
│   ├── jsvm/               # jsvm hooks
│   └── serverless/         # serverless functions
├── Makefile                 # 构建脚本
└── README.md               # 本文件
```

## 命令行参数

```bash
./bin/benchmark [options]

Options:
  -url <url>          PocketBase 服务地址 (默认: http://127.0.0.1:8090)
  -scenario <name>    指定测试场景 (逗号分隔)
  -concurrency <n>    并发数
  -duration <d>       测试持续时间 (如 30s, 1m)
  -verbose            详细输出
  -output <dir>       报告输出目录
  -config <file>      配置文件路径
```

## 测试报告

测试完成后，报告生成在 `reports/serverless-vs-hooks/` 目录：
- `YYYY-MM-DD-HHMMSS-full.json`: 完整 JSON 数据
- `YYYY-MM-DD-HHMMSS-summary.md`: Markdown 汇总

## 预期结果

| 维度 | jsvm | serverless | 说明 |
|------|------|------------|------|
| 冷启动 | 快 | 较慢 | WASM 初始化开销 |
| 热执行 | 快 | 略慢 | Host Function 调用开销 |
| 内存隔离 | 无 | 有 | WASM 沙箱 |
| 超时控制 | 无 | 有 | 可配置 |
| 错误隔离 | 部分 | 完全 | 不影响主进程 |
| ES 版本 | ES5+ | ES2022+ | 完整 async/await |

## 相关文档

- [规范文档](../../specs/011-serverless-vs-hooks-benchmark/spec.md)
- [Serverless 引擎规范](../../specs/010-serverless-engine/spec.md)
