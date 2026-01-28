# 介绍

::: warning
请注意，PocketBase 仍在积极开发中，在 v1.0.0 之前不保证完全向后兼容。除非你愿意阅读 [更新日志](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md) 并不时进行一些手动迁移，否则暂不推荐将 PocketBase 用于生产关键型应用。
:::

PocketBase 是一个开源后端，包含嵌入式数据库（SQLite）、实时订阅、内置身份认证管理、便捷的管理后台 UI 以及简洁的 REST 风格 API。它既可以作为 Go 框架使用，也可以作为独立应用程序运行。

## 下载

最简单的入门方式是下载预构建的 PocketBase 可执行文件：

### x64

- [下载 v0.36.1 Linux x64 版本 (~12MB zip)](https://github.com/pocketbase/pocketbase/releases/download/v0.36.1/pocketbase_0.36.1_linux_amd64.zip)
- [下载 v0.36.1 Windows x64 版本 (~12MB zip)](https://github.com/pocketbase/pocketbase/releases/download/v0.36.1/pocketbase_0.36.1_windows_amd64.zip)
- [下载 v0.36.1 macOS x64 版本 (~12MB zip)](https://github.com/pocketbase/pocketbase/releases/download/v0.36.1/pocketbase_0.36.1_darwin_amd64.zip)

### ARM64

- [下载 v0.36.1 Linux ARM64 版本 (~11MB zip)](https://github.com/pocketbase/pocketbase/releases/download/v0.36.1/pocketbase_0.36.1_linux_arm64.zip)
- [下载 v0.36.1 Windows ARM64 版本 (~11MB zip)](https://github.com/pocketbase/pocketbase/releases/download/v0.36.1/pocketbase_0.36.1_windows_arm64.zip)
- [下载 v0.36.1 macOS ARM64 版本 (~11MB zip)](https://github.com/pocketbase/pocketbase/releases/download/v0.36.1/pocketbase_0.36.1_darwin_arm64.zip)

更多平台和详情请查看 [GitHub Releases 页面](https://github.com/pocketbase/pocketbase/releases)。

---

## 快速开始

解压后，在解压目录中运行 `./pocketbase serve` 即可启动应用。

**就是这么简单！** 首次启动时会生成一个安装链接，该链接会自动在浏览器中打开，用于设置你的第一个超级用户账号（也可以通过 `./pocketbase superuser create EMAIL PASS` 手动创建）。

启动的 Web 服务器包含以下默认路由：

- [`http://127.0.0.1:8090`](http://127.0.0.1:8090) - 如果存在 `pb_public` 目录，则提供其中的静态内容（html、css、图片等）
- [`http://127.0.0.1:8090/_/`](http://127.0.0.1:8090/_/) - 超级用户管理后台
- [`http://127.0.0.1:8090/api/`](http://127.0.0.1:8090/api/) - REST 风格 API

## 目录结构

预构建的 PocketBase 可执行文件会在同目录下创建和管理 2 个新目录：

- `pb_data` - 存储应用数据、上传的文件等（通常应添加到 `.gitignore`）
- `pb_migrations` - 包含记录集合变更的 JS 迁移文件（可以安全提交到代码仓库）

你还可以编写自定义迁移脚本。更多信息请查看 [JS 迁移文档](/zh/js/migrations)。

运行 `./pocketbase --help` 或 `./pocketbase [command] --help` 可查看所有可用命令及其选项。
