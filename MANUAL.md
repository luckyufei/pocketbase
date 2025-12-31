# PocketBase 完整指南

PocketBase 是一个开源的后端解决方案，将嵌入式数据库（SQLite）、实时订阅、内置身份验证管理、便捷的管理仪表板 UI 和简单的 REST API 集成在一个可执行文件中。它既可以作为 Go 框架使用，也可以作为独立应用程序运行。

---

## 目录

1. [快速开始](#快速开始)
2. [核心概念](#核心概念)
3. [Collections（集合）](#collections集合)
4. [身份验证](#身份验证)
5. [API 规则与过滤器](#api-规则与过滤器)
6. [文件处理](#文件处理)
7. [关系处理](#关系处理)
8. [实时 API](#实时-api)
9. [扩展 PocketBase](#扩展-pocketbase)
10. [数据库操作](#数据库操作)
11. [迁移系统](#迁移系统)
12. [生产部署](#生产部署)

---

## 快速开始

### 安装与运行

```bash
# 下载对应平台的预编译可执行文件后
./pocketbase serve

# 创建超级用户
./pocketbase superuser create EMAIL PASS

# 启动带自动 TLS 的 HTTPS 服务器
./pocketbase serve yourdomain.com
```

### 默认路由

| 路由 | 描述 |
|------|------|
| `http://127.0.0.1:8090` | 静态文件服务（如果存在 `pb_public` 目录） |
| `http://127.0.0.1:8090/_/` | 超级用户管理仪表板 |
| `http://127.0.0.1:8090/api/` | REST API |

### 目录结构

| 目录 | 描述 |
|------|------|
| `pb_data` | 应用数据、上传文件（应加入 `.gitignore`） |
| `pb_migrations` | JS 迁移文件（可提交到仓库） |
| `pb_hooks` | JavaScript 钩子文件（`*.pb.js`） |
| `pb_public` | 静态文件目录 |

---

## 核心概念

### 架构特点

- **完全无状态**：没有传统会话，令牌不存储在数据库中
- **单文件部署**：不需要外部依赖
- **嵌入式 SQLite**：默认使用纯 Go SQLite 移植版，不需要 CGO
- **实时订阅**：通过 Server-Sent Events (SSE) 实现

### 使用方式

1. **独立应用**：直接使用预编译可执行文件
2. **Go 框架**：导入 PocketBase 包，编写自定义业务逻辑
3. **JavaScript 扩展**：在 `pb_hooks` 目录中编写 `*.pb.js` 文件

---

## Collections（集合）

Collections 代表应用数据，底层由自动生成的 SQLite 表支持。

### 集合类型

| 类型 | 描述 |
|------|------|
| **Base** | 默认类型，存储任何应用数据 |
| **View** | 只读，数据从 SQL SELECT 语句填充，支持聚合查询 |
| **Auth** | 包含 Base 功能 + 用户认证特殊字段 |

### Auth 集合特殊字段

- `email` - 用户邮箱
- `emailVisibility` - 邮箱可见性
- `verified` - 验证状态
- `password` - 密码
- `tokenKey` - 令牌密钥

### 字段类型

| 类型 | 描述 | 默认值 | 修饰符 |
|------|------|--------|--------|
| `bool` | 布尔值 | `false` | - |
| `number` | 数字 | `0` | `+`（加）, `-`（减） |
| `text` | 字符串 | `""` | `:autogenerate` |
| `email` | 邮箱 | `""` | - |
| `url` | URL | `""` | - |
| `editor` | HTML 文本 | `""` | - |
| `date` | 日期时间 | `""` | 格式：`Y-m-d H:i:s.uZ` |
| `autodate` | 自动日期 | 自动 | 创建/更新时自动设置 |
| `select` | 预定义选项 | `""`/`[]` | `+`, `-` |
| `file` | 文件 | `""`/`[]` | `+`, `-` |
| `relation` | 关系引用 | `""`/`[]` | `+`, `-` |
| `json` | JSON 数据 | `null` | - |
| `geoPoint` | 地理坐标 | `{"lon":0,"lat":0}` | - |

---

## 身份验证

### 认证方式

#### 密码认证
```javascript
const authData = await pb.collection('users').authWithPassword('email', 'password');

// 访问认证数据
pb.authStore.isValid
pb.authStore.token
pb.authStore.record.id

// 登出
pb.authStore.clear();
```

#### OTP 认证
```javascript
const result = await pb.collection('users').requestOTP('email');
const authData = await pb.collection('users').authWithOTP(result.otpId, 'OTP_CODE');
```

#### OAuth2 认证
```javascript
const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
```

### 多因素认证（MFA）

```javascript
try {
    await pb.collection('users').authWithPassword('email', 'password');
} catch (err) {
    const mfaId = err.response?.mfaId;
    if (!mfaId) throw err;
    
    const result = await pb.collection('users').requestOTP('email');
    await pb.collection('users').authWithOTP(result.otpId, 'CODE', { mfaId });
}
```

### 用户模拟（超级用户）

```javascript
await pb.collection('_superusers').authWithPassword('admin', 'password');
const impersonateClient = await pb.collection('users').impersonate('USER_ID', 3600);
```

---

## API 规则与过滤器

### 规则类型

| 规则 | 描述 | 不满足时返回 |
|------|------|-------------|
| `listRule` | 列表访问 | 200 空列表 |
| `viewRule` | 查看记录 | 404 |
| `createRule` | 创建记录 | 400 |
| `updateRule` | 更新记录 | 404 |
| `deleteRule` | 删除记录 | 404 |

### 规则值

- `null`（锁定）：仅超级用户可执行
- 空字符串：任何人可执行
- 非空字符串：满足过滤表达式的用户可执行

### 过滤器语法

#### 可用字段

```javascript
// 集合字段
someField = "value"
someRelField.status != "pending"

// 请求数据
@request.auth.id != ""
@request.body.title != ""
@request.query.page = "1"
@request.headers.x_token = "test"

// 其他集合
@collection.news.categoryId ?= categoryId
```

#### 操作符

| 操作符 | 描述 |
|--------|------|
| `=`, `!=` | 等于/不等于 |
| `>`, `>=`, `<`, `<=` | 比较 |
| `~`, `!~` | 包含/不包含（LIKE） |
| `?=`, `?~` 等 | 任意匹配（用于多值字段） |

#### 日期宏

```
@now, @yesterday, @tomorrow
@todayStart, @todayEnd
@monthStart, @monthEnd
@yearStart, @yearEnd
@second, @minute, @hour, @weekday, @day, @month, @year
```

#### 字段修饰符

| 修饰符 | 描述 |
|--------|------|
| `:isset` | 检查字段是否已提交 |
| `:changed` | 检查字段是否已更改 |
| `:length` | 数组字段长度 |
| `:each` | 对数组每个元素应用条件 |
| `:lower` | 小写比较 |

#### 示例

```javascript
// 仅注册用户
@request.auth.id != ""

// 仅作者
author = @request.auth.id

// 基于角色
@request.auth.role = "staff"

// 禁止修改字段
@request.body.role:isset = false

// 地理距离
geoDistance(address.lon, address.lat, 23.32, 42.69) < 25
```

---

## 文件处理

### 上传文件

```javascript
const record = await pb.collection('example').create({
    title: 'Hello',
    documents: [new File(['content'], 'file.txt')]
});

// 追加文件
await pb.collection('example').update('ID', {
    'documents+': new File(['content'], 'file2.txt')
});
```

### 删除文件

```javascript
// 删除所有
await pb.collection('example').update('ID', { documents: [] });

// 删除特定文件
await pb.collection('example').update('ID', {
    'documents-': ['file1.pdf']
});
```

### 文件 URL

```
http://127.0.0.1:8090/api/files/COLLECTION/RECORD/FILENAME
http://127.0.0.1:8090/api/files/COLLECTION/RECORD/FILENAME?thumb=100x300
```

### 获取文件 URL

```javascript
const url = pb.files.getURL(record, record.documents[0], { thumb: '100x250' });
```

### 受保护文件

```javascript
const fileToken = await pb.files.getToken();
const url = pb.files.getURL(record, record.file, { token: fileToken });
```

---

## 关系处理

### 设置关系

```javascript
await pb.collection('posts').create({
    title: 'Post',
    tags: ['TAG_ID1', 'TAG_ID2']
});
```

### 修改关系

```javascript
// 追加/前置
await pb.collection('posts').update('ID', {
    'tags+': 'TAG_ID',      // 追加
    '+tags': 'TAG_ID'       // 前置
});

// 移除
await pb.collection('posts').update('ID', {
    'tags-': ['TAG_ID1', 'TAG_ID2']
});
```

### 展开关系

```javascript
// 展开单个关系
await pb.collection('comments').getList(1, 30, { expand: 'user' });

// 展开嵌套关系
await pb.collection('comments').getList(1, 30, { expand: 'user,post.author' });
```

### 反向关系

使用 `_via_` 语法访问反向关系：

```javascript
await pb.collection('posts').getList(1, 30, {
    filter: "comments_via_post.message ?~ 'hello'",
    expand: "comments_via_post.user"
});
```

---

## 实时 API

通过 Server-Sent Events (SSE) 实现，支持 `create`、`update`、`delete` 事件。

### 订阅

```javascript
// 订阅集合所有记录
pb.collection('example').subscribe('*', (e) => {
    console.log(e.action);  // create, update, delete
    console.log(e.record);
});

// 订阅单条记录
pb.collection('example').subscribe('RECORD_ID', (e) => {
    console.log(e.record);
});
```

### 取消订阅

```javascript
pb.collection('example').unsubscribe('RECORD_ID');
pb.collection('example').unsubscribe('*');
pb.collection('example').unsubscribe();  // 取消所有
```

### 访问控制

- 订阅单条记录：使用 `ViewRule`
- 订阅整个集合：使用 `ListRule`

---

## 扩展 PocketBase

### Go 扩展

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 注册路由
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
            name := e.Request.PathValue("name")
            return e.String(200, "Hello "+name)
        })
        return se.Next()
    })

    // 注册钩子
    app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
        if !e.HasSuperuserAuth() {
            e.Record.Set("status", "pending")
        }
        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### JavaScript 扩展

在 `pb_hooks` 目录创建 `*.pb.js` 文件：

```javascript
// pb_hooks/main.pb.js

// 注册路由
routerAdd("GET", "/hello/{name}", (e) => {
    let name = e.request.pathValue("name")
    return e.json(200, { message: "Hello " + name })
})

// 注册钩子
onRecordAfterUpdateSuccess((e) => {
    console.log("user updated...", e.record.get("email"))
    e.next()
}, "users")
```

### 全局对象（JavaScript）

| 对象 | 描述 |
|------|------|
| `__hooks` | pb_hooks 目录绝对路径 |
| `$app` | 当前 PocketBase 实例 |
| `$apis.*` | API 路由助手和中间件 |
| `$os.*` | OS 级别操作 |
| `$security.*` | JWT、加密等安全助手 |

### TypeScript 支持

```javascript
/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
    e.next()
    console.log("App initialized!")
})
```

---

## 数据库操作

### 执行查询（Go）

```go
// 执行语句
res, err := app.DB().NewQuery("DELETE FROM articles WHERE status = 'archived'").Execute()

// 查询单条
user := User{}
err := app.DB().NewQuery("SELECT * FROM users WHERE id=1").One(&user)

// 查询多条
users := []User{}
err := app.DB().NewQuery("SELECT * FROM users LIMIT 100").All(&users)
```

### 参数绑定

```go
err := app.DB().
    NewQuery("SELECT * FROM posts WHERE created >= {:from}").
    Bind(dbx.Params{"from": "2023-06-25"}).
    All(&posts)
```

### 查询构建器

```go
app.DB().
    Select("id", "email").
    From("users").
    AndWhere(dbx.Like("email", "example.com")).
    Limit(100).
    OrderBy("created ASC").
    All(&users)
```

### 记录操作（Go）

```go
// 查找记录
record, err := app.FindRecordById("articles", "RECORD_ID")
record, err := app.FindFirstRecordByData("articles", "slug", "test")
record, err := app.FindFirstRecordByFilter("articles", "status = 'public'")

// 创建记录
record := core.NewRecord(collection)
record.Set("title", "Hello")
err := app.Save(record)

// 更新记录
record.Set("title", "Updated")
err := app.Save(record)

// 删除记录
err := app.Delete(record)
```

### 记录操作（JavaScript）

```javascript
// 查找记录
let record = $app.findRecordById("articles", "RECORD_ID")
let record = $app.findFirstRecordByData("articles", "slug", "test")

// 创建记录
let collection = $app.findCollectionByNameOrId("articles")
let record = new Record(collection)
record.set("title", "Hello")
$app.save(record)

// 更新/删除
record.set("title", "Updated")
$app.save(record)
$app.delete(record)
```

---

## 迁移系统

### 创建迁移

```bash
go run . migrate create "your_new_migration"
```

### 迁移文件结构

```go
// migrations/1655834400_your_new_migration.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        // 升级代码
        return nil
    }, func(app core.App) error {
        // 降级代码
        return nil
    })
}
```

### 运行迁移

```bash
# 自动运行（启动时）
./pocketbase serve

# 手动运行
go run . migrate up
go run . migrate down [number]
```

### 集合快照

```bash
go run . migrate collections
```

### 自动迁移

```go
migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
    Automigrate: true,  // 在 Dashboard 中修改集合时自动创建迁移
})
```

---

## 生产部署

### 最小化部署

```bash
# 上传文件
rsync -avz -e ssh /local/path/to/myapp root@SERVER_IP:/root/pb

# SSH 连接并启动
ssh root@SERVER_IP
/root/pb/pocketbase serve yourdomain.com
```

### Systemd 服务

```ini
# /lib/systemd/system/pocketbase.service
[Unit]
Description = pocketbase

[Service]
Type             = simple
User             = root
Group            = root
LimitNOFILE      = 4096
Restart          = always
RestartSec       = 5s
WorkingDirectory = /root/pb
ExecStart        = /root/pb/pocketbase serve yourdomain.com

[Install]
WantedBy = multi-user.target
```

```bash
systemctl enable pocketbase.service
systemctl start pocketbase
```

### 反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name example.com;
    client_max_body_size 10M;

    location / {
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_read_timeout 360s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://127.0.0.1:8090;
    }
}
```

### Docker

```dockerfile
FROM alpine:latest
ARG PB_VERSION=0.23.0

RUN apk add --no-cache unzip ca-certificates
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/

EXPOSE 8080
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
```

### 生产建议

1. **使用 SMTP 邮件服务器**：避免邮件被标记为垃圾邮件
2. **启用超级用户 MFA**：增加安全层
3. **启用速率限制**：防止 API 滥用
4. **增加文件描述符限制**：`ulimit -n 4096`
5. **设置 GOMEMLIMIT**：内存受限环境下防止 OOM
6. **启用设置加密**：`--encryptionEnv=PB_ENCRYPTION_KEY`

### 备份与恢复

- 手动：复制/替换 `pb_data` 目录
- 内置：Dashboard > Settings > Backups
- 支持本地存储或 S3 兼容存储

---

## 客户端 SDK

### JavaScript SDK

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// 认证
await pb.collection('users').authWithPassword('email', 'password');

// CRUD
const records = await pb.collection('posts').getList(1, 20);
const record = await pb.collection('posts').create({ title: 'Hello' });
await pb.collection('posts').update('ID', { title: 'Updated' });
await pb.collection('posts').delete('ID');

// 实时订阅
pb.collection('posts').subscribe('*', (e) => console.log(e));
```

### Dart SDK

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// 认证
await pb.collection('users').authWithPassword('email', 'password');

// CRUD
final records = await pb.collection('posts').getList(perPage: 20);
final record = await pb.collection('posts').create(body: {'title': 'Hello'});
await pb.collection('posts').update('ID', body: {'title': 'Updated'});
await pb.collection('posts').delete('ID');
```

### 移动端持久化

```javascript
// React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import PocketBase, { AsyncAuthStore } from 'pocketbase';

const store = new AsyncAuthStore({
    save: async (serialized) => AsyncStorage.setItem('pb_auth', serialized),
    initial: AsyncStorage.getItem('pb_auth'),
});

const pb = new PocketBase('http://127.0.0.1:8090', store);
```

---

## 事件钩子

### 常用钩子

| 钩子 | 描述 |
|------|------|
| `OnBootstrap` | 应用启动时 |
| `OnServe` | 服务器启动时 |
| `OnRecordCreateRequest` | 创建记录请求前 |
| `OnRecordUpdateRequest` | 更新记录请求前 |
| `OnRecordDeleteRequest` | 删除记录请求前 |
| `OnRecordAfterCreateSuccess` | 创建记录成功后 |
| `OnRecordAfterUpdateSuccess` | 更新记录成功后 |
| `OnRecordAfterDeleteSuccess` | 删除记录成功后 |
| `OnRecordEnrich` | 记录序列化时 |

### 钩子示例（Go）

```go
app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
    // 修改记录
    e.Record.Set("status", "pending")
    return e.Next()
})

app.OnRecordAfterCreateSuccess("posts").BindFunc(func(e *core.RecordEvent) error {
    // 发送通知等
    return e.Next()
})
```

### 钩子示例（JavaScript）

```javascript
onRecordCreateRequest((e) => {
    e.record.set("status", "pending")
    e.next()
}, "posts")

onRecordAfterCreateSuccess((e) => {
    console.log("Created:", e.record.id)
    e.next()
}, "posts")
```

---

## 路由与中间件

### 注册路由（Go）

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // 基本路由
    se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
        return e.String(200, "Hello "+e.Request.PathValue("name"))
    })

    // 带中间件
    se.Router.POST("/api/myapp/settings", handler).Bind(apis.RequireAuth())

    // 路由组
    g := se.Router.Group("/api/myapp")
    g.Bind(apis.RequireAuth())
    g.GET("/items", listItems)
    g.POST("/items", createItem)

    return se.Next()
})
```

### 注册路由（JavaScript）

```javascript
routerAdd("GET", "/hello/{name}", (e) => {
    return e.string(200, "Hello " + e.request.pathValue("name"))
})

routerAdd("POST", "/api/myapp/settings", (e) => {
    return e.json(200, { success: true })
}, $apis.requireAuth())
```

### 内置中间件

| 中间件 | 描述 |
|--------|------|
| `RequireAuth()` | 要求认证用户 |
| `RequireSuperuserAuth()` | 要求超级用户 |
| `RequireGuestOnly()` | 仅允许未认证用户 |
| `SkipSuccessActivityLog()` | 跳过成功日志 |
| `Gzip()` | Gzip 压缩 |

---

## 发送邮件

### Go

```go
message := &mailer.Message{
    From: mail.Address{Name: "Support", Address: "support@example.com"},
    To:   []mail.Address{{Address: "user@example.com"}},
    Subject: "Hello",
    HTML: "<p>Hello World</p>",
}
app.NewMailClient().Send(message)
```

### JavaScript

```javascript
const message = new MailerMessage({
    from: { name: "Support", address: "support@example.com" },
    to: [{ address: "user@example.com" }],
    subject: "Hello",
    html: "<p>Hello World</p>",
})
$app.newMailClient().send(message)
```

---

## 定时任务

### Go

```go
app.Cron().MustAdd("hello", "*/5 * * * *", func() {
    log.Println("Hello!")
})
```

### JavaScript

```javascript
cronAdd("hello", "*/5 * * * *", () => {
    console.log("Hello!")
})
```

---

本文档涵盖了 PocketBase 的核心功能和常用操作。更多详细信息请参考官方文档：https://pocketbase.io/docs/
