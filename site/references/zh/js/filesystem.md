# 文件系统（JavaScript）

PocketBase 提供文件系统辅助函数，用于处理文件和存储。

## 访问文件系统

```javascript
// 获取主文件存储
const fs = $app.newFilesystem()

// 获取备份存储
const backupsFs = $app.newBackupsFilesystem()
```

## 读取文件

```javascript
const fs = $app.newFilesystem()

try {
    // 检查文件是否存在
    const exists = fs.exists("path/to/file.txt")
    
    // 获取文件属性
    const attrs = fs.attributes("path/to/file.txt")
    console.log(attrs.size, attrs.modTime)
    
    // 读取文件内容
    const reader = fs.getFile("path/to/file.txt")
    // 处理 reader...
} finally {
    fs.close()
}
```

## 写入文件

```javascript
const fs = $app.newFilesystem()

try {
    // 上传内容
    fs.upload(content, "path/to/file.txt")
} finally {
    fs.close()
}
```

## 删除文件

```javascript
const fs = $app.newFilesystem()

try {
    // 删除单个文件
    fs.delete("path/to/file.txt")
    
    // 按前缀删除
    fs.deletePrefix("path/to/")
} finally {
    fs.close()
}
```

## 处理记录文件

```javascript
onRecordCreate((e) => {
    // 获取上传的文件
    const files = e.record.getUnsavedFiles("attachment")
    
    for (const file of files) {
        console.log("Uploaded:", file.name, file.size)
    }
    
    e.next()
}, "documents")
```

## 示例：文件处理

```javascript
onRecordCreate((e) => {
    const files = e.record.getUnsavedFiles("image")
    
    for (const file of files) {
        // 验证文件大小
        if (file.size > 10 * 1024 * 1024) { // 10MB
            throw new BadRequestError("File too large")
        }
        
        // 验证 MIME 类型
        if (!file.type.startsWith("image/")) {
            throw new BadRequestError("Only images allowed")
        }
    }
    
    e.next()
}, "photos")
```
