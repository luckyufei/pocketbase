# 发送 HTTP 请求

## 概述

你可以使用全局 `$http.send(config)` 辅助函数向外部服务发送 HTTP 请求。例如，可用于从外部数据源获取数据、向支付提供商 API 发送自定义请求等。

以下是所有当前支持的配置选项及其默认值列表。

```javascript
// 超时或网络连接错误时会抛出异常
const res = $http.send({
    url:     "",
    method:  "GET",
    body:    "", // 例如 JSON.stringify({"test": 123}) 或 new FormData()
    headers: {}, // 例如 {"content-type": "application/json"}
    timeout: 120, // 秒
})

console.log(res.headers)    // 响应头（例如 res.headers['X-Custom'][0]）
console.log(res.cookies)    // 响应 cookies（例如 res.cookies.sessionId.value）
console.log(res.statusCode) // 响应 HTTP 状态码
console.log(res.body)       // 响应体（纯字节数组）
console.log(res.json)       // 响应体（解析后的 json 数组或 map）
```

以下是一个示例，将根据 openlibrary.org 的 ISBN 详情为单本书籍记录补充数据。

```javascript
onRecordCreateRequest((e) => {
    let isbn = e.record.get("isbn");

    // 尝试从 openlibrary API 获取出版日期进行更新
    try {
        const res = $http.send({
            url: "https://openlibrary.org/isbn/" + isbn + ".json",
            headers: {"content-type": "application/json"}
        })

        if (res.statusCode == 200) {
            e.record.set("published", res.json.publish_date)
        }
    } catch (err) {
        e.app.logger().error("Failed to retrieve book data", "error", err);
    }

    return e.next()
}, "books")
```

### multipart/form-data 请求

要发送 `multipart/form-data` 请求（例如上传文件），请求 `body` 必须是 `FormData` 实例。

PocketBase JSVM 的 `FormData` 与其[浏览器版本](https://developer.mozilla.org/en-US/docs/Web/API/FormData)具有相同的 API，主要区别是文件值使用 [`$filesystem.File`](/jsvm/modules/_filesystem.html) 而不是 `Blob`。

```javascript
const formData = new FormData();

formData.append("title", "Hello world!")
formData.append("documents", $filesystem.fileFromBytes("doc1", "doc1.txt"))
formData.append("documents", $filesystem.fileFromBytes("doc2", "doc2.txt"))

const res = $http.send({
    url:    "https://...",
    method: "POST",
    body:   formData,
})

console.log(res.statusCode)
```

## 限制

目前不支持流式响应或服务器发送事件（SSE）。`$http.send` 调用会阻塞并一次性返回整个响应体。

对于此类和其他更高级的用例，你需要[使用 Go 扩展 PocketBase](/docs/go-overview/)。
