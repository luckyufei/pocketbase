# 渲染模板

[[toc]]

## 概述

创建自定义路由或邮件时的一个常见任务是需要生成 HTML 输出。

有很多 Go 模板引擎可供使用，但通常对于简单的情况，Go 标准库的 `html/template` 包就能很好地工作。

为了更容易地并发和即时加载模板文件，PocketBase 还在 [`github.com/pocketbase/pocketbase/tools/template`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/template) 实用包中提供了标准库的薄封装。

```go
import "github.com/pocketbase/pocketbase/tools/template"

data := map[string]any{"name": "John"}

html, err := template.NewRegistry().LoadFiles(
    "views/base.html",
    "views/partial1.html",
    "views/partial2.html",
).Render(data)
```

处理组合和嵌套模板的一般流程是创建"基础"模板，使用 <code v-pre>{{template "placeholderName" .}}</code> 或 <code v-pre>{{block "placeholderName" .}}default...{{end}}</code> 动作定义各种占位符。

然后在局部模板中，使用 <code v-pre>{{define "placeholderName"}}custom...{{end}}</code> 动作定义这些占位符的内容。

上面的点对象（`.`）表示通过 `Render(data)` 方法传递给模板的数据。

默认情况下，模板应用上下文（HTML、JS、CSS、URI）自动转义，因此生成的模板内容应该是注入安全的。要在模板中渲染原始/逐字的可信内容，可以使用内置的 `raw` 函数（例如 <code v-pre>{{.content|raw}}</code>）。

::: info
有关模板语法的更多信息，请参阅 [*html/template*](https://pkg.go.dev/html/template#hdr-A_fuller_picture) 和 [*text/template*](https://pkg.go.dev/text/template) 包文档。

**另一个很好的资源是 Hashicorp 的 [Learn Go Template Syntax](https://developer.hashicorp.com/nomad/tutorials/templates/go-template-syntax) 教程。**
:::

## 带布局的 HTML 页面示例

考虑以下应用目录结构：

```
myapp/
    views/
        layout.html
        hello.html
    main.go
```

我们将 `layout.html` 的内容定义为：

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>{{block "title" .}}Default app title{{end}}</title>
</head>
<body>
    Header...

    {{block "body" .}}
        Default app body...
    {{end}}

    Footer...
</body>
</html>
```

我们将 `hello.html` 的内容定义为：

```html
{{define "title"}}
    Page 1
{{end}}

{{define "body"}}
    <p>Hello from {{.name}}</p>
{{end}}
```

然后要输出最终页面，我们将注册一个自定义的 `/hello/:name` 路由：

```go
// main.go
package main

import (
    "log"
    "net/http"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/template"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // 这可以安全地被多个 goroutine 使用
        // （它充当已解析模板的存储）
        registry := template.NewRegistry()

        se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
            name := e.Request.PathValue("name")

            html, err := registry.LoadFiles(
                "views/layout.html",
                "views/hello.html",
            ).Render(map[string]any{
                "name": name,
            })

            if err != nil {
                // 或重定向到专用的 404 HTML 页面
                return e.NotFoundError("", err)
            }

            return e.HTML(http.StatusOK, html)
        })

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```
