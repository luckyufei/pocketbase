# Authentication

[[toc]]

## Overview

A single client is considered authenticated as long as it sends valid `Authorization:YOUR_AUTH_TOKEN` header with the request.

The PocketBase Web APIs are fully stateless and there are no sessions in the traditional sense (even the tokens are not stored in the database).

Because there are no sessions and we don't store the tokens on the server there is also no logout endpoint. To "logout" a user you can simply disregard the token from your local state (aka. `pb.authStore.clear()` if you use the SDKs).

The auth token could be generated either through the specific auth collection Web APIs or programmatically via Go/JS.

All allowed auth collection methods can be configured individually from the specific auth collection options.

::: info
Note that PocketBase admins (aka. `_superusers`) are similar to the regular auth collection records with 2 caveats:
- OAuth2 is not supported as auth method for the `_superusers` collection
- Superusers can access and modify anything (collection API rules are ignored)
:::

## Authenticate with Password

To authenticate with password you must enable the *Identity/Password* auth collection option (see also [Web API reference](/en/api/records#auth-with-password)).

The default identity field is the `email` but you can configure any other unique field like "username" (it must have a UNIQUE index).

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const authData = await pb.collection("users").authWithPassword('test@example.com', '1234567890');

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout" the last authenticated record
pb.authStore.clear();
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

final authData = await pb.collection("users").authWithPassword('test@example.com', '1234567890');

// after the above you can also access the auth data from the authStore
print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

// "logout" the last authenticated record
pb.authStore.clear();
```

</template>

</CodeTabs>

## Authenticate with OTP

To authenticate with email code you must enable the *One-time password (OTP)* auth collection option (see also [Web API reference](/en/api/records#auth-with-otp)).

The usual flow is the user typing manually the received password from their email but you can also adjust the default email template from the collection options and add a url containing the OTP and its id as query parameters (you have access to `{OTP}` and `{OTP_ID}` placeholders).

Note that when requesting an OTP we return an `otpId` even if a user with the provided email doesn't exist as a very rudimentary enumeration protection (it doesn't create or send anything).

On successful OTP validation, by default the related user email will be automatically marked as "verified".

::: warning
Keep in mind that OTP as a standalone authentication method could be less secure compared to the other methods because the generated password is usually 0-9 digits and there is a risk of it being guessed or enumerated (especially when a longer duration time is configured).

For security critical applications OTP is recommended to be used in combination with the other auth methods and the [Multi-factor authentication](#multi-factor-authentication) option.
:::

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// send OTP email to the provided auth record
const result = await pb.collection('users').requestOTP('test@example.com');

// ... show a screen/popup to enter the password from the email ...

// authenticate with the requested OTP id and the email password
const authData = await pb.collection('users').authWithOTP(result.otpId, "YOUR_OTP");

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout"
pb.authStore.clear();
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// send OTP email to the provided auth record
final result = await pb.collection('users').requestOTP('test@example.com');

// ... show a screen/popup to enter the password from the email ...

// authenticate with the requested OTP id and the email password
final authData = await pb.collection('users').authWithOTP(result.otpId, "YOUR_OTP");

// after the above you can also access the auth data from the authStore
print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

// "logout"
pb.authStore.clear();
```

</template>

</CodeTabs>

## Authenticate with OAuth2

You can also authenticate your users with an OAuth2 provider (Google, GitHub, Microsoft, etc.). See the [Web API reference](/en/api/records#auth-with-oauth2) for more details.

## Authenticate with TOF (Tencent Internal)

TOF (Tencent Open Framework) is Tencent's internal unified authentication gateway. This authentication method is only available for Tencent internal applications.

### Server Configuration

First, register the TOF plugin in your Go application:

```go
import "github.com/pocketbase/pocketbase/plugins/tofauth"

func main() {
    app := pocketbase.New()

    // Register TOF plugin
    tofauth.MustRegister(app, tofauth.Config{
        SafeMode:       tofauth.Bool(true),  // Recommended for production
        CheckTimestamp: tofauth.Bool(true),  // Check timestamp expiration
    })

    app.Start()
}
```

Configure the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TOF_APP_KEY` | No | Taihu application key (for logout redirect) |
| `TOF_APP_TOKEN` | Yes | Taihu application token (for signature verification) |
| `TOF_DEV_MOCK_USER` | No | Mock user for development (e.g., `testuser`) |

::: warning
The `TOF_DEV_MOCK_USER` is only for local development. Never set it in production!
:::

### Client Usage

<CodeTabs :tabs="['JavaScript']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// Authenticate with TOF (requires TOF gateway headers)
const authData = await pb.collection('users').authWithTof({
    taiIdentity: 'x-tai-identity-value',  // from x-tai-identity header
    timestamp: 'timestamp-value',          // from timestamp header
    signature: 'signature-value',          // from signature header
    seq: 'x-rio-seq-value',               // from x-rio-seq header
});

// Access auth data
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// Access TOF identity info
console.log(authData.meta.tofIdentity);
// { loginName: "username", staffId: 12345, expiration: "...", ticket: "..." }

// "logout"
pb.authStore.clear();
```

</template>

</CodeTabs>

### API Routes

The TOF plugin registers the following routes:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/collections/{collection}/auth-with-tof` | GET | TOF authentication |
| `/api/tof/logout?url={redirect_url}` | GET | TOF logout |
| `/api/tof/redirect?url={redirect_url}` | GET | TOF redirect verification |
| `/api/tof/status` | GET | TOF config status (superuser only) |

### Development Mode

For local development without TOF gateway, set `TOF_DEV_MOCK_USER` environment variable:

```bash
TOF_DEV_MOCK_USER=testuser go run main.go serve
```

When TOF headers are missing and `TOF_DEV_MOCK_USER` is set, the plugin will authenticate using a mock identity with the specified username.

## Multi-factor Authentication

PocketBase v0.23+ introduced optional Multi-factor authentication (MFA).

If enabled, it requires the user to authenticate with any 2 different auth methods from above (the order doesn't matter).

The expected flow is:

1. User authenticates with "Auth method A".
2. On success, a 401 response is sent with `{"mfaId": "..."}` as JSON body (the MFA "session" is stored in the `_mfas` system collection).
3. User authenticates with "Auth method B" as usual **but adds the `mfaId` from the previous step as body or query parameter**.
4. On success, a regular auth response is returned, aka. token + auth record data.

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

try {
  await pb.collection('users').authWithPassword('test@example.com', '1234567890');
} catch (err) {
  const mfaId = err.response?.mfaId;
  if (!mfaId) {
    throw err; // not mfa -> rethrow
  }

  // the user needs to authenticate again with another auth method, for example OTP
  const result = await pb.collection('users').requestOTP('test@example.com');
  // ... show a modal for users to check their email and to enter the received code ...
  await pb.collection('users').authWithOTP(result.otpId, 'EMAIL_CODE', { 'mfaId': mfaId });
}
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

try {
  await pb.collection('users').authWithPassword('test@example.com', '1234567890');
} on ClientException catch (e) {
  final mfaId = e.response['mfaId'];
  if (mfaId == null) {
    throw e; // not mfa -> rethrow
  }

  // the user needs to authenticate again with another auth method, for example OTP
  final result = await pb.collection('users').requestOTP('test@example.com');
  // ... show a modal for users to check their email and to enter the received code ...
  await pb.collection('users').authWithOTP(result.otpId, 'EMAIL_CODE', query: { 'mfaId': mfaId });
}
```

</template>

</CodeTabs>

## Users Impersonation

Superusers have the option to generate tokens and authenticate as anyone else via the [Impersonate endpoint](/en/api/records#impersonate).

**The generated impersonate auth tokens can have custom duration but are not renewable!**

For convenience the official SDKs creates and returns a standalone client that keeps the token state in memory, aka. only for the duration of the impersonate client instance.

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// authenticate as superuser
await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

// impersonate (the custom token duration is in seconds and it is optional)
const impersonateClient = await pb.collection("users").impersonate("USER_RECORD_ID", 3600)

// log the impersonate token and user data
console.log(impersonateClient.authStore.token);
console.log(impersonateClient.authStore.record);

// send requests as the impersonated user
const items = await impersonateClient.collection("example").getFullList();
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// authenticate as superuser
await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

// impersonate (the custom token duration is in seconds and it is optional)
final impersonateClient = await pb.collection("users").impersonate("USER_RECORD_ID", 3600)

// log the impersonate token and user data
print(impersonateClient.authStore.token);
print(impersonateClient.authStore.record);

// send requests as the impersonated user
final items = await impersonateClient.collection("example").getFullList();
```

</template>

</CodeTabs>

## API Keys

While PocketBase doesn't have "API keys" in the traditional sense, as a side effect of the support for users impersonation, for such cases you can use instead the generated nonrenewable `_superusers` impersonate auth token.

You can generate such token via the above impersonate API or from the *Dashboard > Collections > _superusers > {select superuser} > "Impersonate" dropdown option*.

![Screenshot of the _superusers impersonate popup](/images/screenshots/impersonate.png)

::: danger
Because of the security implications (superusers can execute, access and modify anything), use the generated `_superusers` tokens with extreme care and only for internal **server-to-server** communication.

To invalidate already issued tokens, you need to change the individual superuser account password (or if you want to reset the tokens for all superusers - change the shared auth token secret from the `_superusers` collection options).
:::

## Auth Token Verification

PocketBase doesn't have a dedicated token verification endpoint, but if you want to verify an existing auth token from a 3rd party app you can send an [Auth refresh](/en/api/records#auth-refresh) call, aka. `pb.collection("users").authRefresh()`.

On valid token - it returns a new token with refreshed `exp` claim and the latest user data.

Otherwise - returns an error response.

Note that calling `authRefresh` doesn't invalidate previously issued tokens and you can safely disregard the new one if you don't need it (as mentioned in the beginning - PocketBase doesn't store the tokens on the server).

Performance wise, the used `HS256` algorithm for generating the JWT has very little to no impact and it is essentially the same in terms of response time as calling `getOne("USER_ID")` (see [benchmarks](https://github.com/pocketbase/benchmarks/blob/master/results/hetzner_cax11.md#user-auth-refresh)).
