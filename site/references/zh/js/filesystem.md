# 文件系统

PocketBase 在本地文件系统和 S3 之间提供了一层薄的抽象。

要配置使用哪一个，你可以从 *仪表板 > 设置 > 文件存储* 部分调整存储设置。

文件系统抽象可以通过 [`$app.newFilesystem()`](/jsvm/functions/_app.newFilesystem.html) 方法以编程方式访问。

以下列出了一些最常见的操作，但你可以在 [`filesystem.System`](/jsvm/interfaces/filesystem.System.html) 接口中找到更多详细信息。

::: warning
始终确保在最后为创建的文件系统实例和检索到的文件读取器调用 `close()`，以防止资源泄漏。
:::

## 读取文件

要获取单个存储文件的文件内容，可以使用 [`getReader(key)`](/jsvm/interfaces/filesystem.System.html#getReader)。

请注意，文件键通常包含**前缀**（即文件的"路径"）。对于记录文件，完整的键是 `collectionId/recordId/filename`。

要检索匹配特定*前缀*的多个文件，可以使用 [`list(prefix)`](/jsvm/interfaces/filesystem.System.html#list)。

下面的代码展示了一个将单个记录文件内容作为字符串检索的最小示例。

```javascript
let record = $app.findAuthRecordByEmail("users", "test@example.com")

// 通过将记录存储路径与特定文件名连接来构建完整的文件键
let avatarKey = record.baseFilesPath() + "/" + record.get("avatar")

let fsys, reader, content;

try {
    // 初始化文件系统
    fsys = $app.newFilesystem();

    // 获取头像键的文件读取器
    reader = fsys.getReader(avatarKey)

    // 复制为纯字符串
    content = toString(reader)
} finally {
    reader?.close();
    fsys?.close();
}
```

## 保存文件

根据可用的文件内容源，有几种方法可以保存*（即写入/上传）*文件：

- [`upload(content, key)`](/jsvm/interfaces/filesystem.System.html#upload)
- [`uploadFile(file, key)`](/jsvm/interfaces/filesystem.System.html#uploadFile)
- [`uploadMultipart(mfh, key)`](/jsvm/interfaces/filesystem.System.html#uploadMultipart)

大多数用户很少需要直接使用上述方法，因为对于集合记录，文件持久化在保存记录模型时会被透明处理（它还会根据集合 `file` 字段选项执行大小和 MIME 类型验证）。例如：

```javascript
let record = $app.findRecordById("articles", "RECORD_ID")

// 其他可用的 File 工厂方法
// - $filesystem.fileFromBytes(content, name)
// - $filesystem.fileFromURL(url)
// - $filesystem.fileFromMultipart(mfh)
let file = $filesystem.fileFromPath("/local/path/to/file")

// 设置新文件（可以是单个或 File 值数组）
// （如果记录有旧文件，它会在成功保存时自动删除）
record.set("yourFileField", file)

$app.save(record)
```

## 删除文件

可以使用 [`delete(key)`](/jsvm/interfaces/filesystem.System.html#delete) 从存储文件系统中删除文件。

与上一节类似，大多数用户很少需要直接使用 `delete` 文件方法，因为对于集合记录，从记录模型中删除现有文件名时会透明处理文件删除（这也确保引用该文件的数据库条目也被删除）。例如：

```javascript
let record = $app.findRecordById("articles", "RECORD_ID")

// 如果你想"重置"文件字段（即删除关联的单个或多个文件）
// 你可以将其设置为 null
record.set("yourFileField", null)

// 或者如果你只想从多文件字段中删除单个文件，可以使用 "-" 修饰符
// （值可以是单个文件名字符串或文件名字符串切片）
record.set("yourFileField-", "example_52iWbGinWd.txt")

$app.save(record)
```
