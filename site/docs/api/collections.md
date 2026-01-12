# Collections API

## List collections

Returns a paginated Collections list.

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// fetch a paginated collections list
const pageResult = await pb.collections.getList(1, 100, {
    filter: 'created >= "2022-01-01 00:00:00"',
});

// you can also fetch all collections at once via getFullList
const collections = await pb.collections.getFullList({ sort: '-created' });

// or fetch only the first collection that matches the specified filter
const collection = await pb.collections.getFirstListItem('type="auth"');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection("_superusers").authWithPassword('test@example.com', '1234567890');

// fetch a paginated collections list
final pageResult = await pb.collections.getList(
    page: 1,
    perPage: 100,
    filter: 'created >= "2022-01-01 00:00:00"',
);

// you can also fetch all collections at once via getFullList
final collections = await pb.collections.getFullList(sort: '-created');

// or fetch only the first collection that matches the specified filter
final collection = await pb.collections.getFirstListItem('type="auth"');
```

</template>
</CodeTabs>

### API details

::: info GET
`/api/collections`

Requires `Authorization: TOKEN`
:::

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| page | Number | The page (aka. offset) of the paginated list (default to 1). |
| perPage | Number | The max returned collections per page (default to 30). |
| sort | String | Specify the ORDER BY fields. Add `-` / `+` (default) in front of the attribute for DESC / ASC order. Supported fields: `@random`, `id`, `created`, `updated`, `name`, `type`, `system` |
| filter | String | Filter expression to filter/search the returned collections list. Supported fields: `id`, `created`, `updated`, `name`, `type`, `system` |
| fields | String | Comma separated string of the fields to return in the JSON response. |
| skipTotal | Boolean | If set to true, the total counts query will be skipped. |

<FilterSyntax />

**Responses**

::: code-group
```json [200]
{
  "page": 1,
  "perPage": 2,
  "totalItems": 10,
  "totalPages": 5,
  "items": [
    {
      "id": "_pbc_344172009",
      "listRule": null,
      "viewRule": null,
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "name": "users",
      "type": "auth",
      "fields": [...],
      "indexes": [...],
      "system": false
    },
    {
      "id": "_pbc_2287844090",
      "name": "posts",
      "type": "base",
      "fields": [...],
      "indexes": [],
      "system": false
    }
  ]
}
```

```json [400]
{
  "status": 400,
  "message": "Something went wrong while processing your request. Invalid filter.",
  "data": {}
}
```

```json [401]
{
  "status": 401,
  "message": "The request requires valid record authorization token.",
  "data": {}
}
```

```json [403]
{
  "status": 403,
  "message": "Only superusers can perform this action.",
  "data": {}
}
```
:::

---

## View collection

Returns a single collection by its ID or name.

Only superusers can perform this action.

### API details

::: info GET
`/api/collections/{collectionIdOrName}`

Requires `Authorization: TOKEN`
:::

---

## Create collection

Creates a new collection.

Only superusers can perform this action.

### API details

::: tip POST
`/api/collections`

Requires `Authorization: TOKEN`
:::

---

## Update collection

Updates an existing collection.

Only superusers can perform this action.

### API details

::: warning PATCH
`/api/collections/{collectionIdOrName}`

Requires `Authorization: TOKEN`
:::

---

## Delete collection

Deletes a single collection by its ID or name.

Only superusers can perform this action.

### API details

::: danger DELETE
`/api/collections/{collectionIdOrName}`

Requires `Authorization: TOKEN`
:::

---

## Truncate collection

Deletes all records associated with the specified collection.

Only superusers can perform this action.

### API details

::: danger DELETE
`/api/collections/{collectionIdOrName}/truncate`

Requires `Authorization: TOKEN`
:::

---

## Import collections

Bulk imports the provided collections configuration.

Only superusers can perform this action.

### API details

::: tip PUT
`/api/collections/import`

Requires `Authorization: TOKEN`
:::

---

## Get scaffolds

Returns a list with all available collection types and their default fields scaffolds.

Only superusers can perform this action.

### API details

::: info GET
`/api/collections/meta/scaffolds`

Requires `Authorization: TOKEN`
:::
