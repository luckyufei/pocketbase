# Quickstart: PocketLess 功能对齐开发

**Feature**: 033-pocketless-check  
**Date**: 2026-02-11

## 前置要求

- Bun >= 1.x
- pocketless 项目已初始化 (`cd pocketless && bun install`)
- 了解 Go PocketBase 源码结构

## 运行现有测试

```bash
cd pocketless
bun test
```

## 开发顺序（按优先级）

### Phase 1: P1 安全与数据完整性

按以下顺序开发，每个模块遵循 TDD：

1. **db.ts Hook 链修复** — 最基础，其他模块依赖正确的 hook 触发
   - 修复 `modelCreate/modelUpdate/modelDelete` 添加事务包裹
   - 添加 error hook 触发
   - 添加 Record-level 前置 hook
   ```bash
   bun test src/core/db.test.ts
   ```

2. **TxApp 事务感知** — db.ts 修复后立即实现
   - 创建 `core/tx_app.ts`
   - 修改 `runInTransaction` 签名
   ```bash
   bun test src/core/tx_app.test.ts
   ```

3. **权限规则检查** — 安全关键
   - 修正 `record_field_resolver.ts` 的 `:isset` 和 `:changed`
   - 在 `record_crud.ts` 中添加 rule 检查
   ```bash
   bun test src/core/record_field_resolver.test.ts
   bun test src/apis/record_crud.test.ts
   ```

4. **集合验证** — 数据完整性
   - 创建 `core/collection_validate.ts`
   - 注册到 `onCollectionValidate` hook
   ```bash
   bun test src/core/collection_validate.test.ts
   ```

5. **自动表同步** — 集合验证后
   - 创建 `core/collection_record_table_sync.ts`
   ```bash
   bun test src/core/collection_record_table_sync.test.ts
   ```

### Phase 2: P2 功能扩展

6. **缺失 Hook 定义** — 添加到 base.ts + events.ts
   ```bash
   bun test src/core/base.test.ts
   ```

7. **Realtime 认证 + 权限过滤**
   ```bash
   bun test src/apis/realtime.test.ts
   ```

8. **View 集合**
   ```bash
   bun test src/core/view.test.ts
   ```

9. **App 接口补全** (newFilesystem, newMailClient, logger, unsafeWithoutHooks)
   ```bash
   bun test src/core/base.test.ts
   ```

### Phase 3: P3 工具与 CLI

10. **工具模块** (picker, dbutils, archive, logger)
    ```bash
    bun test src/tools/picker/
    bun test src/tools/dbutils/
    bun test src/tools/archive/
    bun test src/tools/logger/
    ```

11. **CLI 命令实现**
    ```bash
    bun test src/cmd/superuser.test.ts
    bun test src/cmd/migrate.test.ts
    ```

## 关键参考文件

| 功能 | Go 参考文件 | Pocketless 目标文件 |
|------|-----------|-------------------|
| 权限过滤 | `apis/record_crud.go` L100-200 | `apis/record_crud.ts` |
| 字段解析 | `core/record_field_resolver_runner.go` | `core/record_field_resolver.ts` |
| 集合验证 | `core/collection_validate.go` | `core/collection_validate.ts` (NEW) |
| 表同步 | `core/collection_record_table_sync.go` | `core/collection_record_table_sync.ts` (NEW) |
| View | `core/view.go` | `core/view.ts` (NEW) |
| Hooks | `core/base.go` L800-1678 | `core/base.ts` |
| TxApp | `core/base.go` `RunInTransaction` | `core/tx_app.ts` (NEW) |
| Picker | `tools/picker/pick.go` | `tools/picker/pick.ts` (NEW) |
| DB Utils | `tools/dbutils/*.go` | `tools/dbutils/*.ts` (NEW) |
| Archive | `tools/archive/*.go` | `tools/archive/*.ts` (NEW) |
| Logger | Go `slog` | `tools/logger/logger.ts` (NEW) |

## 验证完成度

完成所有开发后，运行全量测试：

```bash
cd pocketless
bun test --coverage
```

目标：所有新增模块覆盖率 ≥ 90%。
