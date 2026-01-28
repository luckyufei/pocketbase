# 渲染模板

## 概述

创建自定义路由或邮件时的一个常见任务是需要生成 HTML 输出。为了帮助实现这一点，PocketBase 提供了全局 `$template` 辅助函数用于解析和渲染 HTML 模板。

```javascript
const html = $template.loadFiles(
    `${__hooks}/views/base.html`,
    `${__hooks}/views/partial1.html`,
    `${__hooks}/views/partial2.html`,
).render(data)
```

处理组合和嵌套模板的一般流程是创建"基础"模板，使用 <code v-pre>{{template "placeholderName" .}}</code> 或 <code v-pre>{{block "placeholderName" .}}default...{{end}}</code> 动作定义各种占位符。

然后在局部模板中，使用 <code v-pre>{{define "placeholderName"}}custom...{{end}}</code> 动作定义这些占位符的内容。

上面的点对象（`.`）表示通过 `render(data)` 方法传递给模板的数据。

默认情况下，模板应用上下文（HTML、JS、CSS、URI）自动转义，因此生成的模板内容应该是注入安全的。要在模板中渲染原始/逐字的可信内容，可以使用内置的 `raw` 函数（例如 <code v-pre>{{.content|raw}}</code>）。

::: info
有关模板语法的更多信息，请参阅 [*html/template*](https://pkg.go.dev/html/template#hdr-A_fuller_picture) 和 [*text/template*](https://pkg.go.dev/text/template) 包文档。**另一个很好的资源是 Hashicorp 的 [Learn Go Template Syntax](https://developer.hashicorp.com/nomad/tutorials/templates/go-template-syntax) 教程。**
:::

## 带布局的 HTML 页面示例

考虑以下应用目录结构：

```
myapp/
    pb_hooks/
        views/
            layout.html
            hello.html
        main.pb.js
    pocketbase
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

```javascript
routerAdd("get", "/hello/{name}", (e) => {
    const name = e.request.pathValue("name")

    const html = $template.loadFiles(
        `${__hooks}/views/layout.html`,
        `${__hooks}/views/hello.html`,
    ).render({
        "name": name,
    })

    return e.html(200, html)
})
```
