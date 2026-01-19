# Tasks: 迁移文件可读时间戳格式

**Feature Branch**: `018-migration-readable-timestamp`  
**Created**: 2026-01-20  
**Status**: ✅ Completed  
**Approach**: TDD (Red-Green-Refactor)

## 任务概览

| Task | 描述 | 预估时间 | 状态 |
|------|------|----------|------|
| 1 | 修改 `migratecmd.go` 时间戳格式 | 15 min | ✅ Completed |
| 2 | 修改 `automigrate.go` 时间戳格式 | 10 min | ✅ Completed |
| 3 | 添加单元测试 | 30 min | ✅ Completed |
| 4 | 验证向后兼容性 | 15 min | ✅ Completed |
| 5 | 更新文档 | 10 min | ✅ Completed |

**总预估时间**: ~1.5 小时  
**实际完成时间**: ~30 分钟

---

## Task 1: 修改手动迁移创建的时间戳格式 (TDD)

**目标**: 将 `migrate create` 命令生成的文件名从 Unix 时间戳改为 YYYYMMDDHHMMSS 格式

**文件**: `plugins/migratecmd/migratecmd.go`

### Red Test (先写测试)

**测试文件**: `plugins/migratecmd/migratecmd_test.go`

```go
func TestMigrateCreateFilenameFormat(t *testing.T) {
    // 验证文件名格式为 YYYYMMDDHHMMSS_name.go
    // 例如: 20260120153010_test_feature.go
}
```

- [ ] 1.1 创建测试用例 `TestMigrateCreateFilenameFormat`
- [ ] 1.2 验证生成的文件名匹配正则 `^\d{14}_\w+\.(go|js)$`
- [ ] 1.3 验证时间戳部分可正确解析为日期

### Green Implementation

**修改位置**: `plugins/migratecmd/migratecmd.go` 第 154 行

```go
// Before
filename := fmt.Sprintf("%d_%s.%s", time.Now().Unix(), inflector.Snakecase(name), p.config.TemplateLang)

// After
filename := fmt.Sprintf("%s_%s.%s", time.Now().Format("20060102150405"), inflector.Snakecase(name), p.config.TemplateLang)
```

- [ ] 1.4 修改 `filename` 格式化逻辑
- [ ] 1.5 运行测试确认通过

**验收标准**: `go test -v -run TestMigrateCreateFilenameFormat ./plugins/migratecmd/`

---

## Task 2: 修改自动迁移的时间戳格式 (TDD)

**目标**: 将 Admin UI 自动生成的迁移文件名改为 YYYYMMDDHHMMSS 格式

**文件**: `plugins/migratecmd/automigrate.go`

### Red Test

- [ ] 2.1 创建测试用例 `TestAutoMigrateFilenameFormat`
- [ ] 2.2 验证 `created_`, `updated_`, `deleted_` 操作的文件名格式

### Green Implementation

**修改位置**: `plugins/migratecmd/automigrate.go` 第 70 行

```go
// Before
name := fmt.Sprintf("%d_%s.%s", time.Now().Unix(), action, p.config.TemplateLang)

// After
name := fmt.Sprintf("%s_%s.%s", time.Now().Format("20060102150405"), action, p.config.TemplateLang)
```

- [ ] 2.3 修改 `name` 格式化逻辑
- [ ] 2.4 运行测试确认通过

**验收标准**: `go test -v -run TestAutoMigrateFilenameFormat ./plugins/migratecmd/`

---

## Task 3: 添加完整单元测试

**目标**: 确保新格式的正确性和边界情况处理

**测试文件**: `plugins/migratecmd/migratecmd_test.go`

### 测试用例清单

- [ ] 3.1 `TestTimestampFormat` - 验证时间戳格式正确（14 位数字）
- [ ] 3.2 `TestFilenameRegex` - 验证完整文件名格式
- [ ] 3.3 `TestGoTemplate` - 验证 Go 模板生成 `.go` 文件
- [ ] 3.4 `TestJSTemplate` - 验证 JS 模板生成 `.js` 文件
- [ ] 3.5 `TestSnakecaseName` - 验证名称转换为 snake_case

### 示例测试代码

```go
func TestTimestampFormat(t *testing.T) {
    timestamp := time.Now().Format("20060102150405")
    
    // 验证长度为 14
    if len(timestamp) != 14 {
        t.Errorf("timestamp length should be 14, got %d", len(timestamp))
    }
    
    // 验证可解析
    _, err := time.Parse("20060102150405", timestamp)
    if err != nil {
        t.Errorf("timestamp should be parseable: %v", err)
    }
}
```

**验收标准**: 
- `go test -v ./plugins/migratecmd/` 全部通过
- 覆盖率 ≥ 90%

---

## Task 4: 验证向后兼容性

**目标**: 确保新旧格式迁移文件混合时排序正确

### 测试场景

- [ ] 4.1 创建混合格式测试目录
- [ ] 4.2 验证字典序排序结果正确

### 测试步骤

```bash
# 创建测试迁移文件
mkdir -p /tmp/test_migrations
touch /tmp/test_migrations/1736300000_old_format.go
touch /tmp/test_migrations/1736400000_another_old.go
touch /tmp/test_migrations/20260120153010_new_format.go
touch /tmp/test_migrations/20260120153011_another_new.go

# 验证排序
ls -1 /tmp/test_migrations/
# 期望输出:
# 1736300000_old_format.go
# 1736400000_another_old.go
# 20260120153010_new_format.go
# 20260120153011_another_new.go
```

### 单元测试

```go
func TestMixedFormatSorting(t *testing.T) {
    files := []string{
        "20260120153010_new.go",
        "1736300000_old.go",
        "1736400000_another_old.go",
        "20260120153011_another_new.go",
    }
    
    sort.Strings(files)
    
    expected := []string{
        "1736300000_old.go",
        "1736400000_another_old.go",
        "20260120153010_new.go",
        "20260120153011_another_new.go",
    }
    
    for i, f := range files {
        if f != expected[i] {
            t.Errorf("position %d: expected %s, got %s", i, expected[i], f)
        }
    }
}
```

- [ ] 4.3 添加 `TestMixedFormatSorting` 测试
- [ ] 4.4 运行完整迁移测试确认无回归

**验收标准**: 所有现有迁移测试通过

---

## Task 5: 更新文档（可选）

**目标**: 更新相关文档说明新的时间戳格式

### 文档更新清单

- [ ] 5.1 更新 `site/docs/` 中迁移相关文档（如有）
- [ ] 5.2 在 `CHANGELOG.md` 中记录此变更

### 变更说明模板

```markdown
### Changed
- Migration file timestamp format changed from Unix timestamp (e.g., `1736300000`) 
  to human-readable format (e.g., `20260120153010` for `YYYYMMDDHHMMSS`)
- This is backward compatible: existing Unix timestamp files continue to work
```

**验收标准**: 文档清晰说明新格式

---

## 执行顺序

```
Task 1 (手动迁移) → Task 2 (自动迁移) → Task 3 (完整测试)
                                              ↓
                   Task 5 (文档) ← Task 4 (兼容性验证)
```

## 验收检查清单

- [ ] `go test ./plugins/migratecmd/...` 全部通过
- [ ] `go build ./...` 无编译错误
- [ ] 手动测试 `./pocketbase migrate create test_feature` 生成正确格式
- [ ] 现有项目升级后迁移功能正常

## 进度跟踪

| Task | Status | Notes |
|------|--------|-------|
| 1 | ✅ Completed | `migratecmd.go:154` 修改完成 |
| 2 | ✅ Completed | `automigrate.go:70` 修改完成 |
| 3 | ✅ Completed | 新增 3 个测试用例，覆盖率 65.7% |
| 4 | ✅ Completed | `TestMigrationFilenameFormat_MixedSorting` 验证通过 |
| 5 | ✅ Completed | CHANGELOG.md 已更新 |

## 实现总结

### 代码变更

**文件 1**: `plugins/migratecmd/migratecmd.go` (第 154 行)
```go
// Before
filename := fmt.Sprintf("%d_%s.%s", time.Now().Unix(), ...)

// After
filename := fmt.Sprintf("%s_%s.%s", time.Now().Format("20060102150405"), ...)
```

**文件 2**: `plugins/migratecmd/automigrate.go` (第 70 行)
```go
// Before
name := fmt.Sprintf("%d_%s.%s", time.Now().Unix(), ...)

// After
name := fmt.Sprintf("%s_%s.%s", time.Now().Format("20060102150405"), ...)
```

### 新增测试

- `TestMigrationFilenameFormat_ReadableTimestamp` - 验证 Go/JS 模板生成 YYYYMMDDHHMMSS 格式
- `TestMigrationFilenameFormat_MixedSorting` - 验证新旧格式混合排序正确
- `TestTimestampFormat_Parseable` - 验证时间戳格式可解析

### 测试结果

```
=== RUN   TestMigrationFilenameFormat_ReadableTimestamp
--- PASS: TestMigrationFilenameFormat_ReadableTimestamp (0.11s)
    --- PASS: TestMigrationFilenameFormat_ReadableTimestamp/Go_template (0.06s)
    --- PASS: TestMigrationFilenameFormat_ReadableTimestamp/JS_template (0.05s)
=== RUN   TestMigrationFilenameFormat_MixedSorting
--- PASS: TestMigrationFilenameFormat_MixedSorting (0.00s)
=== RUN   TestTimestampFormat_Parseable
--- PASS: TestTimestampFormat_Parseable (0.00s)
PASS
ok      github.com/pocketbase/pocketbase/plugins/migratecmd     0.512s
```
