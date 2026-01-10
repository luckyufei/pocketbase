lint:
	golangci-lint run -c ./golangci.yml ./...

test:
	go test ./... -v --cover

# PostgreSQL 测试 (需要 Docker)
test-postgres:
	@echo "Running PostgreSQL integration tests..."
	go test ./tests/... -v -race -timeout 15m -run "TestPostgres"
	go test ./tools/dbutils/... -v -race -timeout 5m
	go test ./core/... -v -race -timeout 10m -run "TestIsolation|TestRetry|TestLock|TestGIN"

# PostgreSQL 15 专用测试
test-postgres-15:
	@echo "Running PostgreSQL 15 tests..."
	POSTGRES_VERSION=15 go test ./tests/... -v -race -timeout 15m -run "TestPostgres"

# PostgreSQL 16 专用测试
test-postgres-16:
	@echo "Running PostgreSQL 16 tests..."
	POSTGRES_VERSION=16 go test ./tests/... -v -race -timeout 15m -run "TestPostgres"

# 双数据库测试 (SQLite + PostgreSQL)
test-all:
	@echo "Running SQLite tests..."
	go test ./... -v -race -timeout 10m
	@echo "Running PostgreSQL tests..."
	$(MAKE) test-postgres

jstypes:
	go run ./plugins/jsvm/internal/types/types.go

test-report:
	go test ./... -v --cover -coverprofile=coverage.out
	go tool cover -html=coverage.out

# ============================================================================
# Serverless WASM 构建 (使用 Zig)
# ============================================================================

SERVERLESS_DIR = plugins/serverless/runtime/wasm/quickjs-src

# 构建 serverless WASM
serverless-wasm:
	@echo "Building Serverless WASM with Zig..."
	cd $(SERVERLESS_DIR) && ./build.sh

# 下载 QuickJS 源码
serverless-fetch:
	cd $(SERVERLESS_DIR) && ./build.sh fetch

# 清理 WASM 构建产物
serverless-clean:
	cd $(SERVERLESS_DIR) && ./build.sh clean

# 生成占位 WASM (用于不需要 serverless 的构建)
serverless-stub:
	cd $(SERVERLESS_DIR) && ./build.sh stub

# 安装 Zig (如未安装)
serverless-install-zig:
	cd $(SERVERLESS_DIR) && ./build.sh install-zig

# 构建带 serverless 的完整版本
build-full: serverless-wasm
	cd examples/base && go build -o pocketbase .

# 构建不带 serverless 的精简版本
build-lite: serverless-stub
	cd examples/base && go build -o pocketbase .
