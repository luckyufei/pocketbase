# WebUI New Collection 功能验证清单

> 此文档用于验证 webui 版本的 New Collection 功能是否与 ui 版本完全对齐

## 验证方法

**同时打开两个界面进行对比测试：**
- UI 版本：`http://localhost:3000/_/`（原 Svelte 版本）
- WebUI 版本：`http://localhost:9000/`（新 React 版本）

---

## 1. Collection 类型选择

### 1.1 Base Collection
- [ ] 点击 "New collection" 按钮后默认选中 Base
- [ ] 图标和标签显示正确
- [ ] 初始化时包含 `id`、`created`、`updated` 三个系统字段
- [ ] 字段列表显示正确（系统字段有锁图标）

### 1.2 Auth Collection
- [ ] 切换到 Auth 类型后显示正确的图标和标签
- [ ] 初始化时包含以下系统字段：
  - [ ] `id` (Primary Key)
  - [ ] `password` (Password)
  - [ ] `tokenKey` (Text)
  - [ ] `email` (Email)
  - [ ] `emailVisibility` (Bool)
  - [ ] `verified` (Bool)
  - [ ] `created` (Autodate)
  - [ ] `updated` (Autodate)
- [ ] 显示 Options Tab（Auth 选项配置）
- [ ] 默认包含 tokenKey 和 email 的唯一索引

### 1.3 View Collection
- [ ] 切换到 View 类型后显示正确的图标和标签
- [ ] 显示 Query Tab
- [ ] 隐藏 Fields Tab（或显示为只读）
- [ ] API Rules Tab 不可用/隐藏

### 1.4 类型切换行为
- [ ] Base → Auth：保留用户添加的非系统字段
- [ ] Auth → Base：保留用户添加的非系统字段，移除 Auth 系统字段
- [ ] Any → View：清空字段列表
- [ ] View → Any：从新类型的 scaffold 重新初始化

---

## 2. Fields Tab（字段配置）

### 2.1 字段类型列表
验证所有字段类型都可选择：

| 字段类型 | UI ✓ | WebUI ✓ |
|---------|------|---------|
| Text | [ ] | [ ] |
| Editor (Rich text) | [ ] | [ ] |
| Number | [ ] | [ ] |
| Bool | [ ] | [ ] |
| Email | [ ] | [ ] |
| URL | [ ] | [ ] |
| Date | [ ] | [ ] |
| Select (Single/Multiple) | [ ] | [ ] |
| Relation (Single/Multiple) | [ ] | [ ] |
| File (Single/Multiple) | [ ] | [ ] |
| JSON | [ ] | [ ] |
| Password | [ ] | [ ] |
| Autodate (Create/Update) | [ ] | [ ] |
| GeoPoint | [ ] | [ ] |
| Secret | [ ] | [ ] |

### 2.2 字段通用选项
每种字段类型都验证以下通用选项：

- [ ] Required 开关
- [ ] Presentable 开关
- [ ] 字段名输入框
- [ ] 字段类型下拉框
- [ ] 展开/收起字段详情

### 2.3 各字段类型特有选项

#### Text 字段
- [ ] Min length
- [ ] Max length
- [ ] Pattern (正则)
- [ ] Autogenerate 开关

#### Editor 字段
- [ ] Convert URLs to links 开关

#### Number 字段
- [ ] Min value
- [ ] Max value
- [ ] Only integers 开关

#### Email 字段
- [ ] Except domains
- [ ] Only domains

#### URL 字段
- [ ] Except domains
- [ ] Only domains

#### Date 字段
- [ ] Min date
- [ ] Max date

#### Select 字段
- [ ] Values 输入（多值）
- [ ] Max select 数量

#### Relation 字段
- [ ] Collection 选择
- [ ] Max select 数量
- [ ] Cascade delete 开关
- [ ] Display fields（显示字段）

#### File 字段
- [ ] Max select 数量
- [ ] Max size (KB)
- [ ] MIME types
- [ ] Thumbs (缩略图尺寸)
- [ ] Protected 开关

#### JSON 字段
- [ ] Max size (Bytes)

#### Password 字段
- [ ] Min length
- [ ] Max length
- [ ] Pattern (正则)
- [ ] Cost (bcrypt)

#### Autodate 字段
- [ ] OnCreate 开关
- [ ] OnUpdate 开关

#### GeoPoint 字段
- [ ] 无特殊选项

#### Secret 字段
- [ ] Pattern (正则)
- [ ] Min length
- [ ] Max length
- [ ] Autogenerate 开关

### 2.4 字段操作
- [ ] 添加新字段
- [ ] 删除字段（非系统字段）
- [ ] 拖拽排序字段
- [ ] 复制字段（Duplicate）
- [ ] 重置字段名时自动 focus 到输入框
- [ ] 系统字段显示锁图标，不可删除

---

## 3. API Rules Tab（规则配置）

### 3.1 规则类型
验证所有规则类型都存在：

- [ ] List/Search rule
- [ ] View rule
- [ ] Create rule
- [ ] Update rule
- [ ] Delete rule
- [ ] Manage rule（仅 Auth Collection）

### 3.2 规则状态
- [ ] 锁定状态（Superusers only）- 显示锁图标
- [ ] 解锁状态（Everyone）- 输入框为空
- [ ] 自定义规则 - 显示输入框内容

### 3.3 规则编辑
- [ ] 点击锁图标可切换锁定/解锁状态
- [ ] 规则输入框支持代码高亮
- [ ] 规则输入框有自动补全
- [ ] 错误规则显示红色边框和错误信息

---

## 4. Indexes Tab（索引配置）

### 4.1 索引显示
- [ ] 显示已有索引列表
- [ ] 索引名称显示正确
- [ ] 索引类型显示（Unique Badge）
- [ ] 索引字段显示

### 4.2 索引操作
- [ ] 添加新索引
- [ ] 编辑现有索引
- [ ] 删除索引

### 4.3 索引编辑面板
- [ ] 索引名称输入
- [ ] Unique 开关
- [ ] 索引表达式输入框（SQL）
- [ ] Presets 快速选择（单行链接样式）
- [ ] 新建和编辑时都显示删除按钮
- [ ] 面板标题区分"New index"和"Edit index"

---

## 5. Options Tab（仅 Auth Collection）

### 5.1 Password Auth
- [ ] Enable 开关
- [ ] Identity fields 多选

### 5.2 OAuth2
- [ ] Enable 开关
- [ ] Providers 列表显示
- [ ] 已配置的 Provider 显示绿色对勾
- [ ] 点击 Provider 打开配置面板

### 5.3 OTP (One-Time Password)
- [ ] Enable 开关
- [ ] OTP 配置选项

### 5.4 MFA (Multi-Factor Authentication)
- [ ] Enable 开关
- [ ] Duration 配置
- [ ] Rule 配置

### 5.5 Auth Alert
- [ ] Enable 开关
- [ ] Email template 选择

### 5.6 Token Options
- [ ] Auth duration
- [ ] Email verification duration
- [ ] Password reset duration
- [ ] Email change duration
- [ ] Protected file access duration
- [ ] 每个 token 都有 "Invalidate all previously issued tokens" 链接
- [ ] 点击后颜色变绿

### 5.7 Email Templates
- [ ] Verification email 模板
- [ ] Password reset email 模板
- [ ] Email change email 模板

---

## 6. Query Tab（仅 View Collection）

- [ ] SQL 查询输入框
- [ ] 代码高亮（SQL 语法）
- [ ] 自动补全
- [ ] 执行查询按钮
- [ ] 查询结果预览

---

## 7. API Preview Tab

### 7.1 SDK 选项
- [ ] JavaScript SDK 代码示例
- [ ] Dart SDK 代码示例

### 7.2 API 操作文档
- [ ] List/Search API
- [ ] View API
- [ ] Create API
- [ ] Update API
- [ ] Delete API
- [ ] Auth APIs（仅 Auth Collection）

### 7.3 代码示例
- [ ] 代码块支持复制
- [ ] 代码高亮正确
- [ ] 示例参数与当前 Collection 匹配

---

## 8. 保存和更新

### 8.1 新建 Collection
- [ ] 输入名称后可保存
- [ ] 名称验证（格式、唯一性）
- [ ] 保存成功后关闭面板
- [ ] 左侧列表更新

### 8.2 编辑 Collection
- [ ] 加载现有配置
- [ ] 变更检测（标题显示 *）
- [ ] Ctrl+S 快捷保存
- [ ] 保存前确认弹窗（如有破坏性变更）

### 8.3 更新确认弹窗
- [ ] 显示变更摘要
- [ ] 字段变更详情（新增/删除/修改）
- [ ] 索引变更详情
- [ ] 规则变更详情
- [ ] 确认/取消按钮

### 8.4 未保存警告
- [ ] 有未保存更改时按 Escape 显示警告
- [ ] 切换 Collection 时显示警告
- [ ] 关闭面板时显示警告

---

## 9. 错误处理

### 9.1 表单验证错误
- [ ] 字段名重复错误
- [ ] 字段名格式错误
- [ ] Collection 名称错误
- [ ] 规则语法错误
- [ ] 索引语法错误

### 9.2 API 错误
- [ ] 网络错误提示
- [ ] 服务端验证错误提示
- [ ] 错误字段高亮

### 9.3 Tab 错误指示器
- [ ] Fields Tab 有错误时显示红点
- [ ] Rules Tab 有错误时显示红点
- [ ] Indexes Tab 有错误时显示红点
- [ ] Options Tab 有错误时显示红点

---

## 10. UI/UX 细节

### 10.1 样式对齐
- [ ] 按钮样式一致
- [ ] 输入框样式一致
- [ ] 开关（Toggle）样式一致
- [ ] Tab 样式一致
- [ ] 颜色方案一致

### 10.2 动画效果
- [ ] 面板打开/关闭动画
- [ ] 折叠/展开动画
- [ ] 加载动画

### 10.3 响应式
- [ ] 小屏幕适配
- [ ] 大屏幕适配

### 10.4 可访问性
- [ ] 键盘导航
- [ ] Tab 顺序正确
- [ ] Focus 状态可见

---

## 11. 特殊场景

### 11.1 _superusers Collection
- [ ] 不允许删除
- [ ] 部分选项受限
- [ ] 显示系统 Collection 标识

### 11.2 系统 Collection
- [ ] 显示系统标识
- [ ] 部分操作受限

### 11.3 大量数据
- [ ] 大量字段时性能正常
- [ ] 大量索引时性能正常
- [ ] 大量 Collection 时侧边栏性能正常

---

## 验证结果汇总

### 代码分析结果（自动验证 - 2026-02-05）

| 模块 | 状态 | 备注 |
|------|------|------|
| Collection 类型选择 | ✅ 对齐 | Base/Auth/View 三种类型，类型切换逻辑完整 |
| Fields Tab | ✅ 对齐 | 15种字段类型全部实现，选项完整 |
| API Rules Tab | ✅ 对齐 | 6种规则类型，Auth额外规则(authRule/manageRule) |
| Indexes Tab | ✅ 对齐 | 索引列表显示、新增/编辑/删除功能 |
| Options Tab | ✅ 对齐 | Password/OAuth2/OTP/MFA/AuthAlert/TokenOptions/MailTemplates |
| Query Tab | ✅ 对齐 | SQL编辑器，语法高亮，自动补全 |
| API Preview Tab | ⚠️ 待验证 | 需要手动测试 SDK 代码示例 |
| 保存和更新 | ✅ 对齐 | 变更检测、确认弹窗、Ctrl+S快捷键 |
| 错误处理 | ✅ 对齐 | 表单验证、API错误映射、Tab错误指示器 |
| UI/UX 细节 | ⚠️ 待验证 | 需要手动对比样式细节 |
| 特殊场景 | ⚠️ 待验证 | 需要手动测试 _superusers 等系统集合 |

### 手动测试结果（待填写）

| 模块 | 总项数 | 通过 | 失败 | 备注 |
|------|--------|------|------|------|
| Collection 类型选择 | - | - | - | |
| Fields Tab | - | - | - | |
| API Rules Tab | - | - | - | |
| Indexes Tab | - | - | - | |
| Options Tab | - | - | - | |
| Query Tab | - | - | - | |
| API Preview Tab | - | - | - | |
| 保存和更新 | - | - | - | |
| 错误处理 | - | - | - | |
| UI/UX 细节 | - | - | - | |
| 特殊场景 | - | - | - | |
| **总计** | - | - | - | |

---

## 发现的问题记录

### 高优先级 (P0)
| 编号 | 问题描述 | 影响范围 | 状态 |
|------|----------|----------|------|
| | | | |

### 中优先级 (P1)
| 编号 | 问题描述 | 影响范围 | 状态 |
|------|----------|----------|------|
| | | | |

### 低优先级 (P2)
| 编号 | 问题描述 | 影响范围 | 状态 |
|------|----------|----------|------|
| | | | |

---

## 验证完成签字

- [ ] 功能测试完成
- [ ] UI 对比完成
- [ ] 回归测试完成

**验证人**: _______________
**日期**: _______________
