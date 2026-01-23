# PocketBase 文档站点

基于 VitePress 构建的 PocketBase 文档站点，支持使用 Go embed 打包成独立可执行文件。

## 目录结构

```
site/
├── references/            # VitePress 文档源文件（重命名自 docs/）
│   ├── .vitepress/       # VitePress 配置
│   │   ├── config.ts     # 站点配置
│   │   └── dist/         # 构建输出
│   ├── api/              # Web API 文档
│   ├── go/               # Go SDK 文档
│   ├── js/               # JS SDK 文档
│   └── public/           # 静态资源
├── assets/               # 可复用的配置模板和资源
│   ├── Caddyfile                    # Caddy 反向代理配置模板
│   ├── collection-schema-template.json  # Collection schema 模板
│   ├── docker-compose.yml           # Docker Compose 部署模板
│   └── frontend-template.html       # 前端集成示例模板
├── scripts/              # 自动化脚本
│   ├── setup_pocketbase.sh   # PocketBase 安装和初始化脚本
│   ├── import_data.py        # 数据导入脚本（CSV/JSON → PocketBase）
│   └── export_data.py        # 数据导出脚本（PocketBase → CSV/JSON）
├── cmd/                  # Go 命令行入口
│   ├── main.go           # 主程序
│   ├── go.mod            # Go 模块定义
│   └── dist/             # 嵌入的静态文件（构建时复制）
├── SKILL.md              # LLM Agent Skill 指令文件（Claude Code 等）
├── Makefile              # 构建脚本
└── package.json          # Node.js 依赖
```

## SKILL.md - LLM Agent Skill

`SKILL.md` 是为 LLM Agent（如 Claude Code）设计的技能描述文件，提供：

- **快速导航**：按场景分类的文档索引
- **完整目录**：所有 API、Go/JS 扩展文档的结构化列表
- **查询模式**：常见问题的文档映射
- **研究指南**：帮助 Agent 高效检索信息

Agent 可以通过读取此文件快速了解 PocketBase 文档结构，并准确定位用户查询所需的参考资料。

## assets/ - 配置模板

| 文件 | 用途 |
|------|------|
| `Caddyfile` | Caddy 反向代理配置，用于生产部署 |
| `collection-schema-template.json` | Collection schema JSON 模板，快速创建集合 |
| `docker-compose.yml` | Docker Compose 配置，一键部署 PocketBase |
| `frontend-template.html` | 前端集成示例，展示 JS SDK 用法 |

## scripts/ - 自动化脚本

| 脚本 | 用途 |
|------|------|
| `setup_pocketbase.sh` | 下载安装 PocketBase，创建初始配置 |
| `import_data.py` | 从 CSV/JSON 批量导入数据到 PocketBase |
| `export_data.py` | 从 PocketBase 导出数据到 CSV/JSON |

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建静态站点
npm run build

# 预览构建结果
npm run preview
```

## 构建独立可执行文件

使用 Go embed 将文档站点打包成单个可执行文件，无需额外依赖即可运行。

### 使用 npm scripts

```bash
# 准备构建产物（构建 VitePress 并复制到 cmd/dist）
npm run prepare:dist

# 构建当前平台的可执行文件
npm run build:server
# 输出: ./site-server

# 构建 Linux 版本
npm run build:server:linux
# 输出: ./site-server-linux

# 构建 macOS 版本
npm run build:server:darwin
# 输出: ./site-server-darwin

# 构建 Windows 版本
npm run build:server:windows
# 输出: ./site-server.exe

# 一键构建所有平台
npm run build:all

# 构建并运行
npm run serve
```

### 使用 Makefile（如果存在）

```bash
# 构建当前平台的可执行文件
make build-go

# 构建所有平台
make build-all

# 运行
./pocketbase-docs --port=8080
```

### 可用的 npm scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 VitePress 开发服务器 |
| `npm run build` | 构建 VitePress 静态站点 |
| `npm run preview` | 预览构建结果 |
| `npm run prepare:dist` | 构建并准备 dist 目录用于 Go embed |
| `npm run build:server` | 构建当前平台的 Go 服务器 |
| `npm run build:server:linux` | 构建 Linux AMD64 版本（静态链接） |
| `npm run build:server:darwin` | 构建 macOS AMD64 版本（静态链接） |
| `npm run build:server:windows` | 构建 Windows AMD64 版本（静态链接） |
| `npm run build:all` | 构建所有平台版本 |
| `npm run serve` | 构建并启动服务器 |

### 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--port` | 8080 | 服务器端口 |
| `--host` | 127.0.0.1 | 服务器地址 |

## 原始来源

SYNC from https://github.com/pocketbase/site.git, commit: 746f3deed fixed typo and removed npx usage