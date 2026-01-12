# PocketBase 文档站点

基于 VitePress 构建的 PocketBase 文档站点，支持使用 Go embed 打包成独立可执行文件。

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 构建静态站点
bun run build

# 预览构建结果
bun run preview
```

## 构建独立可执行文件

使用 Go embed 将文档站点打包成单个可执行文件，无需额外依赖即可运行。

### 快速构建

```bash
# 构建当前平台的可执行文件
make build-go

# 运行
./pocketbase-docs --port=8080
```

### 跨平台构建

```bash
# 构建所有平台
make build-all
```

生成的二进制文件：
- `pocketbase-docs-linux-amd64`
- `pocketbase-docs-linux-arm64`
- `pocketbase-docs-darwin-amd64`
- `pocketbase-docs-darwin-arm64`
- `pocketbase-docs-windows-amd64.exe`

### 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--port` | 8080 | 服务器端口 |
| `--host` | 127.0.0.1 | 服务器地址 |

## 目录结构

```
site-vitepress/
├── docs/                  # VitePress 文档源文件
│   ├── .vitepress/       # VitePress 配置
│   │   ├── config.ts     # 站点配置
│   │   └── dist/         # 构建输出
│   ├── api/              # Web API 文档
│   ├── go/               # Go SDK 文档
│   ├── js/               # JS SDK 文档
│   └── public/           # 静态资源
├── cmd/                   # Go 命令行入口
│   ├── main.go           # 主程序
│   ├── go.mod            # Go 模块定义
│   └── dist/             # 嵌入的静态文件（构建时复制）
├── Makefile              # 构建脚本
└── package.json          # Node.js 依赖
```

## 原始来源

SYNC from https://github.com/pocketbase/site.git, commit: 746f3deed fixed typo and removed npx usage