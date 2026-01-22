# 身份认证

[[toc]]

## 概述

只要客户端发送带有有效 `Authorization:YOUR_AUTH_TOKEN` 请求头的请求，就被视为已认证。

PocketBase Web API 是完全无状态的，没有传统意义上的会话（甚至 token 也不存储在数据库中）。

因为没有会话且我们不在服务器上存储 token，所以也没有登出端点。要"登出"用户，只需从本地状态中丢弃 token（如果使用 SDK，即 `pb.authStore.clear()`）。

认证 token 可以通过特定的认证集合 Web API 生成，也可以通过 Go/JS 以编程方式生成。

所有允许的认证集合方法都可以在特定认证集合选项中单独配置。

::: info
注意 PocketBase 管理员（即 `_superusers`）与普通认证集合记录类似，但有 2 个注意事项：
- `_superusers` 集合不支持 OAuth2 作为认证方法
- 超级用户可以访问和修改任何内容（集合 API 规则被忽略）
:::

## 密码认证

要使用密码进行认证，必须启用认证集合的 *身份/密码* 选项（另见 [Web API 参考](/zh/api/records#auth-with-password)）。

默认身份字段是 `email`，但你可以配置任何其他唯一字段，如 "username"（必须有 UNIQUE 索引）。

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const authData = await pb.collection("users").authWithPassword('test@example.com', '1234567890');

// 之后你也可以从 authStore 访问认证数据
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "登出"最后认证的记录
pb.authStore.clear();
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

final authData = await pb.collection("users").authWithPassword('test@example.com', '1234567890');

// 之后你也可以从 authStore 访问认证数据
print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

// "登出"最后认证的记录
pb.authStore.clear();
```

</template>

</CodeTabs>

## OTP 认证

要使用邮箱验证码认证，必须启用认证集合的 *一次性密码 (OTP)* 选项（另见 [Web API 参考](/zh/api/records#auth-with-otp)）。

通常流程是用户手动输入从邮件中收到的密码，但你也可以从集合选项中调整默认邮件模板，添加包含 OTP 及其 ID 作为查询参数的 URL（你可以使用 `{OTP}` 和 `{OTP_ID}` 占位符）。

注意，即使提供的邮箱用户不存在，请求 OTP 时我们也会返回 `otpId` 作为基本的枚举保护（它不会创建或发送任何内容）。

OTP 验证成功后，默认情况下相关用户邮箱将自动标记为"已验证"。

::: warning
请记住，OTP 作为独立的认证方法可能比其他方法不够安全，因为生成的密码通常是 0-9 数字，存在被猜测或枚举的风险（特别是配置了较长持续时间时）。

对于安全关键型应用，建议将 OTP 与其他认证方法和[多因素认证](#多因素认证)选项结合使用。
:::

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// 向提供的认证记录发送 OTP 邮件
const result = await pb.collection('users').requestOTP('test@example.com');

// ... 显示屏幕/弹窗让用户输入邮件中的密码 ...

// 使用请求的 OTP ID 和邮件密码进行认证
const authData = await pb.collection('users').authWithOTP(result.otpId, "YOUR_OTP");

// 之后你也可以从 authStore 访问认证数据
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "登出"
pb.authStore.clear();
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// 向提供的认证记录发送 OTP 邮件
final result = await pb.collection('users').requestOTP('test@example.com');

// ... 显示屏幕/弹窗让用户输入邮件中的密码 ...

// 使用请求的 OTP ID 和邮件密码进行认证
final authData = await pb.collection('users').authWithOTP(result.otpId, "YOUR_OTP");

// 之后你也可以从 authStore 访问认证数据
print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

// "登出"
pb.authStore.clear();
```

</template>

</CodeTabs>

## OAuth2 认证

你也可以使用 OAuth2 提供商（Google、GitHub、Microsoft 等）认证用户。详见 [Web API 参考](/zh/api/records#auth-with-oauth2)。

## TOF 认证（腾讯内部）

TOF（Tencent Open Framework）是腾讯内部统一认证网关。此认证方法仅适用于腾讯内部应用。

### 服务端配置

首先，在你的 Go 应用中注册 TOF 插件：

```go
import "github.com/pocketbase/pocketbase/plugins/tofauth"

func main() {
    app := pocketbase.New()

    // 注册 TOF 插件
    tofauth.MustRegister(app, tofauth.Config{
        SafeMode:       tofauth.Bool(true),  // 生产环境推荐
        CheckTimestamp: tofauth.Bool(true),  // 检查时间戳过期
    })

    app.Start()
}
```

配置以下环境变量：

| 变量 | 必需 | 描述 |
|----------|----------|-------------|
| `TOF_APP_KEY` | 否 | 太湖应用密钥（用于登出重定向） |
| `TOF_APP_TOKEN` | 是 | 太湖应用令牌（用于签名验证） |
| `TOF_DEV_MOCK_USER` | 否 | 开发用模拟用户（如 `testuser`） |

::: warning
`TOF_DEV_MOCK_USER` 仅用于本地开发。切勿在生产环境中设置！
:::

### 客户端使用

<CodeTabs :tabs="['JavaScript']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// 使用 TOF 认证（需要 TOF 网关头）
const authData = await pb.collection('users').authWithTof({
    taiIdentity: 'x-tai-identity-value',  // 来自 x-tai-identity 头
    timestamp: 'timestamp-value',          // 来自 timestamp 头
    signature: 'signature-value',          // 来自 signature 头
    seq: 'x-rio-seq-value',               // 来自 x-rio-seq 头
});

// 访问认证数据
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// 访问 TOF 身份信息
console.log(authData.meta.tofIdentity);
// { loginName: "username", staffId: 12345, expiration: "...", ticket: "..." }

// "登出"
pb.authStore.clear();
```

</template>

</CodeTabs>

### API 路由

TOF 插件注册以下路由：

| 路由 | 方法 | 描述 |
|-------|--------|-------------|
| `/api/collections/{collection}/auth-with-tof` | GET | TOF 认证 |
| `/api/tof/logout?url={redirect_url}` | GET | TOF 登出 |
| `/api/tof/redirect?url={redirect_url}` | GET | TOF 重定向验证 |
| `/api/tof/status` | GET | TOF 配置状态（仅超级用户） |

### 开发模式

在没有 TOF 网关的本地开发环境中，设置 `TOF_DEV_MOCK_USER` 环境变量：

```bash
TOF_DEV_MOCK_USER=testuser go run main.go serve
```

当 TOF 头缺失且设置了 `TOF_DEV_MOCK_USER` 时，插件将使用指定用户名的模拟身份进行认证。

## 多因素认证

PocketBase v0.23+ 引入了可选的多因素认证（MFA）。

如果启用，它要求用户使用上述任意 2 种不同的认证方法进行认证（顺序无关）。

预期流程是：

1. 用户使用"认证方法 A"进行认证。
2. 成功后，返回 401 响应，JSON 正文为 `{"mfaId": "..."}`（MFA "会话"存储在 `_mfas` 系统集合中）。
3. 用户照常使用"认证方法 B"进行认证，**但将上一步的 `mfaId` 作为正文或查询参数添加**。
4. 成功后，返回常规认证响应，即 token + 认证记录数据。

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
    throw err; // 不是 MFA -> 重新抛出
  }

  // 用户需要使用另一种认证方法再次认证，例如 OTP
  const result = await pb.collection('users').requestOTP('test@example.com');
  // ... 显示弹窗让用户查看邮箱并输入收到的验证码 ...
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
    throw e; // 不是 MFA -> 重新抛出
  }

  // 用户需要使用另一种认证方法再次认证，例如 OTP
  final result = await pb.collection('users').requestOTP('test@example.com');
  // ... 显示弹窗让用户查看邮箱并输入收到的验证码 ...
  await pb.collection('users').authWithOTP(result.otpId, 'EMAIL_CODE', query: { 'mfaId': mfaId });
}
```

</template>

</CodeTabs>

## 用户模拟

超级用户可以通过[模拟端点](/zh/api/records#impersonate)生成 token 并以其他任何人的身份进行认证。

**生成的模拟认证 token 可以有自定义持续时间，但不可续期！**

为方便起见，官方 SDK 创建并返回一个独立客户端，将 token 状态保存在内存中，即仅在模拟客户端实例存在期间有效。

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// 以超级用户身份认证
await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

// 模拟（自定义 token 持续时间以秒为单位，可选）
const impersonateClient = await pb.collection("users").impersonate("USER_RECORD_ID", 3600)

// 记录模拟 token 和用户数据
console.log(impersonateClient.authStore.token);
console.log(impersonateClient.authStore.record);

// 以被模拟用户身份发送请求
const items = await impersonateClient.collection("example").getFullList();
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

// 以超级用户身份认证
await pb.collection("_superusers").authWithPassword("test@example.com", "1234567890");

// 模拟（自定义 token 持续时间以秒为单位，可选）
final impersonateClient = await pb.collection("users").impersonate("USER_RECORD_ID", 3600)

// 记录模拟 token 和用户数据
print(impersonateClient.authStore.token);
print(impersonateClient.authStore.record);

// 以被模拟用户身份发送请求
final items = await impersonateClient.collection("example").getFullList();
```

</template>

</CodeTabs>

## API 密钥

虽然 PocketBase 没有传统意义上的 "API 密钥"，但由于支持用户模拟，对于此类场景，你可以使用生成的不可续期 `_superusers` 模拟认证 token。

你可以通过上述模拟 API 或从*管理后台 > Collections > _superusers > {选择超级用户} > "Impersonate" 下拉选项*生成此类 token。

![_superusers 模拟弹窗截图](/images/screenshots/impersonate.png)

::: danger
由于安全影响（超级用户可以执行、访问和修改任何内容），请极其谨慎地使用生成的 `_superusers` token，仅用于内部**服务器到服务器**通信。

要使已发行的 token 失效，你需要更改单个超级用户账户密码（或如果你想重置所有超级用户的 token - 从 `_superusers` 集合选项更改共享认证 token 密钥）。
:::

## 认证 Token 验证

PocketBase 没有专门的 token 验证端点，但如果你想从第三方应用验证现有认证 token，可以发送[认证刷新](/zh/api/records#auth-refresh)调用，即 `pb.collection("users").authRefresh()`。

有效 token - 返回带有刷新 `exp` 声明的新 token 和最新用户数据。

否则 - 返回错误响应。

注意，调用 `authRefresh` 不会使先前发行的 token 失效，如果不需要可以安全地丢弃新 token（如开头所述 - PocketBase 不在服务器上存储 token）。

性能方面，用于生成 JWT 的 `HS256` 算法影响很小或没有影响，响应时间本质上与调用 `getOne("USER_ID")` 相同（见 [benchmarks](https://github.com/pocketbase/benchmarks/blob/master/results/hetzner_cax11.md#user-auth-refresh)）。
