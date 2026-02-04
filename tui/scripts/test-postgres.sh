#!/bin/bash
# PostgreSQL E2E 测试脚本
# 使用 Docker 启动 PostgreSQL，然后运行同一套 E2E 测试

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUI_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$TUI_DIR")"

# PostgreSQL 配置
PG_CONTAINER_NAME="pocketbase-tui-postgres-test"
PG_PORT=5433
PG_USER="postgres"
PG_PASSWORD="postgres"
PG_DB="pocketbase_tui_test"
PB_PORT=8091
PB_DATA_DIR="/tmp/pb_postgres_test_data_$$"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cleanup() {
    log_info "清理测试环境..."
    
    # 停止 PocketBase
    if [ ! -z "$PB_PID" ]; then
        kill $PB_PID 2>/dev/null || true
        wait $PB_PID 2>/dev/null || true
    fi
    
    # 停止并删除 PostgreSQL 容器
    docker stop $PG_CONTAINER_NAME 2>/dev/null || true
    docker rm $PG_CONTAINER_NAME 2>/dev/null || true
    
    # 清理临时数据目录
    rm -rf "$PB_DATA_DIR" 2>/dev/null || true
    
    log_info "清理完成"
}

trap cleanup EXIT

# 1. 启动 PostgreSQL 容器
log_info "启动 PostgreSQL 容器..."

# 先清理可能存在的旧容器
docker stop $PG_CONTAINER_NAME 2>/dev/null || true
docker rm $PG_CONTAINER_NAME 2>/dev/null || true

docker run -d \
    --name $PG_CONTAINER_NAME \
    -e POSTGRES_USER=$PG_USER \
    -e POSTGRES_PASSWORD=$PG_PASSWORD \
    -e POSTGRES_DB=$PG_DB \
    -p $PG_PORT:5432 \
    postgres:15

# 等待 PostgreSQL 就绪
log_info "等待 PostgreSQL 就绪..."
for i in {1..30}; do
    if docker exec $PG_CONTAINER_NAME pg_isready -U $PG_USER -d $PG_DB >/dev/null 2>&1; then
        log_info "PostgreSQL 已就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "PostgreSQL 启动超时"
        exit 1
    fi
    sleep 1
done

# 2. 构建并启动 PocketBase (PostgreSQL 模式)
log_info "构建 PocketBase..."
cd "$PROJECT_ROOT/examples/base"

# 创建临时数据目录
mkdir -p "$PB_DATA_DIR"

PG_DSN="postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}?sslmode=disable"

log_info "启动 PocketBase (PostgreSQL 模式)..."
go run main.go serve \
    --pg="$PG_DSN" \
    --http="127.0.0.1:$PB_PORT" \
    --dir="$PB_DATA_DIR" \
    2>&1 &

PB_PID=$!

# 等待 PocketBase 就绪
log_info "等待 PocketBase 就绪..."
for i in {1..60}; do
    if curl -s "http://127.0.0.1:$PB_PORT/api/health" >/dev/null 2>&1; then
        log_info "PocketBase 已就绪 (PostgreSQL 模式)"
        break
    fi
    if [ $i -eq 60 ]; then
        log_error "PocketBase 启动超时"
        exit 1
    fi
    sleep 1
done

# 3. 创建测试账号
log_info "创建测试账号..."

# 使用 PocketBase CLI 创建 superuser
cd "$PROJECT_ROOT/examples/base"
go run main.go superuser create test@test.com test123456 \
    --pg="$PG_DSN" \
    --dir="$PB_DATA_DIR" 2>/dev/null || log_warn "superuser 可能已存在"

# 4. 创建测试集合 (posts, tags)
log_info "创建测试集合..."

# 获取 token
TOKEN=$(curl -s -X POST "http://127.0.0.1:$PB_PORT/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    -d '{"identity":"test@test.com","password":"test123456"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    log_error "无法获取认证 token"
    exit 1
fi

# 创建 posts 集合
curl -s -X POST "http://127.0.0.1:$PB_PORT/api/collections" \
    -H "Content-Type: application/json" \
    -H "Authorization: $TOKEN" \
    -d '{
        "name": "posts",
        "type": "base",
        "fields": [
            {"name": "title", "type": "text", "required": true},
            {"name": "content", "type": "text"},
            {"name": "published", "type": "bool"}
        ]
    }' >/dev/null 2>&1 || log_warn "posts 集合可能已存在"

# 创建 tags 集合
curl -s -X POST "http://127.0.0.1:$PB_PORT/api/collections" \
    -H "Content-Type: application/json" \
    -H "Authorization: $TOKEN" \
    -d '{
        "name": "tags",
        "type": "base",
        "fields": []
    }' >/dev/null 2>&1 || log_warn "tags 集合可能已存在"

# 创建测试数据 (30 条 posts)
log_info "创建测试数据..."
for i in {1..30}; do
    curl -s -X POST "http://127.0.0.1:$PB_PORT/api/collections/posts/records" \
        -H "Content-Type: application/json" \
        -H "Authorization: $TOKEN" \
        -d "{\"title\": \"Post $i\", \"content\": \"Content $i\", \"published\": $([ $((i % 2)) -eq 0 ] && echo "true" || echo "false")}" >/dev/null 2>&1
done

log_info "测试数据创建完成"

# 5. 运行 E2E 测试
log_info "运行 E2E 测试 (PostgreSQL 模式)..."
cd "$TUI_DIR"

# 设置测试 URL 并运行测试
TEST_URL="http://127.0.0.1:$PB_PORT" bun test tests/e2e/ --timeout 120000

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    log_info "✅ PostgreSQL E2E 测试全部通过!"
else
    log_error "❌ PostgreSQL E2E 测试失败 (exit code: $TEST_EXIT_CODE)"
fi

exit $TEST_EXIT_CODE
