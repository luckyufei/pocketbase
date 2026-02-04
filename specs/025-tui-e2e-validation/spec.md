# Feature Specification: TUI End-to-End Validation

**Feature Branch**: `025-tui-e2e-validation`  
**Created**: 2026-02-04  
**Status**: ✅ Completed  
**Input**: `023-tui-console` (TUI 实现), `024-tui-integration-fix` (集成修复)

## 0. Executive Summary

| 指标 | 结果 |
|------|------|
| **总测试数** | 97 |
| **通过** | 97 (100%) |
| **失败** | 0 |
| **完整测试套件** | 697 tests (600 unit + 97 e2e) |
| **执行时间** | ~1.3s |
| **发现问题** | 2 (1 P1 CRUD 缺失, 1 P2 documented) |

## 1. Problem Essence (核心问题)

TUI Console 已完成基础实现和集成修复（600 tests pass），但缺乏从用户真实使用场景出发的端到端验证。需要系统性地测试每一个功能、每一个接口，覆盖完整的用户操作流程。

**目标**: 
1. 从用户视角验证所有功能的可用性
2. 覆盖数据 CRUD 等所有操作场景
3. 发现潜在问题并记录，统一修复
4. 确保 TUI 可以作为日常管理工具使用

## 2. Validation Scope (验证范围)

### 2.1 功能模块清单

| 模块 | 命令/功能 | 优先级 | 状态 |
|------|----------|--------|------|
| **连接管理** | `--url`, `--token`, 健康检查 | P0 | ✅ |
| **OmniBar** | 命令补全、资源选择、Tab 补全 | P0 | ✅ |
| **Collections** | `/cols`, 列表显示、导航 | P0 | ✅ |
| **Schema** | `/schema @col`, 字段显示 | P0 | ✅ |
| **Records 查询** | `/view @col`, 分页、过滤、排序 | P0 | ✅ |
| **Records 详情** | `/get @col:id`, JSON 显示 | P0 | ✅ |
| **Logs** | `/logs`, 级别过滤、实时流 | P1 | ✅ |
| **Monitor** | `/monitor`, 指标显示、刷新 | P1 | ✅ |
| **Health** | `/health`, 状态检查 | P1 | ✅ |
| **Help** | `/help`, `/help <cmd>` | P1 | ✅ |
| **Clear** | `/clear`, 清屏 | P2 | ✅ |
| **Quit** | `/quit`, `/q`, `Ctrl+C` | P2 | ✅ |
| **快捷键** | `Esc`, `?`, `r`, 导航键 | P1 | ✅ |
| **Records 新增** | `/create @col` | P0 | ❌ 未实现 |
| **Records 修改** | `/edit @col:id` | P0 | ❌ 未实现 |
| **Records 删除** | `/delete @col:id` | P0 | ❌ 未实现 |

### 2.2 API 端点清单

| 端点 | 方法 | 用途 | 测试场景 |
|------|------|------|---------|
| `/api/health` | GET | 健康检查 | 启动、重连 |
| `/api/collections` | GET | 获取集合列表 | `/cols` 命令 |
| `/api/collections/:name` | GET | 获取单个集合 | `/schema` 命令 |
| `/api/collections/:col/records` | GET | 记录列表 | `/view` 命令 |
| `/api/collections/:col/records/:id` | GET | 单条记录 | `/get` 命令 |
| `/api/collections/:col/records` | POST | 创建记录 | `/create` 命令 (❌ 未实现) |
| `/api/collections/:col/records/:id` | PATCH | 更新记录 | `/edit` 命令 (❌ 未实现) |
| `/api/collections/:col/records/:id` | DELETE | 删除记录 | `/delete` 命令 (❌ 未实现) |
| `/api/logs` | GET | 日志列表 | `/logs` 命令 |
| `/api/system/metrics` | GET | 系统指标 | `/monitor` 命令 |

## 3. Test Scenarios (测试场景)

### Epic 1: 启动与连接 (Startup & Connection)

#### STORY-1.1: 基础启动

**目标**: 验证 TUI 可以正常启动并连接到 PocketBase

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-1.1.1 默认启动 | `bun run dev` | 连接 http://127.0.0.1:8090，显示 "Connected" | ⏳ |
| S-1.1.2 指定 URL | `bun run dev -- --url http://localhost:8090` | 连接指定地址 | ⏳ |
| S-1.1.3 带 Token | `bun run dev -- --token <token>` | 显示 Token 指示器 "****" | ⏳ |
| S-1.1.4 无效 URL | `bun run dev -- --url http://invalid:9999` | 显示连接失败错误 | ⏳ |

#### STORY-1.2: 认证验证

**目标**: 验证 Token 认证是否正常工作

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-1.2.1 无 Token 访问受保护 API | 启动后执行 `/cols` | 返回 401 错误提示 | ⏳ |
| S-1.2.2 有效 Token | 带 superuser token 启动 | Collections 正常显示 | ⏳ |
| S-1.2.3 过期 Token | 使用过期 token | 显示认证失败提示 | ⏳ |

---

### Epic 2: OmniBar 交互 (OmniBar Interaction)

#### STORY-2.1: 命令补全

**目标**: 验证 OmniBar 命令输入和补全功能

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-2.1.1 输入 `/` | 在 OmniBar 输入 `/` | 显示命令列表提示 | ⏳ |
| S-2.1.2 部分输入 | 输入 `/v` | 过滤显示 `/view` | ⏳ |
| S-2.1.3 Tab 补全 | 输入 `/v` 后按 Tab | 补全为 `/view` | ⏳ |
| S-2.1.4 Enter 执行 | 输入完整命令后按 Enter | 执行命令 | ⏳ |

#### STORY-2.2: 资源选择

**目标**: 验证 `@resource` 语法和补全

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-2.2.1 输入 `@` | 在命令后输入 `@` | 显示 Collections 列表 | ⏳ |
| S-2.2.2 资源过滤 | 输入 `@u` | 过滤匹配 `u` 开头的集合 | ⏳ |
| S-2.2.3 Tab 补全资源 | 选中资源后按 Tab | 补全为 `@users` | ⏳ |
| S-2.2.4 带 ID 的资源 | 输入 `@users:abc123` | 解析为 collection:id 形式 | ⏳ |

#### STORY-2.3: 错误处理

**目标**: 验证输入错误的处理

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-2.3.1 无效命令 | 输入 `/invalid` | 显示 "Unknown command" | ⏳ |
| S-2.3.2 缺少参数 | 输入 `/view` 无资源 | 显示参数缺失提示 | ⏳ |
| S-2.3.3 不存在的资源 | `/view @nonexistent` | 显示 "Collection not found" | ⏳ |
| S-2.3.4 空输入 | 按 Enter 无内容 | 忽略，保持当前状态 | ⏳ |

---

### Epic 3: Collections 浏览 (Collections Browsing)

#### STORY-3.1: Collections 列表

**目标**: 验证 `/cols` 命令和列表显示

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-3.1.1 执行 /cols | 输入 `/cols` 回车 | 显示所有 Collections 表格 | ⏳ |
| S-3.1.2 表格列 | 查看表格 | 显示 Name, Type, Records 列 | ⏳ |
| S-3.1.3 系统集合 | 查看列表 | 包含 `_superusers`, `users` 等 | ⏳ |
| S-3.1.4 类型标识 | 查看 Type 列 | 正确显示 base/auth/view | ⏳ |

#### STORY-3.2: Collections 导航

**目标**: 验证列表中的键盘导航

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-3.2.1 上下导航 | 按 ↑/↓ 键 | 选中项高亮移动 | ⏳ |
| S-3.2.2 选中 Enter | 选中后按 Enter | 进入该集合的 Records 视图 | ⏳ |
| S-3.2.3 Esc 返回 | 在列表中按 Esc | 返回 Dashboard | ⏳ |

---

### Epic 4: Schema 查看 (Schema View)

#### STORY-4.1: Schema 显示

**目标**: 验证 `/schema @col` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-4.1.1 执行命令 | `/schema @users` | 显示 users 的 Schema | ⏳ |
| S-4.1.2 字段列表 | 查看显示 | 显示字段名、类型、必填、唯一 | ⏳ |
| S-4.1.3 系统集合 Schema | `/schema @_superusers` | 显示 _superusers 字段 | ⏳ |
| S-4.1.4 不存在的集合 | `/schema @invalid` | 显示错误提示 | ⏳ |

#### STORY-4.2: API Rules 显示

**目标**: 验证 API Rules 信息

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-4.2.1 查看 Rules | 在 Schema 视图中 | 显示 list/view/create/update/delete rules | ⏳ |
| S-4.2.2 空 Rules | 查看无 rules 的集合 | 显示 "null" 或 "-" | ⏳ |

---

### Epic 5: Records 查询 (Records Query)

#### STORY-5.1: Records 列表

**目标**: 验证 `/view @col` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-5.1.1 执行命令 | `/view @users` | 显示 users 表格 | ⏳ |
| S-5.1.2 表格列 | 查看表格 | 显示 id, created 等列 | ⏳ |
| S-5.1.3 空集合 | `/view @empty_collection` | 显示 "No records found" | ⏳ |
| S-5.1.4 系统集合 | `/view @_superusers` | 显示 superuser 记录 | ⏳ |

#### STORY-5.2: 分页

**目标**: 验证分页功能

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-5.2.1 默认分页 | `/view @logs_table` (假设 >20 条) | 显示第 1 页，每页 20 条 | ⏳ |
| S-5.2.2 指定页码 | `/view @logs_table page=2` | 显示第 2 页 | ⏳ |
| S-5.2.3 指定每页数 | `/view @logs_table perPage=50` | 每页显示 50 条 | ⏳ |
| S-5.2.4 Page Down | 在表格中按 Page Down | 切换到下一页 | ⏳ |
| S-5.2.5 Page Up | 在表格中按 Page Up | 切换到上一页 | ⏳ |

#### STORY-5.3: 过滤

**目标**: 验证 filter 参数

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-5.3.1 等值过滤 | `/view @users filter="verified=true"` | 只显示 verified=true 的记录 | ⏳ |
| S-5.3.2 日期过滤 | `/view @posts filter="created>'2024-01-01'"` | 显示 2024 年后的记录 | ⏳ |
| S-5.3.3 无效过滤 | `/view @users filter="invalid==="` | 显示语法错误提示 | ⏳ |
| S-5.3.4 无结果 | `/view @users filter="email='nonexistent@x.com'"` | 显示 "No records found" | ⏳ |

#### STORY-5.4: 排序

**目标**: 验证 sort 参数

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-5.4.1 升序排序 | `/view @users sort="created"` | 按 created 升序 | ⏳ |
| S-5.4.2 降序排序 | `/view @users sort="-created"` | 按 created 降序 | ⏳ |
| S-5.4.3 多字段排序 | `/view @users sort="name,-created"` | 先按 name 升序，再按 created 降序 | ⏳ |

---

### Epic 6: 单条记录 (Single Record)

#### STORY-6.1: 获取记录

**目标**: 验证 `/get @col:id` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-6.1.1 获取存在的记录 | `/get @users:<valid_id>` | 显示完整 JSON | ⏳ |
| S-6.1.2 不存在的 ID | `/get @users:invalid_id` | 显示 "Record not found" | ⏳ |
| S-6.1.3 不存在的集合 | `/get @invalid:id` | 显示 "Collection not found" | ⏳ |

#### STORY-6.2: 记录详情显示

**目标**: 验证记录详情的展示格式

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-6.2.1 JSON 格式 | 查看记录详情 | 格式化的 JSON 显示 | ⏳ |
| S-6.2.2 系统字段 | 查看详情 | 包含 id, created, updated | ⏳ |
| S-6.2.3 复杂字段 | 包含 relation/file 的记录 | 正确显示复杂字段值 | ⏳ |

---

### Epic 7: 日志查看 (Logs View)

#### STORY-7.1: 日志流

**目标**: 验证 `/logs` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-7.1.1 执行命令 | `/logs` | 切换到日志视图 | ⏳ |
| S-7.1.2 日志格式 | 查看日志条目 | 显示时间戳、级别、消息 | ⏳ |
| S-7.1.3 颜色编码 | 查看不同级别 | error=红, warn=黄, info=蓝 | ⏳ |
| S-7.1.4 无日志 | 空日志时 | 显示 "No logs available" | ⏳ |

#### STORY-7.2: 级别过滤

**目标**: 验证日志级别过滤

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-7.2.1 过滤 error | `/logs level=error` | 只显示 error 级别 | ⏳ |
| S-7.2.2 过滤 warn | `/logs level=warn` | 只显示 warn 级别 | ⏳ |
| S-7.2.3 过滤 info | `/logs level=info` | 只显示 info 级别 | ⏳ |
| S-7.2.4 快捷键过滤 | 在视图中按 `e`/`w`/`i`/`a` | 切换过滤级别 | ⏳ |

---

### Epic 8: 系统监控 (System Monitor)

#### STORY-8.1: 监控仪表盘

**目标**: 验证 `/monitor` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-8.1.1 执行命令 | `/monitor` | 切换到监控视图 | ⏳ |
| S-8.1.2 CPU 指标 | 查看 CPU | 显示 CPU 使用百分比 | ⏳ |
| S-8.1.3 内存指标 | 查看内存 | 显示内存占用 MB | ⏳ |
| S-8.1.4 Goroutines | 查看 goroutines | 显示 goroutine 数量 | ⏳ |

#### STORY-8.2: 指标刷新

**目标**: 验证指标更新

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-8.2.1 手动刷新 | 按 `r` 键 | 指标数据更新 | ⏳ |
| S-8.2.2 数值变化 | 等待后刷新 | 显示新的指标值 | ⏳ |

---

### Epic 9: 通用命令 (General Commands)

#### STORY-9.1: Health 检查

**目标**: 验证 `/health` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-9.1.1 正常状态 | `/health` | 显示 "API is healthy" | ⏳ |
| S-9.1.2 服务断开 | 断开服务后执行 | 显示连接失败 | ⏳ |

#### STORY-9.2: Help 命令

**目标**: 验证 `/help` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-9.2.1 全部帮助 | `/help` | 显示所有命令列表 | ⏳ |
| S-9.2.2 单命令帮助 | `/help view` | 显示 /view 的详细说明 | ⏳ |
| S-9.2.3 无效命令帮助 | `/help invalid` | 显示 "Command not found" | ⏳ |

#### STORY-9.3: 退出命令

**目标**: 验证退出功能

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-9.3.1 /quit | 执行 `/quit` | 程序退出 | ⏳ |
| S-9.3.2 /q | 执行 `/q` | 程序退出 | ⏳ |
| S-9.3.3 Ctrl+C | 按 Ctrl+C | 程序退出 | ⏳ |

#### STORY-9.4: 清屏

**目标**: 验证 `/clear` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-9.4.1 清屏 | `/clear` | 清空消息区域 | ⏳ |

---

### Epic 10: 快捷键 (Keyboard Shortcuts)

#### STORY-10.1: 全局快捷键

**目标**: 验证全局快捷键

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-10.1.1 Esc 返回 | 在任意视图按 Esc | 返回 Dashboard | ⏳ |
| S-10.1.2 ? 帮助 | 按 `?` | 显示 Help 视图 | ⏳ |
| S-10.1.3 Ctrl+C 退出 | 按 Ctrl+C | 退出程序 | ⏳ |

#### STORY-10.2: 导航快捷键

**目标**: 验证列表/表格中的导航

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-10.2.1 ↑/↓ 导航 | 在列表中按 ↑/↓ | 上下移动选中项 | ⏳ |
| S-10.2.2 Page Up/Down | 在表格中按 | 翻页 | ⏳ |
| S-10.2.3 Home/End | 在列表中按 | 跳转首/末项 | ⏳ |

---

### Epic 11: 边界情况 (Edge Cases)

#### STORY-11.1: 网络错误

**目标**: 验证网络异常处理

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-11.1.1 服务不可达 | 关闭 PocketBase 后操作 | 显示连接错误提示 | ⏳ |
| S-11.1.2 超时 | 模拟网络延迟 | 显示 loading 状态 | ⏳ |
| S-11.1.3 401 未授权 | 无 token 访问受保护资源 | 显示认证错误 | ⏳ |
| S-11.1.4 404 不存在 | 访问不存在的资源 | 显示 Not Found | ⏳ |

#### STORY-11.2: 数据边界

**目标**: 验证特殊数据情况

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-11.2.1 空集合 | 查看无记录的集合 | 显示 "No records" | ⏳ |
| S-11.2.2 大数据量 | 查看 1000+ 记录的集合 | 分页正常工作 | ⏳ |
| S-11.2.3 特殊字符 | 记录含特殊字符 | 正确显示不破坏布局 | ⏳ |
| S-11.2.4 长文本 | 字段值很长 | 截断显示 | ⏳ |
| S-11.2.5 空字段 | 字段值为 null/空 | 显示 "-" 或空 | ⏳ |

#### STORY-11.3: 输入边界

**目标**: 验证特殊输入处理

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-11.3.1 空输入 | Enter 无内容 | 忽略，不执行 | ⏳ |
| S-11.3.2 只有空格 | 输入纯空格 | 忽略，不执行 | ⏳ |
| S-11.3.3 超长输入 | 输入 1000+ 字符 | 正常处理或截断 | ⏳ |
| S-11.3.4 特殊字符输入 | 输入 emoji/unicode | 正确处理 | ⏳ |

---

### Epic 12: CRUD 操作 (❌ 未实现 - 需要 026-tui-crud)

> **重要**: 以下场景在当前 TUI 中**未实现**，已创建 `026-tui-crud` spec 进行开发。

#### STORY-12.1: 创建记录 (Create)

**目标**: 验证 `/create @col` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-12.1.1 进入创建模式 | `/create @posts` | 显示交互式表单 | ❌ 未实现 |
| S-12.1.2 填写必填字段 | 填写 title | 字段值被记录 | ❌ 未实现 |
| S-12.1.3 提交创建 | 按 Ctrl+S 或确认 | 记录创建成功，显示新 ID | ❌ 未实现 |
| S-12.1.4 取消创建 | 按 Esc | 返回上一视图，无数据变更 | ❌ 未实现 |
| S-12.1.5 必填校验 | 不填必填字段直接提交 | 显示验证错误 | ❌ 未实现 |

#### STORY-12.2: 编辑记录 (Update)

**目标**: 验证 `/edit @col:id` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-12.2.1 进入编辑模式 | `/edit @posts:<id>` | 显示表单，预填当前值 | ❌ 未实现 |
| S-12.2.2 修改字段 | 修改 title 值 | 字段值更新 | ❌ 未实现 |
| S-12.2.3 提交修改 | 按 Ctrl+S | 记录更新成功 | ❌ 未实现 |
| S-12.2.4 取消修改 | 按 Esc | 返回，无数据变更 | ❌ 未实现 |
| S-12.2.5 编辑不存在的记录 | `/edit @posts:invalid` | 显示 "Record not found" | ❌ 未实现 |

#### STORY-12.3: 删除记录 (Delete)

**目标**: 验证 `/delete @col:id` 命令

| 场景 | 步骤 | 预期结果 | 状态 |
|------|------|---------|------|
| S-12.3.1 删除确认 | `/delete @posts:<id>` | 显示确认提示 | ❌ 未实现 |
| S-12.3.2 确认删除 | 输入 `y` 或按 Enter | 记录删除成功 | ❌ 未实现 |
| S-12.3.3 取消删除 | 输入 `n` 或按 Esc | 取消操作 | ❌ 未实现 |
| S-12.3.4 强制删除 | `/delete @posts:<id> -f` | 直接删除，无确认 | ❌ 未实现 |
| S-12.3.5 批量删除 | `/delete @posts:<id1>,<id2>` | 批量删除多条 | ❌ 未实现 |
| S-12.3.6 删除不存在的记录 | `/delete @posts:invalid` | 显示 "Record not found" | ❌ 未实现 |

---

## 4. Test Data Setup (测试数据准备)

### 4.1 必要的测试集合

在开始测试前，确保 PocketBase 中存在以下数据：

```bash
# 1. 系统集合（自带）
- _superusers
- _mfas
- _otps
- _externalAuths
- _authOrigins
- users

# 2. 测试数据集合（需创建）
- posts (base 类型，用于测试 CRUD)
  - title: text, required
  - content: text
  - published: bool
  - author: relation to users

- tags (base 类型)
  - name: text, required, unique
```

### 4.2 测试用户

```bash
# Superuser (用于认证)
email: test@test.com
password: test123456

# 普通用户（用于 users 集合测试）
- 至少 3 条记录用于分页测试
```

### 4.3 获取认证 Token

```bash
# 获取 superuser token
curl -X POST "http://127.0.0.1:8090/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d '{"identity":"test@test.com","password":"test123456"}'
```

## 5. Issue Recording Template (问题记录模板)

验证过程中发现的问题记录格式：

```markdown
### Issue #N: [简短描述]

**场景**: S-X.X.X
**严重程度**: P0/P1/P2
**状态**: Open/Fixed/Won't Fix

**复现步骤**:
1. 
2. 
3. 

**预期结果**:
[描述]

**实际结果**:
[描述]

**截图/日志**:
[如有]

**根因分析**:
[修复时填写]

**修复方案**:
[修复时填写]
```

## 6. Success Criteria (成功标准)

| 标准 | 要求 |
|------|------|
| P0 场景通过率 | 100% |
| P1 场景通过率 | ≥ 95% |
| P2 场景通过率 | ≥ 90% |
| 无阻塞性问题 | 所有 P0 问题已修复 |
| 可用性验证 | 能完成日常管理任务 |

## 7. Execution Plan (执行计划)

| 阶段 | 内容 | 预计时间 |
|------|------|---------|
| 准备 | 启动 PocketBase，准备测试数据 | 15min |
| Epic 1-2 | 启动连接 + OmniBar | 30min |
| Epic 3-4 | Collections + Schema | 20min |
| Epic 5-6 | Records 查询 + 详情 | 45min |
| Epic 7-8 | Logs + Monitor | 20min |
| Epic 9-10 | 通用命令 + 快捷键 | 20min |
| Epic 11 | 边界情况 | 30min |
| 问题汇总 | 整理所有发现的问题 | 15min |
| 修复 | 逐个修复问题 | Variable |

## 8. Output (产出物)

1. **验证报告**: `tasks.md` 中记录每个场景的测试结果
2. **问题清单**: 所有发现的问题及状态
3. **修复记录**: 每个问题的修复方案和代码变更
4. **更新的测试用例**: 为新发现的场景补充单元测试
