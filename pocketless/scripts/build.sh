#!/bin/bash
# build.sh — Pocketless 单二进制编译脚本
# 与 Go 版 CGO_ENABLED=0 编译对齐

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_DIR/src"
OUT_DIR="$PROJECT_DIR/dist"
ENTRY="$SRC_DIR/pocketless.ts"

# 默认目标平台（当前平台）
TARGET="${1:-}"
OUT_NAME="pocketless"

mkdir -p "$OUT_DIR"

echo "=== Pocketless Build ==="
echo "  Entry: $ENTRY"
echo "  Output: $OUT_DIR/$OUT_NAME"

if [ -n "$TARGET" ]; then
  echo "  Target: $TARGET"
  bun build --compile --minify --target="bun-$TARGET" "$ENTRY" --outfile "$OUT_DIR/$OUT_NAME-$TARGET"
  echo "  ✅ Built: $OUT_DIR/$OUT_NAME-$TARGET"
else
  bun build --compile --minify "$ENTRY" --outfile "$OUT_DIR/$OUT_NAME"
  echo "  ✅ Built: $OUT_DIR/$OUT_NAME"
fi

# 交叉编译支持
if [ "${CROSS_COMPILE:-}" = "true" ]; then
  echo ""
  echo "=== Cross-Compilation ==="
  for target in linux-x64 linux-arm64 darwin-arm64 darwin-x64; do
    echo "  Building for $target..."
    bun build --compile --minify --target="bun-$target" "$ENTRY" --outfile "$OUT_DIR/$OUT_NAME-$target"
    echo "  ✅ $OUT_DIR/$OUT_NAME-$target"
  done
fi

echo ""
echo "=== Build Complete ==="
ls -lh "$OUT_DIR"/pocketless*
