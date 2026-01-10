#!/bin/bash
# build.sh - QuickJS WASM 构建脚本
#
# 使用 Zig 编译 QuickJS 为 WASM，无需 wasi-sdk
#
# 使用方法:
#   ./build.sh              # 构建 WASM
#   ./build.sh fetch        # 下载 QuickJS 源码
#   ./build.sh clean        # 清理构建产物
#   ./build.sh stub         # 生成占位 WASM
#   ./build.sh install-zig  # 安装 Zig (macOS/Linux)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="$OUTPUT_DIR/pb_runtime.wasm"
QUICKJS_DIR="$SCRIPT_DIR/quickjs"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 检查 Zig 是否安装
check_zig() {
    if ! command -v zig &> /dev/null; then
        error "Zig 未安装。请运行: ./build.sh install-zig"
    fi
    info "Zig 版本: $(zig version)"
}

# 安装 Zig
install_zig() {
    info "安装 Zig..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install zig
        else
            error "请先安装 Homebrew: https://brew.sh"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        ZIG_VERSION="0.13.0"
        ARCH=$(uname -m)
        if [[ "$ARCH" == "x86_64" ]]; then
            ZIG_ARCH="x86_64"
        elif [[ "$ARCH" == "aarch64" ]]; then
            ZIG_ARCH="aarch64"
        else
            error "不支持的架构: $ARCH"
        fi
        
        ZIG_URL="https://ziglang.org/download/$ZIG_VERSION/zig-linux-$ZIG_ARCH-$ZIG_VERSION.tar.xz"
        info "下载 Zig from $ZIG_URL"
        
        curl -L "$ZIG_URL" | tar xJ -C /tmp
        sudo mv "/tmp/zig-linux-$ZIG_ARCH-$ZIG_VERSION" /opt/zig
        sudo ln -sf /opt/zig/zig /usr/local/bin/zig
    else
        error "不支持的操作系统: $OSTYPE"
    fi
    
    info "Zig 安装完成: $(zig version)"
}

# 下载 QuickJS 源码
fetch_quickjs() {
    info "下载 QuickJS 源码..."
    mkdir -p "$QUICKJS_DIR"
    
    # 使用官方 QuickJS 仓库
    curl -sL https://github.com/bellard/quickjs/archive/refs/heads/master.tar.gz | \
        tar xz --strip-components=1 -C "$QUICKJS_DIR"
    
    info "QuickJS 源码已下载到 $QUICKJS_DIR/"
}

# 构建 WASM
build_wasm() {
    check_zig
    
    # 检查 QuickJS 源码
    if [[ ! -f "$QUICKJS_DIR/quickjs.c" ]]; then
        warn "QuickJS 源码未找到，正在下载..."
        fetch_quickjs
    fi
    
    info "构建 QuickJS WASM..."
    
    # 直接使用 zig cc (简单可靠，跨版本兼容)
    build_with_zig_cc
}

# 使用 zig cc 直接编译
build_with_zig_cc() {
    info "使用 zig cc 编译..."
    
    cd "$SCRIPT_DIR"
    
    zig cc \
        -target wasm32-wasi \
        -Os \
        -flto \
        -D_WASI_EMULATED_SIGNAL \
        -D_WASI_EMULATED_MMAN \
        -DEMSCRIPTEN \
        -DCONFIG_VERSION=\"2024-12-22\" \
        -I. \
        -I"$QUICKJS_DIR" \
        -Wl,--export=malloc \
        -Wl,--export=free \
        -Wl,--export=init_runtime \
        -Wl,--export=run_handler \
        -Wl,--export=get_response_ptr \
        -Wl,--export=get_response_len \
        -Wl,--export=reset_runtime \
        -Wl,--no-entry \
        -Wl,--import-symbols \
        -Wl,--strip-all \
        -Wl,--gc-sections \
        "$QUICKJS_DIR/quickjs.c" \
        "$QUICKJS_DIR/libregexp.c" \
        "$QUICKJS_DIR/libunicode.c" \
        "$QUICKJS_DIR/cutils.c" \
        "$QUICKJS_DIR/dtoa.c" \
        pb_bridge.c \
        bootloader.c \
        -o "$OUTPUT_FILE"
    
    info "构建完成: $OUTPUT_FILE"
    ls -lh "$OUTPUT_FILE"
}

# 清理
clean() {
    info "清理构建产物..."
    rm -f "$OUTPUT_FILE"
    rm -rf "$SCRIPT_DIR/zig-cache"
    rm -rf "$SCRIPT_DIR/zig-out"
    rm -rf "$SCRIPT_DIR/.zig-cache"
    info "清理完成"
}

# 生成占位 WASM
stub() {
    info "生成占位 WASM..."
    echo -n "STUB_WASM" > "$OUTPUT_FILE"
    info "占位 WASM 已生成: $OUTPUT_FILE"
}

# 显示帮助
show_help() {
    cat << EOF
QuickJS WASM 构建脚本 (使用 Zig)

使用方法:
    ./build.sh              构建 pb_runtime.wasm
    ./build.sh fetch        下载 QuickJS 源码
    ./build.sh clean        清理构建产物
    ./build.sh stub         生成占位 WASM (用于测试)
    ./build.sh install-zig  安装 Zig
    ./build.sh help         显示此帮助

优势:
    - 无需 wasi-sdk (~1GB)
    - Zig 单文件 (~40MB)
    - 跨平台通用
    - CI/CD 友好
EOF
}

# 主入口
case "${1:-build}" in
    build)
        build_wasm
        ;;
    fetch|fetch-quickjs)
        fetch_quickjs
        ;;
    clean)
        clean
        ;;
    stub)
        stub
        ;;
    install-zig)
        install_zig
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "未知命令: $1\n运行 './build.sh help' 查看帮助"
        ;;
esac
