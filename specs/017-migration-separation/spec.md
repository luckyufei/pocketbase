# Feature Specification: Schema/Seed Migration Separation

**Feature Branch**: `017-migration-separation`  
**Created**: 2026-01-17  
**Status**: Draft  
**Input**: 用户需求讨论 - 开发期间频繁变更 schema 产生大量迁移文件，发布前需要压缩但不能丢失 seed 迁移

## 背景

当前 PocketBase 的迁移系统将 schema 迁移（表结构变更）和 seed 迁移（数据种子、数据修复）放在同一目录，导致以下问题：

1. **开发期间**：频繁修改 Collection 会生成大量 `created_*/updated_*/deleted_*` 迁移文件
2. **发布前压缩**：使用 `migrate collections` 生成快照时，会丢失 seed 迁移逻辑
3. **顺序依赖**：如果快照时间戳晚于 seed 迁移，执行时表不存在会导致失败
4. **清理困难**：无法安全区分哪些迁移可以删除

### 问题本质

Schema 和 Seed 迁移有不同的生命周期：

| 类型 | 特点 | 压缩需求 |
|------|------|---------|
| Schema | 可从最终状态重建 | ✅ 可压缩 |
| Seed | 必须保留执行逻辑 | ❌ 不能压缩 |

将两者混在同一目录违反了**分离关注点**原则。

## 设计目标

1. **简单**：无特殊命名约定，目录即分类
2. **健壮**：schema 永远先于 seed 执行
3. **灵活**：各自独立管理，互不干扰
4. **兼容**：完全兼容现有单目录模式

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 双目录迁移支持 (Priority: P1)

作为开发者，我希望能将 schema 迁移和 seed 迁移分开管理，以便在发布前安全压缩 schema 迁移。

**Why this priority**: 这是核心功能，解决根本问题。

**Independent Test**: 创建 `pb_migrations/` 和 `pb_seeds/` 两个目录，验证按正确顺序执行。

**Acceptance Scenarios**:

1. **Given** 同时存在 `pb_migrations/` 和 `pb_seeds/`, **When** 执行 `migrate up`, **Then** 先执行 schema 目录，再执行 seed 目录
2. **Given** schema 迁移创建 `posts` 表, seed 迁移插入数据, **When** 从空数据库执行, **Then** 两个迁移都成功
3. **Given** `pb_seeds/` 目录不存在, **When** 执行 `migrate up`, **Then** 只执行 `pb_migrations/` 中的迁移（兼容旧项目）
4. **Given** `pb_migrations/` 目录不存在, **When** 执行 `migrate up`, **Then** 只执行 `pb_seeds/` 中的迁移
5. **Given** 两个目录都有迁移, **When** 查看 `_migrations` 表, **Then** 所有迁移都记录在同一张表

---

### User Story 2 - 独立的 down 回滚 (Priority: P1)

作为开发者，我希望回滚时也遵循正确的顺序（先回滚 seed，再回滚 schema）。

**Why this priority**: 回滚是迁移系统的核心功能，必须保证正确性。

**Independent Test**: 执行 `migrate down 2` 验证回滚顺序。

**Acceptance Scenarios**:

1. **Given** 已执行 schema 和 seed 迁移, **When** 执行 `migrate down 1`, **Then** 回滚最后执行的迁移（可能是 seed）
2. **Given** seed 迁移在 schema 之后执行, **When** 执行 `migrate down 2`, **Then** 先回滚 seed 迁移，再回滚 schema 迁移
3. **Given** 回滚 schema 迁移会删除表, **When** 该表有 seed 迁移的数据, **Then** 先回滚 seed 再回滚 schema（避免外键错误）

---

### User Story 3 - create 命令支持目标目录 (Priority: P2)

作为开发者，我希望 `migrate create` 命令能指定创建到哪个目录。

**Why this priority**: 便于快速创建 seed 迁移。

**Independent Test**: 使用 `migrate create --seed seed_users` 创建 seed 迁移。

**Acceptance Scenarios**:

1. **Given** 默认情况, **When** 执行 `migrate create add_posts`, **Then** 在 `pb_migrations/` 创建文件
2. **Given** 使用 `--seed` 标志, **When** 执行 `migrate create --seed seed_users`, **Then** 在 `pb_seeds/` 创建文件
3. **Given** `pb_seeds/` 不存在, **When** 执行 `migrate create --seed xxx`, **Then** 自动创建目录

---

### User Story 4 - collections 快照不影响 seed 目录 (Priority: P2)

作为开发者，我希望 `migrate collections` 只操作 schema 目录。

**Why this priority**: 确保压缩操作不会影响 seed 迁移。

**Independent Test**: 执行 `migrate collections` 验证只在 `pb_migrations/` 生成文件。

**Acceptance Scenarios**:

1. **Given** 两个目录都有迁移, **When** 执行 `migrate collections`, **Then** 只在 `pb_migrations/` 生成快照
2. **Given** `pb_seeds/` 有 seed 迁移, **When** 执行 `migrate collections`, **Then** seed 目录不受影响
3. **Given** 删除 `pb_migrations/*` 后执行 collections, **When** 同时存在 seed 迁移, **Then** 两者可以正常配合执行

---

### User Story 5 - history-sync 支持双目录 (Priority: P2)

作为开发者，我希望 `migrate history-sync` 能同时检查两个目录。

**Why this priority**: 保持数据库记录与文件系统同步。

**Independent Test**: 删除部分迁移文件后执行 `history-sync`。

**Acceptance Scenarios**:

1. **Given** `_migrations` 表有记录指向已删除文件, **When** 执行 `history-sync`, **Then** 清理这些孤立记录
2. **Given** 文件在 `pb_migrations/` 被删除, **When** 执行 `history-sync`, **Then** 正确清理
3. **Given** 文件在 `pb_seeds/` 被删除, **When** 执行 `history-sync`, **Then** 正确清理

---

### User Story 6 - Automigrate 配置 Seed 目录 (Priority: P3)

作为框架使用者，我希望能配置 Seed 目录位置。

**Why this priority**: 高级用户可能需要自定义目录布局。

**Independent Test**: 配置 `SeedDir` 后创建 seed 迁移。

**Acceptance Scenarios**:

1. **Given** 默认配置, **When** Automigrate 生成迁移, **Then** 输出到 `pb_migrations/`（schema）
2. **Given** 配置了 `SeedDir`, **When** 手动创建 seed 迁移, **Then** 输出到配置的目录
3. **Given** Go 框架配置, **When** 设置 `migratecmd.Config{SeedDir: "./custom_seeds"}`, **Then** seed 迁移输出到 `./custom_seeds`

---

### User Story 7 - 兼容现有单目录项目 (Priority: P1)

作为现有用户，我希望升级后不需要修改任何东西，现有项目继续正常工作。

**Why this priority**: 向后兼容是必须的。

**Independent Test**: 使用只有 `pb_migrations/` 的旧项目升级后运行。

**Acceptance Scenarios**:

1. **Given** 只有 `pb_migrations/` 目录, **When** 升级 PocketBase 版本, **Then** 一切正常工作
2. **Given** 旧项目没有 `pb_seeds/`, **When** 执行 `migrate up`, **Then** 只执行 `pb_migrations/`
3. **Given** 旧项目的迁移包含 seed 逻辑, **When** 不使用新功能, **Then** 行为与之前完全一致

---

## Technical Design

### 目录结构

```
project/
├── pb_migrations/     # Schema 迁移（自动生成 + 快照）
│   ├── 1704067200_created_posts.js
│   └── 1704070000_collections_snapshot.js
├── pb_seeds/          # Seed 迁移（手动编写，永不压缩）
│   ├── 1704067300_seed_categories.js
│   └── 1704067400_seed_admin.js
└── pb_data/
    └── data.db
```

### 执行顺序

```
migrate up 执行顺序:
1. System Migrations (core.SystemMigrations)
2. pb_migrations/* (按时间戳排序)
3. pb_seeds/* (按时间戳排序)  
4. App Migrations (core.AppMigrations)

migrate down 执行顺序（逆序）:
1. App Migrations
2. pb_seeds/* (逆时间戳)
3. pb_migrations/* (逆时间戳)
4. System Migrations
```

### 统一的 _migrations 表

两个目录的迁移记录在同一张表，通过文件路径区分来源：

```sql
-- 现有结构保持不变
CREATE TABLE _migrations (
    id TEXT PRIMARY KEY,
    file TEXT NOT NULL,
    applied INTEGER NOT NULL
);

-- 记录示例
-- file: "1704067200_created_posts.js"        (from pb_migrations/)
-- file: "seed/1704067300_seed_categories.js" (from pb_seeds/)
```

**注意**：seed 迁移文件名加 `seed/` 前缀以区分来源。

### 配置扩展

```go
type Config struct {
    // Dir specifies the directory for schema migrations.
    // Default: "pb_data/../pb_migrations" (JS) or "pb_data/../migrations" (Go)
    Dir string

    // SeedDir specifies the directory for seed migrations.
    // Default: "pb_data/../pb_seeds" (JS) or "pb_data/../seeds" (Go)
    // Set to empty string to disable seed migrations directory.
    SeedDir string

    Automigrate  bool
    TemplateLang string
}
```

### 命令扩展

```bash
# 现有命令保持不变
migrate up
migrate down [number]
migrate collections
migrate history-sync

# 新增 --seed 标志
migrate create <name>           # 创建到 pb_migrations/
migrate create --seed <name>    # 创建到 pb_seeds/
```

---

## Implementation Checklist

### Phase 1: Core Support

- [ ] 1.1 扩展 `Config` 结构添加 `SeedDir` 字段
- [ ] 1.2 修改迁移加载逻辑支持双目录
- [ ] 1.3 实现正确的执行顺序（schema → seed）
- [ ] 1.4 实现正确的回滚顺序（seed → schema）
- [ ] 1.5 修改 `_migrations` 表记录格式区分来源

### Phase 2: Commands

- [ ] 2.1 `migrate create --seed` 支持
- [ ] 2.2 `migrate history-sync` 双目录支持
- [ ] 2.3 `migrate collections` 确保只影响 schema 目录

### Phase 3: Documentation

- [ ] 3.1 更新 `site/references/js/migrations.md`
- [ ] 3.2 更新 `site/references/go/migrations.md`
- [ ] 3.3 添加迁移最佳实践文档

---

## Migration Path for Existing Projects

现有项目无需任何修改：

1. **无 `pb_seeds/`**：行为与之前完全一致
2. **创建 `pb_seeds/`**：自动启用双目录模式
3. **迁移建议**：
   - 识别现有迁移中的 seed 逻辑
   - 将 seed 迁移移动到 `pb_seeds/`
   - 更新 `_migrations` 表记录（添加 `seed/` 前缀）

---

## Risks & Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 用户混淆两个目录用途 | 中 | 清晰文档 + 命令帮助信息 |
| 回滚顺序错误导致失败 | 高 | 严格按执行逆序回滚 |
| `_migrations` 表格式变更 | 低 | 兼容旧格式，自动迁移 |

---

## Success Metrics

1. 现有项目升级后零报错
2. 新项目可以安全压缩 schema 迁移
3. Seed 迁移永不丢失
4. 执行顺序始终正确（schema → seed）
