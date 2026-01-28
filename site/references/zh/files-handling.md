# 文件处理

[[toc]]

## 上传文件

要上传文件，你必须首先向集合添加一个 `file` 字段：

![文件字段截图](/images/screenshots/file-field.png)

添加后，你可以使用*记录创建/更新 API* 通过发送 `multipart/form-data` 请求来创建/更新记录并上传"documents"文件。

::: info
每个上传的文件将以原始文件名（经过清理）保存，并附加一个随机部分（通常是 10 个字符）。例如 `test_52iwbgds7l.png`。

单个文件的最大允许大小目前限制为约 8PB（2^53-1 字节）。
:::

以下是如何使用 SDK 创建新记录并上传多个文件到示例"documents" `file` 字段的示例：

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// 创建新记录并上传多个文件
// （文件必须是 Blob 或 File 实例）
const createdRecord = await pb.collection('example').create({
    title: 'Hello world!', // 常规文本字段
    'documents': [
        new File(['content 1...'], 'file1.txt'),
        new File(['content 2...'], 'file2.txt'),
    ]
});

// -----------------------------------------------------------
// 替代方案 FormData + 纯 HTML 文件输入示例
// <input type="file" id="fileInput" />
// -----------------------------------------------------------

const fileInput = document.getElementById('fileInput');

const formData = new FormData();

// 设置常规文本字段
formData.append('title', 'Hello world!');

// 监听文件输入变化并将选定的文件添加到表单数据
fileInput.addEventListener('change', function () {
    for (let file of fileInput.files) {
        formData.append('documents', file);
    }
});

...

// 上传并创建新记录
const createdRecord = await pb.collection('example').create(formData);
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';
import 'package:http/http.dart' as http;

final pb = PocketBase('http://127.0.0.1:8090');

...

// 创建新记录并上传多个文件
final record = await pb.collection('example').create(
    body: {
        'title': 'Hello world!', // 常规文本字段
    },
    files: [
        http.MultipartFile.fromString(
            'documents',
            'example content 1...',
            filename: 'file1.txt',
        ),
        http.MultipartFile.fromString(
            'documents',
            'example content 2...',
            filename: 'file2.txt',
        ),
    ],
);
```

</template>

</CodeTabs>

如果你的 `file` 字段支持上传多个文件（即 **Max Files 选项 >= 2**），你可以使用 `+` 前缀/后缀字段名修饰符分别在已上传的文件前面/后面追加新文件。例如：

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript

import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const createdRecord = await pb.collection('example').update('RECORD_ID', {
    "documents+": new File(["content 3..."], "file3.txt")
});
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';
import 'package:http/http.dart' as http;

final pb = PocketBase('http://127.0.0.1:8090');

...

final record = await pb.collection('example').update(
    'RECORD_ID',
    files: [
        http.MultipartFile.fromString(
            'documents+',
            'example content 3...',
            filename: 'file3.txt',
        ),
    ],
);
```

</template>

</CodeTabs>

## 删除文件

要删除已上传的文件，你可以从仪表板编辑记录，或使用 API 将文件字段设置为零值（空字符串、`[]`）。

如果你想**从多文件上传字段中删除单个文件**，你可以在字段名后加上 `-` 并指定要删除的文件名。以下是使用 SDK 的一些示例：

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// 删除所有 "documents" 文件
await pb.collection('example').update('RECORD_ID', {
    'documents': [],
});

// 删除单个文件
await pb.collection('example').update('RECORD_ID', {
    'documents-': ["file1.pdf", "file2.txt"],
});
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

// 删除所有 "documents" 文件
await pb.collection('example').update('RECORD_ID', body: {
    'documents': [],
});

// 删除单个文件
await pb.collection('example').update('RECORD_ID', body: {
    'documents-': ["file1.pdf", "file2.txt"],
});
```

</template>

</CodeTabs>

上述示例使用 JSON 对象数据格式，但你也可以使用 `FormData` 实例进行 *multipart/form-data* 请求。如果使用 `FormData`，请将文件字段设置为空字符串。

## 文件 URL

每个上传的文件可以通过请求其文件 URL 来访问：

```
http://127.0.0.1:8090/api/files/COLLECTION_ID_OR_NAME/RECORD_ID/FILENAME
```

如果你的文件字段有 **Thumb sizes** 选项，你可以通过向 URL 添加 `thumb` 查询参数来获取图片文件的缩略图：

```
http://127.0.0.1:8090/api/files/COLLECTION_ID_OR_NAME/RECORD_ID/FILENAME?thumb=100x300
```

*目前仅限于 jpg、png、gif（其第一帧）和部分 webp（存储为 png）。*

目前支持以下缩略图格式：

| 格式 | 示例 | 描述 |
|------|------|------|
| `WxH` (例如 100x300) | - | 裁剪到 WxH 视框（从中心） |
| `WxHt` (例如 100x300t) | - | 裁剪到 WxH 视框（从顶部） |
| `WxHb` (例如 100x300b) | - | 裁剪到 WxH 视框（从底部） |
| `WxHf` (例如 100x300f) | - | 适应 WxH 视框内（不裁剪） |
| `0xH` (例如 0x300) | - | 调整到 H 高度保持宽高比 |
| `Wx0` (例如 100x0) | - | 调整到 W 宽度保持宽高比 |

如果请求的缩略图大小未找到或文件不是图片，将返回原始文件！

如果你已经有一个 Record 模型实例，SDK 提供了一个便捷方法来通过文件名生成文件 URL。

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const record = await pb.collection('example').getOne('RECORD_ID');

// 仅获取 "documents" 中的第一个文件名
//
// 注意：
// "documents" 是一个文件名数组，因为
// "documents" 字段创建时 "Max Files" 选项 > 1；
// 如果 "Max Files" 为 1，则结果属性将只是一个字符串
const firstFilename = record.documents[0];

// 返回类似：
// http://127.0.0.1:8090/api/files/example/kfzjt5oy8r34hvn/test_52iWbGinWd.png?thumb=100x250
const url = pb.files.getURL(record, firstFilename, {'thumb': '100x250'});
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final record = await pb.collection('example').getOne('RECORD_ID');

// 仅获取 "documents" 中的第一个文件名
//
// 注意：
// "documents" 是一个文件名数组，因为
// "documents" 字段创建时 "Max Files" 选项 > 1；
// 如果 "Max Files" 为 1，则结果属性将只是一个字符串
final firstFilename = record.getListValue<String>('documents')[0];

// 返回类似：
// http://127.0.0.1:8090/api/files/example/kfzjt5oy8r34hvn/test_52iWbGinWd.png?thumb=100x250
final url = pb.files.getURL(record, firstFilename, thumb: '100x250');
```

</template>

</CodeTabs>

此外，要指示浏览器在直接访问时始终下载文件而不是显示预览，你可以向文件 URL 附加 `?download=1` 查询参数。

## 受保护的文件

默认情况下，如果你知道文件的完整 URL，所有文件都是公开可访问的。

对于大多数应用程序来说，这是没问题的，而且相当安全，因为所有文件的名称都附加了随机部分，但在某些情况下，你可能需要额外的安全性来防止未经授权访问敏感文件，如身份证或护照副本、合同等。

为此，你可以在仪表板的字段选项中将 `file` 字段标记为*受保护*，然后使用特殊的**短期文件令牌**请求文件。

::: info
只有满足记录集合的 **View API rule** 的请求才能访问或下载受保护的文件。
:::

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// 认证
await pb.collection('users').authWithPassword('test@example.com', '1234567890');

// 生成文件令牌
const fileToken = await pb.files.getToken();

// 获取受保护文件 URL 的示例（有效期约 2 分钟）
const record = await pb.collection('example').getOne('RECORD_ID');
const url = pb.files.getURL(record, record.myPrivateFile, {'token': fileToken});
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

// 认证
await pb.collection('users').authWithPassword('test@example.com', '1234567890');

// 生成文件令牌
final fileToken = await pb.files.getToken();

// 获取受保护文件 URL 的示例（有效期约 2 分钟）
final record = await pb.collection('example').getOne('RECORD_ID');
final url = pb.files.getURL(record, record.getStringValue('myPrivateFile'), token: fileToken);
```

</template>

</CodeTabs>

## 存储选项

默认情况下，PocketBase 将上传的文件存储在本地文件系统的 `pb_data/storage` 目录中。对于大多数情况，这通常是推荐的存储选项，因为它非常快、易于使用和备份。

但如果你的磁盘空间有限，可以切换到外部 S3 兼容存储（AWS S3、MinIO、Wasabi、DigitalOcean Spaces、Vultr Object Storage 等）。设置连接设置最简单的方法是从*仪表板* > *设置* > *文件存储*：

![文件存储设置截图](/images/screenshots/files-storage.png)
