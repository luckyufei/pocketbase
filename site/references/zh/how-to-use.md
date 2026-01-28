# 如何使用

使用 PocketBase 最简单的方式是直接从客户端（如移动应用或浏览器 SPA）与其 Web API 交互。

PocketBase 正是为此场景设计的，这也是为什么它提供了通用的 JSON API 来支持列表查询、分页、排序、过滤等功能。

数据的访问和过滤控制通常通过 [集合 API 规则](/zh/api-rules-and-filters) 来实现。

对于需要更专业处理的场景（如发送邮件、拦截默认操作、创建新路由等），你可以 [使用 Go 或 JavaScript 扩展 PocketBase](/zh/use-as-framework)。

## SDK 客户端

与 [Web API](/zh/api/records) 交互时，你可以使用官方 SDK 客户端：

- [JavaScript SDK](https://github.com/pocketbase/js-sdk)（浏览器、Node.js、React Native）
- [Dart SDK](https://github.com/pocketbase/dart-sdk)（Web、移动端、桌面端、CLI）

::: tip
在客户端使用时，可以安全地在整个应用生命周期内使用单个/全局的 SDK 实例。
:::

## Web 应用建议

<Accordion title="Web 应用建议">

不是所有人都会同意这个观点，但如果你使用 PocketBase 构建 Web 应用，我建议将前端开发为**传统的客户端 SPA**，对于需要额外服务端处理的场景（如支付 Webhook、额外的服务端数据验证等），你可以尝试：

- [将 PocketBase 作为 Go/JS 框架使用](/zh/use-as-framework)来创建新路由或拦截现有路由
- 创建一次性的 Node.js/Bun/Deno 等服务端操作，仅以超级用户身份与 PocketBase 交互，将其作为纯数据存储（类似传统数据库交互，但通过 HTTP）

在这种情况下，可以安全地使用全局超级用户客户端，例如：

```javascript
// src/superuser.js
import PocketBase from "pocketbase"

const superuserClient = new PocketBase('https://example.com');

// 禁用自动取消，以便处理多用户的异步请求
superuserClient.autoCancellation(false);

// 方式 1：使用邮箱/密码进行超级用户认证（可使用环境变量填充）
await superuserClient.collection('_superusers').authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASS, {
  // 当 token 过期或将在 30 分钟内过期时，自动刷新或重新认证
  autoRefreshThreshold: 30 * 60
})

// 方式 2：或使用长期有效的 "API 密钥" 进行超级用户认证
// (参见 https://pocketbase.io/docs/authentication/#api-keys)
superuserClient.authStore.save('YOUR_GENERATED_SUPERUSER_TOKEN')

export default superuserClient;
```

然后你可以在服务端操作中直接导入该文件并使用客户端：

```javascript
import superuserClient from './src/superuser.js'

async function serverAction(req, resp) {
  ... 执行额外的数据验证或处理 ...

  // 以超级用户身份发送创建请求
  await superuserClient.collection('example').create({ ... })
}
```

</Accordion>

<Accordion title="为什么不推荐 JS SSR">

将 PocketBase 与 SvelteKit、Nuxt、Next.js 等元框架配合使用**在 JS SSR 模式下**是可行的，但会带来很多复杂性，你需要仔细评估在现有后端（Node.js 服务器）之外再添加另一个后端（PocketBase）是否值得。

你可以在 [JS SSR - 问题与建议 #5313](https://github.com/pocketbase/pocketbase/discussions/5313) 中了解更多潜在问题，以下是一些常见陷阱：

- 在长时间运行的服务端上下文中，JS SDK 实例初始化和共享不当导致的安全问题
- 与仅服务端 OAuth2 流程相关的 OAuth2 集成困难（或其混合的"一体化"客户端处理以及与服务端共享 cookie）
- 代理实时连接，本质上是重复 PocketBase 已经做的事情
- 默认单线程 Node.js 进程导致的性能瓶颈，以及由于服务端渲染和不同层之间频繁来回请求通信（`客户端<->Node.js<->PocketBase`）造成的过度资源消耗

这并不意味着使用 PocketBase 配合 JS SSR 总是"坏事"，但根据迄今为止报告的数十个问题，我建议只有在仔细评估后，并且仅对那些深入了解所使用工具及其权衡的经验丰富的开发者才推荐使用。如果你仍想使用 PocketBase 在 JS SSR 元框架中处理常规用户认证，可以在仓库的 [JS SSR 集成部分](https://github.com/pocketbase/js-sdk#ssr-integration) 找到一些 JS SDK 示例。

</Accordion>

<Accordion title="为什么不推荐 htmx、Hotwire/Turbo、Unpoly 等">

htmx、Hotwire/Turbo、Unpoly 和其他类似工具通常用于构建服务端渲染应用，但它们与 PocketBase 的 JSON API 和完全无状态特性不太兼容。

虽然可以将它们与 PocketBase 一起使用，但目前我不推荐这样做，因为我们缺少构建 SSR 优先应用所需的辅助工具，这意味着你可能需要从头开始创建很多东西，例如用于处理 cookie 的中间件（*最终还要处理 CORS 和 CSRF*）或自定义认证端点和访问控制（*集合 API 规则仅适用于内置的 JSON 路由*）。

将来我们可能会为这种用例提供官方的 SSR 支持，包括指南和中间件，但再次强调 - PocketBase 并非为此设计，你可能需要重新评估应用的技术栈，转向如前所述的传统客户端 SPA，或使用更适合你用例的其他后端解决方案。

</Accordion>

## 移动应用认证持久化

<Accordion title="移动应用认证持久化">

使用 JavaScript SDK 或 Dart SDK 构建移动应用时，如果要在各种应用活动和打开/关闭状态之间保持认证，需要指定自定义持久化存储。

SDK 提供了一个辅助异步存储实现，允许你接入任何自定义持久化层（本地文件、SharedPreferences、基于键值的数据库等）。以下是 React Native (JavaScript) 和 Flutter (Dart) 的最小 PocketBase SDK 初始化示例：

<CodeTabs :tabs="['JavaScript', 'Dart']">

<template #tab-0>

```javascript
// Node.js 和 React Native 没有原生 EventSource 实现
// 因此要使用实时订阅，你需要加载 EventSource polyfill，
// 例如：npm install react-native-sse --save
import eventsource from 'react-native-sse';

import AsyncStorage from '@react-native-async-storage/async-storage';

import PocketBase, { AsyncAuthStore } from 'pocketbase';

// 加载 polyfill
global.EventSource = eventsource;

// 初始化异步存储
const store = new AsyncAuthStore({
    save:    async (serialized) => AsyncStorage.setItem('pb_auth', serialized),
    initial: AsyncStorage.getItem('pb_auth'),
});

// 初始化 PocketBase 客户端
// (在应用的整个生命周期内使用单个/全局实例是可以的)
const pb = new PocketBase('http://127.0.0.1:8090', store);

...

await pb.collection('users').authWithPassword('test@example.com', '1234567890');

console.log(pb.authStore.record)
```

</template>

<template #tab-1>

```dart
import 'package:pocketbase/pocketbase.dart';
import 'package:shared_preferences/shared_preferences.dart';

// 为简单起见，我们使用简单的 SharedPreferences 实例
// 但你也可以用更安全的 EncryptedSharedPreferences 替代方案
final prefs = await SharedPreferences.getInstance();

// 初始化异步存储
final store = AsyncAuthStore(
  save:    (String data) async => prefs.setString('pb_auth', data),
  initial: prefs.getString('pb_auth'),
);

// 初始化 PocketBase 客户端
// (在应用的整个生命周期内使用单个/全局实例是可以的)
final pb = PocketBase('http://127.0.0.1:8090', authStore: store);

...

await pb.collection('users').authWithPassword('test@example.com', '1234567890');

print(pb.authStore.record);
```

</template>

</CodeTabs>

</Accordion>

<Accordion title="React Native 在 Android 和 iOS 上的文件上传">

在撰写本文时，React Native 在 Android 和 iOS 上似乎有非标准的 `FormData` 实现，在这些平台上上传文件需要以下特殊对象语法：

```javascript
{
  uri: "...",
  type: "...",
  name: "..."
}
```

换句话说，你可能需要应用类似以下的条件处理：

```javascript
const data = new FormData();

// result 是 ImagePicker.launchImageLibraryAsync 返回的 Promise 结果
let imageUri = result.assets[0].uri;

if (Platform.OS === 'web') {
  const req = await fetch(imageUri);
  const blob = await req.blob();
  data.append('avatar', blob); // 常规 File/Blob 值
} else {
  // 以下对象格式仅适用于 Android 和 iOS
  // (FormData.set() 似乎也不支持，所以我们使用 FormData.append())
  data.append('avatar', {
    uri:  imageUri,
    type: 'image/*',
    name: imageUri.split('/').pop(),
  });
}

await pb.collection('example').create(data)
```

</Accordion>

---

接下来的几页将介绍更多关于 PocketBase 基本组件的信息，如集合、记录、认证、关联关系、文件处理等。
