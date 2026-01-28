# 事件钩子

修改 PocketBase 行为的标准方式是通过 Go 代码中的**事件钩子**。

所有钩子都有 3 个主要方法：

- [**`Bind(handler)`**](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/hook#Hook.Bind) - 向指定的事件钩子添加新的处理程序。处理程序有 3 个字段：
  - `Id` *（可选）* - 处理程序的名称（可用作 `Unbind` 的参数）
  - `Priority` *（可选）* - 处理程序的执行顺序（如果为空，则回退到代码中的注册顺序）
  - `Func` *（必需）* - 处理函数

- [**`BindFunc(func)`**](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/hook#Hook.BindFunc) - 类似于 `Bind`，但仅从提供的函数注册新处理程序。<br> 注册的处理程序以默认优先级 0 添加，ID 自动生成（返回的字符串值）。

- [**`Trigger(event, oneOffHandlerFuncs...)`**](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/hook#Hook.Trigger) - 触发事件钩子。<br> <em class="txt-hint">用户很少需要手动调用此方法。</em>

要移除已注册的钩子处理程序，可以使用处理程序 ID 并将其传递给 `Unbind(id)`，或使用 `UnbindAll()` 移除所有处理程序（*包括系统处理程序*）。

::: info
所有钩子处理函数共享相同的 `func(e T) error` 签名，并期望用户调用 `e.Next()` 以继续执行链。

**如果你需要从钩子处理程序内部访问应用实例，请优先使用 `e.App` 字段而不是重用父作用域的 app 变量，因为钩子可能是数据库事务的一部分，可能导致死锁。**

也要避免在钩子处理程序内部使用全局互斥锁，因为它可能被递归调用（例如级联删除），可能导致死锁。
:::

你可以在下方查看所有可用的钩子：

- [应用钩子](#应用钩子)
- [邮件钩子](#邮件钩子)
- [实时钩子](#实时钩子)
- [记录模型钩子](#记录模型钩子)
- [集合模型钩子](#集合模型钩子)
- [请求钩子](#请求钩子)
- [基础模型钩子](#基础模型钩子)

## 应用钩子
### OnBootstrap

`OnBootstrap` 钩子在初始化主应用程序资源（数据库、应用设置等）时触发。

::: warning
注意：在调用 `e.Next()` 之前尝试访问数据库将导致错误。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        // e.App

        return nil
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnServe

`OnServe` 钩子在 Web 服务器启动时触发（在 TCP 监听器启动之后，但在阻塞服务任务之前），允许你调整服务器选项并附加新路由或中间件。

```go
package main

import (
    "log"
    "net/http"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/apis"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(e *core.ServeEvent) error {
        // 注册新的 "GET /hello" 路由
        e.Router.GET("/hello", func(e *core.RequestEvent) error {
            return e.String(200, "Hello world!")
        }).Bind(apis.RequireAuth())

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnSettingsReload

`OnSettingsReload` 钩子在每次 `App.Settings()` 被替换为新状态时触发。

::: info
在 `e.Next()` 返回后，调用 `e.App.Settings()` 将返回新状态。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnSettingsReload().BindFunc(func(e *core.SettingsReloadEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        // e.App.Settings()

        return nil
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnBackupCreate

`OnBackupCreate` 钩子在每次调用 `App.CreateBackup` 时触发。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnBackupCreate().BindFunc(func(e *core.BackupEvent) error {
        // e.App
        // e.Name    - 要创建的备份名称
        // e.Exclude - 要从备份中排除的 pb_data 目录条目列表

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnBackupRestore

`OnBackupRestore` 钩子在应用程序备份恢复之前触发（即调用 `App.RestoreBackup` 时）。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnBackupRestore().BindFunc(func(e *core.BackupEvent) error {
        // e.App
        // e.Name    - 要恢复的备份名称
        // e.Exclude - 要从备份中排除的目录条目列表

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnTerminate

`OnTerminate` 钩子在应用程序正在终止过程中时触发（例如收到 `SIGTERM` 信号）。

::: warning
注意：应用程序可能会在不等待钩子完成的情况下突然终止。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
        // e.App
        // e.IsRestart

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 邮件钩子

### OnMailerSend

`OnMailerSend` 钩子在每次使用 `App.NewMailClient()` 实例发送新邮件时触发。

它允许拦截邮件消息或使用自定义邮件客户端。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerSend().BindFunc(func(e *core.MailerEvent) error {
        // e.App
        // e.Mailer
        // e.Message

        // 例如：更改邮件主题
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordAuthAlertSend

`OnMailerRecordAuthAlertSend` 钩子在向认证记录发送新设备登录警报邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordAuthAlertSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["info"].(string)

        // 例如：更改邮件主题
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordPasswordResetSend

`OnMailerRecordPasswordResetSend` 钩子在向认证记录发送密码重置邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordPasswordResetSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["token"].(string)

        // 例如：更改邮件主题
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordVerificationSend

`OnMailerRecordVerificationSend` 钩子在向认证记录发送验证邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordVerificationSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["token"].(string)

        // 例如：更改邮件主题
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordEmailChangeSend

`OnMailerRecordEmailChangeSend` 钩子在向认证记录发送确认新邮箱地址邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordEmailChangeSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["token"].(string)
        // e.Meta["newEmail"].(string)

        // 例如：更改邮件主题
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordOTPSend

`OnMailerRecordOTPSend` 钩子在向认证记录发送 OTP 邮件时触发，允许你拦截和自定义正在发送的邮件消息。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordOTPSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["otpId"].(string)
        // e.Meta["password"].(string)

        // 例如：更改邮件主题
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 实时钩子

### OnRealtimeConnectRequest

`OnRealtimeConnectRequest` 钩子在建立 SSE 客户端连接时触发。

::: info
`e.Next()` 之后的代码将在客户端断开连接后执行。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnRealtimeConnectRequest().BindFunc(func(e *core.RealtimeConnectRequestEvent) error {
        // e.App
        // e.Client
        // e.IdleTimeout
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRealtimeSubscribeRequest

`OnRealtimeSubscribeRequest` 钩子在更新客户端订阅时触发，允许你进一步验证和修改提交的更改。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnRealtimeSubscribeRequest().BindFunc(func(e *core.RealtimeSubscribeRequestEvent) error {
        // e.App
        // e.Client
        // e.Subscriptions
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRealtimeMessageSend

`OnRealtimeMessageSend` 钩子在向客户端发送 SSE 消息时触发。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnRealtimeMessageSend().BindFunc(func(e *core.RealtimeMessageEvent) error {
        // e.App
        // e.Client
        // e.Message
        // 以及所有原始连接的 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 记录模型钩子

::: info
这些是较低级别的 Record 模型钩子，可以从任何地方触发（自定义控制台命令、计划的 cron 作业、调用 `e.Save(record)` 时等），因此它们无法访问请求上下文！

如果你想拦截内置的 Web API 并访问其请求体、查询参数、请求头或请求认证状态，请使用专门的 [记录 `*Request` 钩子](#记录-crud-请求钩子)。
:::

### OnRecordEnrich

`OnRecordEnrich` 钩子在每次记录被"丰富"时触发 - 作为内置记录响应的一部分、在实时消息序列化期间或调用 `apis.EnrichRecord` 时。

它可用于例如动态显示/隐藏字段或仅针对特定请求信息计算临时记录模型属性。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnRecordEnrich("posts").BindFunc(func(e *core.RecordEnrichEvent) error {
        // 隐藏一个或多个字段
        e.Record.Hide("role")

        // 为已注册用户添加新的自定义字段
        if e.RequestInfo.Auth != nil && e.RequestInfo.Auth.Collection().Name == "users" {
            e.Record.WithCustomData(true) // 出于安全考虑需要显式允许
            e.Record.Set("computedScore", e.Record.GetInt("score") * e.RequestInfo.Auth.GetInt("base"))
        }

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordValidate

`OnRecordValidate` 是 `OnModelValidate` 的 Record 代理模型钩子。

`OnRecordValidate` 在每次验证 Record 时触发，例如由 `App.Validate()` 或 `App.Save()` 触发。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordValidate().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordValidate("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordCreate

`OnRecordCreate` 是 `OnModelCreate` 的 Record 代理模型钩子。

`OnRecordCreate` 在每次创建新 Record 时触发，例如由 `App.Save()` 触发。

`e.Next()` 之前的操作在 Record 验证和 INSERT DB 语句之前执行。

`e.Next()` 之后的操作在 Record 验证和 INSERT DB 语句之后执行。

::: warning
注意：成功执行并不保证 Record 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnRecordAfterCreateSuccess` 或 `OnRecordAfterCreateError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordCreate().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordCreate("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordCreateExecute

`OnRecordCreateExecute` 是 `OnModelCreateExecute` 的 Record 代理模型钩子。

`OnRecordCreateExecute` 在 Record 验证成功后、模型 INSERT DB 语句执行之前触发。

通常作为 `App.Save()` 的一部分触发，触发顺序如下：

`OnRecordCreate`  
&nbsp;-> `OnRecordValidate`（使用 `App.SaveNoValidate()` 时跳过）  
&nbsp;-> `OnRecordCreateExecute`

::: warning
注意：成功执行并不保证 Record 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnRecordAfterCreateSuccess` 或 `OnRecordAfterCreateError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordCreateExecute().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordCreateExecute("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterCreateSuccess

`OnRecordAfterCreateSuccess` 是 `OnModelAfterCreateSuccess` 的 Record 代理模型钩子。

`OnRecordAfterCreateSuccess` 在每次成功将 Record 持久化到数据库后触发。

::: warning
注意：当 Record 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordAfterCreateSuccess().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordAfterCreateSuccess("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterCreateError

`OnRecordAfterCreateError` 是 `OnModelAfterCreateError` 的 Record 代理模型钩子。

`OnRecordAfterCreateError` 在每次 Record 数据库创建持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `App.Save()` 失败时
- **延迟** 在事务回滚时
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordAfterCreateError().BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordAfterCreateError("users", "articles").BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordUpdate

`OnRecordUpdate` 是 `OnModelUpdate` 的 Record 代理模型钩子。

`OnRecordUpdate` 在每次更新 Record 时触发，例如由 `App.Save()` 触发。

`e.Next()` 之前的操作在 Record 验证和 UPDATE DB 语句之前执行。

`e.Next()` 之后的操作在 Record 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Record 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnRecordAfterUpdateSuccess` 或 `OnRecordAfterUpdateError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordUpdate().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordUpdate("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordUpdateExecute

`OnRecordUpdateExecute` 是 `OnModelUpdateExecute` 的 Record 代理模型钩子。

`OnRecordUpdateExecute` 在 Record 验证成功后、模型 UPDATE DB 语句执行之前触发。

通常作为 `App.Save()` 的一部分触发，触发顺序如下：

`OnRecordUpdate`  
&nbsp;-> `OnRecordValidate`（使用 `App.SaveNoValidate()` 时跳过）  
&nbsp;-> `OnRecordUpdateExecute`

::: warning
注意：成功执行并不保证 Record 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnRecordAfterUpdateSuccess` 或 `OnRecordAfterUpdateError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordUpdateExecute().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordUpdateExecute("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterUpdateSuccess

`OnRecordAfterUpdateSuccess` 是 `OnModelAfterUpdateSuccess` 的 Record 代理模型钩子。

`OnRecordAfterUpdateSuccess` 在每次成功将 Record 更新持久化到数据库后触发。

::: warning
注意：当 Record 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordAfterUpdateSuccess().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordAfterUpdateSuccess("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterUpdateError

`OnRecordAfterUpdateError` 是 `OnModelAfterUpdateError` 的 Record 代理模型钩子。

`OnRecordAfterUpdateError` 在每次 Record 数据库更新持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `App.Save()` 失败时
- **延迟** 在事务回滚时
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordAfterUpdateError().BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordAfterUpdateError("users", "articles").BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordDelete

`OnRecordDelete` 是 `OnModelDelete` 的 Record 代理模型钩子。

`OnRecordDelete` 在每次删除 Record 时触发，例如由 `App.Delete()` 触发。

`e.Next()` 之前的操作在 Record 验证和 UPDATE DB 语句之前执行。

`e.Next()` 之后的操作在 Record 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Record 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的删除事件，可以绑定到 `OnRecordAfterDeleteSuccess` 或 `OnRecordAfterDeleteError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordDelete().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordDelete("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordDeleteExecute

`OnRecordDeleteExecute` 是 `OnModelDeleteExecute` 的 Record 代理模型钩子。

`OnRecordDeleteExecute` 在内部删除检查之后、模型 DELETE DB 语句执行之前触发。

通常作为 `App.Delete()` 的一部分触发，触发顺序如下：

`OnRecordDelete`  
&nbsp;-> 内部删除检查  
&nbsp;-> `OnRecordDeleteExecute`

::: warning
注意：成功执行并不保证 Record 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的删除事件，可以绑定到 `OnRecordAfterDeleteSuccess` 或 `OnRecordAfterDeleteError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordDeleteExecute().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordDeleteExecute("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterDeleteSuccess

`OnRecordAfterDeleteSuccess` 是 `OnModelAfterDeleteSuccess` 的 Record 代理模型钩子。

`OnRecordAfterDeleteSuccess` 在每次成功将 Record 从数据库删除后触发。

::: warning
注意：当 Record 作为事务的一部分删除时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordAfterDeleteSuccess("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterDeleteError

`OnRecordAfterDeleteError` 是 `OnModelAfterDeleteError` 的 Record 代理模型钩子。

`OnRecordAfterDeleteError` 在每次 Record 数据库删除持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：
- **即时** 在 `App.Delete()` 失败时
- **延迟** 在事务回滚时
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每条记录触发
    app.OnRecordAfterDeleteError().BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 记录触发
    app.OnRecordAfterDeleteError("users", "articles").BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 集合模型钩子

::: info
这些是较低级别的 Collection 模型钩子，可以从任何地方触发（自定义控制台命令、计划的 cron 作业、调用 `e.Save(collection)` 时等），因此它们无法访问请求上下文！

如果你想拦截内置的 Web API 并访问其请求体、查询参数、请求头或请求认证状态，请使用专门的 [Collection `*Request` 钩子](#oncollectionslistrequest)。
:::

### OnCollectionValidate

`OnCollectionValidate` 是 `OnModelValidate` 的 Collection 代理模型钩子。

`OnCollectionValidate` 在每次验证 Collection 时触发，例如由 `App.Validate()` 或 `App.Save()` 触发。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionValidate().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionCreate

`OnCollectionCreate` 是 `OnModelCreate` 的 Collection 代理模型钩子。

`OnCollectionCreate` 在每次创建新 Collection 时触发，例如由 `App.Save()` 触发。

`e.Next()` 之前的操作在 Collection 验证和 INSERT DB 语句之前执行。

`e.Next()` 之后的操作在 Collection 验证和 INSERT DB 语句之后执行。

::: warning
注意：成功执行并不保证 Collection 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnCollectionAfterCreateSuccess` 或 `OnCollectionAfterCreateError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionCreate().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionCreateExecute

`OnCollectionCreateExecute` 是 `OnModelCreateExecute` 的 Collection 代理模型钩子。

`OnCollectionCreateExecute` 在 Collection 验证成功后、模型 INSERT DB 语句执行之前触发。

通常作为 `App.Save()` 的一部分触发，触发顺序如下：

`OnCollectionCreate`  
&nbsp;-> `OnCollectionValidate`（使用 `App.SaveNoValidate()` 时跳过）  
&nbsp;-> `OnCollectionCreateExecute`

::: warning
注意：成功执行并不保证 Collection 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnCollectionAfterCreateSuccess` 或 `OnCollectionAfterCreateError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionCreateExecute().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterCreateSuccess

`OnCollectionAfterCreateSuccess` 是 `OnModelAfterCreateSuccess` 的 Collection 代理模型钩子。

`OnCollectionAfterCreateSuccess` 在每次成功将 Collection 持久化到数据库后触发。

::: warning
注意：当 Collection 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionAfterCreateSuccess().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterCreateError

`OnCollectionAfterCreateError` 是 `OnModelAfterCreateError` 的 Collection 代理模型钩子。

`OnCollectionAfterCreateError` 在每次 Collection 数据库创建持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：

- **即时** 在 `App.Save()` 失败时
- **延迟** 在事务回滚时
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionAfterCreateError().BindFunc(func(e *core.CollectionErrorEvent) error {
        // e.App
        // e.Collection
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionUpdate

`OnCollectionUpdate` 是 `OnModelUpdate` 的 Collection 代理模型钩子。

`OnCollectionUpdate` 在每次更新 Collection 时触发，例如由 `App.Save()` 触发。

`e.Next()` 之前的操作在 Collection 验证和 UPDATE DB 语句之前执行。

`e.Next()` 之后的操作在 Collection 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Collection 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnCollectionAfterUpdateSuccess` 或 `OnCollectionAfterUpdateError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionUpdate().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionUpdateExecute

`OnCollectionUpdateExecute` 是 `OnModelUpdateExecute` 的 Collection 代理模型钩子。

`OnCollectionUpdateExecute` 在 Collection 验证成功后、模型 UPDATE DB 语句执行之前触发。

通常作为 `App.Save()` 的一部分触发，触发顺序如下：

`OnCollectionUpdate`  
&nbsp;-> `OnCollectionValidate`（使用 `App.SaveNoValidate()` 时跳过）  
&nbsp;-> `OnCollectionUpdateExecute`

::: warning
注意：成功执行并不保证 Collection 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnCollectionAfterUpdateSuccess` 或 `OnCollectionAfterUpdateError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionUpdateExecute().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterUpdateSuccess

`OnCollectionAfterUpdateSuccess` 是 `OnModelAfterUpdateSuccess` 的 Collection 代理模型钩子。

`OnCollectionAfterUpdateSuccess` 在每次成功将 Collection 更新持久化到数据库后触发。

::: warning
注意：当 Collection 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionAfterUpdateSuccess().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterUpdateError

`OnCollectionAfterUpdateError` 是 `OnModelAfterUpdateError` 的 Collection 代理模型钩子。

`OnCollectionAfterUpdateError` 在每次 Collection 数据库更新持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：

- **即时** 在 `App.Save()` 失败时
- **延迟** 在事务回滚时
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionAfterUpdateError().BindFunc(func(e *core.CollectionErrorEvent) error {
        // e.App
        // e.Collection
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionDelete

`OnCollectionDelete` 是 `OnModelDelete` 的 Collection 代理模型钩子。

`OnCollectionDelete` 在每次删除 Collection 时触发，例如由 `App.Delete()` 触发。

`e.Next()` 之前的操作在 Collection 验证和 UPDATE DB 语句之前执行。

`e.Next()` 之后的操作在 Collection 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Collection 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的删除事件，可以绑定到 `OnCollectionAfterDeleteSuccess` 或 `OnCollectionAfterDeleteError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionDelete().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionDeleteExecute

`OnCollectionDeleteExecute` 是 `OnModelDeleteExecute` 的 Collection 代理模型钩子。

`OnCollectionDeleteExecute` 在内部删除检查之后、Collection DELETE DB 语句执行之前触发。

通常作为 `App.Delete()` 的一部分触发，触发顺序如下：

`OnCollectionDelete`  
&nbsp;-> 内部删除检查  
&nbsp;-> `OnCollectionDeleteExecute`

::: warning
注意：成功执行并不保证 Collection 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的删除事件，可以绑定到 `OnCollectionAfterDeleteSuccess` 或 `OnCollectionAfterDeleteError` 钩子。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionDeleteExecute().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterDeleteSuccess

`OnCollectionAfterDeleteSuccess` 是 `OnModelAfterDeleteSuccess` 的 Collection 代理模型钩子。

`OnCollectionAfterDeleteSuccess` 在每次成功将 Collection 从数据库删除后触发。

::: warning
注意：当 Collection 作为事务的一部分删除时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionAfterDeleteSuccess().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterDeleteError

`OnCollectionAfterDeleteError` 是 `OnModelAfterDeleteError` 的 Collection 代理模型钩子。

`OnCollectionAfterDeleteError` 在每次 Collection 数据库删除持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：

- **即时** 在 `App.Delete()` 失败时
- **延迟** 在事务回滚时
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionAfterDeleteError().BindFunc(func(e *core.CollectionErrorEvent) error {
        // e.App
        // e.Collection
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 请求钩子

::: info
请求钩子仅在访问相应的 API 请求端点时触发。
:::

### 记录 CRUD 请求钩子

#### OnRecordsListRequest

`OnRecordsListRequest` 钩子在每次 API 记录列表请求时触发。
可用于在返回给客户端之前验证或修改响应。

::: warning
注意：如果你想隐藏现有字段或添加新的计算 Record 字段，建议使用 [`OnRecordEnrich`](#onrecordenrich) 钩子，因为它更不容易出错，并且会被所有内置 Record 响应触发（包括发送实时 Record 事件时）。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个集合触发
    app.OnRecordsListRequest().BindFunc(func(e *core.RecordsListRequestEvent) error {
        // e.App
        // e.Collection
        // e.Records
        // e.Result
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 集合触发
    app.OnRecordsListRequest("users", "articles").BindFunc(func(e *core.RecordsListRequestEvent) error {
        // e.App
        // e.Collection
        // e.Records
        // e.Result
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordViewRequest

`OnRecordViewRequest` 钩子在每次 API 记录查看请求时触发。
可用于在返回给客户端之前验证或修改响应。

::: warning
注意：如果你想隐藏现有字段或添加新的计算 Record 字段，建议使用 [`OnRecordEnrich`](#onrecordenrich) 钩子，因为它更不容易出错，并且会被所有内置 Record 响应触发（包括发送实时 Record 事件时）。
:::

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个集合触发
    app.OnRecordViewRequest().BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 集合触发
    app.OnRecordViewRequest("users", "articles").BindFunc(func(e *core.RecordRequestEvent) error {
        log.Println(e.HttpContext)
        log.Println(e.Record)
        return nil
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordCreateRequest

`OnRecordCreateRequest` 钩子在每次 API 记录创建请求时触发。
<br>
可用于额外验证请求数据或实现完全不同的持久化行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个集合触发
    app.OnRecordCreateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 集合触发
    app.OnRecordCreateRequest("users", "articles").BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordUpdateRequest

`OnRecordUpdateRequest` 钩子在每次 API 记录更新请求时触发。
<br>
可用于额外验证请求数据或实现完全不同的持久化行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个集合触发
    app.OnRecordUpdateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 集合触发
    app.OnRecordUpdateRequest("users", "articles").BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordDeleteRequest

`OnRecordDeleteRequest` 钩子在每次 API 记录删除请求时触发。
<br>
可用于额外验证请求数据或实现完全不同的删除行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个集合触发
    app.OnRecordDeleteRequest().BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 集合触发
    app.OnRecordDeleteRequest("users", "articles").BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 记录认证请求钩子

#### OnRecordAuthRequest

`OnRecordAuthRequest` 钩子在每次成功的 API 记录认证请求（登录、令牌刷新等）时触发。可用于额外验证或修改认证记录数据和令牌。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordAuthRequest().BindFunc(func(e *core.RecordAuthRequestEvent) error {
        // e.App
        // e.Record
        // e.Token
        // e.Meta
        // e.AuthMethod
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordAuthRequest("users", "managers").BindFunc(func(e *core.RecordAuthRequestEvent) error {
        // e.App
        // e.Record
        // e.Token
        // e.Meta
        // e.AuthMethod
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordAuthRefreshRequest

`OnRecordAuthRefreshRequest` 钩子在每次记录认证刷新 API 请求时触发（在生成新认证令牌之前）。

可用于额外验证请求数据或实现完全不同的认证刷新行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordAuthRefreshRequest().BindFunc(func(e *core.RecordAuthWithOAuth2RequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordAuthRefreshRequest("users", "managers").BindFunc(func(e *core.RecordAuthWithOAuth2RequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordAuthWithPasswordRequest

`OnRecordAuthWithPasswordRequest` 钩子在每次记录密码认证 API 请求时触发。

**如果未找到匹配的身份，`e.Record` 可能为 `nil`，允许你手动定位不同的 Record 模型（通过重新分配 `e.Record`）。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordAuthWithPasswordRequest().BindFunc(func(e *core.RecordAuthWithPasswordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record（可能为 nil）
        // e.Identity
        // e.IdentityField
        // e.Password
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordAuthWithPasswordRequest("users", "managers").BindFunc(func(e *core.RecordAuthWithPasswordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record（可能为 nil）
        // e.Identity
        // e.IdentityField
        // e.Password
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordAuthWithOAuth2Request

`OnRecordAuthWithOAuth2Request` 钩子在每次记录 OAuth2 登录/注册 API 请求时触发（令牌交换之后，链接到外部提供者之前）。

如果未设置 `e.Record`，则 OAuth2 请求将尝试创建新的认证记录。
<br>
要分配或链接不同的现有记录模型，可以更改 `e.Record` 字段。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordAuthWithOAuth2Request().BindFunc(func(e *core.RecordAuthWithOAuth2RequestEvent) error {
        // e.App
        // e.Collection
        // e.ProviderName
        // e.ProviderClient
        // e.Record（可能为 nil）
        // e.OAuth2User
        // e.CreateData
        // e.IsNewRecord
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordAuthWithOAuth2Request("users", "managers").BindFunc(func(e *core.RecordAuthWithOAuth2RequestEvent) error {
        // e.App
        // e.Collection
        // e.ProviderName
        // e.ProviderClient
        // e.Record（可能为 nil）
        // e.OAuth2User
        // e.CreateData
        // e.IsNewRecord
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordRequestPasswordResetRequest

`OnRecordRequestPasswordResetRequest` 钩子在每次记录请求密码重置 API 请求时触发。

可用于额外验证请求数据或实现完全不同的密码重置行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordRequestPasswordResetRequest().BindFunc(func(e *core.RecordRequestPasswordResetRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordRequestPasswordResetRequest("users", "managers").BindFunc(func(e *core.RecordRequestPasswordResetRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordConfirmPasswordResetRequest

`OnRecordConfirmPasswordResetRequest` 钩子在每次记录确认密码重置 API 请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordConfirmPasswordResetRequest().BindFunc(func(e *core.RecordConfirmPasswordResetRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordConfirmPasswordResetRequest("users", "managers").BindFunc(func(e *core.RecordConfirmPasswordResetRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordRequestVerificationRequest

`OnRecordRequestVerificationRequest` 钩子在每次记录请求验证 API 请求时触发。

可用于额外验证请求数据或实现完全不同的验证行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordRequestVerificationRequest().BindFunc(func(e *core.RecordRequestVerificationRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordRequestVerificationRequest("users", "managers").BindFunc(func(e *core.RecordRequestVerificationRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordConfirmVerificationRequest

`OnRecordConfirmVerificationRequest` 钩子在每次记录确认验证 API 请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordConfirmVerificationRequest().BindFunc(func(e *core.RecordConfirmVerificationRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordConfirmVerificationRequest("users", "managers").BindFunc(func(e *core.RecordConfirmVerificationRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordRequestEmailChangeRequest

`OnRecordRequestEmailChangeRequest` 钩子在每次记录请求邮箱更改 API 请求时触发。

可用于额外验证请求数据或实现完全不同的邮箱更改行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordRequestEmailChangeRequest().BindFunc(func(e *core.RecordRequestEmailChangeRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.NewEmail
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordRequestEmailChangeRequest("users", "managers").BindFunc(func(e *core.RecordRequestEmailChangeRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.NewEmail
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordConfirmEmailChangeRequest

`OnRecordConfirmEmailChangeRequest` 钩子在每次记录确认邮箱更改 API 请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordConfirmEmailChangeRequest().BindFunc(func(e *core.RecordConfirmEmailChangeRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordConfirmEmailChangeRequest("users", "managers").BindFunc(func(e *core.RecordConfirmEmailChangeRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordRequestOTPRequest

`OnRecordRequestOTPRequest` 钩子在每次记录请求 OTP API 请求时触发。

**如果未找到请求邮箱对应的用户，`e.Record` 可能为 `nil`，允许你手动创建新的 Record 或定位不同的 Record 模型（通过重新分配 `e.Record`）。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordRequestOTPRequest().BindFunc(func(e *core.RecordCreateOTPRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record（可能为 nil）
        // e.Password
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordRequestOTPRequest("users", "managers").BindFunc(func(e *core.RecordCreateOTPRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record（可能为 nil）
        // e.Password
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnRecordAuthWithOTPRequest

`OnRecordAuthWithOTPRequest` 钩子在每次记录 OTP 认证 API 请求时触发。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个认证集合触发
    app.OnRecordAuthWithOTPRequest().BindFunc(func(e *core.RecordAuthWithOTPRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.OTP
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 认证集合触发
    app.OnRecordAuthWithOTPRequest("users", "managers").BindFunc(func(e *core.RecordAuthWithOTPRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.OTP
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 批量请求钩子

#### OnBatchRequest

`OnBatchRequest` 钩子在每次 API 批量请求时触发。

可用于额外验证或修改提交的批量请求。

此钩子还会触发相应的 `OnRecordCreateRequest`、`OnRecordUpdateRequest`、`OnRecordDeleteRequest` 钩子，其中 `e.App` 是批量事务应用。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnBatchRequest().BindFunc(func(e *core.BatchRequestEvent) error {
        // e.App
        // e.Batch
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnFileDownloadRequest

`OnFileDownloadRequest` 钩子在每次 API 文件下载请求之前触发。

可用于在返回给客户端之前验证或修改文件响应。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个集合触发
    app.OnFileDownloadRequest().BindFunc(func(e *core.FileDownloadRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.FileField
        // e.ServedPath
        // e.ServedName
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 集合触发
    app.OnFileDownloadRequest("users", "articles").BindFunc(func(e *core.FileDownloadRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.FileField
        // e.ServedPath
        // e.ServedName
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnFileTokenRequest

`OnFileTokenRequest` 钩子在每次认证文件令牌 API 请求时触发。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个集合触发
    app.OnFileTokenRequest().BindFunc(func(e *core.FileTokenRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.Token
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    // 仅对 "users" 和 "managers" 集合触发
    app.OnFileTokenRequest("users", "managers").BindFunc(func(e *core.FileTokenRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.Token
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 集合请求钩子

#### OnCollectionsListRequest

`OnCollectionsListRequest` 钩子在每次 API 集合列表请求时触发。

可用于在返回给客户端之前验证或修改响应。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionsListRequest().BindFunc(func(e *core.CollectionsListRequestEvent) error {
        // e.App
        // e.Collections
        // e.Result
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnCollectionViewRequest

`OnCollectionViewRequest` 钩子在每次 API 集合查看请求时触发。

可用于在返回给客户端之前验证或修改响应。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionViewRequest().BindFunc(func(e *core.CollectionRequestEvent) error {
        // e.App
        // e.Collection
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnCollectionCreateRequest

`OnCollectionCreateRequest` 钩子在每次 API 集合创建请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionCreateRequest().BindFunc(func(e *core.CollectionRequestEvent) error {
        // e.App
        // e.Collection
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnCollectionUpdateRequest

`OnCollectionUpdateRequest` 钩子在每次 API 集合更新请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionUpdateRequest().BindFunc(func(e *core.CollectionRequestEvent) error {
        // e.App
        // e.Collection
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnCollectionDeleteRequest

`OnCollectionDeleteRequest` 钩子在每次 API 集合删除请求时触发。

可用于额外验证请求数据或实现完全不同的删除行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionDeleteRequest().BindFunc(func(e *core.CollectionRequestEvent) error {
        // e.App
        // e.Collection
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnCollectionsImportRequest

`OnCollectionsImportRequest` 钩子在每次 API 集合导入请求时触发。

可用于额外验证导入的集合或实现完全不同的导入行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionsImportRequest().BindFunc(func(e *core.CollectionsImportRequestEvent) error {
        // e.App
        // e.Collections
        // e.CollectionsData
        // e.DeleteMissing
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 设置请求钩子

#### OnSettingsListRequest

`OnSettingsListRequest` 钩子在每次 API 设置列表请求时触发。

可用于在返回给客户端之前验证或修改响应。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnSettingsListRequest().BindFunc(func(e *core.SettingsListRequestEvent) error {
        // e.App
        // e.Settings
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

#### OnSettingsUpdateRequest

`OnSettingsUpdateRequest` 钩子在每次 API 设置更新请求时触发。

可用于额外验证请求数据或实现完全不同的持久化行为。

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnSettingsUpdateRequest().BindFunc(func(e *core.SettingsUpdateRequestEvent) error {
        // e.App
        // e.OldSettings
        // e.NewSettings
        // 以及所有 RequestEvent 字段...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 基础模型钩子

::: info
为所有实现 Model DB 接口的 PocketBase 结构体触发的通用钩子 - Record、Collection、Log 等。

为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。
:::

### OnModelValidate

`OnModelValidate` 在每次验证 Model 时调用，例如由 `App.Validate()` 或 `App.Save()` 触发。

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelValidate().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelValidate("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelCreate

`OnModelCreate` 钩子在每次创建新 Model 时触发，例如由 `App.Save()` 触发。

`e.Next()` 之前的操作在 Model 验证和 INSERT DB 语句之前执行。

`e.Next()` 之后的操作在 Model 验证和 INSERT DB 语句之后执行。

::: warning
注意：成功执行并不保证 Model 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnModelAfterCreateSuccess` 或 `OnModelAfterCreateError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelCreate().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelCreate("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelCreateExecute

`OnModelCreateExecute` 钩子在 Model 验证成功后、模型 INSERT DB 语句执行之前触发。

通常作为 `App.Save()` 的一部分触发，触发顺序如下：

`OnModelCreate`  
&nbsp;-> `OnModelValidate`（使用 `App.SaveNoValidate()` 时跳过）  
&nbsp;-> `OnModelCreateExecute`

::: warning
注意：成功执行并不保证 Model 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnModelAfterCreateSuccess` 或 `OnModelAfterCreateError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelCreateExecute().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelCreateExecute("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterCreateSuccess

`OnModelAfterCreateSuccess` 在每次成功将 Model 持久化到数据库后触发。

::: warning
注意：当 Model 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelAfterCreateSuccess().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelAfterCreateSuccess("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterCreateError

`OnModelAfterCreateError` 在每次 Model 数据库创建持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：

- **即时** 在 `App.Save()` 失败时
- **延迟** 在事务回滚时
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelAfterCreateError().BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelAfterCreateError("users", "articles").BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelUpdate

`OnModelUpdate` 钩子在每次更新 Model 时触发，例如由 `App.Save()` 触发。

`e.Next()` 之前的操作在 Model 验证和 UPDATE DB 语句之前执行。

`e.Next()` 之后的操作在 Model 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Model 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnModelAfterUpdateSuccess` 或 `OnModelAfterUpdateError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelUpdate().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelUpdate("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelUpdateExecute

`OnModelUpdateExecute` 钩子在 Model 验证成功后、模型 UPDATE DB 语句执行之前触发。

通常作为 `App.Save()` 的一部分触发，触发顺序如下：

`OnModelUpdate`  
&nbsp;-> `OnModelValidate`（使用 `App.SaveNoValidate()` 时跳过）  
&nbsp;-> `OnModelUpdateExecute`

::: warning
注意：成功执行并不保证 Model 已持久化到数据库中，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnModelAfterUpdateSuccess` 或 `OnModelAfterUpdateError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelUpdateExecute().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelUpdateExecute("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterUpdateSuccess

`OnModelAfterUpdateSuccess` 在每次成功将 Model 更新持久化到数据库后触发。

::: warning
注意：当 Model 作为事务的一部分持久化时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelAfterUpdateSuccess().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelAfterUpdateSuccess("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterUpdateError

`OnModelAfterUpdateError` 在每次 Model 数据库更新持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：

- **即时** 在 `App.Save()` 失败时
- **延迟** 在事务回滚时
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelAfterUpdateError().BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelAfterUpdateError("users", "articles").BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelDelete

`OnModelDelete` 钩子在每次删除 Model 时触发，例如由 `App.Delete()` 触发。

`e.Next()` 之前的操作在 Model 验证和 UPDATE DB 语句之前执行。

`e.Next()` 之后的操作在 Model 验证和 UPDATE DB 语句之后执行。

::: warning
注意：成功执行并不保证 Model 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的删除事件，可以绑定到 `OnModelAfterDeleteSuccess` 或 `OnModelAfterDeleteError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelDelete().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelDelete("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelDeleteExecute

`OnModelDeleteExecute` 钩子在内部删除检查之后、模型 DELETE DB 语句执行之前触发。

通常作为 `App.Delete()` 的一部分触发，触发顺序如下：

`OnModelDelete`  
&nbsp;-> 内部删除检查  
&nbsp;-> `OnModelDeleteExecute`

::: warning
注意：成功执行并不保证 Model 已从数据库中删除，因为其包装事务可能尚未提交。如果你只想监听实际持久化的事件，可以绑定到 `OnModelAfterDeleteSuccess` 或 `OnModelAfterDeleteError` 钩子。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelDeleteExecute().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelDeleteExecute("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterDeleteSuccess

`OnModelAfterDeleteSuccess` 在每次成功将 Model 从数据库删除后触发。

::: warning
注意：当 Model 作为事务的一部分删除时，此钩子会延迟并仅在事务提交后执行。如果事务失败/回滚，此钩子不会触发。
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelAfterDeleteSuccess().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelAfterDeleteSuccess("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterDeleteError

`OnModelAfterDeleteError` 在每次 Model 数据库删除持久化失败后触发。

::: warning
注意：此钩子的执行是即时的还是延迟的取决于错误：

- **即时** 在 `App.Delete()` 失败时
- **延迟** 在事务回滚时
:::

**为方便起见，如果你想仅监听 Record 或 Collection 模型事件而无需手动进行类型断言，可以使用等效的 `OnRecord*` 和 `OnCollection*` 代理钩子。**

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // 对每个模型触发
    app.OnModelAfterDeleteError().BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    // 仅对 "users" 和 "articles" 模型触发
    app.OnModelAfterDeleteError("users", "articles").BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

有关可用钩子及其事件对象的完整列表，请参阅 [PocketBase Go 文档](https://pkg.go.dev/github.com/pocketbase/pocketbase)。
