# QuickJS WASM 编译 Makefile
#
# 使用 wasi-sdk 将 QuickJS 编译为 WASM
# 产出: pb_runtime.wasm
#
# 依赖:
#   - wasi-sdk v22+ (https://github.com/WebAssembly/wasi-sdk)
#   - QuickJS 源码 (https://github.com/bellard/quickjs)
#
# 使用方法:
#   1. 下载 wasi-sdk 并设置 WASI_SDK_PATH
#   2. 下载 QuickJS 源码到 quickjs/ 目录
#   3. make

# wasi-sdk 路径（可通过环境变量覆盖）
WASI_SDK_PATH ?= /opt/wasi-sdk

# 编译器
CC = $(WASI_SDK_PATH)/bin/clang
AR = $(WASI_SDK_PATH)/bin/llvm-ar

# QuickJS 源码目录
QUICKJS_DIR = quickjs

# 编译选项
# 注意: 新版 QuickJS (2024+) 已移除 CONFIG_BIGNUM，BigInt 为内置支持
# EMSCRIPTEN 宏让 QuickJS 使用兼容 WASI 的 malloc_usable_size 实现（返回 0）
# -I. 优先使用本地 setjmp.h（WASI 兼容版本）
CFLAGS = -O3 \
	-D_WASI_EMULATED_SIGNAL \
	-D_WASI_EMULATED_MMAN \
	-DEMSCRIPTEN \
	-DCONFIG_VERSION=\"2024-12-22\" \
	-I. \
	-I$(QUICKJS_DIR)

# 链接选项
# --export=malloc/free: 允许 Go 往 WASM 内存写数据
# --no-entry: 不需要 _start 入口
# --allow-undefined: 允许导入未定义的函数（host functions）
LDFLAGS = -Wl,--export=malloc \
	-Wl,--export=free \
	-Wl,--export=run_handler \
	-Wl,--export=init_runtime \
	-Wl,--export=get_response_ptr \
	-Wl,--export=get_response_len \
	-Wl,--no-entry \
	-Wl,--allow-undefined \
	-lwasi-emulated-signal \
	-lwasi-emulated-mman

# QuickJS 源文件
# 注意: 新版 QuickJS 已移除 libbf.c，BigInt 实现已内置到 quickjs.c
# dtoa.c 包含 u32toa/i32toa/i64toa 等数字转字符串函数
QUICKJS_SRCS = \
	$(QUICKJS_DIR)/quickjs.c \
	$(QUICKJS_DIR)/libregexp.c \
	$(QUICKJS_DIR)/libunicode.c \
	$(QUICKJS_DIR)/cutils.c \
	$(QUICKJS_DIR)/dtoa.c

# PocketBase 桥接源文件
PB_SRCS = \
	pb_bridge.c \
	bootloader.c

# 目标文件
OUTPUT = ../pb_runtime.wasm

.PHONY: all clean check-deps download-quickjs

all: check-deps $(OUTPUT)

$(OUTPUT): $(QUICKJS_SRCS) $(PB_SRCS)
	@echo "编译 QuickJS WASM..."
	$(CC) $(CFLAGS) $(LDFLAGS) \
		$(QUICKJS_SRCS) \
		$(PB_SRCS) \
		-o $(OUTPUT)
	@echo "产出: $(OUTPUT)"
	@ls -lh $(OUTPUT)

check-deps:
	@if [ ! -d "$(WASI_SDK_PATH)" ]; then \
		echo "错误: wasi-sdk 未找到，请设置 WASI_SDK_PATH 环境变量"; \
		echo "下载地址: https://github.com/WebAssembly/wasi-sdk/releases"; \
		exit 1; \
	fi
	@if [ ! -f "$(QUICKJS_DIR)/quickjs.c" ]; then \
		echo "错误: QuickJS 源码未找到，请运行 'make download-quickjs'"; \
		exit 1; \
	fi

download-quickjs:
	@echo "下载 QuickJS 源码..."
	@mkdir -p $(QUICKJS_DIR)
	@curl -L https://github.com/bellard/quickjs/archive/refs/heads/master.tar.gz | \
		tar xz --strip-components=1 -C $(QUICKJS_DIR)
	@echo "QuickJS 源码已下载到 $(QUICKJS_DIR)/"

clean:
	rm -f $(OUTPUT)

# 开发用：生成占位 WASM（用于测试框架）
stub:
	@echo "生成占位 WASM..."
	@echo -n "STUB_WASM" > $(OUTPUT)
