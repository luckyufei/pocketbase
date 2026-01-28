# 文件系统

PocketBase 提供了一个轻量级抽象层，用于统一处理本地文件系统和 S3。

要配置使用哪种存储方式，可以在 *仪表板 > 设置 > 文件存储* 部分调整存储设置。

文件系统抽象可以通过 [`app.NewFilesystem()`](https://pkg.go.dev/github.com/pocketbase/pocketbase/core#BaseApp.NewFilesystem) 方法以编程方式访问。

下面列出了一些最常见的操作，但你可以在 [`filesystem`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem) 子包中找到更多详细信息。

::: warning
务必在最后为创建的文件系统实例和获取的文件读取器调用 `Close()` 以防止资源泄漏。
:::

- [读取文件](#读取文件)
- [保存文件](#保存文件)
- [删除文件](#删除文件)

## 读取文件

要获取单个存储文件的内容，可以使用 [`GetReader(key)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#System.GetReader)。

注意，文件 key 通常包含**前缀**（即文件的"路径"）。对于记录文件，完整的 key 格式为 `collectionId/recordId/filename`。

要获取匹配特定*前缀*的多个文件，可以使用 [`List(prefix)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#System.List)。

下面的代码展示了一个最小示例，演示如何获取单个记录文件并将其内容复制到 `bytes.Buffer` 中。

```go
record, err := app.FindAuthRecordByEmail("users", "test@example.com")
if err != nil {
    return err
}

// 通过连接记录存储路径和特定文件名来构建完整的文件 key
avatarKey := record.BaseFilesPath() + "/" + record.GetString("avatar")

// 初始化文件系统
fsys, err := app.NewFilesystem()
if err != nil {
    return err
}
defer fsys.Close()

// 获取 avatar key 的文件读取器
r, err := fsys.GetReader(avatarKey)
if err != nil {
    return err
}
defer r.Close()

// 对读取器进行操作...
content := new(bytes.Buffer)
_, err = io.Copy(content, r)
if err != nil {
    return err
}
```

## 保存文件

根据可用的文件内容源，有几种方法可以保存*（即写入/上传）*文件：

- [`Upload([]byte, key)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#System.Upload)
- [`UploadFile(*filesystem.File, key)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#System.UploadFile)
- [`UploadMultipart(*multipart.FileHeader, key)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#System.UploadFile)

大多数用户很少需要直接使用上述方法，因为对于集合记录，文件持久化在保存记录模型时会透明处理（它还会根据集合 `file` 字段选项执行大小和 MIME 类型验证）。例如：

```go
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

// 其他可用的 File 工厂方法
// - filesystem.NewFileFromBytes(data, name)
// - filesystem.NewFileFromURL(ctx, url)
// - filesystem.NewFileFromMultipart(mh)
f, err := filesystem.NewFileFromPath("/local/path/to/file")

// 设置新文件（可以是单个 *filesytem.File 或多个 []*filesystem.File）
// （如果记录有旧文件，成功保存后会自动删除）
record.Set("yourFileField", f)

err = app.Save(record)
if err != nil {
    return err
}
```

## 删除文件

可以使用 [`Delete(key)`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#System.Delete) 从存储文件系统中删除文件。

与上一节类似，大多数用户很少需要直接使用 `Delete` 文件方法，因为对于集合记录，文件删除在从记录模型中移除现有文件名时会透明处理（这也确保引用该文件的数据库条目也被移除）。例如：

```go
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

// 如果你想"重置"一个文件字段（即删除关联的单个或多个文件）
// 可以将其设置为 nil
record.Set("yourFileField", nil)

// 或者如果你只想从多文件字段中移除单个文件，可以使用 "-" 修饰符
// （值可以是单个文件名字符串或文件名字符串切片）
record.Set("yourFileField-", "example_52iWbGinWd.txt")

err = app.Save(record)
if err != nil {
    return err
}
```
