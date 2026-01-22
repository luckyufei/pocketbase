# 文件系统

PocketBase 提供文件系统辅助函数，用于处理文件和配置的存储（本地或 S3）。

## 访问文件系统

```go
// 获取主文件存储
fs, err := app.NewFilesystem()
if err != nil {
    return err
}
defer fs.Close()

// 获取备份存储
backupsFs, err := app.NewBackupsFilesystem()
if err != nil {
    return err
}
defer backupsFs.Close()
```

## 读取文件

```go
// 检查文件是否存在
exists, err := fs.Exists("path/to/file.txt")

// 获取文件属性
attrs, err := fs.Attributes("path/to/file.txt")

// 读取文件内容
reader, err := fs.GetFile("path/to/file.txt")
if err != nil {
    return err
}
defer reader.Close()

content, err := io.ReadAll(reader)
```

## 写入文件

```go
// 从 reader 上传
err := fs.Upload(strings.NewReader("Hello World"), "path/to/file.txt")

// 从字节上传
err := fs.UploadBytes([]byte("Hello World"), "path/to/file.txt")

// 从文件上传
file, _ := os.Open("/local/path/to/file.txt")
defer file.Close()
err := fs.Upload(file, "path/to/file.txt")
```

## 删除文件

```go
// 删除单个文件
err := fs.Delete("path/to/file.txt")

// 按前缀删除（所有以该前缀开头的文件）
err := fs.DeletePrefix("path/to/")
```

## 提供文件服务

```go
// 提供文件服务，可选生成缩略图
err := fs.Serve(
    response,           // http.ResponseWriter
    request,            // *http.Request
    "path/to/file.jpg",
    "filename.jpg",     // 下载文件名
)
```

## S3 配置

S3 存储可以从仪表板的"设置 > 文件存储"中配置，或以编程方式配置：

```go
settings := app.Settings()
settings.S3.Enabled = true
settings.S3.Bucket = "my-bucket"
settings.S3.Region = "us-east-1"
settings.S3.Endpoint = "s3.amazonaws.com"
settings.S3.AccessKey = "..."
settings.S3.Secret = "..."

if err := app.Save(settings); err != nil {
    return err
}
```
