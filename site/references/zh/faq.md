# 常见问题

::: danger 0. 为什么？
PocketBase 的创建是为了协助构建可以在单个服务器上运行的自包含应用程序，无需安装任何额外的东西（*参见 [Presentator#183](https://github.com/presentator/presentator/issues/183)*）。

基本思想是，常见功能如增删改查、认证、文件上传、自动 TLS 等都是开箱即用的，让你可以专注于 UI 和实际的应用业务需求。

请注意，PocketBase 既不是初创公司，也不是企业。它背后没有付费团队或公司。它是一个有意限制范围的个人开源项目，完全基于志愿者开发。除了已经可用的内容之外，没有维护和支持的承诺（*你可以查看[路线图](https://github.com/orgs/pocketbase/projects/2/views/1)大致了解项目的发展方向，但没有固定的预计时间*）。

**如果你没有时间至少浏览一下文档，并且计划完全依赖某些 AI 工具，那么请不要使用 PocketBase！**
:::

## 1. 你们提供托管服务吗？

不提供。PocketBase 仅支持自托管。如果你正在寻找适合小型概念验证和个人项目的免费选项，可以查看：

- [Google Cloud 免费套餐](https://cloud.google.com/free/docs/free-cloud-features#compute)
  - *免费套餐 e2-micro 计算实例配备 0.25vCPU、30GB 磁盘存储、1GB 内存和每月 200GB 标准层出口流量，区域必须是 us-central1 | us-west1 | us-east1。*

- [Oracle Cloud 永久免费服务](https://www.oracle.com/cloud/free/)
  - *AMD 和 ARM 架构的计算实例，有不同的免费额度和存储选项（注：有未经证实的报告称"不活跃"账户会被随机删除）。*

- [IBM LinuxONE 开源软件社区云](https://community.ibm.com/zsystems/form/l1cc-oss-vm-request/)
  - *为开源项目提供的免费 IBM Z (s390x) 虚拟机（需要填写表格）。*

对于更传统的设置，你可以使用任何提供持久存储的 VPS 提供商，如：
[Hetzner](https://www.hetzner.com/)、[Vultr](https://www.vultr.com/)、[UpCloud](https://upcloud.com/)、[Linode](https://www.linode.com/) 等。

[生产环境部署](/zh/going-to-production)指南包含如何部署 PocketBase 应用和一些配置建议的信息。

## 2. 能扩展吗？

只能在单个服务器上扩展，即垂直扩展。大多数时候，你可能不需要管理一组机器和服务的复杂性来运行后端。

**PocketBase 可能是中小型应用的绝佳选择** - SaaS、移动 API 后端、内网系统等。

即使没有优化，PocketBase 也可以在便宜的 $4 Hetzner CAX11 VPS（2vCPU，4GB RAM）上轻松支持 10,000+ 个持久实时连接。

你可以在官方[基准测试仓库](https://github.com/pocketbase/benchmarks)中找到各种读写操作的性能测试。

仍有改进空间（*我还没有做过广泛的性能分析*），但当前性能对于 PocketBase 所针对的应用类型来说已经足够好了。

## 3. 如何运行自定义代码？

PocketBase 不同于 Firebase、Supabase、Nhost 等其他类似的后端解决方案，不支持运行云函数。

**相反，PocketBase 可以作为 Go 或 JS 框架使用，使你能够构建自己的自定义应用特定业务逻辑，并最终获得一个可移植的后端**（查看[作为框架使用](/zh/use-as-framework)指南）。

## 4. 支持 Google 或 Facebook 登录吗？

是的，目前支持超过 15 种 OAuth2 提供商 - Apple、Google、Facebook、Microsoft、VK、GitHub、GitLab 等等。

## 5. 是否提供用户登录、注册等界面的前端 UI？

不提供。PocketBase 只提供客户端集成的 SDK，你可以自由实现自己的前端。

为方便起见，有默认的用户界面页面用于用户电子邮件确认链接（密码重置、验证等），但你也可以通过更新电子邮件模板集合设置中的 URL 来设置自己的页面。

## 6. 可以使用数据库 X 吗？

不能，至少不能开箱即用。PocketBase 使用嵌入式 SQLite（WAL 模式），没有计划支持其他数据库。

**对于大多数查询，SQLite（WAL 模式）优于传统数据库如 MySQL、MariaDB 或 PostgreSQL（尤其是读取操作）。**

如果你需要复制和灾难恢复，一个很好的配套应用是 [Litestream](https://litestream.io/)。

## 7. 如何从 PocketBase 导入/导出数据？

目前我们没有内置的数据导入/导出助手，但你可以探索[discussions#6287](https://github.com/pocketbase/pocketbase/discussions/6287)中提到的一些建议。

## 8. 可以捐款吗？

不可以。过去欢迎捐款（我非常感谢每一位贡献者），但个人的财务贡献通常带有一些"不言而喻的期望"，为了避免精神负担和在不处理贡献者功能请求时感到内疚，我决定停止接受 PocketBase 的捐款。

如果你是提供赞助或资助的组织的一员，并且想在财务上支持项目开发，可以通过 *support at pocketbase.io* 联系我，但前提是没有附加条件。

## 9. 在哪里可以获得 PocketBase 应用的帮助？

你可以随时在我们的公共[讨论区](https://github.com/pocketbase/pocketbase/discussions)寻求帮助、[提交问题](https://github.com/pocketbase/pocketbase)或联系 *support at pocketbase.io*。
