#!/usr/bin/env node
/**
 * 简单 Node.js 脚本 - 用于测试基础进程管理
 * 输出到 stdout/stderr，运行一段时间后正常退出
 */

console.log(`[Node] PID: ${process.pid}`);
console.log(`[Node] Args: ${process.argv.slice(2).join(', ')}`);
console.log(`[Node] CWD: ${process.cwd()}`);

// 检查环境变量
const testEnv = process.env.TEST_ENV_VAR || 'not_set';
console.log(`[Node] TEST_ENV_VAR: ${testEnv}`);

// 输出到 stderr
console.error('[Node] This is stderr output');

// 模拟工作
const duration = parseInt(process.env.RUN_DURATION || '5', 10);
console.log(`[Node] Running for ${duration} seconds...`);

let tick = 0;
const interval = setInterval(() => {
    tick++;
    console.log(`[Node] Tick ${tick}/${duration}`);
    
    if (tick >= duration) {
        clearInterval(interval);
        console.log('[Node] Script completed successfully');
        process.exit(0);
    }
}, 1000);

// 处理信号
process.on('SIGTERM', () => {
    console.log('[Node] Received SIGTERM');
    clearInterval(interval);
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[Node] Received SIGINT');
    clearInterval(interval);
    process.exit(0);
});
