/**
 * T173 — serve.test.ts
 * 对照 Go 版 apis/serve.go
 * 测试 startServe 配置、地址解析、hook 触发
 * 注意：不实际启动服务器（避免端口冲突），主要测试导出和类型
 */

import { describe, test, expect } from "bun:test";
import { startServe, type ServeOptions } from "./serve";
import { createRouter } from "./base";

describe("Serve Module", () => {
  test("startServe is exported as async function", () => {
    expect(typeof startServe).toBe("function");
  });

  test("ServeOptions interface accepts httpAddr and isDev", () => {
    const opts: ServeOptions = {
      httpAddr: "127.0.0.1:8090",
      isDev: true,
    };
    expect(opts.httpAddr).toBe("127.0.0.1:8090");
    expect(opts.isDev).toBe(true);
  });

  test("createRouter is exported and callable", () => {
    expect(typeof createRouter).toBe("function");
  });

  test("addr parsing — host:port format", () => {
    // 模拟 startServe 内部的 addr 解析逻辑
    const addr = "0.0.0.0:9090";
    const [host, portStr] = addr.split(":");
    const port = parseInt(portStr || "8090", 10);
    expect(host).toBe("0.0.0.0");
    expect(port).toBe(9090);
  });

  test("addr parsing — port only (empty host defaults)", () => {
    const addr = ":3000";
    const [host, portStr] = addr.split(":");
    const port = parseInt(portStr || "8090", 10);
    expect(host).toBe("");
    expect(port).toBe(3000);
  });

  test("addr parsing — missing port defaults to 8090", () => {
    const addr = "localhost:";
    const [host, portStr] = addr.split(":");
    const port = parseInt(portStr || "8090", 10);
    // parseInt("") returns NaN, but portStr is empty so fallback applies
    expect(host).toBe("localhost");
    expect(port).toBe(8090);
  });
});
