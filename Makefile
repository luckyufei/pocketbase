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
