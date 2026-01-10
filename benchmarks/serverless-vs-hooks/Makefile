# Serverless vs Hooks 性能对比测试 Makefile

.PHONY: all build run run-quick run-full clean help setup

# 默认目标
all: build

# 构建测试工具
build:
	@echo "构建性能测试工具..."
	go build -o bin/benchmark ./cmd/benchmark

# 运行快速测试 (仅 HTTP Handler，低并发)
run-quick: build
	@echo "运行快速测试..."
	./bin/benchmark -scenario http_handler -concurrency 10 -duration 10s

# 运行标准测试
run: build
	@echo "运行标准测试..."
	./bin/benchmark

# 运行完整测试 (所有场景，高并发)
run-full: build
	@echo "运行完整测试..."
	./bin/benchmark -concurrency 200 -duration 60s

# 运行稳定性测试 (1小时)
run-stability: build
	@echo "运行稳定性测试 (1小时)..."
	./bin/benchmark -scenario stability -duration 1h

# 清理
clean:
	rm -rf bin/
	rm -rf reports/serverless-vs-hooks/*.json
	rm -rf reports/serverless-vs-hooks/*.md

# 设置测试环境
setup:
	@echo "设置测试环境..."
	@echo "1. 复制 jsvm hooks 到 pb_hooks/"
	mkdir -p ../../examples/base/pb_hooks
	cp fixtures/jsvm/benchmark.pb.js ../../examples/base/pb_hooks/
	@echo "2. 复制 serverless functions 到 pb_serverless/"
	mkdir -p ../../examples/base/pb_serverless/routes
	mkdir -p ../../examples/base/pb_serverless/hooks
	cp fixtures/serverless/routes/benchmark.ts ../../examples/base/pb_serverless/routes/
	cp fixtures/serverless/hooks/benchmark.ts ../../examples/base/pb_serverless/hooks/
	@echo "3. 创建测试 collections..."
	@echo "请在 PocketBase Admin UI 中创建以下 collections:"
	@echo "  - benchmark_data (用于 I/O 测试)"
	@echo "  - benchmark_jsvm (用于 jsvm hook 测试)"
	@echo "  - benchmark_serverless (用于 serverless hook 测试)"
	@echo ""
	@echo "设置完成！请重启 PocketBase 后运行测试。"

# 帮助
help:
	@echo "Serverless vs Hooks 性能对比测试"
	@echo ""
	@echo "使用方法:"
	@echo "  make build          构建测试工具"
	@echo "  make run-quick      快速测试 (10s)"
	@echo "  make run            标准测试"
	@echo "  make run-full       完整测试 (高并发)"
	@echo "  make run-stability  稳定性测试 (1h)"
	@echo "  make setup          设置测试环境"
	@echo "  make clean          清理构建产物"
	@echo ""
	@echo "命令行参数:"
	@echo "  -url <url>          PocketBase 服务地址 (默认: http://127.0.0.1:8090)"
	@echo "  -scenario <name>    指定测试场景 (逗号分隔)"
	@echo "  -concurrency <n>    并发数"
	@echo "  -duration <d>       测试持续时间 (如 30s, 1m)"
	@echo "  -verbose            详细输出"
	@echo "  -output <dir>       报告输出目录"
