/**
 * Test setup for bun:test
 * This file is preloaded before all tests
 */

// React 环境模拟
import { expect } from "bun:test";

// 全局测试超时设置
// @ts-ignore
globalThis.testTimeout = 5000;

// 模拟终端环境
process.env.TERM = "xterm-256color";
process.env.FORCE_COLOR = "1";
