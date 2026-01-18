# Plan: Schema/Seed Migration Separation

**Feature Branch**: `017-migration-separation`  
**Created**: 2026-01-17  
**Estimated Effort**: 3-4 days

---

## Problem Statement

开发期间频繁修改 Collection 会生成大量 schema 迁移文件。发布前使用 `migrate collections` 压缩时，会丢失混在其中的 seed 迁移（如种子数据）。当前无法安全区分哪些迁移可以压缩。

## Solution Overview

将 schema 迁移和 seed 迁移分离到两个独立目录：

```
project/
├── pb_migrations/     # Schema（可压缩）
└── pb_seeds/          # Seed（永不压缩）
```

执行顺序保证 schema 先于 seed，解决依赖问题。

## Key Design Decisions

### 1. 目录命名

| 语言 | Schema Dir | Seed Dir |
|------|------------|----------|
| JS | `pb_migrations/` | `pb_seeds/` |
| Go | `migrations/` | `seeds/` |

使用 `pb_seeds` 而非 `pb_data_migrations`，避免与 `pb_data` 目录混淆。

### 2. 执行顺序

```
Up:   System → Schema → Seed → App
Down: App → Seed → Schema → System
```

Schema 完全执行完毕后再执行 Seed，确保表结构就绪。

### 3. _migrations 表记录

Seed 迁移记录添加 `seed/` 前缀：

```
file: "1704067200_created_posts.js"        # schema
file: "seed/1704067300_seed_users.js"      # seed
```

### 4. 向后兼容

- 无 `pb_seeds/` 目录时，行为与现在完全一致
- 旧 `_migrations` 记录（无前缀）自动识别为 schema 迁移
- 现有项目零修改可用

## Implementation Phases

### Phase 1: Core (Day 1-2)

1. Config 扩展 `SeedDir` 字段
2. 双目录加载逻辑
3. 执行顺序控制
4. `_migrations` 表前缀处理

### Phase 2: Commands (Day 2-3)

1. `migrate create --seed` 支持
2. `migrate history-sync` 双目录支持
3. Seed 迁移模板（含幂等示例）

### Phase 3: Polish (Day 3-4)

1. 文档更新
2. 集成测试
3. 边界情况处理

## Risks

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 破坏现有项目 | 低 | 高 | 全面向后兼容测试 |
| 用户困惑 | 中 | 中 | 清晰文档 + 帮助信息 |
| 复杂边界情况 | 中 | 低 | 充分的 TDD 覆盖 |

## Success Criteria

1. ✅ 现有项目升级后零报错
2. ✅ `migrate collections` 不影响 seed 迁移
3. ✅ 执行顺序始终正确
4. ✅ 测试覆盖率 > 90%

## Dependencies

- 无外部依赖
- 需要修改 `plugins/migratecmd/` 包
- 可能涉及 `core/migrations_runner.go`

## Rollout Plan

1. **Alpha**: 内部测试，验证兼容性
2. **Beta**: 文档发布，收集反馈
3. **GA**: 下一个 minor 版本发布
