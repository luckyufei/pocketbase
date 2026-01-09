/**
 * pb_bridge.c - PocketBase JS Bindings for QuickJS WASM
 *
 * 此文件定义了 JS 如何调用 Go Host Functions 的桥接层。
 * 实现 quickjs-wasm.md 中定义的 ABI 规格。
 *
 * Host Functions (从 Go 导入):
 *   - host_request(op, ptr, len) -> res_ptr  万能网关
 *   - host_log(ptr, len, level) -> void      日志转发
 *   - host_error(ptr, len) -> void           致命错误
 */

#include "quickjs.h"
#include <string.h>
#include <stdlib.h>

// ============================================================================
// Host Function 声明 (从 Go 导入)
// ============================================================================

// 万能网关：所有 DB/Fetch/KV/Queue 操作都走这个入口
// op: 操作码 (1=fetch, 2=db, 3=kv_get, ...)
// ptr: 请求 payload 指针
// len: payload 长度
// 返回: 响应 JSON 指针
__attribute__((import_module("env"), import_name("host_request")))
extern unsigned int host_request(unsigned int op, unsigned int ptr, unsigned int len);

// 日志转发
// ptr: 日志消息指针
// len: 消息长度
// level: 日志级别 (0=log, 1=warn, 2=error)
__attribute__((import_module("env"), import_name("host_log")))
extern void host_log(unsigned int ptr, unsigned int len, unsigned int level);

// 致命错误，终止实例
__attribute__((import_module("env"), import_name("host_error")))
extern void host_error(unsigned int ptr, unsigned int len);

// ============================================================================
// 全局状态
// ============================================================================

// 响应缓冲区（用于返回结果给 Go）
static char g_response_buffer[65536];  // 64KB 响应缓冲区
static unsigned int g_response_len = 0;

// ============================================================================
// 内部辅助函数
// ============================================================================

/**
 * pb_op - JS 调用 Host Function 的内部接口
 *
 * 这是 JS SDK 调用 Go 的核心函数。
 * JS 侧调用: __pb_op(op_code, payload_json)
 */
static JSValue js_pb_op(JSContext *ctx, JSValueConst this_val,
                        int argc, JSValueConst *argv)
{
    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "pb_op requires 2 arguments");
    }

    // 获取操作码
    int32_t op;
    if (JS_ToInt32(ctx, &op, argv[0]) < 0) {
        return JS_EXCEPTION;
    }

    // 获取 payload JSON 字符串
    size_t payload_len;
    const char *payload = JS_ToCStringLen(ctx, &payload_len, argv[1]);
    if (!payload) {
        return JS_EXCEPTION;
    }

    // 调用 Host Function
    unsigned int res_ptr = host_request((unsigned int)op,
                                        (unsigned int)(uintptr_t)payload,
                                        (unsigned int)payload_len);

    JS_FreeCString(ctx, payload);

    // 读取响应
    // 响应格式: { "data": ..., "error": "..." }
    if (res_ptr == 0) {
        return JS_ThrowInternalError(ctx, "host_request failed");
    }

    // 从响应指针读取 JSON
    // 注意：响应长度通过约定的内存位置获取
    const char *response = (const char *)(uintptr_t)res_ptr;
    
    // 解析响应 JSON
    JSValue result = JS_ParseJSON(ctx, response, strlen(response), "<host_response>");
    if (JS_IsException(result)) {
        return result;
    }

    // 检查是否有错误
    JSValue error = JS_GetPropertyStr(ctx, result, "error");
    if (!JS_IsUndefined(error) && !JS_IsNull(error)) {
        const char *err_msg = JS_ToCString(ctx, error);
        JS_FreeValue(ctx, error);
        JS_FreeValue(ctx, result);
        if (err_msg) {
            JSValue err = JS_ThrowInternalError(ctx, "%s", err_msg);
            JS_FreeCString(ctx, err_msg);
            return err;
        }
        return JS_ThrowInternalError(ctx, "unknown error");
    }
    JS_FreeValue(ctx, error);

    // 返回 data 字段
    JSValue data = JS_GetPropertyStr(ctx, result, "data");
    JS_FreeValue(ctx, result);

    return data;
}

/**
 * console.log/warn/error 实现
 */
static JSValue js_console_log(JSContext *ctx, JSValueConst this_val,
                              int argc, JSValueConst *argv, int level)
{
    // 构建日志消息
    char buffer[4096];
    size_t offset = 0;

    for (int i = 0; i < argc; i++) {
        if (i > 0 && offset < sizeof(buffer) - 1) {
            buffer[offset++] = ' ';
        }

        const char *str = JS_ToCString(ctx, argv[i]);
        if (str) {
            size_t len = strlen(str);
            if (offset + len < sizeof(buffer)) {
                memcpy(buffer + offset, str, len);
                offset += len;
            }
            JS_FreeCString(ctx, str);
        }
    }
    buffer[offset] = '\0';

    // 调用 host_log
    host_log((unsigned int)(uintptr_t)buffer, (unsigned int)offset, (unsigned int)level);

    return JS_UNDEFINED;
}

static JSValue js_console_log_wrapper(JSContext *ctx, JSValueConst this_val,
                                      int argc, JSValueConst *argv)
{
    return js_console_log(ctx, this_val, argc, argv, 0);  // level 0 = log
}

static JSValue js_console_warn_wrapper(JSContext *ctx, JSValueConst this_val,
                                       int argc, JSValueConst *argv)
{
    return js_console_log(ctx, this_val, argc, argv, 1);  // level 1 = warn
}

static JSValue js_console_error_wrapper(JSContext *ctx, JSValueConst this_val,
                                        int argc, JSValueConst *argv)
{
    return js_console_log(ctx, this_val, argc, argv, 2);  // level 2 = error
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * pb_bridge_init - 初始化 PocketBase 桥接层
 *
 * 注册全局对象和函数到 JS 上下文：
 *   - globalThis.__pb_op(op, payload) - 内部 Host Function 调用
 *   - console.log/warn/error - 日志输出
 */
void pb_bridge_init(JSContext *ctx)
{
    JSValue global = JS_GetGlobalObject(ctx);

    // 注册 __pb_op 函数
    JSValue pb_op_func = JS_NewCFunction(ctx, js_pb_op, "__pb_op", 2);
    JS_SetPropertyStr(ctx, global, "__pb_op", pb_op_func);

    // 创建 console 对象
    JSValue console = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, console, "log",
                      JS_NewCFunction(ctx, js_console_log_wrapper, "log", 1));
    JS_SetPropertyStr(ctx, console, "warn",
                      JS_NewCFunction(ctx, js_console_warn_wrapper, "warn", 1));
    JS_SetPropertyStr(ctx, console, "error",
                      JS_NewCFunction(ctx, js_console_error_wrapper, "error", 1));
    JS_SetPropertyStr(ctx, console, "info",
                      JS_NewCFunction(ctx, js_console_log_wrapper, "info", 1));
    JS_SetPropertyStr(ctx, console, "debug",
                      JS_NewCFunction(ctx, js_console_log_wrapper, "debug", 1));
    JS_SetPropertyStr(ctx, global, "console", console);

    JS_FreeValue(ctx, global);
}

/**
 * pb_bridge_set_response - 设置响应内容（供 Go 调用）
 */
void pb_bridge_set_response(const char *response, unsigned int len)
{
    if (len > sizeof(g_response_buffer) - 1) {
        len = sizeof(g_response_buffer) - 1;
    }
    memcpy(g_response_buffer, response, len);
    g_response_buffer[len] = '\0';
    g_response_len = len;
}

/**
 * pb_bridge_get_response_ptr - 获取响应缓冲区指针
 */
unsigned int pb_bridge_get_response_ptr(void)
{
    return (unsigned int)(uintptr_t)g_response_buffer;
}

/**
 * pb_bridge_get_response_len - 获取响应长度
 */
unsigned int pb_bridge_get_response_len(void)
{
    return g_response_len;
}
