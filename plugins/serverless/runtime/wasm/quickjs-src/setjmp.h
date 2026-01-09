/**
 * setjmp.h - WASI 兼容的 setjmp/longjmp 空实现
 *
 * dtoa.c 包含了 setjmp.h 但实际不使用 setjmp/longjmp
 * 这个文件提供空定义来避免 WASI 编译错误
 */

#ifndef _SETJMP_H
#define _SETJMP_H

typedef int jmp_buf[1];

static inline int setjmp(jmp_buf env) {
    (void)env;
    return 0;
}

static inline void longjmp(jmp_buf env, int val) {
    (void)env;
    (void)val;
    // 在 WASI 环境中不应该被调用
    __builtin_trap();
}

#endif // _SETJMP_H
