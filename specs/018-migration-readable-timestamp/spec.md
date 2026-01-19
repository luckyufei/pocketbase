# Feature Specification: 迁移文件可读时间戳格式

**Feature Branch**: `018-migration-readable-timestamp`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "将迁移文件名从 Unix 时间戳改为人类可读的 YYYYMMDDHHMMSS 格式"

## 背景

PocketBase 当前使用 Unix 时间戳（如 `1705392000`）作为迁移文件名前缀，这种设计虽然在技术上简单可靠，但存在以下问题：

1. **可读性差**：无法一眼看出 `1705392000` 对应的日期时间
2. **排查困难**：在故障排查时需要额外转换时间戳
3. **协作不便**：团队成员讨论迁移文件时沟通成本高

**目标**: 将迁移文件名格式从 `{unix_timestamp}_{name}.{ext}` 改为 `{YYYYMMDDHHMMSS}_{name}.{ext}`。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 生成可读迁移文件名 (Priority: P1)

作为开发者，我希望运行 `migrate create` 命令时生成的迁移文件使用人类可读的时间戳格式，以便快速识别文件创建时间。

**Why this priority**: 这是核心功能，直接影响日常开发体验。

**Independent Test**: 运行 `./pocketbase migrate create test_feature`，验证生成的文件名格式为 `20260120153010_test_feature.go`。

**Acceptance Scenarios**:

1. **Given** 开发者在项目目录, **When** 运行 `migrate create add_user_status`, **Then** 生成文件名如 `20260120153010_add_user_status.go`
2. **Given** 当前时间为 2026-01-20 15:30:10, **When** 运行迁移创建命令, **Then** 文件名前缀为 `20260120153010`
3. **Given** 使用 JS 模板语言配置, **When** 运行迁移创建命令, **Then** 生成文件名如 `20260120153010_add_user_status.js`

---

### User Story 2 - 自动迁移文件名可读化 (Priority: P1)

作为开发者，我希望在 Admin UI 中修改 Collection 后自动生成的迁移文件也使用可读时间戳格式。

**Why this priority**: 自动迁移是常用功能，与手动创建同等重要。

**Independent Test**: 在 Admin UI 中修改 Collection，验证 `pb_migrations/` 下生成的文件使用 YYYYMMDDHHMMSS 格式。

**Acceptance Scenarios**:

1. **Given** 开发者在 Admin UI 创建新 Collection, **When** 保存 Collection, **Then** 生成文件名如 `20260120153010_created_posts.go`
2. **Given** 开发者在 Admin UI 修改 Collection 字段, **When** 保存修改, **Then** 生成文件名如 `20260120153011_updated_posts.go`
3. **Given** 开发者在 Admin UI 删除 Collection, **When** 确认删除, **Then** 生成文件名如 `20260120153012_deleted_posts.go`

---

### User Story 3 - 向后兼容现有迁移文件 (Priority: P2)

作为开发者，我希望升级后系统能正确识别和排序现有的 Unix 时间戳格式迁移文件。

**Why this priority**: 确保平滑升级，不破坏现有项目。

**Independent Test**: 项目中同时存在 `1736300000_xxx.go` 和 `20260120153010_xxx.go` 文件时，按正确时间顺序执行。

**Acceptance Scenarios**:

1. **Given** 项目中存在旧格式文件 `1736300000_create_users.go`, **When** 运行迁移, **Then** 文件按正确顺序执行
2. **Given** 项目中混合存在新旧格式文件, **When** 运行迁移, **Then** 所有文件按字典序正确排序（`17...` < `20...`，符合时间顺序）
3. **Given** 用户从旧版本升级, **When** 创建新迁移文件, **Then** 新文件排在旧文件之后

---

### User Story 4 - Makefile 便捷命令 (Priority: P3)

作为开发者，我希望有一个简单的 `make migration` 命令快速创建迁移文件。

**Why this priority**: 提升开发效率的便利功能。

**Independent Test**: 运行 `make migration name=add_user_status`，验证生成正确格式的迁移文件。

**Acceptance Scenarios**:

1. **Given** 开发者在项目根目录, **When** 运行 `make migration name=add_user_status`, **Then** 生成可读时间戳格式的迁移文件

---

### Edge Cases

- **时区处理**：统一使用 UTC 时间还是本地时间？采用本地时间（与开发者直觉一致）
- **毫秒冲突**：同一秒内创建多个迁移如何处理？秒级精度足够，若冲突则报错提示用户重试
- **格式校验**：如何识别无效的文件名格式？仅校验前缀为 10 位数字或 14 位数字

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `migrate create` 命令 MUST 使用 `YYYYMMDDHHMMSS` 格式生成时间戳前缀
- **FR-002**: 自动迁移功能 MUST 使用 `YYYYMMDDHHMMSS` 格式生成时间戳前缀
- **FR-003**: 迁移文件排序 MUST 继续使用字符串字典序（现有逻辑无需修改）
- **FR-004**: 系统 MUST 兼容现有的 Unix 时间戳格式迁移文件
- **FR-005**: Go 模板和 JS 模板 MUST 都使用新的时间戳格式
- **FR-006**: 时间戳 MUST 使用本地时间生成（与开发者工作时间一致）

### Key Entities

- **MigrationFile**: 迁移文件，包含时间戳前缀、描述性名称、文件扩展名
- **MigrationConfig**: 迁移配置，包含模板语言、目录路径等

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 所有新生成的迁移文件使用 `YYYYMMDDHHMMSS` 格式
- **SC-002**: 现有项目升级后迁移功能正常工作
- **SC-003**: 开发者可以一眼识别迁移文件的创建时间
- **SC-004**: 新旧格式文件混合时排序正确

## Technical Compatibility

### `_migrations` 表结构

`_migrations` 表由 `core/migrations_runner.go` 初始化：

```sql
CREATE TABLE IF NOT EXISTS "_migrations" (
  file VARCHAR(255) PRIMARY KEY NOT NULL,
  applied BIGINT NOT NULL
)
```

**字段长度验证**:

| 组成部分 | 长度 | 示例 |
|---------|------|------|
| 时间戳 | 14 字符 | `20260120153010` |
| 分隔符 | 1 字符 | `_` |
| 名称 | ~200 字符 | `add_user_status` |
| 扩展名 | 3 字符 | `.go` |
| **总计** | **~218 字符** | `20260120153010_add_user_status.go` |

✅ **兼容性确认**: `VARCHAR(255)` 完全足够容纳新格式文件名。

### 排序机制

迁移排序使用字符串字典序（`core/migrations_list.go`），新旧格式混合时：
- 旧格式: `1736300000_xxx.go` (以 `1` 开头)
- 新格式: `20260120153010_xxx.go` (以 `2` 开头)

由于 `'2' > '1'`，新格式文件自然排在旧格式之后，**无需修改排序逻辑**。

## Assumptions

- 迁移文件按字符串字典序排序的现有逻辑无需修改
- 新格式 `2026...` 自然排在旧格式 `173...` 之后
- 开发者主要关心日期级别的可读性，秒级精度足够
- 分布式团队同一秒创建迁移的情况极少
- `_migrations` 表的 `VARCHAR(255)` 字段足够存储新格式文件名
