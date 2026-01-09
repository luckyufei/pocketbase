/**
 * bootloader.c - QuickJS WASM 启动加载器
 *
 * 此文件是 WASM 模块的入口点，负责：
 * 1. 初始化 QuickJS 运行时
 * 2. 预加载 PocketBase JS SDK
 * 3. 执行用户 JS 代码
 *
 * 导出函数 (供 Go 调用):
 *   - init_runtime()           初始化运行时
 *   - run_handler(source_ptr)  执行 JS 代码
 *   - get_response_ptr()       获取响应指针
 *   - get_response_len()       获取响应长度
 */

#include "quickjs.h"
#include <string.h>
#include <stdlib.h>

// 从 pb_bridge.c 导入
extern void pb_bridge_init(JSContext *ctx);
extern void pb_bridge_set_response(const char *response, unsigned int len);
extern unsigned int pb_bridge_get_response_ptr(void);
extern unsigned int pb_bridge_get_response_len(void);

// ============================================================================
// 全局状态
// ============================================================================

static JSRuntime *g_runtime = NULL;
static JSContext *g_context = NULL;
static int g_initialized = 0;

// 响应缓冲区
static char g_result_buffer[65536];  // 64KB
static unsigned int g_result_len = 0;

// ============================================================================
// PocketBase JS SDK 预加载代码
// ============================================================================

// 这段 JS 代码会在运行时初始化时执行，提供 pb 全局对象
static const char *PB_SDK_PRELOAD = 
"// PocketBase Serverless SDK\n"
"(function() {\n"
"  'use strict';\n"
"\n"
"  // 操作码定义\n"
"  const OP_FETCH = 1;\n"
"  const OP_DB_QUERY = 2;\n"
"  const OP_KV_GET = 3;\n"
"  const OP_KV_SET = 4;\n"
"  const OP_SECRET_GET = 5;\n"
"  const OP_JOB_ENQUEUE = 6;\n"
"  const OP_FILE_READ = 7;\n"
"  const OP_FILE_SAVE = 8;\n"
"  const OP_VECTOR_SEARCH = 9;\n"
"  const OP_TX_BEGIN = 10;\n"
"  const OP_TX_COMMIT = 11;\n"
"  const OP_TX_ROLLBACK = 12;\n"
"  const OP_UTILS = 13;\n"
"\n"
"  // 内部调用 Host Function\n"
"  function hostCall(op, data) {\n"
"    const payload = JSON.stringify(data);\n"
"    return globalThis.__pb_op(op, payload);\n"
"  }\n"
"\n"
"  // Collection 服务\n"
"  function createCollectionService(name) {\n"
"    return {\n"
"      getOne: function(id) {\n"
"        return hostCall(OP_DB_QUERY, { op: 'one', col: name, id: id });\n"
"      },\n"
"      getList: function(page, perPage, options) {\n"
"        return hostCall(OP_DB_QUERY, {\n"
"          op: 'list', col: name, page: page, perPage: perPage,\n"
"          filter: options?.filter, sort: options?.sort, expand: options?.expand\n"
"        });\n"
"      },\n"
"      create: function(data) {\n"
"        return hostCall(OP_DB_QUERY, { op: 'create', col: name, data: data });\n"
"      },\n"
"      update: function(id, data) {\n"
"        return hostCall(OP_DB_QUERY, { op: 'update', col: name, id: id, data: data });\n"
"      },\n"
"      delete: function(id) {\n"
"        return hostCall(OP_DB_QUERY, { op: 'delete', col: name, id: id });\n"
"      },\n"
"      vectorSearch: function(opts) {\n"
"        return hostCall(OP_VECTOR_SEARCH, {\n"
"          col: name, vector: opts.vector, field: opts.field,\n"
"          filter: opts.filter, top: opts.top\n"
"        });\n"
"      }\n"
"    };\n"
"  }\n"
"\n"
"  // PocketBase 全局对象\n"
"  globalThis.pb = {\n"
"    collection: createCollectionService,\n"
"\n"
"    kv: {\n"
"      get: function(key) {\n"
"        return hostCall(OP_KV_GET, { key: key });\n"
"      },\n"
"      set: function(key, value, opts) {\n"
"        return hostCall(OP_KV_SET, { key: key, value: value, ttl: opts?.ttl });\n"
"      },\n"
"      delete: function(key) {\n"
"        return hostCall(OP_KV_SET, { key: key, value: null });\n"
"      }\n"
"    },\n"
"\n"
"    files: {\n"
"      read: function(collection, record, filename) {\n"
"        return hostCall(OP_FILE_READ, {\n"
"          collection: collection, recordId: record, filename: filename\n"
"        });\n"
"      },\n"
"      save: function(collection, record, file) {\n"
"        return hostCall(OP_FILE_SAVE, {\n"
"          collection: collection, recordId: record,\n"
"          filename: file.filename, data: file.data\n"
"        });\n"
"      }\n"
"    },\n"
"\n"
"    secrets: {\n"
"      get: function(name) {\n"
"        return hostCall(OP_SECRET_GET, { key: name });\n"
"      }\n"
"    },\n"
"\n"
"    jobs: {\n"
"      enqueue: function(topic, payload) {\n"
"        return hostCall(OP_JOB_ENQUEUE, { topic: topic, payload: payload });\n"
"      }\n"
"    },\n"
"\n"
"    utils: {\n"
"      uuid: function() {\n"
"        return hostCall(OP_UTILS, { func: 'uuid' });\n"
"      },\n"
"      hash: function(input) {\n"
"        return hostCall(OP_UTILS, { func: 'hash', input: input });\n"
"      },\n"
"      randomString: function(length) {\n"
"        return hostCall(OP_UTILS, { func: 'randomString', len: length });\n"
"      }\n"
"    },\n"
"\n"
"    tx: function(fn) {\n"
"      var txId = hostCall(OP_TX_BEGIN, {});\n"
"      try {\n"
"        var result = fn({ collection: createCollectionService });\n"
"        hostCall(OP_TX_COMMIT, { txId: txId });\n"
"        return result;\n"
"      } catch (e) {\n"
"        hostCall(OP_TX_ROLLBACK, { txId: txId });\n"
"        throw e;\n"
"      }\n"
"    }\n"
"  };\n"
"\n"
"  // Hook 注册存储\n"
"  globalThis.__pb_hooks = {};\n"
"\n"
"  // Hook 注册函数\n"
"  pb.onRecordBeforeCreate = function(col, handler) {\n"
"    globalThis.__pb_hooks['beforeCreate:' + col] = handler;\n"
"  };\n"
"  pb.onRecordAfterCreate = function(col, handler) {\n"
"    globalThis.__pb_hooks['afterCreate:' + col] = handler;\n"
"  };\n"
"  pb.onRecordBeforeUpdate = function(col, handler) {\n"
"    globalThis.__pb_hooks['beforeUpdate:' + col] = handler;\n"
"  };\n"
"  pb.onRecordAfterUpdate = function(col, handler) {\n"
"    globalThis.__pb_hooks['afterUpdate:' + col] = handler;\n"
"  };\n"
"  pb.onRecordBeforeDelete = function(col, handler) {\n"
"    globalThis.__pb_hooks['beforeDelete:' + col] = handler;\n"
"  };\n"
"  pb.onRecordAfterDelete = function(col, handler) {\n"
"    globalThis.__pb_hooks['afterDelete:' + col] = handler;\n"
"  };\n"
"\n"
"  // Cron 注册\n"
"  globalThis.__pb_crons = {};\n"
"  pb.cron = function(name, schedule, handler) {\n"
"    globalThis.__pb_crons[name] = { schedule: schedule, handler: handler };\n"
"  };\n"
"})();\n";

// ============================================================================
// 导出函数 (供 Go 调用)
// ============================================================================

/**
 * init_runtime - 初始化 QuickJS 运行时
 *
 * 返回: 0 成功, -1 失败
 */
__attribute__((export_name("init_runtime")))
int init_runtime(void)
{
    if (g_initialized) {
        return 0;  // 已初始化
    }

    // 创建运行时
    g_runtime = JS_NewRuntime();
    if (!g_runtime) {
        return -1;
    }

    // 设置内存限制 (128MB)
    JS_SetMemoryLimit(g_runtime, 128 * 1024 * 1024);

    // 创建上下文
    g_context = JS_NewContext(g_runtime);
    if (!g_context) {
        JS_FreeRuntime(g_runtime);
        g_runtime = NULL;
        return -1;
    }

    // 初始化 PocketBase 桥接层
    pb_bridge_init(g_context);

    // 预加载 PocketBase SDK
    JSValue result = JS_Eval(g_context, PB_SDK_PRELOAD, strlen(PB_SDK_PRELOAD),
                             "<pb_sdk>", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(result)) {
        JS_FreeValue(g_context, result);
        JS_FreeContext(g_context);
        JS_FreeRuntime(g_runtime);
        g_context = NULL;
        g_runtime = NULL;
        return -1;
    }
    JS_FreeValue(g_context, result);

    g_initialized = 1;
    return 0;
}

/**
 * run_handler - 执行 JS 代码
 *
 * source_ptr: JS 源码指针
 * source_len: 源码长度
 *
 * 返回: 0 成功, -1 失败
 * 结果通过 get_response_ptr/get_response_len 获取
 */
__attribute__((export_name("run_handler")))
int run_handler(unsigned int source_ptr, unsigned int source_len)
{
    if (!g_initialized) {
        if (init_runtime() != 0) {
            return -1;
        }
    }

    const char *source = (const char *)(uintptr_t)source_ptr;
    if (!source || source_len == 0) {
        return -1;
    }

    // 执行 JS 代码
    JSValue result = JS_Eval(g_context, source, source_len,
                             "<user_code>", JS_EVAL_TYPE_GLOBAL);

    // 处理结果
    if (JS_IsException(result)) {
        // 获取异常信息
        JSValue exception = JS_GetException(g_context);
        const char *err_msg = JS_ToCString(g_context, exception);
        
        // 构建错误响应
        int len = snprintf(g_result_buffer, sizeof(g_result_buffer),
                          "{\"error\":\"%s\"}", err_msg ? err_msg : "unknown error");
        g_result_len = (unsigned int)len;

        if (err_msg) {
            JS_FreeCString(g_context, err_msg);
        }
        JS_FreeValue(g_context, exception);
        JS_FreeValue(g_context, result);
        return -1;
    }

    // 序列化结果
    if (JS_IsUndefined(result)) {
        strcpy(g_result_buffer, "{\"data\":null}");
        g_result_len = strlen(g_result_buffer);
    } else if (JS_IsNull(result)) {
        strcpy(g_result_buffer, "{\"data\":null}");
        g_result_len = strlen(g_result_buffer);
    } else {
        // 尝试 JSON 序列化
        JSValue json_str = JS_JSONStringify(g_context, result, JS_UNDEFINED, JS_UNDEFINED);
        if (JS_IsException(json_str)) {
            // 回退到 toString
            const char *str = JS_ToCString(g_context, result);
            int len = snprintf(g_result_buffer, sizeof(g_result_buffer),
                              "{\"data\":\"%s\"}", str ? str : "");
            g_result_len = (unsigned int)len;
            if (str) {
                JS_FreeCString(g_context, str);
            }
        } else {
            const char *json = JS_ToCString(g_context, json_str);
            int len = snprintf(g_result_buffer, sizeof(g_result_buffer),
                              "{\"data\":%s}", json ? json : "null");
            g_result_len = (unsigned int)len;
            if (json) {
                JS_FreeCString(g_context, json);
            }
        }
        JS_FreeValue(g_context, json_str);
    }

    JS_FreeValue(g_context, result);

    // 执行待处理的 Promise/Job
    JSContext *ctx1;
    int err;
    while ((err = JS_ExecutePendingJob(g_runtime, &ctx1)) > 0) {
        // 继续执行
    }

    return 0;
}

/**
 * get_response_ptr - 获取响应缓冲区指针
 */
__attribute__((export_name("get_response_ptr")))
unsigned int get_response_ptr(void)
{
    return (unsigned int)(uintptr_t)g_result_buffer;
}

/**
 * get_response_len - 获取响应长度
 */
__attribute__((export_name("get_response_len")))
unsigned int get_response_len(void)
{
    return g_result_len;
}

/**
 * reset_runtime - 重置运行时状态（用于实例池复用）
 */
__attribute__((export_name("reset_runtime")))
void reset_runtime(void)
{
    // 清理全局状态
    g_result_len = 0;
    g_result_buffer[0] = '\0';

    // 注意：完整重置需要重新创建 context
    // 这里只做简单清理，完整重置由实例池管理
}

/**
 * main - WASM 入口点（保持实例存活）
 */
int main(void)
{
    // 初始化运行时
    init_runtime();
    return 0;
}
