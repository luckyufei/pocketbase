/**
 * Bun.js 构建脚本
 * 用于替代 Rollup 进行 SDK 打包
 */

import { $ } from "bun";
import dts from "bun-plugin-dts";

const isProduction = process.env.NODE_ENV === "production" || !process.env.BUN_WATCH;

// 清理 dist 目录
await $`rm -rf dist`;

console.log("🚀 Building PocketBase JS SDK with Bun...\n");

// ES Module 构建 (.mjs)
console.log("📦 Building ES Module (.mjs)...");
await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    naming: "pocketbase.es.mjs",
    format: "esm",
    target: "browser",
    sourcemap: isProduction ? "external" : "none",
    minify: isProduction,
    plugins: [dts()],
});

// ES Module 构建 (.js) - React Native 兼容
console.log("📦 Building ES Module (.js) for React Native...");
await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    naming: "pocketbase.es.js",
    format: "esm",
    target: "browser",
    sourcemap: isProduction ? "external" : "none",
    minify: isProduction,
});

// CommonJS 构建
console.log("📦 Building CommonJS...");
await Bun.build({
    entrypoints: ["./src/Client.ts"],
    outdir: "./dist",
    naming: "pocketbase.cjs.js",
    format: "cjs",
    target: "browser",
    sourcemap: isProduction ? "external" : "none",
    minify: isProduction,
});

// IIFE 构建 (用于浏览器直接引用，替代 UMD)
console.log("📦 Building IIFE for browser...");
await Bun.build({
    entrypoints: ["./src/Client.ts"],
    outdir: "./dist",
    naming: "pocketbase.iife.js",
    format: "iife",
    target: "browser",
    sourcemap: isProduction ? "external" : "none",
    minify: isProduction,
});

// 复制 IIFE 作为 UMD 的替代（保持向后兼容）
await $`cp dist/pocketbase.iife.js dist/pocketbase.umd.js`;
if (isProduction) {
    await $`cp dist/pocketbase.iife.js.map dist/pocketbase.umd.js.map 2>/dev/null || true`;
}

// 重命名类型声明文件
await $`mv dist/index.d.ts dist/pocketbase.es.d.mts 2>/dev/null || true`;

console.log("\n✅ Build completed successfully!");
console.log("📁 Output files:");
await $`ls -la dist/`;
