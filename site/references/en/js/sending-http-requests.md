# Sending HTTP Requests (JavaScript)

PocketBase provides the `$http` global for making HTTP requests.

## GET request

```javascript
const response = $http.send({
    method: "GET",
    url: "https://api.example.com/data"
})

console.log(response.statusCode)
console.log(response.json)
```

## POST request

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

## With authentication

```javascript
const response = $http.send({
    method: "GET",
    url: "https://api.example.com/protected",
    headers: {
        "Authorization": "Bearer YOUR_TOKEN"
    }
})
```

## Timeout

```javascript
const response = $http.send({
    method: "GET",
    url: "https://api.example.com/slow",
    timeout: 30 // seconds
})
```

## Error handling

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

## Example: Webhook integration

```javascript
onRecordCreate((e) => {
    // Send webhook notification
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
