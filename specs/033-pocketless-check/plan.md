# Implementation Plan: PocketLess 功能完全对齐

**Branch**: `033-pocketless-check` | **Date**: 2026-02-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/033-pocketless-check/spec.md`

## Summary

将 TypeScript pocketless (Bun.js + Hono) 实现与 Go PocketBase 完全对齐。经过深度对比分析，识别出 9 大类差距：权限过滤完全缺失（安全致命）、集合验证/表同步缺失、Hook 链不完整（~20 个缺失）、Realtime 无权限过滤、View 集合无功能实现、TxApp 事务感知缺失、工具模块缺失（picker/dbutils/archive/logger）、CLI 命令全为 stub。实施策略为 P1→P2→P3 优先级递进，共 11 个实施步骤。

## Technical Context

**Language/Version**: TypeScript 5.x on Bun 1.x runtime  
**Primary Dependencies**: Hono (HTTP), Kysely (Query Builder), jose (JWT), arctic (OAuth2), croner (Cron), Commander.js (CLI), Zod (Validation), nodemailer (Email), @aws-sdk/client-s3 (S3)  
**Storage**: SQLite (bun:sqlite, 默认) + PostgreSQL (Bun.SQL)  
**Testing**: Bun test runner (`bun test`)  
**Target Platform**: Server-side (Bun runtime)  
**Project Type**: Single library project  
**Performance Goals**: 与 Go PocketBase 功能等价（不要求性能等价）  
**Constraints**: 遵循"丰田式"原则 — 最小依赖、高可靠性  
**Scale/Scope**: ~117 现有源文件 → 预计新增 ~25 个文件，修改 ~15 个文件

## Constitution Check

*Constitution 文件为模板（未填写项目特定内容），无特定 gate 需要检查。*

**通用开发规范检查**:

| 规范 | 状态 | 说明 |
|------|------|------|
| TDD 流程 | ✅ PASS | 所有新模块将先写测试再实现 |
| 覆盖率 ≥ 95% | ✅ PASS | 目标覆盖率 ≥ 90%（spec SC-010 要求） |
| 函数 ≤ 50 行 | ✅ PASS | 将遵循 COGNITIVE First 原则 |
| 最小依赖 | ✅ PASS | 新增模块仅使用内置 API + 已有依赖 |

## Project Structure

### Documentation (this feature)

```text
specs/033-pocketless-check/
├── spec.md                                    # Feature specification
├── plan.md                                    # This file
├── research.md                                # Phase 0 research findings
├── data-model.md                              # Entity definitions
├── quickstart.md                              # Development guide
├── checklists/
│   └── requirements.md                        # Quality checklist
└── contracts/
    ├── record-crud-permissions.md             # CRUD 权限 API 契约
    ├── realtime-permissions.md                # Realtime 权限 API 契约
    ├── collection-validation-view.md          # 集合验证 + View API 契约
    ├── hooks-txapp.md                         # Hook + TxApp 行为契约
    └── cli-commands.md                        # CLI 命令契约
```

### Source Code (repository root)

```text
pocketless/src/
├── core/
│   ├── base.ts                   # 修改: 新增 ~15 个 Hook + App 接口方法
│   ├── db.ts                     # 修改: 事务包裹 + error hook + Record 前置 hook
│   ├── tx_app.ts                 # 新增: TxApp 事务感知 App 实例
│   ├── collection_validate.ts    # 新增: 26 项集合验证
│   ├── collection_record_table_sync.ts  # 新增: DDL 自动同步
│   ├── view.ts                   # 新增: View 集合逻辑
│   ├── permission_rule.ts        # 新增: 权限规则检查工具函数
│   ├── record_field_resolver.ts  # 修改: :isset/:changed 修正
│   └── events.ts                 # 修改: 新增事件类型定义
├── apis/
│   ├── record_crud.ts            # 修改: 添加权限检查
│   ├── realtime.ts               # 修改: 添加 auth + hook
│   ├── realtime_broadcast.ts     # 修改: 添加权限过滤
│   ├── settings.ts               # 修改: 添加 hook 触发
│   ├── file.ts                   # 修改: 添加 hook 触发
│   ├── batch.ts                  # 修改: 添加 hook 触发
│   ├── backup.ts                 # 修改: 添加 hook 触发
│   └── backup_restore.ts         # 修改: 添加 hook 触发
├── tools/
│   ├── picker/
│   │   ├── pick.ts               # 新增: JSON 字段筛选
│   │   ├── modifiers.ts          # 新增: 修饰符注册
│   │   └── excerpt_modifier.ts   # 新增: excerpt 修饰符
│   ├── dbutils/
│   │   ├── index.ts              # 新增: Index 解析/构建
│   │   ├── errors.ts             # 新增: DB 错误分类
│   │   └── json.ts               # 新增: JSON 函数统一接口
│   ├── archive/
│   │   ├── create.ts             # 新增: ZIP 打包
│   │   └── extract.ts            # 新增: ZIP 解压
│   └── logger/
│       └── logger.ts             # 新增: 结构化日志
├── cmd/
│   ├── superuser.ts              # 修改: 实际执行逻辑
│   └── migrate.ts                # 修改: 实际执行逻辑
└── (对应 .test.ts 文件)
```

**Structure Decision**: 沿用 pocketless 现有目录结构，新增文件放入对应目录。无需创建新的顶层目录。

## Implementation Phases

### Phase 1: P1 安全与数据完整性 (Steps 1-5)

| Step | 模块 | 新增/修改 | 依赖 | 预估工作量 |
|------|------|----------|------|-----------|
| 1 | db.ts Hook 链修复 | 修改 | 无 | 中 |
| 2 | TxApp 事务感知 | 新增 + 修改 | Step 1 | 中 |
| 3 | 权限规则检查 + :isset/:changed 修正 | 新增 + 修改 | Step 1 | 大 |
| 4 | 集合验证 | 新增 | Step 1 | 大 |
| 5 | 自动表同步 | 新增 | Step 4 | 大 |

### Phase 2: P2 功能扩展 (Steps 6-9)

| Step | 模块 | 新增/修改 | 依赖 | 预估工作量 |
|------|------|----------|------|-----------|
| 6 | 缺失 Hook 定义 + 事件类型 | 修改 | Step 1 | 小 |
| 7 | Realtime 认证 + 权限过滤 | 修改 | Step 3, 6 | 中 |
| 8 | View 集合 | 新增 | Step 4, 5 | 中 |
| 9 | App 接口补全 | 修改 | Step 2, 6 | 中 |

### Phase 3: P3 工具与 CLI (Steps 10-11)

| Step | 模块 | 新增/修改 | 依赖 | 预估工作量 |
|------|------|----------|------|-----------|
| 10 | 工具模块 (picker/dbutils/archive/logger) | 新增 | 无 | 中 |
| 11 | CLI 命令实现 | 修改 | Step 1, 2 | 中 |

## Dependency Graph

```
Step 1 (db.ts 修复)
  ├── Step 2 (TxApp) ──── Step 9 (App 接口)
  ├── Step 3 (权限) ───── Step 7 (Realtime 权限)
  ├── Step 4 (集合验证)
  │     └── Step 5 (表同步) ── Step 8 (View 集合)
  ├── Step 6 (Hook 定义) ─ Step 7, Step 9
  └── Step 11 (CLI)

Step 10 (工具模块) ── 独立，可并行
```

## Complexity Tracking

无 Constitution 违规需要记录。
