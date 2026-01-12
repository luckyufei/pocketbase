.PHONY: build dev preview clean serve build-go build-all

# 构建 VitePress 静态文件
build:
	bun run build

# 开发模式
dev:
	bun run dev

# 预览构建结果
preview:
	bun run preview

# 清理构建产物
clean:
	rm -rf docs/.vitepress/dist
	rm -rf docs/.vitepress/cache
	rm -rf cmd/dist
	rm -f pocket3as-site
	rm -f pocket3as-site-*

# 复制 dist 到 cmd 目录
copy-dist:
	rm -rf cmd/dist
	cp -r docs/.vitepress/dist cmd/dist

# 构建 Go 二进制文件
build-go: build copy-dist
	cd cmd && go build -o ../pocket3as-site .

# 运行 Go 服务器
serve: build-go
	./pocket3as-site

# 构建所有平台
build-all: build copy-dist
	cd cmd && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o ../pocket3as-site-linux-amd64 .
	cd cmd && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o ../pocket3as-site-linux-arm64 .
	cd cmd && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -o ../pocket3as-site-darwin-amd64 .
	cd cmd && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o ../pocket3as-site-darwin-arm64 .
	cd cmd && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o ../pocket3as-site-windows-amd64.exe .
