# 杂项

本页涵盖 PocketBase 中可用的各种实用函数和辅助工具。

## 安全辅助函数

```go
// 生成随机字符串
randomStr := security.RandomString(32)

// 使用自定义字母表生成随机字符串
randomStr := security.RandomStringWithAlphabet(32, "abc123")

// 哈希密码
hash := security.HashPassword("password123")

// 验证密码
valid := security.ValidatePassword("password123", hash)

// 生成 JWT 令牌
token, err := security.NewJWT(claims, signingKey, duration)

// 解析 JWT 令牌
claims, err := security.ParseJWT(token, signingKey)
```

## 类型辅助函数

```go
// DateTime 操作
now := types.NowDateTime()
parsed, err := types.ParseDateTime("2023-01-01 00:00:00.000Z")

// JSON 类型
jsonArr := types.JSONArray[string]{"a", "b", "c"}
jsonMap := types.JSONMap{"key": "value"}
jsonRaw := types.JSONRaw(`{"key": "value"}`)

// 指针辅助函数
strPtr := types.Pointer("hello")
```

## 验证

```go
import "github.com/pocketbase/pocketbase/tools/validation"

// 邮箱验证
err := validation.Is(email, validation.Email)

// URL 验证
err := validation.Is(url, validation.URL)

// 必填验证
err := validation.Is(value, validation.Required)

// 长度验证
err := validation.Is(str, validation.Length(5, 100))
```

## 词形变化

```go
import "github.com/pocketbase/pocketbase/tools/inflector"

// 复数化
plural := inflector.Pluralize("post") // "posts"

// 单数化
singular := inflector.Singularize("posts") // "post"

// 列名化（转换为 snake_case）
column := inflector.Columnify("SomeField") // "some_field"

// 首字母大写
upper := inflector.UcFirst("hello") // "Hello"
```

## HTTP 客户端

```go
import "github.com/pocketbase/pocketbase/tools/rest"

// 简单 GET 请求
response, err := rest.Get("https://api.example.com/data")

// 带 JSON 主体的 POST 请求
response, err := rest.Post("https://api.example.com/data", map[string]any{
    "key": "value",
})

// 自定义请求
client := rest.NewClient()
response, err := client.Send(&rest.Request{
    Method:  "PUT",
    URL:     "https://api.example.com/data",
    Body:    body,
    Headers: map[string]string{"Authorization": "Bearer token"},
})
```
