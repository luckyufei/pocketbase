# 记录代理

现有的 [`core.Record` 及其辅助方法](/docs/go-records)通常是与数据交互的推荐方式，但如果你想对记录字段进行类型化访问，可以创建一个嵌入 [`core.BaseRecordProxy`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#BaseRecordProxy)（*实现了 `core.RecordProxy` 接口*）的辅助结构体，并将集合字段定义为 getter 和 setter。

通过实现 `core.RecordProxy` 接口，你可以像使用常规记录模型一样，将自定义结构体作为 `RecordQuery` 结果的一部分使用。此外，通过代理结构体进行的每次数据库更改都会触发相应的记录验证和钩子。这确保了应用的其他部分（包括不知道或不使用你自定义结构体的第三方插件）仍能按预期工作。

以下是一个 `Article` 记录代理的示例实现：

```go
// article.go
package main

import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/types"
)

// 确保 Article 结构体满足 core.RecordProxy 接口
var _ core.RecordProxy = (*Article)(nil)

type Article struct {
    core.BaseRecordProxy
}

func (a *Article) Title() string {
    return a.GetString("title")
}

func (a *Article) SetTitle(title string) {
    a.Set("title", title)
}

func (a *Article) Slug() string {
    return a.GetString("slug")
}

func (a *Article) SetSlug(slug string) {
    a.Set("slug", slug)
}

func (a *Article) Created() types.DateTime {
    return a.GetDateTime("created")
}

func (a *Article) Updated() types.DateTime {
    return a.GetDateTime("updated")
}
```

访问和修改代理记录与常规记录相同。继续上面的 `Article` 示例：

```go
func FindArticleBySlug(app core.App, slug string) (*Article, error) {
    article := &Article{}

    err := app.RecordQuery("articles").
        AndWhere(dbx.NewExp("LOWER(slug)={:slug}", dbx.Params{
            "slug": strings.ToLower(slug), // 不区分大小写匹配
        })).
        Limit(1).
        One(article)

    if err != nil {
        return nil, err
    }

    return article, nil
}

...

article, err := FindArticleBySlug(app, "example")
if err != nil {
    return err
}

// 更改标题
article.SetTitle("Lorem ipsum...")

// 持久化更改，同时触发原始记录验证和钩子
err = app.Save(article)
if err != nil {
    return err
}
```

如果你有现有的 `*core.Record` 值，也可以使用 `SetProxyRecord` 方法将其加载到代理中：

```go
// 获取常规记录
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

// 加载到代理
article := &Article{}
article.SetProxyRecord(record)
```
