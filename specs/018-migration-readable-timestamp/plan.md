# Implementation Plan: 迁移文件可读时间戳格式

**Branch**: `018-migration-readable-timestamp` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/018-migration-readable-timestamp/spec.md`

## Summary

将 PocketBase 迁移文件名的时间戳格式从 Unix 时间戳（`1705392000`）改为人类可读的 `YYYYMMDDHHMMSS` 格式（`20260120153010`）。改动范围集中在 `plugins/migratecmd/` 目录，涉及手动创建和自动迁移两个入口点。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: pocketbase/plugins/migratecmd, time (Go 标准库)  
**Testing**: Go test  
**Target Platform**: Linux/macOS/Windows  
**Project Type**: CLI 工具改进  
**Constraints**: 必须向后兼容现有 Unix 时间戳格式文件  
**Scale/Scope**: 改动约 10 行代码

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | 无新依赖，仅修改时间格式化逻辑 |
| Zero External Dependencies | ✅ PASS | 使用 Go 标准库 `time` |
| Backward Compatibility | ✅ PASS | 字典序排序逻辑无需修改 |
| Simplicity | ✅ PASS | 改动极小，风险可控 |

## Code Analysis

### 当前实现

**文件**: `plugins/migratecmd/migratecmd.go` (第 154 行)

```go
filename := fmt.Sprintf("%d_%s.%s", time.Now().Unix(), inflector.Snakecase(name), p.config.TemplateLang)
```

**文件**: `plugins/migratecmd/automigrate.go` (第 70 行)

```go
name := fmt.Sprintf("%d_%s.%s", time.Now().Unix(), action, p.config.TemplateLang)
```

### 目标实现

将 `time.Now().Unix()` 替换为 `time.Now().Format("20060102150405")`：

```go
// migratecmd.go
filename := fmt.Sprintf("%s_%s.%s", time.Now().Format("20060102150405"), inflector.Snakecase(name), p.config.TemplateLang)

// automigrate.go
name := fmt.Sprintf("%s_%s.%s", time.Now().Format("20060102150405"), action, p.config.TemplateLang)
```

### 排序兼容性分析

迁移文件排序逻辑位于 `core/migrations_list.go`：

```go
sort.SliceStable(l.list, func(i int, j int) bool {
    return l.list[i].File < l.list[j].File
})
```

使用字符串字典序比较，新旧格式混合时：
- 旧格式: `1736300000_xxx.go` (以 `1` 开头)
- 新格式: `20260120153010_xxx.go` (以 `2` 开头)

因为 `'2' > '1'`，新格式文件自然排在旧格式之后，符合时间顺序，**无需修改排序逻辑**。

## Project Structure

### Source Code Changes

```text
plugins/migratecmd/
├── migratecmd.go      # 修改手动创建迁移的时间戳格式
├── automigrate.go     # 修改自动迁移的时间戳格式
└── migratecmd_test.go # 新增测试用例
```

### Documentation

```text
specs/018-migration-readable-timestamp/
├── spec.md            # 需求规格
├── plan.md            # 本文件
└── tasks.md           # 开发任务清单
```

## Risk Assessment

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 破坏现有迁移排序 | 低 | 高 | 字典序排序保证兼容性 |
| 时区混乱 | 低 | 低 | 统一使用 `time.Now()` 本地时间 |
| 同秒冲突 | 极低 | 低 | 开发者可重试，实际场景罕见 |

## Complexity Tracking

> 无复杂性违规项，改动极小（约 10 行代码），风险可控。
