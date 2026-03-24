# PocketLess 单测对齐计划 - 执行总结

**创建日期**: 2026-03-24  
**规范编号**: 034  
**状态**: ✅ 规范完成，待执行

---

## 🎯 核心目标

确保 **PocketLess (Bun.js 版)** 与 **PocketBase (Go 版)** 的单元测试完全对齐，使两个版本在 API 协议和业务逻辑上 100% 可验证一致。

---

## 📊 现状分析

### 测试覆盖率对比

```
PocketBase (Go)
├─ 源文件: 434 个
├─ 测试文件: 331 个
└─ 覆盖率: 76%

PocketLess (Bun)
├─ 源文件: 135 个 (31% of Go)
├─ 测试文件: 128 个 (39% of Go)
└─ 覆盖率: 95%+ (但绝对数量少)

缺失测试: ~127 个文件
├─ APIs: 缺 21 个
├─ Core: 缺 46 个
└─ Tools: 缺 60 个
```

### 主要缺失模块

| 模块 | 缺失测试 | 优先级 |
|------|---------|--------|
| Record Authentication (5 种方式) | 12 个 | P1 |
| Record CRUD (扩展) | 5 个 | P1 |
| Collection Management | 2 个 | P1 |
| Middlewares | 3 个 | P1 |
| Database Adapters | 15 个 | P1 |
| Field Types & Validation | 15 个 | P1 |
| Record Models & Expand | 8 个 | P1 |
| Security & Auth Providers | 35+ 个 | P2 |
| 其他 Tools | 25+ 个 | P2 |

---

## 📋 规范内容概览

### 1. 总体规划 (plan.md)

**5 个阶段的分层实施策略**:

```
Phase 1 (7-13h)    ← 认证系统 (P1 关键)
  ↓
Phase 2 (8-12h)    ← CRUD 系统 (P1 关键)
  ↓
Phase 3 (14-22h)   ← 数据库系统 (P1 关键)
  ↓
Phase 4 (8-12h)    ← 高级功能 (P2 可选)
  ↓
Phase 5 (32-48h)   ← 工具库 (P2 可选)
───────────────────────────
总计: 69-107 小时
```

### 2. Phase 1 详细分析 (phase1-analysis.md)

**6 个子模块的细致分解**:

| # | 模块 | 现状 | 工作量 |
|----|------|------|--------|
| 1.1 | Record Auth Methods | ❌ 缺失 | 1h |
| 1.2 | Record Auth Password | ✅ 部分 | 2-3h |
| 1.3 | Record Auth OAuth2 | ✅ 部分 | 2-3h |
| 1.4 | Record Auth OTP | ✅ 部分 | 1-2h |
| 1.5 | Record Auth Verification | ✅ 部分 | 1-2h |
| 1.6 | Record Auth Impersonation | ✅ 部分 | 1h |

**每个模块都包含**:
- Go 版本源码位置
- 关键测试场景列表
- Bun 版本现状评估
- 详细的实现计划
- 预计代码行数

### 3. 执行方法论 (methodology.md)

**5 步对齐工作流**:

```
Step 1: 分析 Go 版本测试 (15-20 min)
  ↓ 输出: 关键测试场景清单
Step 2: 对比 PocketLess 现状 (10-15 min)
  ↓ 输出: 对齐差异报告
Step 3: 设计 Bun 测试实现 (20-30 min)
  ↓ 输出: 实现草案
Step 4: 实现与验证 (1-3 h)
  ↓ 输出: 可运行的测试
Step 5: 文档与规范更新 (5-10 min)
  ↓ 输出: 更新的规范
```

**关键检查点**:
- HTTP 层一致性（状态码、头部）
- 数据格式一致性（JWT、时间戳）
- 错误处理一致性（格式、消息）
- 业务逻辑一致性（字段验证、状态机）
- 边界情况一致性（SQL 注入、并发、超限）

### 4. 实时进度跟踪 (progress.md)

**逐项任务列表**，包含：
- 当前进度（0%）
- 每个 Phase 的任务清单
- 每个子模块的进度指标
- 发现的问题和差异
- 待启动的工作

### 5. 快速参考 (README.md)

- 规范概述（为什么需要）
- 快速开始指南
- 工作量估算
- 常见问题解答
- 立即行动步骤

---

## 🚀 立即行动计划

### 第一步（今天，15 分钟）

```bash
# 1. 了解规范
cat /Users/yufei/workspace/pocketbase-main/specs/034-pocketless-test-alignment/README.md

# 2. 查看规划
cat /Users/yufei/workspace/pocketbase-main/specs/034-pocketless-test-alignment/plan.md | head -100

# 3. 查看现状
cd /Users/yufei/workspace/pocketbase-main/pocketless
bun test 2>&1 | tail -20  # 查看测试数量
```

### 第二步（本周，3-5 小时）

**启动 Phase 1, Task 1.1: Record Auth Methods**

```bash
# 1. 深入分析
cat ../specs/034-pocketless-test-alignment/phase1-analysis.md | grep -A 50 "1.1 Record Auth Methods"

# 2. 对比 Go 版本
grep -r "func.*TestRecordAuthMethods" /Users/yufei/workspace/pocketbase-main/apis/

# 3. 创建测试文件
touch src/apis/record_auth_methods.ts
touch src/apis/record_auth_methods.test.ts

# 4. 实现端点和测试
# 参考: phase1-analysis.md 的详细说明

# 5. 验证
bun test src/apis/record_auth_methods.test.ts
```

### 第三步（本月，10-15 小时）

- [ ] 完成 Phase 1 的所有 6 个子模块
- [ ] 所有 Phase 1 测试都通过
- [ ] 更新 progress.md 标记 Phase 1 完成

### 第四步（持续）

- [ ] 按照 plan.md 启动 Phase 2-3（优先级 P1）
- [ ] 定期更新 progress.md
- [ ] 记录发现的问题和差异

---

## 💡 关键决策

### 为什么用这 5 个阶段？

```
优先级排序:
P1 (必须对齐): APIs + Core = 80% 的用户功能
  ↓ Phase 1-3
P2 (应该对齐): Tools = 20% 的专门功能
  ↓ Phase 4-5
```

### 为什么这样估算工作量？

```
每个测试文件:
  - 分析 Go 版本: 15-20 min
  - 对比现状: 10-15 min
  - 设计实现: 20-30 min
  - 编写测试: 45-90 min (取决于复杂度)
  - 验证对齐: 10-20 min
  - 文档更新: 5-10 min
  ─────────────────
  总计: 1.5-3 小时 / 文件

127 个缺失文件 × 0.5-1 小时 (平均) = 63-127 小时
```

### 为什么从 Phase 1 开始？

```
认证系统的重要性:
1. 每个 API 都依赖认证 (关键路径)
2. 错误最容易被用户发现
3. 作为模板证明方法论可行
4. 建立对齐的信心
```

---

## 📈 预期收益

### 短期（1 个月）

- ✅ Phase 1-2 完成，关键认证 API 100% 对齐
- ✅ 发现并修复 10-20 个协议差异
- ✅ 验证方法论可行性

### 中期（3 个月）

- ✅ Phase 1-3 完成，所有 P1 API 100% 对齐
- ✅ 新功能可以同步在两个版本实现
- ✅ 用户可以安全切换版本

### 长期（6 个月+）

- ✅ 所有测试对齐完成 (或 80% 覆盖)
- ✅ PocketLess 可作为 Go 版本的完全替代
- ✅ 两个版本共享测试套件的一部分

---

## 📚 完整文档列表

```
/specs/034-pocketless-test-alignment/
├─ README.md                              ← 快速开始
├─ plan.md                                ← 5 阶段总规划
├─ phase1-analysis.md                     ← Phase 1 详解
├─ methodology.md                         ← 执行方法论
├─ progress.md                            ← 进度跟踪 (定期更新)
├─ index.md                               ← 文档导航
├─ SUMMARY.md                             ← 本文件
├─ checklists/
│  └─ phase1-checklist.md                 ← Phase 1 检查清单
└─ contracts/
   ├─ api-contract.md                     ← HTTP API 规范
   └─ data-model-contract.md              ← 数据模型规范
```

---

## ✅ 验收标准

### Phase 1 完成标准

- [ ] 7 个任务全部完成
- [ ] 所有 13 个新增测试通过
- [ ] HTTP 状态码 100% 对齐
- [ ] JWT Claims 结构一致
- [ ] 邮件发送 mock 正确
- [ ] 错误消息格式一致
- [ ] progress.md 中标记已完成

### 整体完成标准

- [ ] Phase 1-3 完成 (P1 优先级)
- [ ] 127 个缺失测试 ≥ 100 个已补充
- [ ] 测试覆盖率 ≥ 75%
- [ ] 发现的差异 ≤ 5 个
- [ ] 所有文档已更新

---

## 🎓 学习资源

### 相关技术

- **Bun 测试 API**: https://bun.sh/docs/test/writing
- **Go testing 包**: https://golang.org/pkg/testing/
- **PocketBase 源码**: `/apis`, `/core`, `/tools`

### PocketLess 相关文档

- `specs/032-pocketless/spec.md` - PocketLess 功能规范
- `specs/032-pocketless/quickstart.md` - 快速开始
- `pocketless/package.json` - 依赖和脚本

---

## 📞 支持

### 问题或建议？

1. **查看规范**: 先在相关规范文档中查找
2. **查看方法论**: 在 methodology.md 中查找常见问题
3. **查看进度**: 在 progress.md 中查找已知问题
4. **记录新问题**: 在 progress.md 中添加到"已知问题"

### 规范更新？

- 发现错误或不清楚的地方
- 有更好的执行方案
- 新发现的对齐差异

都可以直接更新文档或提出 Issue。

---

## 📝 版本信息

| 项 | 内容 |
|----|------|
| 规范编号 | 034 |
| 规范名称 | PocketLess 单测对齐计划 |
| 版本 | 1.0 |
| 创建日期 | 2026-03-24 |
| 文档数 | 9 个 |
| 总工作量 | 69-107 小时 |
| 优先级 | P1 (Phase 1-3) + P2 (Phase 4-5) |
| 状态 | ✅ 规范完成，待执行 |

---

## 🚀 现在就开始

**第一步**: 打开规范
```bash
cd /Users/yufei/workspace/pocketbase-main/specs/034-pocketless-test-alignment/
cat README.md
```

**第二步**: 了解规划
```bash
cat plan.md | head -150
```

**第三步**: 启动 Phase 1
```bash
cat phase1-analysis.md | grep -A 30 "1.1 Record Auth Methods"
```

---

**规范链接**: 📖 [README.md](./README.md) | 📋 [plan.md](./plan.md) | 📊 [progress.md](./progress.md)

**下一个里程碑**: Phase 1 启动（目标本周完成前 1-2 个任务）

---

**创建日期**: 2026-03-24  
**状态**: ✅ 规范完成  
**下一步**: 执行 Phase 1, Task 1.1
