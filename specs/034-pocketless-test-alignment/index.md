# PocketLess 单测对齐规范 - 完整目录

**规范编号**: 034  
**版本**: 1.0  
**最后更新**: 2026-03-24

---

## 📚 文档导航

### 核心文档（必读）

1. **[README.md](./README.md)** - 规范概览
   - 快速理解目标和工作量
   - 5 步执行流程
   - 常见问题解答
   - **阅读时间**: 15 分钟

2. **[plan.md](./plan.md)** - 总体规划
   - 5 个阶段的详细划分
   - 每个阶段的关键测试场景
   - 工作量估算和时间表
   - **阅读时间**: 20 分钟

### 深度文档

3. **[phase1-analysis.md](./phase1-analysis.md)** - Phase 1 详细分析
   - 认证系统的 5 个子模块分析
   - 每个模块的关键测试场景
   - Go 版本代码片段参考
   - Bun 版本实现计划
   - **阅读时间**: 30 分钟

4. **[methodology.md](./methodology.md)** - 测试对齐方法论
   - 5 步法工作流详解
   - 对齐的关键检查点
   - 常见问题与解决方案
   - 对齐完成标准
   - **阅读时间**: 25 分钟

5. **[progress.md](./progress.md)** - 实时进度跟踪
   - 当前进度（0%）
   - 按 Phase 的任务列表
   - 待启动工作
   - 发现的问题与差异
   - **阅读时间**: 10 分钟（定期查阅）

### 检查清单（实施时使用）

6. **[checklists/phase1-checklist.md](./checklists/phase1-checklist.md)** - Phase 1 检查清单
   - 7 个子模块的任务清单
   - 每个任务的验证点
   - 完成标准

7. **[checklists/general-alignment-checklist.md](./checklists/general-alignment-checklist.md)** - 通用对齐清单
   - 每个测试文件的标准检查项
   - 可重复使用

### 契约文档（参考）

8. **[contracts/api-contract.md](./contracts/api-contract.md)** - HTTP API 契约
   - 所有 API 端点的规范
   - 请求/响应格式
   - 状态码和错误消息
   - **用途**: 实现时对标检查

9. **[contracts/data-model-contract.md](./contracts/data-model-contract.md)** - 数据模型契约
   - 所有对象的数据结构
   - 字段类型和验证规则
   - 序列化格式
   - **用途**: 实现时对标检查

---

## 🎯 阅读路径建议

### 为管理者

```
1. README.md (15 min)
   ↓
2. plan.md - 第一节 (10 min)
   ↓
3. progress.md (5 min)
```

**了解**: 项目规模、工作量、时间表

---

### 为技术负责人

```
1. README.md (15 min)
   ↓
2. plan.md (20 min)
   ↓
3. methodology.md (25 min)
   ↓
4. phase1-analysis.md - 概览部分 (10 min)
```

**了解**: 完整规划、执行方法、技术细节

---

### 为实施人员

```
1. README.md - 快速开始部分 (5 min)
   ↓
2. phase1-analysis.md (30 min)
   ↓
3. methodology.md - 第 2-3 节 (15 min)
   ↓
4. checklists/phase1-checklist.md (5 min)
   ↓
开始实施 Task 1.1
```

**了解**: 第一个任务的所有细节、方法论、检查清单

---

### 为架构师/审查者

```
1. plan.md (20 min)
   ↓
2. phase1-analysis.md (30 min)
   ↓
3. methodology.md - 检查点部分 (20 min)
   ↓
4. contracts/ (30 min)
```

**了解**: 整体设计、对齐标准、API 契约

---

## 📊 文档类型概览

| 文档类型 | 文件 | 用途 | 更新频率 |
|---------|------|------|---------|
| **规范** | README, plan | 核心规范，指导实施 | 每月 |
| **分析** | phase1-analysis | 深度分析每个阶段 | 每个 Phase 启动时 |
| **方法** | methodology | 执行方法论 | 一次性 |
| **追踪** | progress | 实时进度和问题 | 每周 |
| **检查** | checklists/ | 任务检查清单 | 每个 Phase 启动时 |
| **契约** | contracts/ | 技术规范和标准 | 每月或发现差异时 |

---

## 🔍 快速查找

### 我想了解...

**项目概览**
→ README.md "规范概述"

**工作量和时间表**
→ plan.md "整体工作量估算"

**如何执行**
→ methodology.md "对齐过程（5 步法）"

**第一个任务是什么**
→ phase1-analysis.md "1. Record Auth Methods Tests"

**当前进度**
→ progress.md "📊 整体进度"

**API 规范**
→ contracts/api-contract.md

**数据格式规范**
→ contracts/data-model-contract.md

**Phase 1 的所有任务**
→ phase1-analysis.md + checklists/phase1-checklist.md

**对齐的关键检查点**
→ methodology.md "2. 测试对齐的关键检查点"

**发现的问题和差异**
→ progress.md "🔍 发现的问题与差异"

---

## 📝 文档维护

### 更新规则

1. **README.md**
   - 规范概览改变时更新
   - 快速开始步骤改变时更新
   - **频率**: 月度

2. **plan.md**
   - 阶段划分改变时更新
   - 工作量估算改变时更新
   - **频率**: 月度

3. **phase1-analysis.md**
   - 子模块细节改变时更新
   - Task 列表改变时更新
   - **频率**: Phase 启动前或启动时

4. **methodology.md**
   - 执行流程改变时更新
   - 新的最佳实践出现时更新
   - **频率**: 一次性（或重大改进）

5. **progress.md** ⭐
   - **每周更新**: 任务进度
   - **发现问题时**: 立即添加到"已知问题"
   - **完成 Phase 时**: 标记完成 + 添加发现

6. **checklists/** - 新 Phase 启动时创建

7. **contracts/** - 发现 API 差异时更新

### 更新流程

```
1. 更新规范文件
   ├─ 在文件顶部更新 "最后更新: 日期"
   └─ 如有重大更新，在版本历史中添加记录

2. 更新 progress.md
   ├─ 更新相关 Phase 的进度
   ├─ 添加任何新发现的问题
   └─ 更新 "最后更新" 时间

3. 同步到内存
   └─ 在 /Users/yufei/.codebuddy/.../MEMORY.md 中记录重要更新
```

---

## 🚀 开始使用

### 第一次使用

```bash
# 1. 进入规范目录
cd /Users/yufei/workspace/pocketbase-main/specs/034-pocketless-test-alignment/

# 2. 阅读 README
cat README.md

# 3. 阅读 plan
cat plan.md

# 4. 查看进度
cat progress.md
```

### 定期检查

```bash
# 每周检查进度
cat progress.md | head -30

# 启动新 Phase 时
cat phase<X>-analysis.md | head -50
```

### 执行任务时

```bash
# 查看任务细节
cat phase<X>-analysis.md | grep -A 30 "Task <N>"

# 查看检查清单
cat checklists/phase<X>-checklist.md

# 参考 API 规范
cat contracts/api-contract.md | grep -A 10 "endpoint-name"
```

---

## 📞 支持和反馈

### 文档有问题？

1. 检查是否过期（看"最后更新"时间）
2. 检查相关的最新更新日志
3. 提出 Issue 或更新文档

### 需要澄清？

- 查看相关的"常见问题"部分
- 阅读相关的详深文档
- 如有必要，联系规范维护者

### 想改进文档？

1. 在对应文档中添加建议
2. 或更新到 progress.md 的"已知问题"
3. 提出 PR

---

## 📊 统计信息

```
总规范文档: 9 个
├─ 核心文档: 5
├─ 检查清单: 2
└─ 契约文档: 2

总代码示例: 50+ 个
总检查项: 100+ 个

总阅读时间: ~95 分钟
推荐按阶段分散阅读
```

---

## 📋 版本历史

| 版本 | 日期 | 文档数 | 主要内容 |
|------|------|--------|---------|
| 1.0 | 2026-03-24 | 5 | 初始规范：规划、分析、方法论、进度、README |

---

**规范主页**: [README.md](./README.md)  
**最后更新**: 2026-03-24  
**维护状态**: ✅ 活跃
