/**
 * E2E 测试配置
 * 
 * 支持通过环境变量配置测试 URL，用于 SQLite 和 PostgreSQL 双数据库测试
 */

// 测试 URL - 支持环境变量覆盖
export const TEST_URL = process.env.TEST_URL || "http://127.0.0.1:8090";

// 无效 URL 用于错误测试
export const INVALID_URL = "http://127.0.0.1:9999";

// 测试账号
export const TEST_CREDENTIALS = {
  email: "test@test.com",
  password: "test123456",
};

// 获取当前数据库类型标识 (用于日志)
export function getDbType(): string {
  const url = TEST_URL;
  // 默认 8090 是 SQLite, 8091 是 PostgreSQL (按脚本约定)
  if (url.includes(":8091")) {
    return "PostgreSQL";
  }
  return "SQLite";
}

// 打印测试环境信息
export function logTestEnv(): void {
  if (process.env.TEST_URL) {
    console.log(`\n🔧 Test Environment: ${getDbType()} (${TEST_URL})\n`);
  }
}
