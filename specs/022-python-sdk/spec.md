# PocketBase Python SDK 规范

> **项目代号**: PyPocket
> **愿景**: 为 Python 开发者提供类型安全、Pythonic、TDD 驱动的 PocketBase 客户端
> **开发哲学**: TDD First, Type Safe, Pythonic

## 1. 项目概述

### 1.1 背景

PocketBase 官方提供了 JavaScript SDK，但 Python 生态系统中缺乏一个官方的、高质量的 SDK。Python 作为后端开发、数据科学、AI/ML 领域的主流语言，需要一个完整、类型安全的 PocketBase 客户端。

### 1.2 目标

构建一个与 JavaScript SDK 功能对等的 Python SDK：
- 100% API 覆盖率（与 jssdk 功能对等）
- 完整的类型标注（支持 mypy 严格模式）
- TDD 开发流程（95%+ 测试覆盖率）
- Pythonic 设计（遵循 PEP 8、PEP 484）
- 同步/异步双 API 支持

### 1.3 核心价值

| 维度 | JavaScript SDK | Python SDK (PyPocket) |
|------|---------------|----------------------|
| 类型系统 | TypeScript 泛型 | Python Type Hints + Generic |
| 异步模型 | Promise/async-await | asyncio + 同步包装 |
| Auth 存储 | LocalStorage/Memory | 文件/内存/自定义 |
| HTTP 客户端 | fetch | httpx (sync + async) |
| 实时订阅 | EventSource | httpx-sse |
| 包管理 | npm | pip/poetry/uv |

---

## 2. 架构决策记录 (ADR)

### ADR-001: HTTP 客户端选择
- **决策**: 使用 `httpx` 作为 HTTP 客户端
- **理由**: 原生支持 sync/async、HTTP/2、连接池、SSE

### ADR-002: 类型系统
- **决策**: 使用 Python 3.10+ 类型标注 + Pydantic v2 数据模型
- **理由**: 
  - Python 3.10+ 支持 `T | None` 语法
  - Pydantic v2 性能优异，序列化/反序列化便捷

### ADR-003: 异步架构
- **决策**: 提供 `PocketBase` (sync) 和 `AsyncPocketBase` (async) 双客户端
- **理由**: 兼顾脚本用户和异步框架（FastAPI、asyncio）用户

### ADR-004: 认证存储
- **决策**: 
  - `MemoryAuthStore` (默认)
  - `FileAuthStore` (持久化)
  - `BaseAuthStore` (可扩展基类)
- **理由**: Python 无 LocalStorage，需要提供文件和内存两种方案

### ADR-005: 实时订阅
- **决策**: 使用 `httpx-sse` 实现 Server-Sent Events
- **理由**: 与 httpx 生态一致，支持断线重连

### ADR-006: 项目结构
- **决策**: 使用 Poetry 管理依赖，pytest 测试框架
- **理由**: 现代 Python 最佳实践

### ADR-007: Python 版本
- **决策**: 支持 Python 3.10+
- **理由**: 
  - 3.10 引入了更简洁的联合类型语法 `X | Y`
  - 3.10 是当前 LTS 版本边界

---

## 3. 技术约束

### 3.1 必须实现
- 与 jssdk 完全对等的 API
- 完整的类型标注
- 同步 + 异步双 API
- 95%+ 代码测试覆盖率
- 完整的文档字符串 (docstring)

### 3.2 Python 最佳实践
- 遵循 PEP 8 代码风格
- 遵循 PEP 484 类型标注
- 使用 `ruff` 进行 lint 和格式化
- 使用 `mypy` 进行静态类型检查
- 使用 `pytest` + `pytest-asyncio` 进行测试

### 3.3 性能指标
- 单请求延迟 < 5ms（不含网络）
- 内存占用 < 50MB（基础使用）
- 支持 1000+ 并发实时订阅

---

## 4. 模块设计

### 4.1 目录结构

采用 Python 社区主流的独立 `tests/` 目录结构，测试目录镜像源码结构：

```
pythonsdk/
├── src/
│   └── pocketbase/               # 源码包
│       ├── __init__.py           # 公共 API 导出
│       ├── py.typed              # PEP 561 类型标记
│       ├── client.py             # PocketBase 同步客户端
│       ├── async_client.py       # AsyncPocketBase 异步客户端
│       ├── client_response_error.py  # 统一错误类
│       ├── services/
│       │   ├── __init__.py
│       │   ├── base_service.py   # 服务基类
│       │   ├── crud_service.py   # CRUD 服务基类
│       │   ├── record_service.py # Record CRUD + Auth
│       │   ├── collection_service.py
│       │   ├── file_service.py
│       │   ├── log_service.py
│       │   ├── settings_service.py
│       │   ├── realtime_service.py
│       │   ├── health_service.py
│       │   ├── backup_service.py
│       │   ├── cron_service.py
│       │   ├── batch_service.py
│       │   ├── jobs_service.py
│       │   ├── secrets_service.py
│       │   ├── analytics_service.py
│       │   └── trace_service.py
│       ├── stores/
│       │   ├── __init__.py
│       │   ├── base_auth_store.py
│       │   ├── memory_auth_store.py
│       │   └── file_auth_store.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── record.py         # RecordModel
│       │   ├── collection.py     # CollectionModel
│       │   ├── list_result.py    # ListResult[T]
│       │   └── auth.py           # AuthMethodsList, AuthProviderInfo
│       └── utils/
│           ├── __init__.py
│           ├── jwt.py            # JWT 解析
│           ├── filter.py         # filter() 参数绑定
│           └── options.py        # SendOptions 等
├── tests/                        # 独立测试目录（镜像 src 结构）
│   ├── __init__.py
│   ├── conftest.py               # pytest 全局 fixtures
│   ├── test_client.py
│   ├── test_async_client.py
│   ├── test_client_response_error.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── conftest.py           # services 专用 fixtures
│   │   ├── test_base_service.py
│   │   ├── test_crud_service.py
│   │   ├── test_record_service.py
│   │   ├── test_collection_service.py
│   │   ├── test_file_service.py
│   │   ├── test_log_service.py
│   │   ├── test_settings_service.py
│   │   ├── test_realtime_service.py
│   │   ├── test_health_service.py
│   │   ├── test_backup_service.py
│   │   ├── test_cron_service.py
│   │   ├── test_batch_service.py
│   │   ├── test_jobs_service.py
│   │   ├── test_secrets_service.py
│   │   ├── test_analytics_service.py
│   │   └── test_trace_service.py
│   ├── stores/
│   │   ├── __init__.py
│   │   ├── conftest.py           # stores 专用 fixtures
│   │   ├── test_base_auth_store.py
│   │   ├── test_memory_auth_store.py
│   │   └── test_file_auth_store.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── test_record.py
│   │   ├── test_collection.py
│   │   ├── test_list_result.py
│   │   └── test_auth.py
│   └── utils/
│       ├── __init__.py
│       ├── test_jwt.py
│       ├── test_filter.py
│       └── test_options.py
├── pyproject.toml                # Poetry/PDM 配置（src layout）
├── README.md
├── CHANGELOG.md
└── LICENSE
```

**目录结构说明**：

| 目录 | 用途 |
|------|------|
| `src/pocketbase/` | 源码包，使用 src layout（PEP 517 推荐） |
| `tests/` | 独立测试目录，镜像源码结构 |
| `tests/conftest.py` | pytest 全局 fixtures（如 mock httpx client） |
| `tests/*/conftest.py` | 子模块专用 fixtures |
| `py.typed` | PEP 561 标记，声明包含类型标注 |

**为什么使用 src layout？**

1. **隔离性**：防止意外导入本地开发代码（必须安装后才能 import）
2. **可测试性**：测试时导入的是已安装版本，更接近用户使用场景
3. **打包安全**：避免测试代码意外打进发布包
4. **社区主流**：requests, httpx, pydantic, rich 等知名项目均采用此结构

### 4.2 核心类型定义

```python
# models/record.py
from typing import Any
from pydantic import BaseModel

class RecordModel(BaseModel):
    """PocketBase Record 基础模型"""
    id: str = ""
    collection_id: str = ""
    collection_name: str = ""
    created: str = ""
    updated: str = ""
    
    class Config:
        extra = "allow"  # 允许额外字段

# models/list_result.py
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class ListResult(BaseModel, Generic[T]):
    """分页列表结果"""
    page: int
    per_page: int
    total_items: int
    total_pages: int
    items: list[T]
```

### 4.3 客户端 API 设计

```python
# 同步用法
from pocketbase import PocketBase

pb = PocketBase("http://127.0.0.1:8090")

# 认证
auth_data = pb.collection("users").auth_with_password("test@example.com", "123456")

# CRUD
records = pb.collection("posts").get_list(page=1, per_page=20)
record = pb.collection("posts").get_one("RECORD_ID")
new_record = pb.collection("posts").create({"title": "Hello"})
updated = pb.collection("posts").update("RECORD_ID", {"title": "Updated"})
pb.collection("posts").delete("RECORD_ID")

# 过滤器
records = pb.collection("posts").get_list(
    filter=pb.filter("status = {:status} && created > {:date}", {
        "status": True,
        "date": datetime.now()
    })
)

# 异步用法
from pocketbase import AsyncPocketBase
import asyncio

async def main():
    pb = AsyncPocketBase("http://127.0.0.1:8090")
    records = await pb.collection("posts").get_list()
    
asyncio.run(main())
```

---

## 5. API 对照表

### 5.1 Client 方法

| JavaScript SDK | Python SDK | 说明 |
|---------------|-----------|------|
| `new PocketBase(url, authStore?, lang?)` | `PocketBase(base_url, auth_store?, lang?)` | 构造函数 |
| `pb.collection(name)` | `pb.collection(name)` | 获取 RecordService |
| `pb.autoCancellation(enable)` | `pb.auto_cancellation(enable)` | 请求取消 |
| `pb.cancelAllRequests()` | `pb.cancel_all_requests()` | 取消所有请求 |
| `pb.cancelRequest(key)` | `pb.cancel_request(key)` | 取消单个请求 |
| `pb.buildURL(path)` | `pb.build_url(path)` | 构建完整 URL |
| `pb.send(path, options)` | `pb.send(path, options)` | 发送请求 |
| `pb.filter(expr, params)` | `pb.filter(expr, params)` | 构建过滤器 |
| `pb.beforeSend` | `pb.before_send` | 请求前钩子 |
| `pb.afterSend` | `pb.after_send` | 请求后钩子 |

### 5.2 RecordService 方法

| JavaScript SDK | Python SDK | 说明 |
|---------------|-----------|------|
| `getList(page, perPage, options?)` | `get_list(page, per_page, **options)` | 分页列表 |
| `getFullList(options?)` | `get_full_list(**options)` | 全量列表 |
| `getFirstListItem(filter, options?)` | `get_first_list_item(filter, **options)` | 首条记录 |
| `getOne(id, options?)` | `get_one(id, **options)` | 单条记录 |
| `create(body, options?)` | `create(body, **options)` | 创建 |
| `update(id, body, options?)` | `update(id, body, **options)` | 更新 |
| `delete(id, options?)` | `delete(id, **options)` | 删除 |
| `subscribe(topic, callback, options?)` | `subscribe(topic, callback, **options)` | 实时订阅 |
| `unsubscribe(topic?)` | `unsubscribe(topic?)` | 取消订阅 |

### 5.3 Auth 方法

| JavaScript SDK | Python SDK | 说明 |
|---------------|-----------|------|
| `authWithPassword(identity, password, options?)` | `auth_with_password(identity, password, **options)` | 密码认证 |
| `authWithOAuth2(options)` | `auth_with_oauth2(options)` | OAuth2 认证 |
| `authWithOAuth2Code(...)` | `auth_with_oauth2_code(...)` | OAuth2 Code 认证 |
| `authWithOTP(otpId, password, options?)` | `auth_with_otp(otp_id, password, **options)` | OTP 认证 |
| `authRefresh(options?)` | `auth_refresh(**options)` | 刷新 Token |
| `requestPasswordReset(email, options?)` | `request_password_reset(email, **options)` | 请求重置密码 |
| `confirmPasswordReset(...)` | `confirm_password_reset(...)` | 确认重置密码 |
| `requestVerification(email, options?)` | `request_verification(email, **options)` | 请求验证邮件 |
| `confirmVerification(token, options?)` | `confirm_verification(token, **options)` | 确认验证 |
| `requestEmailChange(newEmail, options?)` | `request_email_change(new_email, **options)` | 请求更改邮箱 |
| `confirmEmailChange(token, password, options?)` | `confirm_email_change(token, password, **options)` | 确认更改邮箱 |
| `requestOTP(email, options?)` | `request_otp(email, **options)` | 请求 OTP |
| `listAuthMethods(options?)` | `list_auth_methods(**options)` | 列出认证方法 |
| `impersonate(recordId, duration, options?)` | `impersonate(record_id, duration, **options)` | 模拟用户 |

### 5.4 其他服务

| 服务 | JavaScript | Python | 说明 |
|-----|-----------|--------|------|
| FileService | `pb.files.getURL(record, filename, options?)` | `pb.files.get_url(record, filename, **options)` | 文件 URL |
| CollectionService | `pb.collections.*` | `pb.collections.*` | 集合管理 |
| SettingsService | `pb.settings.*` | `pb.settings.*` | 设置管理 |
| LogService | `pb.logs.*` | `pb.logs.*` | 日志查询 |
| HealthService | `pb.health.check()` | `pb.health.check()` | 健康检查 |
| BackupService | `pb.backups.*` | `pb.backups.*` | 备份管理 |
| CronService | `pb.crons.*` | `pb.crons.*` | Cron 任务 |
| BatchService | `pb.createBatch()` | `pb.create_batch()` | 批量操作 |
| RealtimeService | `pb.realtime.*` | `pb.realtime.*` | 实时订阅 |

---

## 6. 错误处理

### 6.1 ClientResponseError

```python
class ClientResponseError(Exception):
    """PocketBase API 错误响应"""
    url: str = ""
    status: int = 0
    response: dict[str, Any] = {}
    is_abort: bool = False
    original_error: Exception | None = None
    
    @property
    def data(self) -> dict[str, Any]:
        """response 的别名，向后兼容"""
        return self.response
```

### 6.2 错误处理示例

```python
from pocketbase import PocketBase, ClientResponseError

pb = PocketBase("http://127.0.0.1:8090")

try:
    record = pb.collection("posts").get_one("invalid_id")
except ClientResponseError as e:
    print(f"Status: {e.status}")
    print(f"Message: {e.response.get('message')}")
    print(f"URL: {e.url}")
```

---

## 7. 风险评估

### 7.1 高风险项
1. **实时订阅断线重连**: SSE 连接稳定性
2. **OAuth2 浏览器流程**: Python 无法直接打开浏览器弹窗
3. **并发请求取消**: 需要实现请求 Key 机制

### 7.2 中风险项
1. **类型泛型**: Python Generic 与 TypeScript 差异
2. **文件上传**: FormData 构造差异
3. **Cookie 处理**: SSR 场景需要手动管理

### 7.3 低风险项
1. **CRUD 操作**: 标准 HTTP 请求
2. **Auth Store**: 简单状态管理
3. **Filter 构建**: 字符串处理

---

## 8. 里程碑规划

| 版本 | 代号 | 核心目标 |
|------|------|---------|
| v0.1 | 基础层 | Client + AuthStore + ClientResponseError + 单元测试 |
| v0.2 | CRUD 层 | RecordService + CollectionService CRUD 操作 |
| v0.3 | Auth 层 | 完整认证流程（密码、OAuth2、OTP） |
| v0.4 | 实时层 | Realtime SSE 订阅 |
| v0.5 | 完善层 | 其他服务（Files、Logs、Settings、Backup...） |
| v1.0 | 发布版 | 文档完善、PyPI 发布、CI/CD |

---

## 9. 依赖清单

### 9.1 运行时依赖

| 包名 | 版本 | 用途 |
|-----|------|------|
| httpx | >=0.25.0 | HTTP 客户端 |
| httpx-sse | >=0.4.0 | SSE 支持 |
| pydantic | >=2.0.0 | 数据模型 |

### 9.2 开发依赖

| 包名 | 版本 | 用途 |
|-----|------|------|
| pytest | >=8.0.0 | 测试框架 |
| pytest-asyncio | >=0.23.0 | 异步测试 |
| pytest-cov | >=4.0.0 | 覆盖率 |
| pytest-httpx | >=0.30.0 | httpx mock |
| mypy | >=1.8.0 | 类型检查 |
| ruff | >=0.2.0 | Lint + Format |
| pre-commit | >=3.6.0 | Git hooks |

---

## 10. TDD 开发规范

### 10.1 测试优先原则

每个功能必须：
1. 先编写测试用例（红灯 🔴）
2. 运行测试确认失败
3. 编写最小实现（绿灯 🟢）
4. 重构优化（保持绿灯）

### 10.2 测试覆盖率要求

| 类型 | 覆盖率要求 |
|------|----------|
| 语句覆盖 | >= 95% |
| 分支覆盖 | >= 90% |
| 公共 API | 100% |

### 10.3 测试文件命名

测试目录采用 Python 社区主流的独立 `tests/` 结构，镜像 `src/pocketbase/` 目录：

```
tests/
├── conftest.py                   # 全局 fixtures
├── test_client.py                # 测试 client.py
├── test_async_client.py          # 测试 async_client.py
├── test_client_response_error.py # 测试 client_response_error.py
├── services/
│   ├── conftest.py               # services 专用 fixtures
│   ├── test_base_service.py
│   ├── test_crud_service.py
│   └── test_record_service.py
├── stores/
│   ├── conftest.py               # stores 专用 fixtures
│   ├── test_base_auth_store.py
│   ├── test_memory_auth_store.py
│   └── test_file_auth_store.py
├── models/
│   └── test_record.py
└── utils/
    ├── test_jwt.py
    └── test_filter.py
```

**命名规则**：
- 测试文件：`test_<module_name>.py`
- 测试类：`Test<ClassName>`
- 测试函数：`test_<method_name>_<scenario>`

**conftest.py 层级**：
- `tests/conftest.py`：全局共享（mock httpx、PocketBase 实例）
- `tests/<subdir>/conftest.py`：子模块专用 fixtures

### 10.4 Mock 策略

- 使用 `pytest-httpx` mock HTTP 请求
- 不依赖真实 PocketBase 服务
- 测试数据与 jssdk 保持一致
