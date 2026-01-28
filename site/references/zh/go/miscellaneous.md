# 杂项

[[toc]]

## app.Store()

[`app.Store()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#BaseApp.Store) 返回一个并发安全的应用内存存储，你可以用它在应用进程期间存储任何内容（例如缓存、配置标志等）。

你可以在 [`store.Store`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/store#Store) 文档中找到所有可用存储方法的详细信息，但最常用的是 `Get(key)`、`Set(key, value)` 和 `GetOrSet(key, setFunc)`。

```go
app.Store().Set("example", 123)

v1 := app.Store().Get("example").(int) // 123

v2 := app.Store().GetOrSet("example2", func() any {
    // 此设置器仅调用一次，除非 "example2" 被移除
    // （例如，适用于实例化单例）
    return 456
}).(int) // 456
```

::: warning
请记住，应用存储内部通常使用以 `pb*` 为前缀的键（例如，集合缓存存储在 `pbAppCachedCollections` 键下），更改这些系统键或调用 `RemoveAll()`/`Reset()` 可能会产生意外的副作用。

如果你想要更高级的控制，可以通过 `store.New[K, T](nil)` 初始化你自己的独立于应用实例的存储。
:::

## 安全辅助函数

*以下列出了一些最常用的安全辅助函数，但你可以在 [`security`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/security) 子包中找到所有可用方法的详细文档。*

### 生成随机字符串

```go
secret := security.RandomString(10) // 例如 a35Vdb10Z4

secret := security.RandomStringWithAlphabet(5, "1234567890") // 例如 33215
```

### 常量时间字符串比较

```go
isEqual := security.Equal(hash1, hash2)
```

### AES 加密/解密

```go
// 必须是随机的 32 字符字符串
const key = "q6Zuyqdz839AlmCyq53LA76NIhpbgf3b"

encrypted, err := security.Encrypt([]byte("test"), key)
if err != nil {
    return err
}

decrypted := security.Decrypt(encrypted, key) // []byte("test")
```
