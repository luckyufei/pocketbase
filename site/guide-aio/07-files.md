# 文件存储

## 存储抽象

```go
type System interface {
    Exists(key string) (bool, error)
    Upload(content []byte, key string) error
    Delete(key string) error
    Serve(w http.ResponseWriter, r *http.Request, key string, name string) error
    CreateThumb(originalKey, thumbKey, thumbSize string) error
}

// 实现：localFilesystem（本地）/ s3Filesystem（S3 兼容）
```

## 文件上传

```javascript
// 上传文件
const record = await pb.collection('example').create({
    title: 'Hello',
    documents: [new File(['content'], 'file.txt')]
});

// 追加文件（多文件字段）
await pb.collection('example').update('ID', {
    'documents+': new File(['content'], 'file2.txt')
});

// 删除文件
await pb.collection('example').update('ID', { 
    'documents-': ['file1.pdf'] 
});
```

## 获取文件 URL

```javascript
// 公开文件
const url = pb.files.getURL(record, record.documents[0]);

// 带缩略图
const url = pb.files.getURL(record, record.documents[0], { 
    thumb: '100x250' 
});

// 受保护文件（需要 token）
const fileToken = await pb.files.getToken();
const url = pb.files.getURL(record, record.file, { token: fileToken });
```

## 缩略图格式

| 格式 | 描述 |
|------|------|
| `100x100` | 宽高固定，居中裁剪 |
| `100x0` | 宽度固定，高度自适应 |
| `0x100` | 高度固定，宽度自适应 |
| `100x100t` | 宽高固定，顶部对齐裁剪 |
| `100x100b` | 宽高固定，底部对齐裁剪 |
| `100x100f` | 宽高固定，适应不裁剪 |

## Go 端文件操作

```go
// 获取文件系统
fs, _ := app.NewFilesystem()
defer fs.Close()

// 上传
fs.Upload(content, "path/to/file.txt")

// 删除
fs.Delete("path/to/file.txt")

// 检查存在
exists, _ := fs.Exists("path/to/file.txt")
```
