# 使用关联

[[toc]]

## 概述

假设我们有以下集合结构：

<div style="text-align: center; margin: 1rem 0;">
<img src="/images/relations-diagram.png" alt="集合关联图" style="max-width: 100%;" />
</div>

**`relation` 字段遵循与任何其他集合字段相同的规则，可以通过直接更新字段值来设置/修改 - 使用记录 ID 或 ID 数组（如果使用多关联）。**

以下是创建带有 2 个分配标签的新 **posts** 记录的示例。

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const post = await pb.collection('posts').create({
    'title': 'Lorem ipsum...',
    'tags':  ['TAG_ID1', 'TAG_ID2'],
});
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final post = await pb.collection('posts').create(body: {
    'title': 'Lorem ipsum...',
    'tags':  ['TAG_ID1', 'TAG_ID2'],
});
```

</template>

</CodeTabs>

## 向多关联前置/追加

要向现有值前置/追加单个或多个关联 ID，你可以使用 `+` 字段修饰符：

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const post = await pb.collection('posts').update('POST_ID', {
    // 前置单个标签
    '+tags': 'TAG_ID1',

    // 一次追加多个标签
    'tags+': ['TAG_ID1', 'TAG_ID2'],
})
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final post = await pb.collection('posts').update('POST_ID', body: {
    // 前置单个标签
    '+tags': 'TAG_ID1',

    // 一次追加多个标签
    'tags+': ['TAG_ID1', 'TAG_ID2'],
})
```

</template>

</CodeTabs>

## 从多关联中移除

要从现有值中移除单个或多个关联 ID，你可以使用 `-` 字段修饰符：

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const post = await pb.collection('posts').update('POST_ID', {
    // 移除单个标签
    'tags-': 'TAG_ID1',

    // 一次移除多个标签
    'tags-': ['TAG_ID1', 'TAG_ID2'],
})
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final post = await pb.collection('posts').update('POST_ID', body: {
    // 移除单个标签
    'tags-': 'TAG_ID1',

    // 一次移除多个标签
    'tags-': ['TAG_ID1', 'TAG_ID2'],
})
```

</template>

</CodeTabs>

## 展开关联

你还可以使用 `expand` 查询参数直接在返回的响应中展开记录关联字段，而无需发出额外请求，例如 `?expand=user,post.tags`

::: info
只有请求客户端可以**查看**（即满足关联集合的 **View API Rule**）的关联才会被展开。

`expand`、`filter` 或 `sort` 中的嵌套关联引用通过点表示法支持，最多支持 6 层深度。
:::

例如，要列出所有展开了 **user** 关联的 **comments**，我们可以这样做：

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
await pb.collection("comments").getList(1, 30, { expand: "user" })
```

</template>

<template #tab-1>

```dart
await pb.collection("comments").getList(perPage: 30, expand: "user")
```

</template>

</CodeTabs>

```json
{
    "page": 1,
    "perPage": 30,
    "totalPages": 1,
    "totalItems": 20,
    "items": [
        {
            "id": "lmPJt4Z9CkLW36z",
            "collectionId": "BHKW36mJl3ZPt6z",
            "collectionName": "comments",
            "created": "2022-01-01 01:00:00.456Z",
            "updated": "2022-01-01 02:15:00.456Z",
            "post": "WyAw4bDrvws6gGl",
            "user": "FtHAW9feB5rze7D",
            "message": "Example message...",
            "expand": {
                "user": {
                    "id": "FtHAW9feB5rze7D",
                    "collectionId": "srmAo0hLxEqYF7F",
                    "collectionName": "users",
                    "created": "2022-01-01 00:00:00.000Z",
                    "updated": "2022-01-01 00:00:00.000Z",
                    "username": "users54126",
                    "verified": false,
                    "emailVisibility": false,
                    "name": "John Doe"
                }
            }
        },
        ...
    ]
}
```

## 反向关联

PocketBase 还支持对**反向关联**进行 `filter`、`sort` 和 `expand` - 即关联的 `relation` 字段不在主集合中的关联。

使用以下表示法：`referenceCollection_via_relField`（例如 `comments_via_post`）。

例如，让我们列出至少有一条包含单词 *"hello"* 的 **comments** 记录的 **posts**：

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
await pb.collection("posts").getList(1, 30, {
    filter: "comments_via_post.message ?~ 'hello'"
    expand: "comments_via_post.user",
})
```

</template>

<template #tab-1>

```dart
await pb.collection("posts").getList(
    perPage: 30,
    filter: "comments_via_post.message ?~ 'hello'"
    expand: "comments_via_post.user",
)
```

</template>

</CodeTabs>

```json
{
    "page": 1,
    "perPage": 30,
    "totalPages": 2,
    "totalItems": 45,
    "items": [
        {
            "id": "WyAw4bDrvws6gGl",
            "collectionId": "1rAwHJatkTNCUIN",
            "collectionName": "posts",
            "created": "2022-01-01 01:00:00.456Z",
            "updated": "2022-01-01 02:15:00.456Z",
            "title": "Lorem ipsum dolor sit...",
            "expand": {
                "comments_via_post": [
                    {
                        "id": "lmPJt4Z9CkLW36z",
                        "collectionId": "BHKW36mJl3ZPt6z",
                        "collectionName": "comments",
                        "created": "2022-01-01 01:00:00.456Z",
                        "updated": "2022-01-01 02:15:00.456Z",
                        "post": "WyAw4bDrvws6gGl",
                        "user": "FtHAW9feB5rze7D",
                        "message": "lorem ipsum...",
                        "expand": {
                            "user": {
                                "id": "FtHAW9feB5rze7D",
                                "collectionId": "srmAo0hLxEqYF7F",
                                "collectionName": "users",
                                "created": "2022-01-01 00:00:00.000Z",
                                "updated": "2022-01-01 00:00:00.000Z",
                                "username": "users54126",
                                "verified": false,
                                "emailVisibility": false,
                                "name": "John Doe"
                            }
                        }
                    },
                    {
                        "id": "qBfxPbDJ4zCDKaZ",
                        "collectionId": "BHKW36mJl3ZPt6z",
                        "collectionName": "comments",
                        "created": "2022-01-01 01:00:00.456Z",
                        "updated": "2022-01-01 02:15:00.456Z",
                        "post": "WyAw4bDrvws6gGl",
                        "user": "FtHAW9feB5rze7D",
                        "message": "hello...",
                        "expand": {
                            "user": {
                                "id": "FtHAW9feB5rze7D",
                                "collectionId": "srmAo0hLxEqYF7F",
                                "collectionName": "users",
                                "created": "2022-01-01 00:00:00.000Z",
                                "updated": "2022-01-01 00:00:00.000Z",
                                "username": "users54126",
                                "verified": false,
                                "emailVisibility": false,
                                "name": "John Doe"
                            }
                        }
                    },
                    ...
                ]
            }
        },
        ...
    ]
}
```

### 反向关联注意事项

::: info
- 默认情况下，反向关联引用被解析为动态的*多*关联字段，即使反向关联字段本身标记为*单*关联。这是因为主记录可能有多个*单*反向关联引用（参见上面的示例，`comments_via_post` 展开以数组形式返回，尽管原始的 `comments.post` 字段是*单*关联）。只有当关联字段定义了 `UNIQUE` 索引约束时，反向关联才会被视为*单*关联字段。
- 反向关联 `expand` 每个关联字段最多限制 1000 条记录。如果你需要获取更大数量的反向关联记录，更好的方法是向反向关联集合发送单独的分页 `getList()` 请求，以避免传输大型 JSON 负载并减少内存使用。
:::
