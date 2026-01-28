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

...

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

...

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
| sort | String | Specify the *ORDER BY* fields. Add `-` / `+` (default) in front of the attribute for DESC / ASC order, eg.: `// DESC by created and ASC by id`<br>`?sort=-created,id`<br><br>**Supported record sort fields:**<br>`@random`, `@rowid`, `id`, **and any other collection field**. |
| filter | String | Filter expression to filter/search the returned records list (in addition to the collection's `listRule`), e.g.:<br>`?filter=(title~'abc' && created>'2022-01-01')`<br><br>**Supported record filter fields:**<br>`id`, **+ any field from the collection schema**. |
| expand | String | Auto expand record relations. Ex.:<br>`?expand=relField1,relField2.subRelField`<br>Supports up to 6-levels depth nested relations expansion.<br>The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": {"relField1": {...}, ...}`).<br>Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response (*by default returns all fields*). Ex.:<br>`?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>`:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |
| skipTotal | Boolean | If it is set the total counts query will be skipped and the response fields `totalItems` and `totalPages` will have `-1` value.<br>This could drastically speed up the search queries when the total counters are not needed or cursor based pagination is used.<br>For optimization purposes, it is set by default for the `getFirstListItem()` and `getFullList()` SDKs methods. |

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

::: tip
You could find individual generated records API documentation in the "Dashboard > Collections > API Preview".
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const record = await pb.collection('posts').getOne('RECORD_ID', {
    expand: 'relField1,relField2.subRelField',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

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
| expand | String | Auto expand record relations. Ex.:<br>`?expand=relField1,relField2.subRelField`<br>Supports up to 6-levels depth nested relations expansion.<br>The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": {"relField1": {...}, ...}`).<br>Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response (*by default returns all fields*). Ex.:<br>`?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>`:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

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

::: tip
You could find individual generated records API documentation from the Dashboard.
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const record = await pb.collection('demo').create({
    title: 'Lorem ipsum',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

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

::: tip
You could find individual generated records API documentation from the Dashboard.
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const record = await pb.collection('demo').update('YOUR_RECORD_ID', {
    title: 'Lorem ipsum',
});
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

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

::: tip
You could find individual generated records API documentation from the Dashboard.
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('demo').delete('YOUR_RECORD_ID');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

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

### Batch create/update/upsert/delete records

Batch and transactional create/update/upsert/delete of multiple records in a single request.

::: warning
The batch Web API need to be explicitly enabled and configured from the *Dashboard > Settings > Application*.

Because this endpoint processes the requests in a single read&write transaction, other queries may queue up and it could degrade the performance of your application if not used with proper care and configuration *(some recommendations: prefer using the smallest possible max processing time and body size limits; avoid large file uploads over slow S3 networks and custom hooks that communicate with slow external APIs)*.
:::

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const batch = pb.createBatch();

batch.collection('example1').create({ ... });
batch.collection('example2').update('RECORD_ID', { ... });
batch.collection('example3').delete('RECORD_ID');
batch.collection('example4').upsert({ ... });

const result = await batch.send();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final batch = pb.createBatch();

batch.collection('example1').create(body: { ... });
batch.collection('example2').update('RECORD_ID', body: { ... });
batch.collection('example3').delete('RECORD_ID');
batch.collection('example4').upsert(body: { ... });

final result = await batch.send();
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/batch`
:::

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| requests | Array\<Request\> | Required. List of requests to process. |

Each request element contains: `url path`, `method`, `headers`, `body`.

Supported operations:
- Create: `POST /api/collections/{collection}/records`
- Update: `PATCH /api/collections/{collection}/records/{id}`
- Upsert: `PUT /api/collections/{collection}/records` (body must contain `id`)
- Delete: `DELETE /api/collections/{collection}/records/{id}`

::: tip
When using `multipart/form-data`, regular fields should be serialized in `@jsonPayload`, and file keys need to follow the `requests.N.fileField` format.
:::

**Responses**

::: code-group
```json [200]
[
  {
    "status": 200,
    "body": { "id": "...", ... }
  },
  {
    "status": 200,
    "body": { "id": "...", ... }
  },
  ...
]
```

```json [400]
{
  "status": 400,
  "message": "Batch transaction failed.",
  "data": {}
}
```

```json [403]
{
  "status": 403,
  "message": "Batch requests are not allowed.",
  "data": {}
}
```
:::

---

## Auth record actions

### List auth methods

Returns a public list of the allowed collection auth methods.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const result = await pb.collection('users').listAuthMethods();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final result = await pb.collection('users').listAuthMethods();
```

</template>
</CodeTabs>

#### API details

::: info GET
`/api/collections/{collectionIdOrName}/auth-methods`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| fields | String | Comma separated string of the fields to return in the JSON response (*by default returns all fields*). Ex.:<br>`?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>`:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

**Responses**

::: code-group
```json [200]
{
  "password": {
    "enabled": true,
    "identityFields": ["email"]
  },
  "oauth2": {
    "enabled": true,
    "providers": [
      {
        "name": "github",
        "displayName": "GitHub",
        "state": "nT7SLxzXKAVMeRQJtxSYj9kvnJAvGk",
        "authURL": "https://github.com/login/oauth/authorize?client_id=test&code_challenge=...",
        "codeVerifier": "PwBG5OKR2IyQ7siLrrcgWHFwLLLAeUrz7PS1nY4AneG",
        "codeChallenge": "fcf8WAhNI6uCLJYgJubLyWXHvfs8xghoLe3zksBvxjE",
        "codeChallengeMethod": "S256"
      }
    ]
  },
  "mfa": {
    "enabled": false,
    "duration": 0
  },
  "otp": {
    "enabled": false,
    "duration": 0
  }
}
```
:::

---

### Auth with password

Authenticate a single auth record by combination of a password and a unique identity field (e.g. email, username, etc.).

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const authData = await pb.collection('users').authWithPassword(
    'YOUR_USERNAME_OR_EMAIL',
    'YOUR_PASSWORD',
);

// you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout"
pb.authStore.clear();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final authData = await pb.collection('users').authWithPassword(
    'YOUR_USERNAME_OR_EMAIL',
    'YOUR_PASSWORD',
);

print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

pb.authStore.clear();
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/auth-with-password`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| identity | String | Required. The auth record username or email address. |
| password | String | Required. The auth record password. |
| identityField | String | Optional. The name of the identity field to authenticate with (useful with phone number or any other custom unique field). |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| expand | String | Auto expand record relations. Ex.:<br>`?expand=relField1,relField2.subRelField`<br>Supports up to 6-levels depth nested relations expansion.<br>The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": {"relField1": {...}, ...}`).<br>Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response (*by default returns all fields*). Ex.:<br>`?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>`:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

**Responses**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "ae40239d2bc4477",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "test@example.com",
    "name": "test",
    "verified": true,
    "created": "2022-06-25 11:03:35.163",
    "updated": "2022-06-25 11:03:50.052"
  }
}
```

```json [400]
{
  "status": 400,
  "message": "Failed to authenticate.",
  "data": {
    "identity": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}
```
:::

---

### Auth with OAuth2

Authenticate with an OAuth2 provider and returns a new auth token and record data.

This action usually should be called right after the provider login page redirect.

You could also check the [OAuth2 web integration example](/en/authentication.html#authenticate-with-oauth2).

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const authData = await pb.collection('users').authWithOAuth2Code(
    'google',
    'CODE',
    'VERIFIER',
    'REDIRECT_URL',
    // optional data to use for the account on OAuth2 sign-up
    {
        'name': 'test',
    },
);

// you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout"
pb.authStore.clear();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final authData = await pb.collection('users').authWithOAuth2Code(
    'google',
    'CODE',
    'VERIFIER',
    'REDIRECT_URL',
    createData: {
        'name': 'test',
    },
);

print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

pb.authStore.clear();
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/auth-with-oauth2`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| provider | String | Required. The name of the OAuth2 client provider (e.g. "google"). |
| code | String | Required. The authorization code returned from the initial OAuth2 request. |
| codeVerifier | String | Required. The code verifier sent with the initial OAuth2 request as part of the code_challenge. |
| redirectUrl | String | Required. The redirect URL sent with the initial OAuth2 request. |
| createData | Object | Optional. Optional data to use when creating a new auth record on OAuth2 sign-up (JSON only). |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| expand | String | Auto expand record relations. Ex.:<br>`?expand=relField1,relField2.subRelField`<br>Supports up to 6-levels depth nested relations expansion.<br>The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": {"relField1": {...}, ...}`).<br>Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response (*by default returns all fields*). Ex.:<br>`?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>`:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

**Responses**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "ae40239d2bc4477",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "test@example.com",
    "name": "test",
    "verified": true,
    "created": "2022-06-25 11:03:35.163",
    "updated": "2022-06-25 11:03:50.052"
  },
  "meta": {
    "id": "...",
    "name": "...",
    "username": "...",
    "email": "...",
    "avatarURL": "...",
    "accessToken": "...",
    "refreshToken": "...",
    "rawUser": {...},
    "isNew": false
  }
}
```

```json [400]
{
  "status": 400,
  "message": "An error occurred while submitting the form.",
  "data": {
    "provider": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}
```
:::

---

### Auth with OTP

Authenticate a single auth record with an one-time password (OTP).

Note that when requesting an OTP we return an `otpId` even if a user with the provided email doesn't exist as a very basic enumeration protection.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// send OTP email to the provided auth record
const req = await pb.collection('users').requestOTP('test@example.com');

// ... show a screen/popup to enter the password from the email ...

// authenticate with the requested OTP id and the email password
const authData = await pb.collection('users').authWithOTP(req.otpId, "YOUR_OTP");

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout"
pb.authStore.clear();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

// send OTP email to the provided auth record
final req = await pb.collection('users').requestOTP('test@example.com');

// ... show a screen/popup to enter the password from the email ...

// authenticate with the requested OTP id and the email password
final authData = await pb.collection('users').authWithOTP(req.otpId, "YOUR_OTP");

// after the above you can also access the auth data from the authStore
print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

pb.authStore.clear();
```

</template>
</CodeTabs>

#### API details

**1. Request OTP**

::: tip POST
`/api/collections/{collectionIdOrName}/request-otp`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| email | String | Required. The auth record email address to send the OTP to. |

**Responses**

::: code-group
```json [200]
{
  "otpId": "..."
}
```
:::

**2. Auth with OTP**

::: tip POST
`/api/collections/{collectionIdOrName}/auth-with-otp`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| otpId | String | Required. The id of the OTP request. |
| password | String | Required. The one-time password. |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| expand | String | Auto expand record relations. Ex.:<br>`?expand=relField1,relField2.subRelField`<br>Supports up to 6-levels depth nested relations expansion.<br>The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": {"relField1": {...}, ...}`).<br>Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response (*by default returns all fields*). Ex.:<br>`?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>`:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

**Responses**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "ae40239d2bc4477",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "test@example.com",
    "name": "test",
    "verified": true,
    "created": "2022-06-25 11:03:35.163",
    "updated": "2022-06-25 11:03:50.052"
  }
}
```
:::

---

### Auth refresh

Returns a new auth response (token and user data) for already authenticated auth record.

This method is usually called by users on page/screen reload to ensure that the previously stored data in `pb.authStore` is still valid and up-to-date.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

const authData = await pb.collection('users').authRefresh();

// you can also access the refreshed auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

final authData = await pb.collection('users').authRefresh();

print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/auth-refresh`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| expand | String | Auto expand record relations. Ex.:<br>`?expand=relField1,relField2.subRelField`<br>Supports up to 6-levels depth nested relations expansion.<br>The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": {"relField1": {...}, ...}`).<br>Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response (*by default returns all fields*). Ex.:<br>`?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>`:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

**Responses**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "ae40239d2bc4477",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "test@example.com",
    "name": "test",
    "verified": true,
    "created": "2022-06-25 11:03:35.163",
    "updated": "2022-06-25 11:03:50.052"
  }
}
```

```json [401]
{
  "status": 401,
  "message": "The request requires valid record authorization token to be set.",
  "data": {}
}
```

```json [403]
{
  "status": 403,
  "message": "The authorized record model is not allowed to perform this action.",
  "data": {}
}
```
:::

---

### Request verification

Sends auth record verification email request.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestVerification('test@example.com');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestVerification('test@example.com');
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/request-verification`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| email | String | Required. The auth record email address to send the verification request. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "email": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}
```
:::

---

### Confirm verification

Confirms an auth record email verification request.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmVerification('VERIFICATION_TOKEN');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmVerification('VERIFICATION_TOKEN');
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/confirm-verification`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| token | String | Required. The verification token. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "token": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}
```
:::

---

### Request password reset

Sends auth record password reset email request.

On successful password reset all previously issued auth tokens for the specific record will be automatically invalidated.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestPasswordReset('test@example.com');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').requestPasswordReset('test@example.com');
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/request-password-reset`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| email | String | Required. The auth record email address to send the password reset request. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "email": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}
```
:::

---

### Confirm password reset

Confirms an auth record password reset request.

After a successful password reset all previously issued tokens for that record are automatically invalidated.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmPasswordReset(
    'RESET_TOKEN',
    'NEW_PASSWORD',
    'NEW_PASSWORD_CONFIRM',
);
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmPasswordReset(
    'RESET_TOKEN',
    'NEW_PASSWORD',
    'NEW_PASSWORD_CONFIRM',
);
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/confirm-password-reset`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| token | String | Required. The password reset token. |
| password | String | Required. The new auth record password. |
| passwordConfirm | String | Required. The new auth record password confirmation. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "token": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}
```
:::

---

### Request email change

Sends auth record email change request.

On successful email change all previously issued auth tokens for the specific record will be automatically invalidated.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').authWithPassword('test@example.com', '1234567890');

await pb.collection('users').requestEmailChange('new@example.com');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').authWithPassword('test@example.com', '1234567890');

await pb.collection('users').requestEmailChange('new@example.com');
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/request-email-change`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Header parameters**

| Header | Type | Description |
|--------|------|-------------|
| Authorization | String | Required. The record auth token. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| newEmail | String | Required. The new email address to send the change email request. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "newEmail": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}
```

```json [401]
{
  "status": 401,
  "message": "The request requires valid record authorization token to be set.",
  "data": {}
}
```
:::

---

### Confirm email change

Confirms an auth record new email address.

After a successful email change all previously issued tokens for that record are automatically invalidated.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmEmailChange('EMAIL_CHANGE_TOKEN', 'YOUR_PASSWORD');
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.collection('users').confirmEmailChange('EMAIL_CHANGE_TOKEN', 'YOUR_PASSWORD');
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/confirm-email-change`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| token | String | Required. The email change token. |
| password | String | Required. The auth record password to confirm the email change. |

**Responses**

::: code-group
```json [204]
null
```

```json [400]
{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "token": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}
```
:::

---

### Impersonate

Impersonate allows you to authenticate as a different user by generating a **nonrefreshable** auth token.

Only superusers can perform this action.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

// authenticate as superuser
await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

// impersonate
// (the custom token duration is optional and must be in seconds)
const impersonateClient = pb.collection("users").impersonate("USER_RECORD_ID", 3600)

// log the impersonate token and user data
console.log(impersonateClient.authStore.token);
console.log(impersonateClient.authStore.record);

// send requests as the impersonated user
impersonateClient.collection("example").getFullList();
```

</template>
<template #dart>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

// authenticate as superuser
await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

// impersonate
// (the custom token duration is optional and must be in seconds)
final impersonateClient = pb.collection("users").impersonate("USER_RECORD_ID", 3600)

// log the impersonate token and user data
print(impersonateClient.authStore.token);
print(impersonateClient.authStore.record);

// send requests as the impersonated user
impersonateClient.collection("example").getFullList();
```

</template>
</CodeTabs>

#### API details

::: tip POST
`/api/collections/{collectionIdOrName}/impersonate/{id}`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |
| id | String | ID of the auth record to impersonate. |

**Header parameters**

| Header | Type | Description |
|--------|------|-------------|
| Authorization | String | Required. The superuser auth token. |

**Body Parameters**

| Param | Type | Description |
|-------|------|-------------|
| duration | Number | Optional. Custom `exp` JWT claim for the token duration (in seconds). |

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| expand | String | Auto expand record relations. Ex.:<br>`?expand=relField1,relField2.subRelField`<br>Supports up to 6-levels depth nested relations expansion.<br>The expanded relations will be appended to the record under the `expand` property (e.g. `"expand": {"relField1": {...}, ...}`).<br>Only the relations to which the request user has permissions to **view** will be expanded. |
| fields | String | Comma separated string of the fields to return in the JSON response (*by default returns all fields*). Ex.:<br>`?fields=*,expand.relField.name`<br><br>`*` targets all keys from the specific depth level.<br><br>In addition, the following field modifiers are also supported:<br>`:excerpt(maxLength, withEllipsis?)` - Returns a short plain text version of the field string value. Ex.: `?fields=*,description:excerpt(200,true)` |

**Responses**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {...}
}
```

```json [401]
{
  "status": 401,
  "message": "The request requires valid record authorization token to be set.",
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

### Auth with TOF

Authenticates a single auth collection record via TOF (Tencent Open Framework) gateway.

This endpoint is only available when the `tofauth` plugin is registered on the server.

<CodeTabs>
<template #js>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// Authenticate with TOF (requires TOF gateway headers)
const authData = await pb.collection('users').authWithTof({
    taiIdentity: 'x-tai-identity-value',
    timestamp: 'timestamp-value',
    signature: 'signature-value',
    seq: 'x-rio-seq-value',
});

console.log(authData.token);
console.log(authData.record);
console.log(authData.meta.tofIdentity);
```

</template>
</CodeTabs>

#### API details

::: info GET
`/api/collections/{collectionIdOrName}/auth-with-tof`
:::

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| collectionIdOrName | String | ID or name of the auth collection. |

**Request Headers**

| Header | Type | Description |
|--------|------|-------------|
| x-tai-identity | String | TOF identity token (JWE encrypted). |
| timestamp | String | Request timestamp. |
| signature | String | Request signature. |
| x-rio-seq | String | Request sequence number. |

**Responses**

::: code-group
```json [200]
{
  "token": "JWT_AUTH_TOKEN",
  "record": {
    "id": "8171022dc95a4ed",
    "collectionId": "a98f514eb05f454",
    "collectionName": "users",
    "email": "username@tencent.com",
    "name": "username",
    "verified": true,
    "created": "2024-01-01 00:00:00.000Z",
    "updated": "2024-01-01 00:00:00.000Z"
  },
  "meta": {
    "tofIdentity": {
      "loginName": "username",
      "staffId": 12345,
      "expiration": "2024-01-01T12:00:00Z",
      "ticket": "TOF_TICKET"
    }
  }
}
```

```json [400]
{
  "status": 400,
  "message": "Missing TOF params in http header",
  "data": {}
}
```

```json [401]
{
  "status": 401,
  "message": "TOF identity verification failed: ...",
  "data": {}
}
```

```json [404]
{
  "status": 404,
  "message": "Collection 'xxx' not found",
  "data": {}
}
```
:::
