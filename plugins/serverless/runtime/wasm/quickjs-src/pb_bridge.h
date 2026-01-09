/**
 * pb_bridge.h - PocketBase JS Bindings 头文件
 */

#ifndef PB_BRIDGE_H
#define PB_BRIDGE_H

#include "quickjs.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * pb_bridge_init - 初始化 PocketBase 桥接层
 *
 * 注册全局对象和函数到 JS 上下文：
 *   - globalThis.__pb_op(op, payload) - 内部 Host Function 调用
 *   - console.log/warn/error - 日志输出
 */
void pb_bridge_init(JSContext *ctx);

/**
 * pb_bridge_set_response - 设置响应内容（供 Go 调用）
 */
void pb_bridge_set_response(const char *response, unsigned int len);

/**
 * pb_bridge_get_response_ptr - 获取响应缓冲区指针
 */
unsigned int pb_bridge_get_response_ptr(void);

/**
 * pb_bridge_get_response_len - 获取响应长度
 */
unsigned int pb_bridge_get_response_len(void);

#ifdef __cplusplus
}
#endif

#endif /* PB_BRIDGE_H */
