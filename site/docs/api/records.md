# Records API

## CRUD actions

### List/Search records

Returns a paginated records list, supporting sorting and filtering.

Depending on the collection's `listRule` value, the access to this action may or may not have been restricted.

::: tip
You could find individual generated records API documentation in the "Dashboard > Collections > API Preview".
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// fetch a paginated records list
const resultList = await pb.collection('posts').getList(1, 50, {
    filter: 'created >= "2022-01-01 00:00:00" && someField1 != someField2',
});

// you can also fetch all records at once via getFullList
const records = await pb.collection('posts').getFullList({
    sort: '-created',
});

// or fetch only the first record that matches the specified filter
const record = await pb.collection('posts').getFirstListItem('someField="test"', {
    expand: 'relField1,relField2.subRelField',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// fetch a paginated records list
final resultList = await pb.collection('posts').getList(
  page: 1,
  perPage: 50,
  filter: 'created >= "2022-01-01 00:00:00" && someField1 != someField2',
);

// you can also fetch all records at once via getFullList
final records = await pb.collection('posts').getFullList(sort: '-created');

// or fetch only the first record that matches the specified filter
final record = await pb.collection('posts').getFirstListItem(
  'someField="test"',
  expand: 'relField1,relField2.subRelField',
);
```

</template>
</CodeTabs>

#### API details

::: info GET
`/api/collections/{collectionIdOrName}/records`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the records' collection. |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| page | Number | The page (aka. offset) of the paginated list (default to 1). |
| perPage | Number | The max returned records per page (default to 30). |
| sort | String | Specify the ORDER BY fields. Add `-` / `+` (default) in front of the attribute for DESC / ASC order. Example: `?sort=-created,id` |
| filter | String | Filter expression to filter/search the returned records list. Example: `?filter=(title~'abc' && created>'2022-01-01')` |
| expand | String | Auto expand record relations. |
| fields | String | Comma separated string of the fields to return in the JSON response. |
| skipTotal | Boolean | If set to true, the total counts query will be skipped and the response will have -1 for totalItems and totalPages. |

<FilterSyntax />

**Responses**

::: code-group
```json [200]
{
  "page": 1,
  "perPage": 100,
  "totalItems": 2,
  "totalPages": 1,
  "items": [
    {
      "id": "ae40239d2bc4477",
      "collectionId": "a98f514eb05f454",
      "collectionName": "posts",
      "updated": "2022-06-25 11:03:50.052",
      "created": "2022-06-25 11:03:35.163",
      "title": "test1"
    },
    {
      "id": "d08dfc4f4d84419",
      "collectionId": "a98f514eb05f454",
      "collectionName": "posts",
      "updated": "2022-06-25 11:03:45.876",
      "created": "2022-06-25 11:03:45.876",
      "title": "test2"
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

```json [403]
{
  "status": 403,
  "message": "Only superusers can filter by '@collection.*'",
  "data": {}
}
```
:::

---

### View record

Returns a single collection record by its ID.

Depending on the collection's `viewRule` value, the access to this action may or may not have been restricted.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const record = await pb.collection('posts').getOne('RECORD_ID', {
    expand: 'relField1,relField2.subRelField',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

final record = await pb.collection('posts').getOne('RECORD_ID',
  expand: 'relField1,relField2.subRelField',
);
```

</template>
</CodeTabs>

#### API details

::: info GET
`/api/collections/{collectionIdOrName}/records/{recordId}`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the record's collection. |
| recordId | String | ID of the record to view. |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| expand | String | Auto expand record relations. |
| fields | String | Comma separated string of the fields to return in the JSON response. |

**Responses**

::: code-group
```json [200]
{
  "id": "ae40239d2bc4477",
  "collectionId": "a98f514eb05f454",
  "collectionName": "posts",
  "updated": "2022-06-25 11:03:50.052",
  "created": "2022-06-25 11:03:35.163",
  "title": "test1"
}
```

```json [403]
{
  "status": 403,
  "message": "Only superusers can perform this action.",
  "data": {}
}
```

```json [404]
{
  "status": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}
```
:::

---

### Create record

Creates a new collection Record.

Depending on the collection's `createRule` value, the access to this action may or may not have been restricted.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const record = await pb.collection('demo').create({
    title: 'Lorem ipsum',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

final record = await pb.collection('demo').create(body: {
    'title': 'Lorem ipsum',
});
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/records`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the record's collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| id | String | Optional. 15 characters string to store as record ID. If not set, it will be auto generated. |
| *Schema fields* | | Any field from the collection's schema. |
| password | String | Required for auth records. Auth record password. |
| passwordConfirm | String | Required for auth records. Auth record password confirmation. |

::: tip
Body parameters could be sent as JSON or multipart/form-data. File upload is supported only through multipart/form-data.
:::

**Responses**

::: code-group
```json [200]
{
  "collectionId": "a98f514eb05f454",
  "collectionName": "demo",
  "id": "ae40239d2bc4477",
  "updated": "2022-06-25 11:03:50.052",
  "created": "2022-06-25 11:03:35.163",
  "title": "Lorem ipsum"
}
```

```json [400]
{
  "status": 400,
  "message": "Failed to create record.",
  "data": {
    "title": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
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

### Update record

Updates an existing collection Record.

Depending on the collection's `updateRule` value, the access to this action may or may not have been restricted.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const record = await pb.collection('demo').update('YOUR_RECORD_ID', {
    title: 'Lorem ipsum',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

final record = await pb.collection('demo').update('YOUR_RECORD_ID', body: {
    'title': 'Lorem ipsum',
});
```

</template>
</CodeTabs>

#### API details

::: warning PATCH
`/api/collections/{collectionIdOrName}/records/{recordId}`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the record's collection. |
| recordId | String | ID of the record to update. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| *Schema fields* | | Any field from the collection's schema. |
| oldPassword | String | Optional. Old auth record password. Required only when changing the record password. |
| password | String | Optional. New auth record password. |
| passwordConfirm | String | Optional. New auth record password confirmation. |

**Responses**

::: code-group
```json [200]
{
  "collectionId": "a98f514eb05f454",
  "collectionName": "demo",
  "id": "ae40239d2bc4477",
  "updated": "2022-06-25 11:03:50.052",
  "created": "2022-06-25 11:03:35.163",
  "title": "Lorem ipsum"
}
```

```json [400]
{
  "status": 400,
  "message": "Failed to create record.",
  "data": {
    "title": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
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

### Delete record

Deletes a single collection Record by its ID.

Depending on the collection's `deleteRule` value, the access to this action may or may not have been restricted.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection('demo').delete('YOUR_RECORD_ID');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.collection('demo').delete('YOUR_RECORD_ID');
```

</template>
</CodeTabs>

#### API details

::: danger DELETE
`/api/collections/{collectionIdOrName}/records/{recordId}`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the record's collection. |
| recordId | String | ID of the record to delete. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "Failed to delete record. Make sure that the record is not part of a required relation reference.",
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

```json [404]
{
  "status": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}
```
:::

---

## Auth record actions

For auth record specific actions (authentication, verification, password reset, etc.), please refer to the [Authentication](/authentication) documentation.
