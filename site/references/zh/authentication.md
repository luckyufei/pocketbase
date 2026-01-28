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

你也可以使用 OAuth2 提供商（Google、GitHub、Microsoft 等）认证用户。详见下方示例集成。

::: info
开始之前，你需要在提供商的仪表板中创建 OAuth2 应用以获取 **Client Id** 和 **Client Secret**，并注册重定向 URL。

获得 **Client Id** 和 **Client Secret** 后，你可以从 PocketBase 认证集合选项中启用和配置提供商（**PocketBase > Collections > {你的集合} > 编辑集合（设置齿轮）> Options > OAuth2**）。
:::

### 一体化方式（推荐）

此方法在单次调用中处理所有内容，无需定义自定义重定向、深度链接甚至页面重载。

创建 OAuth2 应用时，回调/重定向 URL 需要使用 `https://yourdomain.com/api/oauth2-redirect`（本地测试时使用 `http://127.0.0.1:8090/api/oauth2-redirect`）。

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase.io');

...

// 此方法初始化一次性实时订阅，并打开一个弹窗窗口
// 显示 OAuth2 提供商页面进行认证。
//
// 外部 OAuth2 登录/注册流程完成后，弹窗窗口将自动关闭，
// OAuth2 数据通过之前建立的实时连接发送回用户。
//
// 如果在 Safari 中弹窗被阻止，请确保你的点击处理程序没有使用 async/await。
pb.collection('users').authWithOAuth2({
    provider: 'google'
}).then((authData) => {
    console.log(authData)

    // 之后你也可以从 authStore 访问认证数据
    console.log(pb.authStore.isValid);
    console.log(pb.authStore.token);
    console.log(pb.authStore.record.id);

    // "登出" 最后认证的记录
    pb.authStore.clear();
});
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';
import 'package:url_launcher/url_launcher.dart';

final pb = PocketBase('https://pocketbase.io');

...

// 此方法初始化一次性实时订阅，并使用 OAuth2 提供商的 URL 调用提供的 urlCallback 进行认证。
//
// 外部 OAuth2 登录/注册流程完成后，浏览器窗口将自动关闭，
// OAuth2 数据通过之前建立的实时连接发送回用户。
//
// 注意：这需要应用和实时连接在后台保持活跃！
// 对于 Android 15+，请查看 https://github.com/pocketbase/dart-sdk#oauth2-and-android-15 中的说明。
final authData = await pb.collection('users').authWithOAuth2('google', (url) async {
  // 或使用 flutter_custom_tabs 使原生和 Web 内容之间的过渡更加顺畅
  await launchUrl(url);
});

// 之后你也可以从 authStore 访问认证数据
print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

// "登出" 最后认证的记录
pb.authStore.clear();
```

</template>

</CodeTabs>

### 手动代码交换

使用 OAuth2 代码手动认证时，你需要 2 个端点：

- 某处显示 "Login with ..." 链接
- 某处处理提供商的重定向以交换认证代码获取 token

这是一个简单的 Web 示例：

1. **链接页面**（例如 https://127.0.0.1:8090 提供 `pb_public/index.html`）：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OAuth2 links page</title>
    <script src="https://code.jquery.com/jquery-3.7.1.slim.min.js"></script>
</head>
<body>
    <ul id="list">
        <li>Loading OAuth2 providers...</li>
    </ul>

    <script type="module">
        import PocketBase from "https://cdn.jsdelivr.net/gh/pocketbase/js-sdk@master/dist/pocketbase.es.mjs"

        const pb          = new PocketBase("http://127.0.0.1:8090");
        const redirectURL = "http://127.0.0.1:8090/redirect.html";

        const authMethods = await pb.collection("users").listAuthMethods();
        const providers   = authMethods.oauth2?.providers || [];
        const listItems   = [];

        for (const provider of providers) {
            const $li = $(`<li><a>Login with ${provider.name}</a></li>`);

            $li.find("a")
                .attr("href", provider.authURL + redirectURL)
                .data("provider", provider)
                .click(function () {
                    // store provider's data on click for verification in the redirect page
                    localStorage.setItem("provider", JSON.stringify($(this).data("provider")));
                });

            listItems.push($li);
        }

        $("#list").html(listItems.length ? listItems : "<li>No OAuth2 providers.</li>");
    </script>
</body>
</html>
```

2. **重定向处理页面**（例如 https://127.0.0.1:8090/redirect.html 提供 `pb_public/redirect.html`）：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>OAuth2 redirect page</title>
</head>
<body>
    <pre id="content">Authenticating...</pre>

    <script type="module">
        import PocketBase from "https://cdn.jsdelivr.net/gh/pocketbase/js-sdk@master/dist/pocketbase.es.mjs"

        const pb          = new PocketBase("http://127.0.0.1:8090");
        const redirectURL = "http://127.0.0.1:8090/redirect.html";
        const contentEl   = document.getElementById("content");

        // parse the query parameters from the redirected url
        const params = (new URL(window.location)).searchParams;

        // load the previously stored provider's data
        const provider = JSON.parse(localStorage.getItem("provider"))

        // compare the redirect's state param and the stored provider's one
        if (provider.state !== params.get("state")) {
            contentEl.innerText = "State parameters don't match.";
        } else {
            // authenticate
            pb.collection("users").authWithOAuth2Code(
                provider.name,
                params.get("code"),
                provider.codeVerifier,
                redirectURL,
                // pass any optional user create data
                {
                    emailVisibility: false,
                }
            ).then((authData) => {
                contentEl.innerText = JSON.stringify(authData, null, 2);
            }).catch((err) => {
                contentEl.innerText = "Failed to exchange code.\n" + err;
            });
        }
    </script>
</body>
</html>
```

::: info Apple Sign-in 注意
使用"手动代码交换"流程进行 Apple Sign-in 时，你的重定向处理程序必须接受 `POST` 请求才能接收 Apple 用户的姓名和邮箱。如果你只需要 Apple 用户 ID，可以保持重定向处理程序为 `GET`，但需要在 Apple 授权 URL 中将 `response_mode=form_post` 替换为 `response_mode=query`。
:::

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

- 有效 token - 返回带有刷新 `exp` 声明的新 token 和最新用户数据。
- 否则 - 返回错误响应。

注意，调用 `authRefresh` 不会使先前发行的 token 失效，如果不需要可以安全地丢弃新 token（如开头所述 - PocketBase 不在服务器上存储 token）。

性能方面，用于生成 JWT 的 `HS256` 算法影响很小或没有影响，响应时间本质上与调用 `getOne("USER_ID")` 相同（见 [benchmarks](https://github.com/pocketbase/benchmarks/blob/master/results/hetzner_cax11.md#user-auth-refresh)）。
