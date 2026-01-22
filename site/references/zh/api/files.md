# 文件 API

文件通过[记录 API](/zh/api/records)进行上传、更新或删除。

文件 API 通常用于获取/下载文件资源（支持基本的图片操作，如生成缩略图）。

## 下载 / 获取文件

下载单个文件资源（即文件的 URL 地址）。示例：

```html
<img src="http://example.com/api/files/demo/1234abcd/test.png" alt="测试图片" />
```

### API 详情

::: info GET
`/api/files/{collectionIdOrName}/{recordId}/{filename}`
:::

**路径参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| collectionIdOrName | String | 包含文件资源的记录模型所属集合的 ID 或名称。 |
| recordId | String | 包含文件资源的记录模型的 ID。 |
| filename | String | 文件资源的名称。 |

**查询参数**

| 参数 | 类型 | 描述 |
|-------|------|-------------|
| thumb | String | 获取请求文件的缩略图。支持的格式：`WxH`（如 100x300）、`WxHt`（如 100x300t - 裁剪到顶部）、`WxHb`（如 100x300b - 裁剪到底部）、`WxHf`（如 100x300f - 适应）、`0xH`（如 0x300 - 自动宽度）、`Wx0`（如 100x0 - 自动高度）。如果缩略图大小未在文件 schema 字段选项中定义，或文件资源不是图片（jpg、png、gif、webp），则返回原始文件资源。 |
| token | String | 用于授予受保护文件访问权限的可选文件令牌。示例请参阅[文件上传和处理](/zh/files-handling#protected-files)。 |
| download | Boolean | 如果设置为真值（1、t、true），文件将使用 `Content-Disposition: attachment` 头提供服务，指示浏览器忽略 pdf、图片、视频等的文件预览，直接下载文件。 |

**响应**

::: code-group
```text [200]
[文件资源]
```

```json [400]
{
  "status": 400,
  "message": "文件系统初始化失败。",
  "data": {}
}
```

```json [404]
{
  "status": 404,
  "message": "请求的资源未找到。",
  "data": {}
}
```
:::

---

## 生成受保护文件令牌

生成用于访问**受保护文件**的**短期文件令牌**。

客户端必须是超级用户或已认证的 auth 记录（即请求中发送了常规授权令牌）。

### API 详情

::: tip POST
`/api/files/token`

需要 `Authorization: TOKEN`
:::

**响应**

::: code-group
```json [200]
{
    "token": "..."
}
```

```json [400]
{
  "status": 400,
  "message": "生成文件令牌失败。",
  "data": {}
}
```
:::
