# 发送 HTTP 请求（JavaScript）

PocketBase 提供 `$http` 全局对象用于发送 HTTP 请求。

## GET 请求

```javascript
const response = $http.send({
    method: "GET",
    url: "https://api.example.com/data"
})

console.log(response.statusCode)
console.log(response.json)
```

## POST 请求

```javascript
const response = $http.send({
    method: "POST",
    url: "https://api.example.com/data",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        key: "value"
    })
})
```

## 带认证

```javascript
const response = $http.send({
    method: "GET",
    url: "https://api.example.com/protected",
    headers: {
        "Authorization": "Bearer YOUR_TOKEN"
    }
})
```

## 超时

```javascript
const response = $http.send({
    method: "GET",
    url: "https://api.example.com/slow",
    timeout: 30 // 秒
})
```

## 错误处理

```javascript
try {
    const response = $http.send({
        method: "GET",
        url: "https://api.example.com/data"
    })
    
    if (response.statusCode >= 400) {
        throw new Error(`HTTP error: ${response.statusCode}`)
    }
    
    const data = response.json
    console.log(data)
} catch (err) {
    console.error("Request failed:", err.message)
}
```

## 示例：Webhook 集成

```javascript
onRecordCreate((e) => {
    // 发送 webhook 通知
    try {
        $http.send({
            method: "POST",
            url: "https://hooks.example.com/notify",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                event: "record.create",
                collection: e.record.collection().name,
                recordId: e.record.id
            })
        })
    } catch (err) {
        console.error("Webhook failed:", err.message)
    }
    
    e.next()
}, "posts")
```
