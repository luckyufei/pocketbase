# PocketBase 性能基准测试 Makefile

.PHONY: all build test clean run-all run-sqlite run-http run-websocket run-database help

# 默认目标
all: build

# 构建
build:
	@echo "🔨 构建基准测试工具..."
	@mkdir -p bin reports/comparison reports/cluster reports/sqlite reports/postgresql
	go build -o bin/benchmark ./cmd/benchmark
	go build -o bin/pg-compare ./cmd/pg-compare
	go build -o bin/cluster-benchmark ./cmd/cluster-benchmark
	@echo "✅ 构建完成: bin/benchmark, bin/pg-compare, bin/cluster-benchmark"

# 运行测试
test:
	@echo "🧪 运行单元测试..."
	go test -v -cover ./...

# 清理
clean:
	@echo "🧹 清理构建产物和测试数据..."
	rm -rf bin/
	rm -f benchmark.db benchmark.db-wal benchmark.db-shm
	rm -f *.db *.db-wal *.db-shm
	@echo "注: reports/ 目录包含测试报告，不会被清理"

# 依赖管理
deps:
	@echo "📦 更新依赖..."
	go mod tidy

# ============ 运行测试 ============

# 运行完整测试套件
run-all: build
	@echo "🚀 运行完整测试套件..."
	./bin/benchmark -test all -duration 30s -concurrency 10

# SQLite 测试
run-sqlite: build
	@echo "📊 运行 SQLite 基准测试..."
	./bin/benchmark -test sqlite -db sqlite -duration 30s

run-sqlite-small: build
	@echo "📊 运行 SQLite 小规模测试..."
	./bin/benchmark -test sqlite -db sqlite -scale small -duration 15s

run-sqlite-medium: build
	@echo "📊 运行 SQLite 中规模测试..."
	./bin/benchmark -test sqlite -db sqlite -scale medium -duration 30s

run-sqlite-large: build
	@echo "📊 运行 SQLite 大规模测试..."
	./bin/benchmark -test sqlite -db sqlite -scale large -duration 60s

# PostgreSQL 测试
run-postgres: build
	@echo "📊 运行 PostgreSQL 基准测试..."
	./bin/benchmark -test database -db postgresql -duration 30s

# PostgreSQL vs SQLite 对比测试
run-pg-compare: build
	@echo "📊 运行 PostgreSQL vs SQLite 对比测试..."
	./bin/pg-compare -duration 30s -concurrency 10 -scale small -verbose

run-pg-compare-all: build
	@echo "📊 运行完整 PostgreSQL 版本对比测试..."
	./bin/pg-compare -duration 60s -concurrency 20 -scale medium -verbose

run-pg15: build
	@echo "📊 运行 PostgreSQL 15 测试..."
	./bin/pg-compare -duration 30s -concurrency 10 -pg-versions 15 -skip-sqlite -verbose

run-pg16: build
	@echo "📊 运行 PostgreSQL 16 测试..."
	./bin/pg-compare -duration 30s -concurrency 10 -pg-versions 16 -skip-sqlite -verbose

run-pg17: build
	@echo "📊 运行 PostgreSQL 17 测试..."
	./bin/pg-compare -duration 30s -concurrency 10 -pg-versions 17 -skip-sqlite -verbose

run-pg18: build
	@echo "📊 运行 PostgreSQL 18 测试..."
	./bin/pg-compare -duration 30s -concurrency 10 -pg-versions 18 -skip-sqlite -verbose

# ============ 集群测试 ============

# 2 节点集群测试 (1主1从)
run-cluster-2node: build
	@echo "📊 运行 2 节点集群测试..."
	./bin/cluster-benchmark -duration 30s -concurrency 20 \
		-primary-host localhost -primary-port 5440 \
		-replica-hosts localhost -replica-ports 5441 \
		-password pocketbase_test_password -verbose

# 3 节点集群测试 (1主2从)
run-cluster-3node: build
	@echo "📊 运行 3 节点集群测试..."
	./bin/cluster-benchmark -duration 30s -concurrency 30 \
		-primary-host localhost -primary-port 5440 \
		-replica-hosts localhost,localhost -replica-ports 5441,5442 \
		-password pocketbase_test_password -verbose

# HAProxy 负载均衡测试
run-cluster-haproxy: build
	@echo "📊 运行 HAProxy 负载均衡测试..."
	./bin/cluster-benchmark -duration 30s -concurrency 50 \
		-primary-host localhost -primary-port 5440 \
		-replica-hosts localhost -replica-ports 5441 \
		-haproxy-host localhost -haproxy-write 5450 -haproxy-read 5451 \
		-password pocketbase_test_password -use-haproxy -verbose

# 集群扩展性测试 (对比 1/2/3 节点)
run-cluster-scalability: build
	@echo "📊 运行集群扩展性测试..."
	@echo "=== 单节点基准 ==="
	./bin/pg-compare -duration 20s -concurrency 20 -pg-versions 17 -skip-sqlite -pg-password pocketbase_test_password
	@echo ""
	@echo "=== 2 节点集群 ==="
	./bin/cluster-benchmark -duration 20s -concurrency 20 \
		-primary-host localhost -primary-port 5440 \
		-replica-hosts localhost -replica-ports 5441 \
		-password pocketbase_test_password
	@echo ""
	@echo "=== 3 节点集群 ==="
	./bin/cluster-benchmark -duration 20s -concurrency 30 \
		-primary-host localhost -primary-port 5440 \
		-replica-hosts localhost,localhost -replica-ports 5441,5442 \
		-password pocketbase_test_password

# HTTP 测试
run-http: build
	@echo "🌐 运行 HTTP API 测试..."
	./bin/benchmark -test http -duration 30s -concurrency 10

# WebSocket 测试
run-websocket: build
	@echo "🔌 运行 WebSocket 测试..."
	./bin/benchmark -test websocket -duration 30s -concurrency 50

# 数据库直连测试
run-database: build
	@echo "📊 运行数据库直连测试..."
	./bin/benchmark -test database -duration 30s

# ============ 配置文件运行 ============

run-config: build
	@echo "📋 使用配置文件运行测试..."
	@if [ -z "$(CONFIG)" ]; then \
		echo "❌ 请指定配置文件: make run-config CONFIG=configs/local-sqlite.json"; \
		exit 1; \
	fi
	./bin/benchmark -config $(CONFIG)

run-local-sqlite: build
	./bin/benchmark -config configs/local-sqlite.json

run-local-postgres: build
	./bin/benchmark -config configs/local-postgres.json

run-docker-postgres: build
	./bin/benchmark -config configs/docker-postgres.json

# ============ 报告生成 ============

report:
	@echo "📄 生成测试报告..."
	@if [ -z "$(INPUT)" ]; then \
		echo "❌ 请指定输入文件: make report INPUT=results/report.json"; \
		exit 1; \
	fi
	./bin/benchmark -generate-report $(INPUT)

# ============ 帮助 ============

help:
	@echo ""
	@echo "PocketBase 性能基准测试工具"
	@echo ""
	@echo "用法: make <target>"
	@echo ""
	@echo "构建和测试:"
	@echo "  build              构建基准测试工具"
	@echo "  test               运行单元测试"
	@echo "  clean              清理构建产物"
	@echo "  deps               更新依赖"
	@echo ""
	@echo "SQLite 测试:"
	@echo "  run-sqlite         运行 SQLite 基准测试"
	@echo "  run-sqlite-small   运行 SQLite 小规模测试"
	@echo "  run-sqlite-medium  运行 SQLite 中规模测试"
	@echo "  run-sqlite-large   运行 SQLite 大规模测试"
	@echo ""
	@echo "PostgreSQL 测试:"
	@echo "  run-postgres       运行 PostgreSQL 基准测试"
	@echo "  run-pg-compare     PostgreSQL vs SQLite 对比测试"
	@echo "  run-pg-compare-all 完整 PostgreSQL 版本对比测试"
	@echo "  run-pg15           运行 PostgreSQL 15 测试"
	@echo "  run-pg16           运行 PostgreSQL 16 测试"
	@echo "  run-pg17           运行 PostgreSQL 17 测试"
	@echo "  run-pg18           运行 PostgreSQL 18 测试"
	@echo ""
	@echo "PostgreSQL 集群测试:"
	@echo "  run-cluster-2node      2 节点集群测试 (1主1从)"
	@echo "  run-cluster-3node      3 节点集群测试 (1主2从)"
	@echo "  run-cluster-haproxy    HAProxy 负载均衡测试"
	@echo "  run-cluster-scalability 集群扩展性对比测试"
	@echo ""
	@echo "其他测试:"
	@echo "  run-all            运行完整测试套件"
	@echo "  run-http           运行 HTTP API 测试"
	@echo "  run-websocket      运行 WebSocket 测试"
	@echo "  run-database       运行数据库直连测试"
	@echo ""
	@echo "配置文件运行:"
	@echo "  run-config CONFIG=<file>  使用配置文件运行"
	@echo "  run-local-sqlite          使用本地 SQLite 配置"
	@echo "  run-local-postgres        使用本地 PostgreSQL 配置"
	@echo "  run-docker-postgres       使用 Docker PostgreSQL 配置"
	@echo ""
	@echo "示例:"
	@echo "  make build"
	@echo "  make run-sqlite-small"
	@echo "  make run-pg-compare"
	@echo "  make run-cluster-2node"
	@echo "  make run-config CONFIG=configs/production.json"
	@echo ""
